// Import modules
const crypto = require('crypto');
const mustache = require('mustache');

/**
 * Common server-side helper functions
 *
 * @returns {object}
 */
module.exports = (function () {
    /** @type {object} Self reference - all public properties/methods are stored here & returned as public interface. */
    const self = {};

    /**
     * Get UUID v4 string
     *
     * This is a proxy to standardize the use of UUID v4, instead of allowing
     * developers to use the myriad versions in the uuid package, e.g. v3 & v5.
     *
     * @public
     * @returns {string} E.g. '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'
     */
    self.getUuid = function () {
        return crypto.randomUUID(); // use in-built UUID function introduced in Node.js v14.17, 3x faster than uuid.v4()
    };

    /**
     * Log server-side error messages
     *
     * @public
     * @uses log()
     * @param {express.Request} request
     * @param {...mixed} messages
     * @returns void
     */
    self.logError = function (request, ...messages) {
        log.call(null, request, messages, 'error');
    };

    /**
     * Log server-side informational messages
     *
     * @public
     * @uses log()
     * @param {express.Request} request
     * @param {...mixed} messages
     * @returns void
     */
    self.logInfo = function (request, ...messages) {
        log.call(null, request, messages, 'info');
    };

    /**
     * Render HTML using Mustache.js template
     *
     * @public
     * @param {express.Request} request
     * @param {string} template - Mustache.js template.
     * @param {(null|object)} variables=null - Optional key-value pairs to pass to Mustache.js
     *     template, where key is name of template variable and value is value of template variable.
     * @param {(null|object)} partials=null - Optional key-value pairs to pass to Mustache.js
     *     template, where key is name of partial and value is HTML for partial.
     * @returns {string}
     */
    self.render = function (request, template, variables = null, partials = null) {
        return mustache.render(
            template,
            Object.assign(
                {
                    nonce: request?.headers['X-REQUEST-ID'],
                    user: request?.user,
                },
                variables || {}
            ),
            partials || {}
        );
    };

    /**
     * Centralized server-side logging function
     *
     * @private
     * @link Log format adapted from log() in https://github.com/zionsg/getmail/blob/master/src/App/Logger.php
     * @param {(null|express.Request)} request
     * @param {(mixed|mixed[])} messages - Either a string/int/object or an array of string/int/object.
     * @param {string="error","info"} severityLevel="info" Severity level as per RFC 5424.
     * @returns {void}
     */
    function log(request, messages, severityLevel = 'info') {
        if (!Array.isArray(messages)) { // ensure always array
            messages = [messages];
        }

        // Prepend timestamp, severity level and application name
        let stackLevel = 3;
        let caller = ((new Error()).stack.split('at '))[stackLevel].trim();
        messages.unshift(
            '[' + (new Date()).toISOString() + '] [' + severityLevel.toUpperCase() + '] '
            + `[DEMO] [${caller}]`
        );

        console.log(...messages); // eslint-disable-line no-console
    }

    // Return public interface of IIFE
    return self;
})();
