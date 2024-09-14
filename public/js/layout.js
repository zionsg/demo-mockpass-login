/**
 * Layout script containing common client-side helper functions
 *
 * @global
 * @example
 *     <!-- should only be loaded once via src/views/layout.html in project -->
 *     <script src="/public/js/layout.js" data-nonce="{{nonce}}"></script>
 * @param {HTMLElement} currentScript - Script element that this script is loaded in, e.g. <script src="x.js"></script>.
 * @returns {object}
 */
const layout = (function (currentScript) { // not using `var` so that there will be error if it's loaded more than once
    /** @type {object} Self reference - public properties/methods stored here & returned as public interface. */
    const self = {}; // methods attached to this are ordered alphabetically

    /**
     * Initialization on page load
     */
    window.addEventListener('DOMContentLoaded', () => {
        // Nothing for not
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
