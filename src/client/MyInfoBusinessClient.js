// Import modules
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');

/**
 * MyInfo Business client
 *
 * Adapted from https://github.com/opengovsg/myinfo-gov-client/blob/develop/src/MyInfoGovClient.class.ts
 * to use with MyInfo Business.
 *
 * @link https://api.singpass.gov.sg/library/myinfobiz/developers/overview
 * @link https://public.cloud.myinfo.gov.sg/myinfobiz/myinfo-biz-specs-v2.0.html#tag/MyInfo-Business
 * @param {object} config - Configuration. See `self.config` on parameters.
 * @returns {MyInfoBusinessClient}
 * @throws {Error} Throws if required configuration parameters are missing.
 */
module.exports = (function (config) {
    /**
     * @callback LoggerCallback
     * @param {string="error","info","debug"} severityLevel - Log severity level as per RFC 5424.
     * @param {string} message - Log message.
     * @param {(null|Error|object)} result - Error or result if any.
     * @returns {void}
     */

    /**
     * Self reference - all public properties/methods stored here & returned as public interface.
     *
     * @public
     * @type {object}
     * @property {object} config - Configuration.
     * @property {boolean} config.useDemoDefaults=false - Use demo default values without having to
     *     specify the other config params.
     * @property {string} config.clientId - Client ID provided by MyInfo, also known as App ID.
     * @property {string} config.clientSecret - Client secret provided by MyInfo.
     * @property {string} config.singpassEserviceId - The default e-service ID registered with
     *     SingPass.
     * @property {string} config.redirectEndpoint - Endpoint to which user should be redirected
     *     after login.
     * @property {string} config.clientPrivateKey - RSA-SHA256 private key, which must correspond
     *     with public key provided to MyInfo during the onboarding process.
     * @property {string} config.myInfoPublicKey - MyInfo server's public key for verifying
     *     their signature.
     * @property {string} config.myInfoApiBaseUrl - Base URL of My Info API without trailing slash,
     *     e.g. https://sandbox.api.myinfo.gov.sg/biz/v2.
     * @property {(null|LoggerCallback)} config.logger. Optional logging function which will be used
     *     to output log messages. Defaults to using console.log() if not specified, set to null
     *     to disable log messages.
     */
    const self = {
        config: Object.assign(
            {
                useDemoDefaults: false,
                clientId: '',
                clientSecret: '',
                singpassEserviceId: '',
                redirectEndpoint: '',
                clientPrivateKey: '',
                myInfoPublicKey: '',
                myInfoApiBaseUrl: '',
                logger: function (severityLevel, message, result) {
                    let stackLevel = 2;
                    let caller = ((new Error()).stack.split('at '))[stackLevel].trim();

                    console.log( // eslint-disable-line no-console
                        '[' + (new Date()).toISOString() + `] [${severityLevel.toString().toUpperCase()}] `
                        + `${caller} - ${message}`,
                        result
                    );
                },
            },
            config || {}
        ),
    };

    /** @type {string} Constants for log levels. */
    const LOG_DEBUG = 'debug';
    const LOG_ERROR = 'error';
    const LOG_INFO = 'info';

    /** @type {string} Constants for MyInfo endpoints. */
    const ENDPOINT_AUTHORISE = 'authorise';
    const ENDPOINT_ENTITY_PERSON = 'entity-person';
    const ENDPOINT_TOKEN = 'token';

    /**
     * Constructs a redirect URL which the user can visit to initialise SingPass login and consent
     * to providing the given MyInfo attributes
     *
     * @public
     * @param {object} options
     * @param {string} options.purpose - Purpose of requesting the data which will be shown to user.
     * @param {string[]} options.requestedAttributes - MyInfo attributes which the user must
     *     consent to provide.
     * @param {string} options.relayState - State to be forwarded to the redirect endpoint via query
     *     parameters.
     * @param {string} options.singpassEserviceId - Optional alternative SingPass e-service ID.
     *     Defaults to the e-serviceId provided in the config.
     * @param {string} options.redirectEndpoint - Optional alternative redirect endpoint.
     *     Defaults to the endpoint provided in the config.
     * @returns {string}
     */
    self.createRedirectUrl = function (options) {
        let queryParams = {
            purpose: options.purpose || '',
            attributes: (options.requestedAttributes || []).join(','),
            state: options.relayState || '',
            client_id: self.config.clientId,
            redirect_uri: options.redirectEndpoint || self.config.redirectEndpoint,
            sp_esvcId: options.singpassEserviceId || self.config.singpassEserviceId,
        };

        return `${self.config.myInfoApiBaseUrl}/${ENDPOINT_AUTHORISE}?` + generateQueryString(queryParams);
    };

    /**
     * Retrieves the access token from the Token endpoint
     *
     * @public
     * @param {string} authCode - Authorization code provided to the redirect endpoint.
     * @returns {string} The access token as a JWT (JSON Web Token).
     * @throws {Error} Throws if MyInfo returns a non-200 response.
     * @throws {Error} Throws if MyInfo response does not contain the access token.
     */
    self.getAccessToken = async function (authCode) {
        let postUrl = `${self.config.myInfoApiBaseUrl}/${ENDPOINT_TOKEN}`;
        let postParams = {
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: self.config.redirectEndpoint,
            client_id: self.config.clientId,
            client_secret: self.config.clientSecret,
        };
        let headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cache-Control': 'no-cache',
            'Authorization': generateAuthHeader('POST', postUrl, postParams),
        };

        let response = null;
        try {
            response = await sendHttpRequest(postUrl, 'POST', postParams, headers);
        } catch (err) {
            self.config.logger(LOG_ERROR, err.message, err);
            throw err;
        }

        if (!response?.data?.access_token || typeof response.data.access_token !== 'string') {
            let msg = 'Missing access token in response.';
            self.config.logger(LOG_ERROR, msg, response);
            throw new Error(msg);
        }

        return response.data.access_token;
    };

    /**
     * Generate content of Authorization header to be sent with a request to MyInfo
     *
     * @private
     * @param {string="GET","POST"} method - HTTP method to be used for the request.
     * @param {string} url - Endpoint to which the request is being sent.
     * @param {object} urlParams - Key-value pairs for query parameters being sent with the request.
     * @returns {string} The content which should be provided as the Authorization header.
     */
    function generateAuthHeader(method, url, urlParams) {
        let timestamp = Date.now().toString();
        let nonce = crypto.randomBytes(32).toString('base64');
        let authParams = Object.assign(
            urlParams || {},
            {
                signature_method: 'RS256',
                nonce: nonce,
                timestamp: timestamp,
                app_id: self.config.clientId,
            }
        );
        let paramString = generateQueryString(authParams, false);
        let baseString = `${method.toString().toUpperCase()}&${url.toString()}&${paramString}`;
        let signature = crypto
            .createSign('RSA-SHA256')
            .update(baseString)
            .sign(self.config.clientPrivateKey, 'base64');

        return `PKI_SIGN timestamp="${timestamp}",nonce="${nonce}",app_id="${self.config.clientId}"`
            + `,signature_method="RS256",signature="${signature}"`;
    }

    /**
     * Generate querystring from query params
     *
     * @private
     * @param {object} queryParams - Key-value pairs, e.g. { b:'2 two', a:1 }.
     * @param {boolean} encode=true - Whether to URI encode values of query params.
     * @returns {string} Params will be sorted alphabetically, e.g. "a=z&b=2%20two".
     */
    function generateQueryString(queryParams, encode = true) {
        let queryStringArr = [];

        let sortedKeys = Object.keys(queryParams || {});
        sortedKeys.sort();

        let value = '';
        sortedKeys.forEach((key) => {
            value = queryParams[key]?.toString() || '';
            queryStringArr.push(`${key}=` + (encode ? encodeURIComponent(value) : value));
        });

        return queryStringArr.join('&');
    }

    /**
     * Send HTTP request
     *
     * @private
     * @param {string} url - URL to send request to.
     * @param {string} method=GET - HTTP method. Possible values: GET, POST.
     * @param {(null|object)} body=null - Request body in JSON, usually for POST requests.
     * @param {(null|object)} headers=null - Request headers using header-value pairs.
     * @returns {Promise<object>}
     * @throws {Error} Throws if request has errors.
     */
    async function sendHttpRequest(url, method = 'GET', body = null, headers = null) {
        return new Promise((resolve, reject) => {
            // Use https if url starts with https, else use http
            let client = url.match(/^https/) ? https : http;

            let rawBody = '';
            let request = client.request(
                url,
                {
                    method: method,
                    headers: headers || {},
                },
                (response) => {
                    response.on('data', (chunk) => {
                        rawBody += chunk;
                    });

                    // The whole response has been received
                    response.on('end', () => {
                        let parsedBody = null;
                        try {
                            parsedBody = JSON.parse(rawBody);
                        } catch (err) {
                            self.config.logger(LOG_ERROR, err.message, err);
                            reject(err);
                        }

                        resolve(parsedBody);
                    });
                }
            );

            // Error handler
            request.on('error', (err) => {
                self.config.logger(LOG_ERROR, err.message, err);
                reject(err);
            });

            // Write body if any
            if (body) {
                request.write(JSON.stringify(body));
            }

            // Send out request
            request.end(); // do not place resolve() after this line else it will resolve straightaway
        });
    }

    // Initialization
    (function init() {
        if (self.config.useDemoDefaults) {
            let certPath = process.env.DEMO_ROOT + 'node_modules/@opengovsg/mockpass/static/certs';
            self.config = Object.assign(self.config, {
                clientId: 'clientId',
                clientSecret: process.env.DEMO_MYINFO_CLIENT_SECRET,
                singpassEserviceId: 'singpassEserviceId',
                redirectEndpoint: process.env.DEMO_MYINFO_BUSINESS_ASSERT_ENDPOINT,
                // clientPrivateKey - key.pem's public key, key.pub, is used for serviceProvider.pubKey in
                // https://github.com/opengovsg/mockpass/blob/master/index.js, which in turn is used by verify() in
                // https://github.com/opengovsg/mockpass/blob/master/lib/express/myinfo/controllers.js
                clientPrivateKey: fs.readFileSync(`${certPath}/key.pem`),
                // myInfoPublicKey refers to MOCKPASS_PUBLIC_KEY in
                // https://github.com/opengovsg/mockpass/blob/master/lib/express/myinfo/controllers.js
                myInfoPublicKey: fs.readFileSync(`${certPath}/spcp.crt`),
                myInfoApiBaseUrl: process.env.DEMO_MYINFO_BUSINESS_BASEURL_EXTERNAL,
            });

            return;
        }

        // Ensure logger is always a function to reduce checks each time it is used
        if (null === self.config.logger) {
            self.config.logger = function (severityLevel, message, error) {}; // do nothing
        }

        // Check that required config params are set
        Object.keys(self.config).forEach((key) => {
            if (!self.config[key] && key !== 'useDemoDefaults') {
                let msg = `Config parameter "${key}" cannot be empty.`;
                self.config.logger(LOG_ERROR, msg);
                throw new Error(msg);
            }
        });

        // Sanitize config params
        ['clientPrivateKey', 'myInfoPublicKey'].forEach((key) => {
            self.config[key] = self.config[key]?.toString().replace(/\n$/, '') || '';
        });
        if ('/' === self.config.myInfoApiBaseUrl[self.config.myInfoApiBaseUrl.length - 1]) {
            // Remove trailing slash if any
            self.config.myInfoApiBaseUrl =
                self.config.myInfoApiBaseUrl.substr(0, self.config.myInfoApiBaseUrl.length - 1);
        }
    })();

    // Return public interface
    return self;
});
