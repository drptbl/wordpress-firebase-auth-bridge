module.exports = {

    apps: [{
        name: '<FILL_DEV_APP_NAME>',
        // name: 'LoginAPIDev',
        script: '_listen.js',
        watch: ['lib'],
        ignore_watch: ['lib/logs'],
        instances: 2,
        exec_mode: 'cluster',
        max_memory_restart: '500M',
        max_restarts: 9999,
        restart_delay: 5000,
        env_dev: {
            DEBUG: true
        }
    }]

};