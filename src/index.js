/**
 * Entrypoint for entire application
 */

'use strict';

// Set environment variables from .env (file will not override existing env vars on host machine)
require('dotenv').config();
process.env.DEMO_ROOT = require('path').join(__dirname, '../'); // root of repository, need trailing slash

// Log unhandled Promise rejections and uncaught exceptions - must be set as early as possible
process.on('unhandledRejection', (err) => {
    console.error(`Unhandled rejection: ${err.message}.`, err?.stack);
});
process.on('uncaughtException', (err) => {
    console.error(`Uncaught exception: ${err.message}.`, err?.stack);
});

// Import modules
const express = require('express');
const router = require(process.env.DEMO_ROOT + 'src/routes.js');

// Express app
let app = express(); // Express app created outside init() for module exports
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

        console.info(
            `Server started at port ${internalPort}. Open http://localhost:${externalPort}/demo/login in the browser.`
        );
    });
    server.keepAliveTimeout = 0;

    // Signal handling - put at the end cos server need to be init first
    ['SIGHUP', 'SIGINT', 'SIGTERM'].forEach((signal) => {
        process.on(signal, () => {
            console.info(`Process received ${signal} signal. Attempting graceful shutdown.`);

            server.close(() => {
                console.info('HTTP server closed. Exiting process.');
                process.exit(0);
            });
        });
    });
})();

// Export Express app for running test suites, i.e. tests will require src/index.js
module.exports = app;
