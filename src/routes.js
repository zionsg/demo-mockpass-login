// Import modules
const SPCPAuthClient = require('@opengovsg/spcp-auth-client');
const cookieParser = require('cookie-parser');
const express = require('express');
const fs = require('fs');
const path = require('path');

/**
 * Routes for entire application
 *
 * @returns {function(express.Router): void}
 */
module.exports = (function () {
    const router = express.Router();

    // Init auth client for SingPass/CorpPass
    // idpLoginURL and idpEndpoint as per https://github.com/opengovsg/mockpass
    let certPath = process.env.DEMO_ROOT + 'node_modules/@opengovsg/mockpass/static/certs/';
    let client = new SPCPAuthClient({
        partnerEntityId: 'partnerEntityId',
        idpLoginURL: `${process.env.DEMO_MOCKPASS_BROWSER_BASEURL}/singpass/logininitial`,
        idpEndpoint: `${process.env.DEMO_MOCKPASS_API_BASEURL}/singpass/soap`,
        esrvcID: 'esrvcID',
        appCert: fs.readFileSync(`${certPath}/key.pub`),
        appKey: fs.readFileSync(`${certPath}/key.pem`),
        appEncryptionKey: fs.readFileSync(`${certPath}/key.pem`),
        spcpCert: fs.readFileSync(`${certPath}/spcp.crt`),
    });

    // Verify if session has been authenticated with our JWT
    let isAuthenticated = function (req, res, next) {
        client.verifyJWT(req.cookies?.['connect.sid'], (err, data) => {
            if (err) {
                res.status(400).send('Unauthorized');
            } else {
                req.username = data.username;
                next();
            }
        });
    };

    // Needed for request.cookies to work
    router.use(cookieParser());

    // Healthcheck
    router.get('/healthcheck', (req, res) => {
        res.status(200).send('Hello World!');
    });

    // Serve static assets in public folder such as CSS, JS and images, e.g.
    // <script src="/public/js/test.js"> will be served from public/js/test.js.
    router.use('/public', express.static(path.join(process.env.DEMO_ROOT, 'public')));

    // Login Page - if a user is logging in, redirect to SingPass/CorpPass
    router.get('/demo/login', (req, res) => {
        let postLoginPage = '/demo/dashboard';
        let redirectUrl = client.createRedirectURL(postLoginPage);
        res.status(200).send(`
            <a href="${redirectUrl}">Login using SingPass</a>
        `);
    });

    // SingPass/CorpPass would eventually pass control back
    // by GET-ing a pre-agreed endpoint, proceed to obtain the user's
    // identity using out-of-band (OOB) authentication
    router.use('/demo/singpass/assert', (req, res) => { // full URL for this is value for SINGPASS_ASSERT_ENDPOINT in MockPass
        let samlArt = req.query.SAMLart;
        let relayState = req.query.RelayState;
        let cookieOptions = { httpOnly: true };

        client.getAttributes(samlArt, relayState, (err, data) => {
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
                let jwt = client.createJWT(
                    {
                        username: username,
                    },
                    4 * 60 * 60 * 1000
                );
                res.cookie('connect.sid', jwt, cookieOptions);
            }

            res.redirect(relayState);
        });
    });

    // Dashboard Page
    router.get('/demo/dashboard', isAuthenticated, (req, res, next) => {
        res.status(200).send(`Welcome Back, ${req.username}!`);
    });

    // Home Page - go to Login Page if user visits root
    router.get('/', (req, res) => {
        res.redirect('/demo/login');
    });

    return router;
})();
