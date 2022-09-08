// Import modules
const { MyInfoGovClient } = require('@opengovsg/myinfo-gov-client');
const fs = require('fs');

/**
 * MyInfo Personal client
 *
 * @param {object} config - See https://github.com/opengovsg/myinfo-gov-client for more info.
 * @returns {MyInfoGovClient}
 */
module.exports = (function (config) {
    let certPath = process.env.DEMO_ROOT + 'node_modules/@opengovsg/mockpass/static/certs/';

    // See https://github.com/opengovsg/myinfo-gov-client/blob/develop/src/MyInfoGovClient.class.ts on params
    // See https://github.com/opengovsg/myinfo-gov-client/blob/develop/test/constants.ts on certs to use from MockPass
    let client = new MyInfoGovClient({
        clientId: 'clientId',
        clientSecret: process.env.DEMO_MYINFO_CLIENT_SECRET,
        singpassEserviceId: 'singpassEserviceId',
        redirectEndpoint: process.env.DEMO_MYINFO_PERSONAL_ASSERT_ENDPOINT,
        clientPrivateKey: fs.readFileSync(`${certPath}/key.pem`),
        myInfoPublicKey: fs.readFileSync(`${certPath}/spcp.crt`),
        mode: 'dev', // Set to 'dev' to call dev endpoint, 'stg' to call stg endpoint, leave empty for prod
    });

    // Need to modify the base API URL to point to MockPass cos no way to specify when creating client
    client.baseAPIUrl = process.env.DEMO_MOCKPASS_BASEURL_EXTERNAL + '/myinfo/v3';

    return client;
});