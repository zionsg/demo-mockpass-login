// Import modules
const crypto = require('crypto');
const mustache = require('mustache');
const xml2js = require('xml2js');

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
     * Convert XML to JSON
     *
     * @public
     * @param {string} xml
     * @param {boolean} isBase64Encoded=false - Whether XML is Base64 encoded.
     * @returns {Promise<(null|object)>} Null returned if error.
     */
    self.xmlToJson = async function (xml, isBase64Encoded = false) {
        if (isBase64Encoded) {
            try {
                xml = atob(xml);
            } catch (err) {
                console.error(err);
                return null;
            }
        }

        return new Promise((resolve, reject) => {
            xml2js.parseString(xml, { trim: true }, (err, result) => {
                if (err) {
                    console.error(err);
                    resolve(null); // don't use reject else caller has to wrap call in try/catch
                    return;
                }

                resolve(result);
            });
        });
    };

    // Return public interface of IIFE
    return self;
})();
