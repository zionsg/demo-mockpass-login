// Import modules
const fs = require('fs');

/**
 * MyInfo Business client
 *
 * @link https://api.singpass.gov.sg/library/myinfobiz/developers/overview
 * @link https://public.cloud.myinfo.gov.sg/myinfobiz/myinfo-biz-specs-v2.0.html#tag/MyInfo-Business
 * @param {object} config - Configuration. See `self.config` on parameters.
 * @returns {MyInfoBusinessClient}
 * @throws {Error} if required configuration parameters are missing.
 */
module.exports = (function (config) {
    /**
     * @callback LoggerCallback
     * @param {string="error","info","debug"} severityLevel - Log severity level as per RFC 5424.
     * @param {string} message - Log message.
     * @param {(null|Error)} error - Error object if any.
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
                logger: function (severityLevel, message, error) {
                    console.log( // eslint-disable-line no-console
                        '[' + (new Date()).toISOString() + `] [${severityLevel.toString().toUpperCase()}] ${message}`,
                        error
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
     * Generate querystring from query params
     *
     * @private
     * @param {object} queryParams - Key-value pairs, e.g. { b:'2 two', a:1 }.
     * @returns {string} Params will be sorted alphabetically with values encoded, e.g. "a=z&b=2%20two".
     */
    function generateQueryString(queryParams) {
        let queryStringArr = [];
        let sortedKeys = Object.keys(queryParams);
        sortedKeys.sort();
        sortedKeys.forEach((key) => {
            queryStringArr.push(`${key}=` + encodeURIComponent(queryParams[key]?.toString() || ''));
        });

        return queryStringArr.join('&');
    }

    // Initialization
    (function init() {
        if (self.config.useDemoDefaults) {
            let certPath = process.env.DEMO_ROOT + 'node_modules/@opengovsg/mockpass/static/certs/';
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
                throw new Error(`Config parameter "${key}" cannot be empty.`);
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
