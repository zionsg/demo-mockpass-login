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

    return new Corppass.NdiOidcHelper(Object.assign(
        {
            // See https://github.com/opengovsg/mockpass/blob/main/README.md#corppass-v2-corppass-oidc
            // on values to use for MockPass
            oidcConfigUrl:
                `${process.env.DEMO_MOCKPASS_BASEURL_EXTERNAL}/corppass/v2/.well-known/openid-configuration`,
            clientID: '',
            redirectUri: '',
            jweDecryptKey: fs.readFileSync(`${certPath}/oidc-v2-rp-secret.json`),
            clientAssertionSignKey: fs.readFileSync(`${certPath}/key.pem`),
        },
        config || {}
    ));
});
