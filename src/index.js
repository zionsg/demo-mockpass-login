/**
 * Entrypoint for entire application
 */

'use strict';

// Set environment variables from .env (file will not override existing env vars on host machine)
require('dotenv').config();
process.env.DEMO_ROOT = require('path').join(__dirname, '../'); // root of repository, need trailing slash
process.env.MOCKPASS_ROOT = `${process.env.DEMO_ROOT}/node_modules/@opengovsg/mockpass/`; // root of MockPass package

// Import modules
const express = require('express');
const helper = require(process.env.DEMO_ROOT + 'src/helper.js');
const router = require(process.env.DEMO_ROOT + 'src/routes.js');

// Log unhandled Promise rejections and uncaught exceptions - must be set as early as possible
process.on('unhandledRejection', (err) => {
    helper.logError(null, `Unhandled rejection: ${err.message}.`, err?.stack);
});
process.on('uncaughtException', (err) => {
    helper.logError(null, `Uncaught exception: ${err.message}.`, err?.stack);
});

// Express app
let app = express(); // Express app created outside init() for module exports
app.disable('x-powered-by'); // do not set "X-Powered-By: Express" header
app.use('/', router);

// Initialization
(async function init() {
    // Start server
    // Within the same Docker network, the application is accessed by other containers via the internal port
    // From the Internet, host machine or outside the Docker network, the application is accessed via the external port
    let internalPort = process.env.DEMO_PORT_INTERNAL || 4000;
    let externalPort = process.env.DEMO_PORT_EXTERNAL || 5000;
    let server = app.listen(internalPort, () => {
        // Emit event to indicate app is ready. Format: vendor.component.event
        app.emit('demo.app.ready', {
            timestamp: Date.now(),
        });

        helper.logInfo(
            null,
            `Server started at port ${internalPort}. `
            + `Open http://localhost:${externalPort}/demo/web/login in the browser.`
        );
    });
    server.keepAliveTimeout = 0;

    // Signal handling - put at the end cos server need to be init first
    ['SIGHUP', 'SIGINT', 'SIGTERM'].forEach((signal) => {
        process.on(signal, () => {
            helper.logInfo(null, `Process received ${signal} signal. Attempting graceful shutdown.`);

            server.close(() => {
                helper.logInfo(null, 'HTTP server closed. Exiting process.');
                process.exit(0);
            });
        });
    });
})();

// Export Express app for running test suites, i.e. tests will require src/index.js
module.exports = app;
