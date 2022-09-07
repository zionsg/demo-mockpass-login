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

    // idpLoginURL and idpEndpoint as per https://github.com/opengovsg/mockpass
    return new SPCPAuthClient(Object.assign(
        {
            partnerEntityId: 'partnerEntityId',
            idpLoginURL: `${process.env.DEMO_MOCKPASS_BASEURL_EXTERNAL}/singpass/logininitial`,
            idpEndpoint: `${process.env.DEMO_MOCKPASS_BASEURL_INTERNAL}/singpass/soap`,
            esrvcID: 'esrvcID', // SingPass e-Service ID
            appCert: fs.readFileSync(`${certPath}/key.pub`),
            appKey: fs.readFileSync(`${certPath}/key.pem`),
            appEncryptionKey: fs.readFileSync(`${certPath}/key.pem`),
            spcpCert: fs.readFileSync(`${certPath}/spcp.crt`),
        },
        config || {}
    ));
});
