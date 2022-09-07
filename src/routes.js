// Import modules
const SPCPAuthClient = require('@opengovsg/spcp-auth-client');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const helper = require(process.env.DEMO_ROOT + 'src/helper.js');
const path = require('path');

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

    // Init auth client for SingPass/CorpPass
    // idpLoginURL and idpEndpoint as per https://github.com/opengovsg/mockpass
    let certPath = process.env.DEMO_ROOT + 'node_modules/@opengovsg/mockpass/static/certs/';
    let singpassClient = new SPCPAuthClient({
        partnerEntityId: 'partnerEntityId',
        idpLoginURL: `${process.env.DEMO_MOCKPASS_BROWSER_BASEURL}/singpass/logininitial`,
        idpEndpoint: `${process.env.DEMO_MOCKPASS_API_BASEURL}/singpass/soap`,
        esrvcID: 'esrvcID',
        appCert: fs.readFileSync(`${certPath}/key.pub`),
        appKey: fs.readFileSync(`${certPath}/key.pem`),
        appEncryptionKey: fs.readFileSync(`${certPath}/key.pem`),
        spcpCert: fs.readFileSync(`${certPath}/spcp.crt`),
    });
    let corppassClient = new SPCPAuthClient({
        partnerEntityId: 'partnerEntityId',
        idpLoginURL: `${process.env.DEMO_MOCKPASS_BROWSER_BASEURL}/corppass/logininitial`,
        idpEndpoint: `${process.env.DEMO_MOCKPASS_API_BASEURL}/corppass/soap`,
        esrvcID: 'esrvcID',
        appCert: fs.readFileSync(`${certPath}/key.pub`),
        appKey: fs.readFileSync(`${certPath}/key.pem`),
        appEncryptionKey: fs.readFileSync(`${certPath}/key.pem`),
        spcpCert: fs.readFileSync(`${certPath}/spcp.crt`),
    });

    // Verify if session has been authenticated with our JWT
    let isAuthenticated = function (req, res, next) {
        // data = <whatever was put in the JWT>
        singpassClient.verifyJWT(req.cookies?.['connect.sid'], (err, data) => {
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
    router.options('*', cors({ // include before other routes to enable CORS preflight
        optionsSuccessStatus: 200,
    }));
    router.use('/', cors({ // for Cross-origin Resource Sharing (CORS)
        origin: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
    }));

    // Needed for request.cookies to work
    router.use(cookieParser());

    // Serve static assets in public folder such as CSS, JS and images, e.g.
    // <script src="/public/js/test.js"> will be served from public/js/test.js.
    router.use('/public', express.static(path.join(process.env.DEMO_ROOT, 'public')));

    // Login Page - if a user is logging in, redirect to SingPass/CorpPass
    router.get('/demo/login', (req, res) => {
        let html = helper.render(req, layoutTemplate, {
            is_login: true,
            singpass_redirect_url: singpassClient.createRedirectURL(postLoginPage),
            corppass_redirect_url: corppassClient.createRedirectURL(postLoginPage),
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
    router.use('/demo/singpass/assert', (req, res) => {
        // req.query = { SAMLart: '', RelayState: '<postLoginPage>' }
        let samlArt = req.query.SAMLart;
        let relayState = req.query.RelayState;
        let cookieOptions = { httpOnly: true };

        // data = { attributes: { UserName: '<NRIC of user>', relayState: '<postLoginPage>' }
        singpassClient.getAttributes(samlArt, relayState, (err, data) => {
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
                let jwt = singpassClient.createJWT(
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
    router.use('/demo/corppass/assert', (req, res) => {
        // req.query = { SAMLart: '', RelayState: '<postLoginPage>' }
        let samlArt = req.query.SAMLart;
        let relayState = req.query.RelayState;
        let cookieOptions = { httpOnly: true };

        // data = { attributes: { '<UEN of organization>': '<Base64 encoded XML info>', relayState: '<postLoginPage>' }
        corppassClient.getAttributes(samlArt, relayState, async (err, data) => {
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
                let jwt = corppassClient.createJWT(
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

    // Healthcheck
    router.get('/healthcheck', (req, res) => {
        res.status(200).send('Hello World!');
    });

    // Home Page - go to Login Page if user visits root
    router.get('/', (req, res) => {
        res.redirect('/demo/login');
    });

    return router;
})();
