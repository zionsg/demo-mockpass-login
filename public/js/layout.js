/**
 * Layout script containing common client-side helper functions
 *
 * Note that this script loads after scripts in embedded views (if any). To be
 * safe, scripts in embedded views should run after demo.layout.ready event is
 * emitted.
 */
const layout = (function (currentScript) { // not using `var` so that there will be error if it's loaded more than once
    /** @type {object} Self reference - all public properties/methods are stored here & returned as public interface. */
    const self = {}; // methods attached to this are ordered alphabetically

    /**
     * Check if script element has handled demo.layout.ready event
     *
     * This will check data-layout-ready attribute. If this is the first time
     * the script element is handling the event, the attribute will be set to 1
     * to indicate that it has been handled,
     * e.g. <script src="/public/js/test.js" data-layout-ready="1">.
     *
     * Example code in test.js which is loaded via <script src="/public/js/test.js">.
     * Need to listen to event to ensure layout.js has already been loaded.
     *     (function (currentScript) {
     *         window.addEventListener('smsreg.layout.ready', () => {
     *             if (layout.isLayoutReadyHandled(currentScript)) {
     *                 return;
     *             }
     *         });
     *     })(document.currentScript); // pass in argument to ensure different instance each time
     *
     * @public
     * @param {HTMLElement} scriptElement - Typically document.currentScript
     *     in the context of the script tag.
     * @returns {boolean} True if handled before, false if first time handling.
     */
    self.isLayoutReadyHandled = function (scriptElement) {
        let attr = 'data-layout-ready';
        let isHandled = (1 === parseInt(scriptElement?.getAttribute(attr) || 0));

        if (!isHandled) {
            scriptElement?.setAttribute(attr, 1);
        }

        return isHandled;
    };

    // Initialization
    (function init() {
        window.addEventListener('demo.layout.ready', (event) => {
            if (self.isLayoutReadyHandled(currentScript)) {
                return;
            }
        });

        // Emit layout ready event - scripts in embedded views should listen for "demo.layout.ready"
        // event before running, especially if calling helper methods in layout script.
        window.addEventListener('DOMContentLoaded', () => {
            window.dispatchEvent(new CustomEvent('demo.layout.ready')); // find dispatchEvent to see other triggers
        });
    })();

    // Return public interface of IIFE
    return self;
})(document.currentScript); // pass in argument to ensure different instance each time
