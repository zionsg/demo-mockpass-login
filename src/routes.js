// Import modules
const CorpPassClient = require(process.env.DEMO_ROOT + 'src/client/CorpPassClient.js');
const MyInfoBusinessClient = require(process.env.DEMO_ROOT + 'src/client/MyInfoBusinessClient.js');
const MyInfoPersonalClient = require(process.env.DEMO_ROOT + 'src/client/MyInfoPersonalClient.js');
const SingPassClient = require(process.env.DEMO_ROOT + 'src/client/SingPassClient.js');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const helper = require(process.env.DEMO_ROOT + 'src/helper.js');

/**
 * Routes for entire application
 *
 * Adapted from sample code at https://github.com/opengovsg/spcp-auth-client and https://github.com/opengovsg/mockpass
 *
 * @returns {function(express.Router): void}
 */
module.exports = (function () {
    const router = express.Router();

    let postLoginPage = '/demo/dashboard';
    let layoutTemplate = fs.readFileSync(process.env.DEMO_ROOT + 'src/views/layout.html', 'utf8');
    let singPassClient = new SingPassClient();
    let corpPassClient = new CorpPassClient();
    let myInfoPersonalClient = new MyInfoPersonalClient();
    let myInfoPersonalRequestedAttributes = ['name', 'email', 'mobileno'];
    let myInfoBusinessClient = new MyInfoBusinessClient({ useDemoDefaults: true });
    let myInfoBusinessRequestedAttributes = ['basic-profile', 'uinfin', 'name', 'email', 'mobileno'];

    // Verify if session has been authenticated with our JWT
    let isAuthenticated = function (req, res, next) {
        // data = <whatever was put in the JWT>
        singPassClient.verifyJWT(req.cookies?.['connect.sid'], (err, data) => {
            if (err) {
                res.status(400).send('Unauthorized');
            } else {
                req.user = {
                    uen: data.uen,
                    username: data.username,
                };
                next();
            }
        });
    };

    // The very 1st middleware
    router.use((req, res, next) => {
        // Generate unique request ID for each request, store in header and use for security nonce
        let requestId = Date.now() + '-' + helper.getUuid();
        req.headers['X-REQUEST-ID'] = requestId;

        // Set HTTP security headers
        // See https://stg-id.singpass.gov.sg/docs/embedded-auth/js#_content_security_policy_csp_requirements
        // Need to put nonce in script tags else inline scripts will not load, e.g. <script nonce="{{nonce}}">,
        // same for style tags, e.g. <style nonce="{{nonce}}">.
        res.set('strict-transport-security', 'max-age=63072000; includeSubdomains; preload');
        res.set(
            'content-security-policy',
            "default-src 'none'; "
            + "connect-src 'self' https://*.singpass.gov.sg; " // "self" allows AJAX request to self
            // img-src allows self-hosted images, "data:" URIs and SVG
            + "img-src 'self' data: w3.org/svg/2000 https://*.singpass.gov.sg; "
            + "object-src 'none'; "
            // allow inline scripts using nonce - note that if nonce is "abc", value for script-src is "nonce-abc"
            // but script tag would be <script nonce="abc"> not <script nonce="nonce-abc">
            + `script-src 'self' 'nonce-${requestId}' https://*.singpass.gov.sg; `
            // allow Google Fonts to load and inline stylesheets using nonce - note that if nonce is "abc", value for
            // style-src is "nonce-abc" but style tag would be <style nonce="abc"> not <style nonce="nonce-abc">
            + `style-src 'self' 'nonce-${requestId}' fonts.googleapis.com https://*.singpass.gov.sg; `
            // allow self-hosted fonts and Google Fonts to load
            + "font-src 'self' fonts.gstatic.com; "
            + "form-action 'self'; "
            + "frame-ancestors 'none'; "
        );
        res.set('x-content-type-options', 'nosniff');
        res.set('x-frame-options', 'DENY');
        res.set('x-xss-protection', '1; mode=block');

        next();
    });

    // For parsing body
    let limit = '2MB'; // if too low, will have 413 Payload Too Large error, default value in Express is "100kb"
    router.use('/', express.json({ limit: limit })); // application/json
    router.use('/', express.urlencoded({ // application/x-www-form-urlencoded
        extended: true,
        limit: limit,
        // If the no. of files that a user uploads via a form is more than parameterLimit, 413 Payload Too Large error
        // may occur depending on how the multipart/form-data splits the files (e.g. uploading 2000 small files with
        // default parameterLimit of 1000 may not trigger error but uploading 5000 large files probably would).
        // See https://stackoverflow.com/a/36514330 for more info
        parameterLimit: 1000, // default value in Express is 1000
    }));

    // CORS middleware must be set after body parsing middleware
    router.use('/', cors({
        origin: true,
        methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
        credentials: true,
        optionsSuccessStatus: 200,
    }));

    // Needed for request.cookies to work
    router.use(cookieParser());

    // Serve static assets in public folder such as CSS, JS and images, e.g.
    // <script src="/public/js/test.js"> will be served from public/js/test.js.
    router.use('/public', express.static(process.env.DEMO_ROOT + 'public'));

    // Login Page - if a user is logging in, redirect to SingPass/CorpPass
    router.get('/demo/login', (req, res, next) => {
        let html = helper.render(req, layoutTemplate, {
            is_login: true,
            singpass_redirect_url: singPassClient.createRedirectURL(postLoginPage),
            corppass_redirect_url: corpPassClient.createRedirectURL(postLoginPage),
            myinfo_personal_redirect_url: myInfoPersonalClient.createRedirectURL({
                purpose: 'Personal Info for Demo MockPass Login application',
                requestedAttributes: myInfoPersonalRequestedAttributes,
                relayState: 'myInfoPersonalRelayState',
            }),
            myinfo_business_redirect_url: myInfoBusinessClient.createRedirectUrl({
                purpose: 'Business Info for Demo MockPass Login application',
                requestedAttributes: myInfoBusinessRequestedAttributes,
                relayState: 'myInfoBusinessRelayState',
            }),
        });

        res.status(200).send(html);
    });

    // Dashboard Page
    router.get('/demo/dashboard', isAuthenticated, (req, res, next) => {
        let html = helper.render(req, layoutTemplate);
        res.status(200).send(html);
    });

    // Full URL for this route is the value for SINGPASS_ASSERT_ENDPOINT env var in MockPass
    // SingPass would eventually pass control back by GET-ing a pre-agreed endpoint, proceed to obtain the user's
    // identity using out-of-band (OOB) authentication
    router.use('/demo/singpass/assert', (req, res, next) => {
        // req.query = { SAMLart: '', RelayState: '<postLoginPage>' }
        let samlArt = req.query.SAMLart;
        let relayState = req.query.RelayState;
        let cookieOptions = { httpOnly: true };

        // data = { attributes: { UserName: '<NRIC of user>', relayState: '<postLoginPage>' }
        singPassClient.getAttributes(samlArt, relayState, (err, data) => {
            if (err) {
                // Indicate through cookies or headers that an error has occurred
                console.error(err);
                res.cookie('login.error', err.message, cookieOptions);
            } else {
                // If all is well and login occurs, the attributes are given
                // In all cases, the relayState as provided in getAttributes() is given
                // For SingPass, a username will be given
                let relayState = data.relayState;
                let attributes = data.attributes;
                let username = attributes.UserName;

                // Embed a session cookie or pass back some Authorization bearer token
                let jwt = singPassClient.createJWT(
                    {
                        is_singpass: true,
                        username: username,
                    },
                    4 * 60 * 60 * 1000
                );
                res.cookie('connect.sid', jwt, cookieOptions);
            }

            res.redirect(relayState);
        });
    });

    // Full URL for this route is the value for CORPPASS_ASSERT_ENDPOINT env var in MockPass
    // CorpPass would eventually pass control back by GET-ing a pre-agreed endpoint, proceed to obtain the user's
    // identity using out-of-band (OOB) authentication
    router.use('/demo/corppass/assert', (req, res, next) => {
        // req.query = { SAMLart: '', RelayState: '<postLoginPage>' }
        let samlArt = req.query.SAMLart;
        let relayState = req.query.RelayState;
        let cookieOptions = { httpOnly: true };

        // data = { attributes: { '<UEN of organization>': '<Base64 encoded XML info>', relayState: '<postLoginPage>' }
        corpPassClient.getAttributes(samlArt, relayState, async (err, data) => {
            if (err) {
                // Indicate through cookies or headers that an error has occurred
                console.error(err);
                res.cookie('login.error', err.message, cookieOptions);
            } else {
                let relayState = data.relayState;
                let attributes = data.attributes;
                let uen = Object.keys(attributes)?.[0];
                let info = await helper.xmlToJson(attributes[uen], true);
                let username = info?.UserInfo?.CPUID?.[0];

                // Embed a session cookie or pass back some Authorization bearer token
                let jwt = corpPassClient.createJWT(
                    {
                        is_corppass: true,
                        uen: uen,
                        username: username,
                    },
                    4 * 60 * 60 * 1000
                );
                res.cookie('connect.sid', jwt, cookieOptions);
            }

            res.redirect(relayState);
        });
    });

    // Full URL for this route is the value for DEMO_MYINFO_PERSONAL_ASSERT_ENDPOINT env var in .env
    // MyInfo would eventually pass control back by GET-ing a pre-agreed endpoint, proceed to obtain the user's
    // identity using out-of-band (OOB) authentication
    router.use('/demo/myinfo-personal/assert', async (req, res, next) => {
        // req.query = {
        //     code: '70ad6940-2e8e-11ed-bd49-abebb0a8526f',
        //     state: 'myInfoPersonalRelayState',
        //     scope: 'name email mobileno',
        //     client_id: 'clientId',
        //     iss: 'http://localhost:5156/consent/oauth2/consent/myinfo-com'
        // }
        let code = req.query.code;

        let accessToken = '';
        let result = null;
        try {
            accessToken = await myInfoPersonalClient.getAccessToken(code);
        } catch (err) {
            console.error('accessToken', err);
            accessToken = '';
        }

        try {
            // @todo See https://github.com/opengovsg/mockpass/issues/430
            // This throws "Signature verification failed" error cos getPerson() computes the
            // signature with sp_esvcId query param in the url while pki() in
            // https://github.com/opengovsg/mockpass/blob/master/lib/crypto/myinfo-signature.js
            // omits the sp_esvcId query param when returning baseString for /person endpoint,
            // causing verify() in
            // https://github.com/opengovsg/mockpass/blob/master/lib/express/myinfo/controllers.js
            // to use the wrong baseString when computing the signature
            result = await myInfoPersonalClient.getPerson(accessToken, myInfoPersonalRequestedAttributes);
        } catch (err) {
            console.error('getPerson', err);
            result = null;
        }

        let username = '';
        let info = null;
        if (result?.data) {
            username = result.uinFin;
            info = {};
            Object.keys(result.data).forEach((attribute) => {
                info[attribute] = result.data[attribute].value;
            });
        }

        let html = helper.render(req, layoutTemplate, {
            user: {
                username: username,
                info: info,
            },
        });

        res.status(200).send(html);
    });

    // Full URL for this route is the value for DEMO_MYINFO_BUSINESS_ASSERT_ENDPOINT env var in .env
    // Full URL must be http://localhost:3001/callback else will not work with MyInfo Business online test server
    // (cos local MockPass does not support it yet), see
    // https://github.com/singpass/myinfobiz-demo-app/blob/master/start.bat for more info.
    router.use('/callback', async (req, res, next) => {
        // req.query = {
        //     code: '78e0ab02f59464dfaa6b2ec052a66d5b499906a6',
        //     state: 'myInfoBusinessRelayState'
        // }
        let code = req.query.code;

        let accessToken = '';
        let result = null;
        try {
            accessToken = await myInfoBusinessClient.getAccessToken(code);
        } catch (err) {
            console.error('accessToken', err);
            accessToken = '';
        }

        try {
            result = await myInfoBusinessClient.getEntityPerson(accessToken, myInfoBusinessRequestedAttributes);
        } catch (err) {
            console.error('getEntityPerson', err);
            result = null;
        }

        let uen = '';
        let username = '';
        let info = null;
        if (result) {
            uen = result?.entity?.['basic-profile']?.uen?.value;
            username = result?.person?.uinfin?.value;
            info = {};
            Object.keys(result?.person).forEach((attribute) => {
                if ('uinfin' === attribute) {
                    return;
                }

                if ('mobileno' === attribute) {
                    info[attribute] = (result.person[attribute]?.prefix?.value || '')
                        + (result.person[attribute]?.areacode?.value || '')
                        + (result.person[attribute]?.nbr?.value || '');
                } else {
                    info[attribute] = result.person[attribute].value;
                }

            });
        }

        let html = helper.render(req, layoutTemplate, {
            user: {
                uen: uen,
                username: username,
                info: info,
            },
        });

        res.status(200).send(html);
    });

    // Healthcheck
    router.get('/healthcheck', (req, res, next) => {
        res.status(200).send('Hello World!');
    });

    // Home Page - go to Login Page if user visits root
    router.get('/', (req, res, next) => {
        res.redirect('/demo/login');
    });

    return router;
})();
