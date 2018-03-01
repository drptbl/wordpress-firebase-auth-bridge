import admin from 'firebase-admin';
import bodyParser from 'body-parser';
import brute from 'express-brute';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import helmet from 'helmet';
import https from 'https';
import moment from 'moment';
import morgan from 'morgan';
import newrelic from 'newrelic';
import path from 'path';
import pmx from 'pmx';
import rateLimit from 'express-rate-limit';
import redisBruteStore from 'express-brute-redis-store';
import redisRateLimitStore from 'rate-limit-redis';
import request from 'request-promise';
import rfs from 'rotating-file-stream';
import settings from '../settings.js';
import timeout from 'connect-timeout';
import ua from 'express-useragent';

const verify = require('cloudflare-origin-pull').verify;

let store;
let accessLogStream;
let userBruteforce;
let globalBruteforce;
let pmxMonitor;

let isBot;

if (settings.pmxMonitoring) {
    pmxMonitor = pmx.init(settings.pmxMonitorConfig);
}

setupFirebaseAdminSDK();

const app = express();

rateLimitGuard();

bruteForceGuard();

setupLogging();

setupMiddlewares();

app.get(settings.statusPath, (req, res) => {
    verifyCloudFlare(req);
    handleBotProt(req, res);
    console.info('--------> [GET] request incoming <--------');
    console.info('[UA]: ', req.useragent.source);
    if (!isBot) {
        res.status(200).send({ status: 'ok' }).end();
    }
});

app.post(settings.endpointPath,
    globalBruteforce.prevent,
    userBruteforce.getMiddleware({
        key: (req, res, next) => {
            next(req.body.username);
        }
    }), (req, res) => {
        verifyCloudFlare(req);
        handleBotProt(req, res);

        let wpToken;
        let wpEmail;
        let wpId;
        let wpDisplayName;

        let wpAllSubs;

        let fbUserExist;
        let wpLoggedIn;
        let wpLoginError;
        const fbSubs = {subs: {}};

        console.info('--------> [POST] request incoming <--------');
        if (settings.debug) {
            console.info('Body: ', req.body);
        }
        console.info('[UA]: ', req.useragent.source);

        if (!isBot) {
            authWithWordpress(req.body.username, req.body.password);
        }

        function authWithWordpress(login, pass) {
            const options = {
                method: 'POST',
                uri: settings.wpJwtEndpointUrl,
                form: {
                    username: login,
                    password: pass
                }
            };

            request(options)
                .then((resp) => {
                    const respJson = JSON.parse(resp);
                    wpToken = respJson.token;
                    wpEmail = respJson.email;
                    wpId = respJson.id;
                    wpDisplayName = respJson.displayName;

                    wpAllSubs = respJson.activeSubs;

                    for (const key of Object.keys(wpAllSubs)) {
                        fbSubs.subs[key] = {};
                        fbSubs.subs[key].status = wpAllSubs[key].status;
                        fbSubs.subs[key].startDate = wpAllSubs[key].start_date;
                        fbSubs.subs[key].expiryDate = wpAllSubs[key].expiry_date;
                        fbSubs.subs[key].trialExpiryDate = wpAllSubs[key].trial_expiry_date;
                    }

                    wpLoggedIn = wpToken && wpId && wpEmail;

                    if (settings.debug) {
                        console.info('[WP] Token: ', wpToken);
                    }
                    console.info('[WP] User email: ', wpEmail);
                    console.info('[WP] User id: ', wpId);
                    console.info('[WP] Subscriptions: ', fbSubs);
                })
                .catch((err) => {
                    wpLoginError = true;

                    const respError = JSON.parse(err.error);

                    const invalidEmail = '[jwt_auth] invalid_email';
                    const incorrectPassword = '[jwt_auth] incorrect_password';
                    const emptyPassword = '[jwt_auth] empty_password';
                    const emptyUsername = '[jwt_auth] empty_username';
                    const invalidUsername = '[jwt_auth] invalid_username';
                    const invalidPassword = '[jwt_auth] invalid_password';

                    if (respError.code === emptyUsername) {
                        console.info('[WP] Failed while getting token from WP: ', err.error);
                        res.status(403).send({ errorCode: 'emptyUsername', errorMsg: 'Empty username' }).end();
                    } else if (respError.code === emptyPassword) {
                        console.info('[WP] Failed while getting token from WP: ', err.error);
                        res.status(403).send({ errorCode: 'emptyPwd', errorMsg: 'Empty password' }).end();
                    } else if (respError.code === invalidUsername) {
                        console.info('[WP] Failed while getting token from WP: ', err.error);
                        res.status(403).send({ errorCode: 'invalidUserFormat', errorMsg: 'Invalid username format' }).end();
                    } else if (respError.code === invalidPassword) {
                        console.info('[WP] Failed while getting token from WP: ', err.error);
                        res.status(403).send({ errorCode: 'invalidPwd', errorMsg: 'Invalid password format' }).end();
                    } else if (respError.code === invalidEmail) {
                        // user doesnt exist
                        console.info('[WP] Failed while getting token from WP: ', err.error);
                        res.status(403).send({ errorCode: 'invalidEmailOrPwd', errorMsg: 'Wrong password or username' }).end();
                    } else if (respError.code === incorrectPassword) {
                        // wrong password
                        console.info('[WP] Failed while getting token from WP: ', err.error);
                        res.status(403).send({ errorCode: 'invalidEmailOrPwd', errorMsg: 'Wrong password or username' }).end();
                    } else {
                        notify('[WP] Failed while getting token from WP (unhandled error): ', err.error);
                        console.error('[WP] Failed while getting token from WP (unhandled error): ', err.error);
                        res.status(500).send({ errorCode: 'globalError', errorMsg: 'Something went wrong' }).end();
                    }
                })
                .finally(() => {
                    if (!wpLoginError) {
                        fbGetUser(wpId, () => {
                            if (!fbUserExist) {
                                console.info('[Flow] User doesn\'t exist, creating new user..');
                                fbCreateUser(wpId, wpEmail, wpDisplayName, () => {
                                    if (wpLoggedIn) {
                                        console.info('[Flow] User created, creating token..');
                                        req.brute.reset(() => {
                                            fbCreateToken(wpId, wpEmail, fbSubs);
                                        });
                                    }
                                });
                            } else if (wpLoggedIn) {
                                console.info('[Flow] User exist, creating token..');
                                req.brute.reset(() => {
                                    fbCreateToken(wpId, wpEmail, fbSubs);
                                });
                            } else {
                                notify('[Flow] Something went wrong in flow - wasn\'t able to create a token for user');
                                console.error('[Flow] Something went wrong in flow - wasn\'t able to create a token for user');
                                res.status(500).send({ errorCode: 'globalError', errorMsg: 'Something went terribly wrong in flow' }).end();
                            }
                        });
                    } else {
                        console.info('[Flow] Doing nothing because WP Login failed.');
                    }
                });

            // functions
            function fbGetUser(id, cb) {
                admin.auth().getUser(id)
                    .then((userRecord) => {
                        fbUserExist = true;
                        const user = userRecord.toJSON();
                        console.info(`[FB] User exist with e-mail: ${ user.email } | uid: ${ user.uid }`);

                        if (typeof cb === 'function') {
                            cb.call(cb);
                        }
                    })
                    .catch((error) => {
                        if (error.errorInfo.code === 'auth/user-not-found') {
                            console.info('[FB] User doesn\'t exist');
                            fbUserExist = false;
                        } else {
                            console.error('[FB] Unhandled error while fetching user: ', error.errorInfo);
                            notify('[FB] Unhandled error while fetching user: ', error.errorInfo);
                            // setting this only to skip requests and return error for user
                            fbUserExist = true;
                            wpLoggedIn = false;
                        }

                        if (typeof cb === 'function') {
                            cb.call(cb);
                        }
                    });
            }

            function fbCreateUser(id, mail, name, cb) {
                admin.auth().createUser({
                    uid: id,
                    email: mail,
                    emailVerified: true,
                    displayName: name
                })
                    .then((userRecord) => {
                        console.info('[FB] Successfully created new user with uid: ', userRecord.uid);
                        emit('user:created', {
                            user: userRecord.uid,
                            email: mail
                        });

                        if (typeof cb === 'function') {
                            cb.call(cb);
                        }
                    })
                    .catch((error) => {
                        console.error('[FB] Error creating new user: ', error);
                        notify('[FB] Error creating new user: ', error);

                        if (typeof cb === 'function') {
                            cb.call(cb);
                        }
                    });
            }

            function fbCreateToken(uid, mail, subs, cb) {
                // tip: additional claims can be used
                admin.auth().createCustomToken(uid, subs)
                    .then((customToken) => {
                        if (settings.debug) {
                            console.info(`[FB] Custom token for user ${ mail }: `, customToken);
                        } else {
                            console.info(`[FB] Custom token for user ${ mail } created`);
                            emit('user:login', {
                                user: uid,
                                email: mail
                            });
                        }

                        res.status(200).send({ token: customToken/*, email: mail, id: uid, subscriptions: subs*/ }).end();

                        if (typeof cb === 'function') {
                            cb.call(cb);
                        }
                    })
                    .catch((error) => {
                        console.error('[FB] Error creating custom token:', error);
                        notify('[FB] Error creating custom token:', error);

                        res.status(500).send({ errorCode: 'globalError', errorMsg: 'Something went wrong' }).end();

                        if (typeof cb === 'function') {
                            cb.call(cb);
                        }
                    });
            }

        }

    });

if (settings.debug) {
    app.listen(settings.appPort, () => {
        console.log(`Endpoint listening on http with port ${ settings.appPort }`);
    });
} else {
    const options = {
        key: fs.readFileSync(settings.serverKeyPath),
        cert: fs.readFileSync(settings.serverCrtPath),
        requestCert: true,
        rejectUnauthorized: false
    };

    https.createServer(options, app).listen(settings.appPort, () => {
        console.log(`Endpoint listening on https with port ${ settings.appPort }`);
    });
}

function setupFirebaseAdminSDK() {
    admin.initializeApp({
        credential: admin.credential.cert(settings.fbServiceAccount),
        databaseURL: settings.fbDatabaseUrl
    });
}

function verifyCloudFlare(req) {
    if (!verify(req.client.getPeerCertificate())) {
        req.client.destroy();
        return;
    }
}

function handleBotProt(req, res) {
    if (settings.debug || !settings.botProtection) {
        isBot = false;
    } else if (settings.botProtection) {
        botProtection(req.useragent, res);
    }
}

function botProtection(agent, res) {
    // todo: consider adding a check for isMobile there from agent
    if (agent.isBot || agent.isCurl || agent.isWinJs) {
        isBot = true;
        console.warn('[Security] Bot detected and blocked!');
        emit('bot:blocked', {
            userAgent: agent.source
        });
        res.writeHead(404);
        return res.end();
    } else {
        isBot = false;
    }
}

function rateLimitGuard() {
    if (settings.rateLimiter.enabled) {
        const limiter = new rateLimit({
            store: new redisRateLimitStore({
                expiry: settings.rateLimiter.expiry,
                prefix: settings.rateLimiter.prefix
            }),
            max: settings.rateLimiter.max,
            delayMs: settings.rateLimiter.delayMs,
            message: settings.rateLimiter.message
        });

        app.use(limiter);
    }
}

function bruteForceGuard() {
    if (settings.debug) {
        store = new brute.MemoryStore(); // stores state locally, don't use this in production
    } else {
        store = new redisBruteStore(settings.brute);
    }

    const storeFailCb = (req, res, next, nextValidRequestDate) => {
        console.info('Brute force protection triggered');
        emit('bruteforce:triggered', 'Brute force protection has been triggered');
        res.status(429).send({ errorCode: 'tooManyRequests', errorMsg: `You\'ve made too many failed attempts in a short period of time, please try again ${ moment(nextValidRequestDate).fromNow() }.` }).end();
    };
    const storeHandleErr = (error) => {
        notify('[Storage] There was an error related to redis: ', error);
        console.error('[Storage] There was an error related to redis: ', error);
        const errorMsg = {
            message: error.message,
            parent: error.parent
        };
        throw errorMsg;
    };
    // Start slowing requests after 5 failed attempts to do something for the same use
    userBruteforce = new brute(store, {
        freeRetries: 5,
        minWait: 5 * 60 * 1000, // 5 minutes
        maxWait: 60 * 60 * 1000, // 1 hour,
        failCallback: storeFailCb,
        handleStoreError: storeHandleErr
    });
    // No more than 1000 login attempts per day per IP
    globalBruteforce = new brute(store, {
        freeRetries: 1000,
        attachResetToRequest: false,
        refreshTimeoutOnRequest: false,
        minWait: 25 * 60 * 60 * 1000, // 1 day 1 hour (should never reach this wait time)
        maxWait: 25 * 60 * 60 * 1000, // 1 day 1 hour (should never reach this wait time)
        lifetime: 24 * 60 * 60, // 1 day (seconds not milliseconds)
        failCallback: storeFailCb,
        handleStoreError: storeHandleErr
    });
}

function setupLogging() {
    const logDirectory = path.join(__dirname, 'logs');
    fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
    accessLogStream = rfs('requests.log', {
        interval: settings.logRetention,
        path: logDirectory
    });
}

function setupMiddlewares() {
    const rawBodySaver = (req, res, buf, encoding) => {
        if (buf && buf.length) {
            req.rawBody = buf.toString(encoding || 'utf8');
        }
    };

    const jsonOpts = {
        verify: rawBodySaver
    };

    const urlencodedOpts = {
        verify: rawBodySaver,
        extended: true
    };

    const rawOpts = {
        verify: rawBodySaver,
        type: '*/*'
    };

    if (settings.debug) {
        console.info('Not saving requests.log to file');
        app.use(morgan(settings.logFormat));
    } else {
        console.info('Saving requests.log to file');
        app.use(morgan(settings.logFormat, { stream: accessLogStream }));
    }

    if (settings.pmxMonitoring) {
        app.use(pmxMonitor.expressErrorHandler());
    }

    // todo: consider turning referrer policy on in helmet config
    app.use(helmet(settings.helmetConfig));
    app.use(cors());
    app.use(timeout(settings.timeout));
    app.use(ua.express());
    app.use(haltOnTimedout);
    app.use(bodyParser.json(jsonOpts));
    app.use(haltOnTimedout);
    app.use(bodyParser.urlencoded(urlencodedOpts));
    app.use(haltOnTimedout);
    app.use(bodyParser.raw(rawOpts));
    app.use(haltOnTimedout);
}

function haltOnTimedout(req, res, next) {
    if (!req.timedout) {
        next();
    }
}

function notify(msg) {
    if (settings.pmxMonitoring) {
        pmxMonitor.notify(new Error(msg));
    }
    if (settings.newRelicEvents) {
        newrelic.noticeError(new Error(msg), []);
    }
}

function emit(event, msg) {
    if (settings.pmxMonitoring) {
        pmxMonitor.emit(event, msg);
    }
    if (settings.newRelicEvents) {
        newrelic.recordCustomEvent(event, msg);
    }
}
