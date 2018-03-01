'use strict';

console.info('New Relic agent configuration in progress');

/**
 * New Relic agent configuration.
 *
 * See lib/config.default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
    /**
     * Array of application names.
     */
    app_name: ['<FILL_APP_NAME>'],
    // app_name: ['Login API'],
    /**
     * Your New Relic license key.
     */
    license_key: '<FILL_LICENSE_KEY>',
    // license_key: 'testtest',
    logging: {
        /**
         * Level at which to log. 'trace' is most useful to New Relic when diagnosing
         * issues with the agent, 'info' and higher will impose the least overhead on
         * production applications.
         */
        level: 'info'
    },
    error_collector: {
        enabled: true,
        ignore_status_codes: [
            404,
            403,
            429
        ]
    },
    capture_params: true
};
