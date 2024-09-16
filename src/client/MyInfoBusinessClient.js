// Import modules
const crypto = require('crypto');
const fs = require('fs');
const helper = require(process.env.DEMO_ROOT + 'src/helper.js');
const http = require('http');
const https = require('https');
const jose = require('node-jose');

/**
 * MyInfo Business client (v2 API)
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
     * Self reference - all public properties/methods stored here & returned as public interface.
     *
     * @public
     * @type {object}
     * @property {object} config - Configuration.
     * @property {boolean} config.useDemoDefaults=false - Use demo default values without having to
     *     specify the other config params.
     * @property {string} config.redirectEndpoint - Endpoint to which user should be redirected
     *     after login.
     * @property {string} config.clientId - Client ID provided by MyInfo, also known as App ID.
     * @property {string} config.clientSecret - Client secret provided by MyInfo.
     * @property {string} config.clientPrivateKey - RSA-SHA256 private key, which must correspond
     *     with public key provided to MyInfo during the onboarding process.
     * @property {string} config.myInfoPublicKey - MyInfo server's public key for verifying
     *     their signature.
     * @property {string} config.myInfoApiBaseUrl - Base URL of My Info API without trailing slash,
     *     e.g. https://test.api.myinfo.gov.sg/biz/v2.
     * @property {(null|LoggerCallback)} config.logger. Optional logging function which will be used
     *     to output log messages. Defaults to using console.log() if not specified, set to null
     *     to disable log messages.
     */
    const self = {
        config: Object.assign(
            {
                useDemoDefaults: false,
                redirectEndpoint: '',
                clientId: '',
                clientSecret: '',
                clientPrivateKey: '',
                myInfoPublicKey: '',
                myInfoApiBaseUrl: '',
            },
            config || {}
        ),
    };

    /** @type {string} Constants for MyInfo Biz endpoints. */
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
     * @param {string} options.redirectEndpoint - Optional alternative redirect endpoint.
     *     Defaults to the endpoint provided in the config.
     * @returns {string}
     */
    self.createRedirectUrl = function (options) {
        let queryParams = { // does not have singpassEserviceId unlike MyInfo Personal
            purpose: options.purpose || '',
            attributes: (options.requestedAttributes || []).join(','),
            state: options.relayState || '',
            client_id: self.config.clientId,
            redirect_uri: options.redirectEndpoint || self.config.redirectEndpoint,
        };

        return `${self.config.myInfoApiBaseUrl}/${ENDPOINT_AUTHORISE}?` + generateQueryString(queryParams);
    };

    /**
     * Retrieves the access token from the Token endpoint
     *
     * @public
     * @link Adapted from callTokenApi() in https://github.com/singpass/myinfobiz-demo-app/blob/master/routes/index.js
     * @param {string} authCode - Authorization code provided to the redirect endpoint.
     * @param {string} relayState - State to be forwarded to the redirect endpoint via query params.
     * @returns {string} The access token as a JWT (JSON Web Token).
     * @throws {Error} Throws if MyInfo returns a non-200 response.
     * @throws {Error} Throws if MyInfo response does not contain the access token.
     */
    self.getAccessToken = async function (authCode, relayState) {
        let postUrl = `${self.config.myInfoApiBaseUrl}/${ENDPOINT_TOKEN}`;
        let postParams = {
            grant_type: 'authorization_code',
            code: authCode,
            state: relayState,
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
            helper.logError(null, err);
            throw err;
        }

        if (!response?.access_token || typeof response.access_token !== 'string') {
            let msg = 'Missing access token in response.';
            helper.logError(null, msg, response);
            throw new Error(msg);
        }

        return response.access_token;
    };

    /**
     * Retrieves the requested MyInfo attributes from the Entity-Person endpoint after
     * the client has logged in to SingPass and consented to providing the given attributes
     *
     * @public
     * @param {string} accessToken - Access token from getAccessToken().
     * @param {string[]} requestedAttributes - MyInfo attributes requested.
     * @returns {object}
     * @throws {Error} Throws if unable to extract UEN and UUID from access token.
     * @throws {Error} Throws if MyInfo returns a non-200 response.
     */
    self.getEntityPerson = async function (accessToken, requestedAttributes) {
        let uenUuid = await extractUenUuid(accessToken);
        if (!uenUuid) {
            throw new Error('Unable to extract UEN/UUID from access token.');
        }

        let url = `${self.config.myInfoApiBaseUrl}/${ENDPOINT_ENTITY_PERSON}/${uenUuid.uen}/${uenUuid.uuid}`;
        let params = {
            client_id: self.config.clientId,
            attributes: requestedAttributes.join(','),
        };
        let headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            // url has no querystring params appended when generating auth header
            'Authorization': generateAuthHeader('GET', url, params) + `,Bearer ${accessToken}`,
        };

        let response = null;
        try {
            // Don't parse response into JSON object
            response = await sendHttpRequest(`${url}?` + generateQueryString(params), 'GET', null, headers, true);
        } catch (err) {
            helper.logError(null, err);
            throw err;
        }

        let jws = await decryptJwe(response);
        let decoded = await verifyJws(jws);

        return decoded;
    };

    /**
     * Decrypt JWE (JSON Web Encryption)
     *
     * See https://github.com/opengovsg/mockpass/issues/692
     * This caters for the payload not wrapped in quotes due to MockPass switching to jose NPM package in
     * https://github.com/opengovsg/mockpass/blob/v4.3.4/lib/express/myinfo/controllers.js versus
     * the payload being wrapped in quotes when node-jose NPM package was used in
     * https://github.com/opengovsg/mockpass/blob/v4.0.7/lib/express/myinfo/controllers.js
     *
     * @private
     * @link From decryptJWE() in https://github.com/singpass/myinfobiz-demo-app/blob/master/lib/securityHelper.js
     *     which in turn is from https://api.singpass.gov.sg/library/myinfobiz/developers/tutorial3
     * @param {string} jws
     * @returns {Promise<object>} Decrypted JWS (JSON Web Signature) payload.
     * @throws {Error} Throws if error decrypting JWE.
     */
    async function decryptJwe(jwe) {
        return new Promise((resolve, reject) => {
            // See splitting of JWE parts when calling securityHelper.decryptJWE() in
            // https://github.com/singpass/myinfobiz-demo-app/blob/master/routes/index.js and how
            // they correspond to the method signature
            let jweParts = (jwe || '').split('.');
            let header = jweParts[0];
            let encryptedKey = jweParts[1];
            let iv = jweParts[2];
            let cipherText = jweParts[3];
            let tag = jweParts[4];

            let keystore = jose.JWK.createKeyStore();
            let data = {
                type: 'compact',
                ciphertext: cipherText,
                protected: header,
                encrypted_key: encryptedKey,
                tag: tag,
                iv: iv,
                header: JSON.parse(jose.util.base64url.decode(header).toString())
            };

            keystore.add(self.config.clientPrivateKey, 'pem')
                .then((jweKey) => {
                    // result is a jose.JWK.Key
                    jose.JWE.createDecrypt(jweKey)
                        .decrypt(data)
                        .then((result) => {
                            let jwt = result.payload.toString().replaceAll('"', ''); // remove quotes if any
                            resolve(jwt);
                        })
                        .catch((err) => {
                            helper.logError(null, err);
                            reject(err);
                        });
                })
                .catch((err) => {
                    helper.logError(null, err);
                    reject(err);
                });
        });
    }

    /**
     * Extract UEN and UUID from access token
     *
     * @private
     * @link Adapted from callEntityPersonAPI() in
     *     https://github.com/singpass/myinfobiz-demo-app/blob/master/routes/index.js
     * @param {string} accessToken
     * @returns {(Promise<null>|Promise<object>)} Null returned if error. Format of object:
     *     {
     *         uen: '12345678A',
     *         uuid: '499bb4c4-7462-0716-41ac-71fcb021a548'
     *     }
     */
    async function extractUenUuid(accessToken) {
        let decoded = await verifyJws(accessToken);
        if (!decoded?.sub) {
            return null;
        }

        let sub = decoded.sub.split('_');

        return {
            uen: sub[0],
            uuid: sub[1],
        };
    }

    /**
     * Generate content of Authorization header to be sent with a request to MyInfo
     *
     * @private
     * @link From generateSHA256withRSAHeader() in
     *     https://github.com/singpass/myinfobiz-demo-app/blob/master/lib/securityHelper.js
     *     turn is from https://api.singpass.gov.sg/library/myinfobiz/developers/tutorial3
     * @param {string="GET","POST"} method - HTTP method to be used for the request.
     * @param {string} url - Endpoint to which the request is being sent.
     * @param {object} urlParams - Key-value pairs for query parameters being sent with the request.
     * @returns {string} The content which should be provided as the Authorization header.
     */
    function generateAuthHeader(method, url, urlParams) {
        let timestamp = Date.now().toString();
        let nonce = crypto.randomBytes(32).toString('base64');
        let authParams = Object.assign(
            {}, // must assign to empty object else urlParams will be modified
            urlParams || {},
            {
                app_id: self.config.clientId,
                nonce: nonce,
                signature_method: 'RS256',
                timestamp: timestamp,
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
     * @param {boolean} skipParseBody=false - Whether to skip parsing of body into JSON object.
     *     Set to true if response returns a string, file contents, JWE (JSON Web Encryption) or
     *     JWS (JSON Web Signature).
     * @returns {Promise<object>}
     * @throws {Error} Throws if request has errors.
     */
    async function sendHttpRequest(url, method = 'GET', body = null, headers = null, skipParseBody = false) {
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
                        if (skipParseBody) {
                            resolve(rawBody);
                            return;
                        }

                        let parsedBody = null;
                        try {
                            parsedBody = JSON.parse(rawBody);
                        } catch (err) {
                            helper.logError(null, 'Could not parse body into JSON', rawBody);
                            reject(err);
                        }

                        resolve(parsedBody);
                    });
                }
            );

            // Error handler
            request.on('error', (err) => {
                helper.logError(null, err);
                reject(err);
            });

            // Write body if any
            if (body) {
                let contentType = headers?.['Content-Type'] || 'application/json';
                if ('application/x-www-form-urlencoded' === contentType) {
                    request.write(generateQueryString(body));
                } else {
                    request.write(JSON.stringify(body));
                }
            }

            // Send out request
            request.end(); // do not place resolve() after this line else it will resolve straightaway
        });
    }

    /**
     * Verify and decode JWS (JSON Web Signature) or JWT (JSON Web Token)
     *
     * @private
     * @link From verifyJWS() in https://github.com/singpass/myinfobiz-demo-app/blob/master/lib/securityHelper.js
     *     which in turn is from https://api.singpass.gov.sg/library/myinfobiz/developers/tutorial3
     * @param {string} jws
     * @returns {(Promise<null>|Promise<object>)} Null returned if error. Format of object:
     *     {
     *         sub: '12345678A_499bb4c4-7462-0716-41ac-71fcb021a548',
     *         jti: 'kgHQtzZhQflRbEXVgBnBK6Kl5DIznY9g6v2bgQl3',
     *         scope: [ 'basic-profile', 'uinfin', 'name', 'email', 'mobileno' ],
     *         tokenName: 'access_token',
     *         token_type: 'Bearer',
     *         grant_type: 'authorization_code',
     *         expires_in: 1800,
     *         aud: 'STG2-MYINFOBIZ-SELF-TEST',
     *         realm: 'myinfo-biz',
     *         iss: 'https://test.api.myinfo.gov.sg/serviceauth/myinfo-biz',
     *         iat: 1662720023,
     *         nbf: 1662720023,
     *         exp: 1662721823
     *    }
     */
    async function verifyJws(jws) {
        let keyStore = null;
        let result = null;
        let decoded = null;

        try {
            keyStore = await jose.JWK.asKey(self.config.myInfoPublicKey, 'pem');
        } catch (err) {
            helper.logError(null, err);
            return null;
        }

        try {
            result = await jose.JWS.createVerify(keyStore).verify(jws);
        } catch (err) {
            helper.logError(null, err);
            return null;
        }

        try {
            decoded = JSON.parse(Buffer.from(result.payload).toString());
        } catch (err) {
            helper.logError(null, err);
            return null;
        }

        return decoded;
    }

    // Initialization
    (function init() {
        if (self.config.useDemoDefaults) {
            // MockPass does not support MyInfo Business at this point of time.
            // The MyInfo Business online test server only responds to specific credentials and certificates,
            // namely those in https://github.com/singpass/myinfobiz-demo-app/blob/master/start.sh
            // hence using them here. Note that `npm install https://github.com/singpass/myinfobiz-demo-app`
            // installs to `node_modules/myinfo-tutorial-app` not `node_modules/myinfobiz-demo-app`.
            let certPath = process.env.DEMO_ROOT + 'node_modules/myinfo-tutorial-app/ssl';

            // Cannot use staging-myinfo-public-cert.pem in certPath as that is outdated and will cause "No key found"
            // error in verifyJWS(). Using new X.509 certificate (effective from 15 Aug 2024) downloaded from
            // https://partnersupport.singpass.gov.sg/hc/en-sg/articles/32438585928601--14-May-2024-Renewal-of-X-509-Certificates-for-Myinfo-V3-Myinfo-business-and-Verify-API
            let updatedMyInfoPublicCertPath = process.env.DEMO_ROOT
                + 'src/certificates/pub.stg.new.consent.myinfo.gov.sg.cer';

            self.config = Object.assign(self.config, {
                redirectEndpoint: process.env.DEMO_MYINFO_BUSINESS_ASSERT_ENDPOINT,
                clientId: 'STG2-MYINFOBIZ-SELF-TEST',
                clientSecret: '44d953c796cccebcec9bdc826852857ab412fbe2',
                clientPrivateKey: fs.readFileSync(`${certPath}/your-sample-app-private-key.pem`, 'utf8'),
                myInfoPublicKey: fs.readFileSync(updatedMyInfoPublicCertPath, 'utf8'),
                // not using sandbox.api.myinfo.gov.sg cos that does not return encrypted response like production
                myInfoApiBaseUrl: 'https://test.api.myinfo.gov.sg/biz/v2',
            });

            return;
        }

        // Check that required config params are set
        Object.keys(self.config).forEach((key) => {
            if (!self.config[key] && key !== 'useDemoDefaults') {
                let msg = `Config parameter "${key}" cannot be empty.`;
                helper.logError(null, msg);
                throw new Error(msg);
            }
        });

        // Sanitize config params
        ['clientPrivateKey', 'myInfoPublicKey'].forEach((key) => {
            self.config[key] = self.config[key]?.toString().replace(/\n$/, '') || ''; // remove trailing newline if any
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
