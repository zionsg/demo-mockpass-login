/**
 * Layout script containing common client-side helper functions
 *
 * Custom HTML attributes for script element:
 * - data-nonce: Nonce for use with Content Security Policy.
 *
 * @global
 * @example
 *     <!-- should only be loaded once via src/web/views/layout.html in project -->
 *     <script src="/public/js/layout.js" data-nonce="{{nonce}}"></script>
 * @param {HTMLElement} currentScript - Script element that this script is loaded in, e.g. <script src="x.js"></script>.
 * @returns {object}
 */
const layout = (function (currentScript) { // not using `var` so that there will be error if it's loaded more than once
    /** @type {object} Self reference - public properties/methods stored here & returned as public interface. */
    const self = {}; // methods attached to this are ordered alphabetically

    let nonce = currentScript.getAttribute('data-nonce');

    /**
     * Initialization on page load
     */
    window.addEventListener('DOMContentLoaded', () => {
        initQr();
    });

    /**
     * Shortcut to logging client-side error messages
     *
     * @public
     * @param {...mixed} args
     * @returns void
     */
    self.logError = function (...args) {
        log(args, 'error');
    };

    /**
     * Shortcut to logging client-side info messages
     *
     * @public
     * @param {...mixed} args
     * @returns void
     */
    self.logInfo = function (...args) {
        log(args, 'info');
    };

    /**
     * Initialize QR codes
     *
     * @todo Currently getting CORS errors when running this script, probably need to register
     *     domain with SingPass in order to whitelist it.
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
            self.logError(`onError. errorId:${errorId} message:${message}`);
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

            self.logInfo('initAuthSession', initAuthSessionResponse);
        } catch (err) {
            self.logError('initAuthSession', err);
        }
    }

    /**
     * Centralized client-side logging function
     *
     * @private
     * @param @param {(mixed|mixed[])} messages - Either string/int/object or
     *     an array of string/int/object.
     * @param {string="error","info"} severityLevel="info" - Severity level as
     *     per RFC 5424.
     * @returns {void}
     */
    function log(messages, severityLevel = 'info') {
        if (!Array.isArray(messages)) { // ensure always array
            messages = [messages];
        }

        // Prepend timestamp, log level and application name
        messages.unshift(
            '[' + (new Date()).toISOString() + '] [' + severityLevel.toUpperCase() + '] DEMO -'
        );

        console.log(...messages); // eslint-disable-line no-console
    }

    // Return public interface of IIFE
    return self;
})(document.currentScript); // pass in argument to ensure different instance each time
