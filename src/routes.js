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

    let sessionCookieName = 'connect.sid';
    let postLoginPage = '/demo/web/dashboard';
    let redirectUri = `${process.env.DEMO_BASEURL_EXTERNAL}${postLoginPage}`;
    let layoutTemplate = fs.readFileSync(process.env.DEMO_ROOT + 'src/views/layout.html', 'utf8');
    let singPassClient = new SingPassClient({ redirectUri: redirectUri });
    let corpPassClient = new CorpPassClient({ redirectUri: redirectUri });
    let myInfoPersonalClient = new MyInfoPersonalClient();
    let myInfoPersonalRequestedAttributes = ['name', 'email', 'mobileno'];
    let myInfoBusinessClient = new MyInfoBusinessClient({
        useDemoDefaults: true,
    });
    let myInfoBusinessRequestedAttributes = ['basic-profile', 'uinfin', 'name', 'email', 'mobileno'];

    // The very 1st middleware
    router.use((req, res, next) => {
        // Generate unique request ID for each request, store in header and use for security nonce
        let requestId = Date.now() + '-' + helper.getUuid();
        req.headers['X-REQUEST-ID'] = requestId;

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
    router.get('/demo/web/login', async (req, res, next) => {
        let html = helper.render(req, layoutTemplate, {
            is_login: true,
            singpass_redirect_url: await singPassClient.customCreateAuthUrl(req),
            corppass_redirect_url: await corpPassClient.customCreateAuthUrl(req),
            myinfo_personal_redirect_url: myInfoPersonalClient.customCreateRedirectUrl(req, {
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
    router.get('/demo/web/dashboard', async (req, res, next) => {
        // The redirect URI for the SingPass/CorpPass login will come to here, so it's here where
        // we will receive the auth code from MockPass server
        let code = req.query.code;
        let state = req.query.state;
        if (code && state) { // data passed back from logging in on MockPass website
            let tokenResponse = null;
            let idTokenPayload = null;
            let userInfo = null;

            if (state.startsWith('singpass')) { // state set in client
                try {
                    tokenResponse = await singPassClient.getTokens(code);
                    idTokenPayload = await singPassClient.getIdTokenPayload(tokenResponse);
                    userInfo = await singPassClient.extractNricAndUuidFromPayload(idTokenPayload);

                    req.user = userInfo;
                    helper.logInfo(req, 'User authenticated with SingPass', req.user, idTokenPayload);
                } catch (err) {
                    helper.logError(
                        req,
                        'Error with SingPass authentication',
                        err,
                        { tokenResponse, idTokenPayload, userInfo }
                    );
                }
            } else if (state.startsWith('corppass')) {
                try {
                    tokenResponse = await corpPassClient.getTokens(code);
                    idTokenPayload = await corpPassClient.getIdTokenPayload(tokenResponse);
                    userInfo = await corpPassClient.extractInfoFromIdTokenSubject(idTokenPayload);

                    // Interestingly, the idTokenPayload for CorpPass contains userInfo and entityInfo, hence using it
                    req.user = Object.assign(userInfo, {
                        name: idTokenPayload.userInfo.CPUID_FullName,
                        uen: idTokenPayload.entityInfo.CPEntID,
                    });
                    helper.logInfo(req, 'User authenticated with CorpPass', req.user, idTokenPayload);
                } catch (err) {
                    helper.logError(
                        req,
                        'Error with CorpPass authentication',
                        err,
                        { tokenResponse, idTokenPayload, userInfo }
                    );
                }
            }
        }

        let html = helper.render(req, layoutTemplate);
        res.status(200).send(html);
    });

    // Full URL for this route is the value for DEMO_MYINFO_PERSONAL_ASSERT_ENDPOINT env var in .env
    // MyInfo would eventually pass control back by GET-ing a pre-agreed endpoint, proceed to obtain the user's
    // identity using out-of-band (OOB) authentication
    router.use('/demo/api/myinfo-personal/assert', async (req, res, next) => {
        // req.query = {
        //     code: '70ad6940-2e8e-11ed-bd49-abebb0a8526f',
        //     state: 'myInfoPersonalRelayState',
        //     scope: 'name email mobileno',
        //     client_id: 'clientId',
        //     iss: 'http://localhost:5156/consent/oauth2/consent/myinfo-com'
        // }
        let code = req.query.code;
        helper.logInfo(req, req.originalUrl, req.query);

        let accessToken = '';
        let result = null;
        try {
            accessToken = await myInfoPersonalClient.getAccessToken(code);
        } catch (err) {
            helper.logError(req, 'accessToken', err);
            accessToken = '';
        }

        try {
            result = await myInfoPersonalClient.getPerson(accessToken, myInfoPersonalRequestedAttributes);
            helper.logInfo(req, 'User authenticated with MyInfo Personal', JSON.stringify(result));
        } catch (err) {
            helper.logError(req, 'getPerson', err);
            result = null;
        }

        let nric = '';
        let myinfo = null;
        if (result?.data) {
            nric = result.uinFin;
            myinfo = {};
            Object.keys(result.data).forEach((attribute) => {
                myinfo[attribute] = result.data[attribute].value;

                if ('mobileno' === attribute) {
                    myinfo[attribute] = (result.data[attribute].prefix?.value || '')
                        + (result.data[attribute].areacode?.value || '')
                        + (result.data[attribute].nbr?.value || '');
                }
            });
        }

        let html = helper.render(req, layoutTemplate, {
            user: {
                nric: nric,
                myinfo: myinfo,
            },
        });

        res.status(200).send(html);
    });

    // Full URL for this route is the value for DEMO_MYINFO_BUSINESS_ASSERT_ENDPOINT env var in .env
    // Full URL must be http://localhost:3001/callback else will not work with MyInfo Business online test server
    // (cos local MockPass does not support it yet), see MYINFO_APP_REDIRECT_URL env var in
    // https://github.com/singpass/myinfobiz-demo-app/blob/master/start.sh for more info.
    router.use('/callback', async (req, res, next) => { // ideally this would be /demo/api/myinfo-business/assert
        // req.query = {
        //     code: '78e0ab02f59464dfaa6b2ec052a66d5b499906a6',
        //     state: 'myInfoBusinessRelayState'
        // }
        let code = req.query.code;
        helper.logInfo(req, req.originalUrl, req.query);

        let accessToken = '';
        let result = null;
        try {
            accessToken = await myInfoBusinessClient.getAccessToken(code);
        } catch (err) {
            helper.logError(req, 'accessToken', err);
            accessToken = '';
        }

        try {
            result = await myInfoBusinessClient.getEntityPerson(accessToken, myInfoBusinessRequestedAttributes);
        } catch (err) {
            helper.logError(req, 'getEntityPerson', err);
            result = null;
        }

        let nric = '';
        let name = '';
        let uen = '';
        let myinfo = null;
        if (result) {
            nric = result?.person?.uinfin?.value;
            name = result?.person?.name?.value;
            uen = result?.entity?.['basic-profile']?.uen?.value;

            myinfo = {};
            Object.keys(result?.person).forEach((attribute) => {
                if ('uinfin' === attribute) {
                    return;
                }

                if ('mobileno' === attribute) {
                    myinfo[attribute] = (result.person[attribute]?.prefix?.value || '')
                        + (result.person[attribute]?.areacode?.value || '')
                        + (result.person[attribute]?.nbr?.value || '');
                } else {
                    myinfo[attribute] = result.person[attribute].value;
                }
            });
        }

        let html = helper.render(req, layoutTemplate, {
            user: {
                nric: nric,
                name: name,
                uen: uen,
                myinfo: myinfo,
            },
        });

        res.status(200).send(html);
    });

    // Healthcheck
    router.get('/healthcheck', (req, res, next) => { // no prefix
        res.status(200).send('Hello World!');
    });

    // Home Page - go to Login Page if user visits root
    router.get('/', (req, res, next) => {
        res.redirect('/demo/web/login');
    });

    return router;
})();
