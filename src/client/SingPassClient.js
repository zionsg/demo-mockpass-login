// Import modules
const SPCPAuthClient = require('@opengovsg/spcp-auth-client');
const fs = require('fs');

/**
 * SingPass client
 *
 * @param {object} config - See https://github.com/opengovsg/spcp-auth-client for more info.
 * @returns {SPCPAuthClient}
 */
module.exports = (function (config) {
    let certPath = process.env.DEMO_ROOT + 'node_modules/@opengovsg/mockpass/static/certs/';

    return new SPCPAuthClient(Object.assign(
        {
            partnerEntityId: 'partnerEntityId',
            // idpLoginURL route defined in https://github.com/opengovsg/mockpass/blob/master/lib/express/saml.js
            idpLoginURL: `${process.env.DEMO_MOCKPASS_BASEURL_EXTERNAL}/singpass/logininitial`,
            // idpEndpoint route defined in https://github.com/opengovsg/mockpass/blob/master/lib/express/saml.js
            idpEndpoint: `${process.env.DEMO_MOCKPASS_BASEURL_INTERNAL}/singpass/soap`,
            esrvcID: 'esrvcID', // SingPass e-Service ID
            appCert: fs.readFileSync(`${certPath}/key.pub`),
            appKey: fs.readFileSync(`${certPath}/key.pem`),
            appEncryptionKey: fs.readFileSync(`${certPath}/key.pem`),
            // spcpCert's signing key, spcp-key.pem is used by
            // https://github.com/opengovsg/mockpass/blob/master/lib/assertions.js and
            // https://github.com/opengovsg/mockpass/blob/master/lib/crypto/index.js
            spcpCert: fs.readFileSync(`${certPath}/spcp.crt`),
        },
        config || {}
    ));
});
