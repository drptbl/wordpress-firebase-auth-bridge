const fbServiceAcc = require('./serviceAccountKey.json');
const startAppOnPort = 2096; // API will run on this port, you have to open it too (for example in AWS network security settings)
const wpApiPath = 'qjl3cuiqbzwipomeoeav'; // custom wordpress api path, set in wordpress settings
const dbg = process.env.DEBUG || false;

module.exports = {
    debug: dbg,
    appPort: startAppOnPort,
    serverKeyPath: './keys/server.key',
    serverCrtPath: './keys/server.crt',
    endpointPath: '/fb/auth',
    statusPath: '/fb/status',
    projectDir: __dirname,
    fbServiceAccount: fbServiceAcc,
    fbDatabaseUrl: 'https://bot-remote-control.firebaseio.com',
    incomingHost: `botremotecontrol.com:${startAppOnPort}`, // ip+port or domain+port
    userAgent: 'WooCommerce/2.6.14 Hookshot (WordPress/4.7.2)', // accepted user agent
    timeout: '20s',
    logFormat: '[:date[clf]] [:method] to: ":url" => code: :status - took: :response-time ms, from: :remote-addr - :user-agent',
    logRetention: '1d',
    wpJwtEndpointUrl: `https://botremotecontrol.com/${wpApiPath}/jwt-auth/v1/token`, // path for jwt wordpress api
    botProtection: true,
    helmetConfig: {
        contentSecurityPolicy: false,
        dnsPrefetchControl: true,
        frameguard: true,
        hidePoweredBy: true,
        hpkp: false,
        hsts: true,
        ieNoOpen: true,
        noCache: true,
        noSniff: true,
        referrerPolicy: false,
        xssFilter: true
    },
    pmxMonitoring: true && !dbg, // leave !dbg untouched there
    newRelicEvents: true && !dbg, // leave !dbg untouched there
    pmxMonitorConfig: {
        http: true, // HTTP routes logging (default: true)
        ignore_routes: [/socket\.io/, /notFound/], // Ignore http routes with this pattern (Default: [])
        errors: true, // Exceptions logging (default: true)
        custom_probes: true, // Auto expose JS Loop Latency and HTTP req/s as custom metrics
        network: true, // Network monitoring at the application level
        ports: true // Shows which ports your app is listening on (default: false)
    },
    rateLimiter: {
        enabled: true,
        expiry: 60, // how long each rate limiting window exists for
        prefix: 'rlglobal:', // prefix to add to entries in Redis
        max: 20, // limit each IP to 20 requests per windowMs
        delayMs: 0, // disable delaying - full speed until the max limit is reached
        message: '{ "errorCode": "tooManyRequests", "errorMsg": \"You\'ve made too many failed attempts in a short period of time, please try again later.\" }'
    },
    brute: {
        settings: {
            prefix: 'bfauth:' // prefix to add to entries in Redis
        },
        redisOptions: {
            host: '127.0.0.1',
            port: '6379'
        }
    }
};
