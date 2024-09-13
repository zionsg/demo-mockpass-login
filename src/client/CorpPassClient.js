// Import modules
const { Corppass } = require('@govtechsg/singpass-myinfo-oidc-helper');
const fs = require('fs');

/**
 * CorpPass client (Post-NDI)
 *
 * @param {object} config - See https://github.com/GovTechSG/singpass-myinfo-oidc-helper/blob/master/README.md#corppass-post-ndi
 * @returns {SPCPAuthClient}
 */
module.exports = (function (config) {
    let certPath = process.env.MOCKPASS_ROOT + 'static/certs';

    let client = new Corppass.NdiOidcHelper(Object.assign(
        {
            // See https://github.com/opengovsg/mockpass/blob/main/README.md#corppass-v2-corppass-oidc
            // on values to use for MockPass
            oidcConfigUrl:
                `${process.env.DEMO_MOCKPASS_BASEURL_INTERNAL}/corppass/v2/.well-known/openid-configuration`,
            clientID: process.env.DEMO_MOCKPASS_CLIENT_ID,
            redirectUri: '',
            jweDecryptKey: fs.readFileSync(`${certPath}/oidc-v2-rp-secret.json`, 'utf8'),
            clientAssertionSignKey: fs.readFileSync(`${certPath}/key.pem`, 'utf8'),
        },
        config || {}
    ));

    /**
     * Custom method to replace constructAuthorizationUrl() in creating authorization URL
     *
     * The authorization URL generated by constructAuthorizationUrl() will use the same base URL
     * as oidcConfigUrl in the client config. It is meant to be used client-side in the browser in
     * this application, while oidcConfigUrl is used server-side during the instantiation of the
     * client.
     *
     * This method is needed to replace the base URL of the generated authorization URL in order
     * for it to work in the browser, as it will call the MockPass server externally, which is
     * different from oidcConfigUrl which calls the MockPass server inside the Docker network.
     * E.g. oidcConfigUrl starts with
     * "http://<Docker Compose service name for MockPass server>:<internal port of MockPass server>"
     * while the authorizationUrl should start with "http://localhost:<external port of MockPass server>".
     *
     * @public
     * @param {express.Request} req
     * @returns {Promise<string>}
     */
    client.customCreateAuthUrl = async function (req) {
        // On the `state` & `nonce` method arguments for constructAuthorizationUrl(), they are each
        // "a session-based, unique, and non-guessable value that should be generated per auth session",
        // serving different purposes and are documented in the request params for the authorization endpoint in:
        //   - https://api.singpass.gov.sg/library/login/developers/tutorial1
        //   - https://stg-id.singpass.gov.sg/docs/authorization/api#_authorization_endpoint
        let state = 'corppass-' + req.headers['X-REQUEST-ID']; // header set in src/routes.js, prefix diff from SingPass
        let nonce = req.headers['X-REQUEST-ID']; // use the same value for convenience
        let authUrl = await client.constructAuthorizationUrl(state, nonce);

        return authUrl.replace(process.env.DEMO_MOCKPASS_BASEURL_INTERNAL, process.env.DEMO_MOCKPASS_BASEURL_EXTERNAL);
    };

    return client;
});
