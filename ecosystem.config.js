module.exports = {

    apps: [{
        name: '<FILL_APP_NAME>',
        // name: 'LoginAPI',
        script: '_listen.js',
        watch: ['lib'],
        ignore_watch: ['lib/logs'],
        instances: 2,
        exec_mode: 'cluster',
        max_memory_restart: '500M',
        post_update: [
            'npm install'
        ],
        env_dev: {
            DEBUG: true
        },
        env_prod: {}
    }],

    deploy: {
        prod: {
            user: '<FILL_SSH_USER>',
            host: '<FILL_HOST_IP>',
            ref: '<FILL_REF_BRANCH>',
            repo: '<FILL_REPO_ADDRESS>',
            path: '<FILL_HOST_PROD_REPO_PATH>',
            'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js --env prod'
        },
        dev: {
            user: '<FILL_SSH_USER>',
            host: '<FILL_HOST_IP>',
            ref: '<FILL_REF_BRANCH>',
            repo: '<FILL_REPO_ADDRESS>',
            path: '<FILL_HOST_DEV_REPO_PATH>',
            'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js --env dev',
            env: {
                DEBUG: true
            }
        }
        // prod: {
        //     user: 'bitnami',
        //     host: '1.1.1.1',
        //     ref: 'origin/master',
        //     repo: 'git@github.com:drptbl/wordpress-firebase-custom-token-service.git',
        //     path: '/home/bitnami/pm2/prod',
        //     'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js --env prod'
        // },
        // dev: {
        //     user: 'bitnami',
        //     host: '1.1.1.1',
        //     ref: 'origin/master',
        //     repo: 'git@github.com:drptbl/wordpress-firebase-custom-token-service.git',
        //     path: '/home/bitnami/pm2/dev',
        //     'post-deploy': 'npm install && pm2 startOrRestart ecosystem.config.js --env dev',
        //     env: {
        //         DEBUG: true
        //     }
        // }
    }

};
