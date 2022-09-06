// Import modules
const helper = require(process.env.DEMO_ROOT + 'src/helper.js');
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
