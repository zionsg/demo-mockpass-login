// Import modules
const { Singpass } = require('singpass-myinfo-oidc-helper');
const fs = require('fs');

/**
 * SingPass client (Post-NDI)
 *
 * @param {object} config - See https://github.com/GovTechSG/singpass-myinfo-oidc-helper/blob/master/README.md#singpass-post-ndi
 * @returns {SPCPAuthClient}
 */
module.exports = (function (config) {
    let certPath = process.env.MOCKPASS_ROOT + 'static/certs';

    return new Singpass(Object.assign(
        {
            // See https://github.com/opengovsg/mockpass/blob/main/README.md#singpass-v2-ndi-oidc on values for MockPass
            oidcConfigUrl: `${process.env.DEMO_MOCKPASS_BASEURL_EXTERNAL}/singpass/v2/.well-known/openid-configuration`,
            clientID: '',
            redirectUri: '',
            jweDecryptKey: fs.readFileSync(`${certPath}/oidc-v2-rp-secret.json`),
            clientAssertionSignKey: fs.readFileSync(`${certPath}/key.pem`),
        },
        config || {}
    ));
});
