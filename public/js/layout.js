/**
 * Layout script
 */
(function (currentScript) {
    let nonce = currentScript.getAttribute('data-nonce');

    window.addEventListener('DOMContentLoaded', () => {
        initQr();
    });

    /**
     * Initialize QR codes
     *
     * @private
     * @link Adapted from https://stg-id.singpass.gov.sg/docs/embedded-auth/js#_sample_html_with_ndi_embedded_auth_js
     * @returns {void}
     */
    function initQr() {
        let authParamsSupplier = async function () {
            // Replace the below with an `await`ed call to initiate an auth session on your backend
            // which will generate state+nonce values
            return {
                state: btoa(nonce), // must be base64-encoded
                nonce: nonce,
            };
        };

        let onError = function (errorId, message) {
            console.error(`onError. errorId:${errorId} message:${message}`);
        };

        try {
            let initAuthSessionResponse = window.NDI.initAuthSession(
                'singpass-qr',
                {
                    clientId: 'T5sM5a53Yaw3URyDEv2y9129CbElCN2F', // Replace with your client ID
                    redirectUri: ' https://mockpass.ap.ngrok.io', // Replace with a registered redirect URI
                    scope: 'openid',
                    responseType: 'code',
                },
                authParamsSupplier,
                onError,
                {
                    renderDownloadLink: true,
                    appLaunchUrl: 'https://partner.gov.sg' // Replace with your iOS/Android App Link
                }
            );

            console.log('initAuthSession: ', initAuthSessionResponse);
        } catch (err) {
            console.error(err);
        }
    }
})(document.currentScript); // pass in argument to ensure different instance each time
