# wordpress-firebase-auth-bridge
This is an API endpoint which is used by [BRCS - Bot Remote Control System](https://github.com/drptbl/remotecontrol-app).<br>
It allows to authenticate users in `Firebase` with `Wordpress` details (using `jwt`).<br>
If user doesn't exist in `Firebase` it will be created first and then authenticated.

It works one-way-only so it creates and authenticates users from `Wordpress` in `Firebase` (doesn't work vice-versa yet).

In general what I wanted to achieve and what I actually achieved using this:
- I've made a `Wordpress Woocommerce` online shop and wanted users from mobile app to have exactly the same authentication database as users from online shop
- Users using online shop were authenticated by `Wordpress` database, but users using mobile app were authenticated by `Wordpress` first, then "copied" over to `Firebase` auth and then logged in to mobile app using `Firebase` SDK

You are thinking.. why not `Wordpress` only? Because I love `Firebase` features for mobile apps!

## Features:
- fully customizable
- integrated with `pm2` for auto-restarting, deployment and auto-scaling
- rate limiting & brute force protection (uses redis in production to maintain banned users)
- anti-ddos protection
- bot protection (throws `404` for bots and crawlers)
- integrated with `cloudflare` protection
- saves logs to file
- accept requests only from custom user agent (endpoint was used only by mobile app)
- well integrated with [pmx monitor](http://docs.keymetrics.io/) & [new relic](https://github.com/newrelic/node-newrelic)

## Endpoints:
- status endpoint - `/fb/status` => `GET`
- auth endpoint - `/fb/auth` => `POST` => format: `{"username":"test","password":"test"}`

## Requirements:
- `WP REST API V2` enabled
- [JWT Authentication for the WP REST API](https://github.com/Tmeister/wp-api-jwt-auth) enabled

## Setup:
I will be honest here. There may be some steps missing so you will have to figure it out yourself (I've stopped using it because mobile app which uses it is not developed anymore).
1. Install `npm install --g babel-cli pm2`
2. Clone repository
3. Run `npm install`
4. Modify settings in these files:
    - `./keys/server.crt` && `./keys/server.key` => generate your own keys
    - `./serviceAccountKey.json` => get whole file from `Firebase` project
    - `./newrelic.js`
    - `./ecosystem.config.js`
    - `./dev_ecosystem.config.js`
    - `./settings.js`
    - `./package.json` => modify name of your app (if changed) in pre-defined commands

## Things to keep-in-mind:
- add your ssh key to deployment machine
- configure `pm2` on your deployment machine (`pm2 link`)
- you could install some useful plugins for `pmx monitor` on deployment machine:
    (keep in mind that each of these has to be configured separately, also some of them are useless if you're not going to run `Wordpress` on same machine with `Login API`)
    - `pm2 install pm2-server-monit`
    - `pm2 install pm2-php-fpm`
    - `pm2 install pm2-memcached`
    - `pm2 install pm2-mysql`
    - `pm2 install pm2-slack`
    - `pm2 install pm2-logrotate`
- you have to open some ports (for example in AWS security group => `2096` for API and `43554` for `pmx monitor` in my case)
- if I recall correctly I had to exclude auth endpoint from `cloudflare` caching (somewhere on theirs website in domain settings)


## Usage example:
- Run setup first: `pm2 deploy ecosystem.config.js dev setup`
- Then.. deploy!: `pm2 deploy ecosystem.config.js prod`
- And save process to be run on next startup: `pm2 save`

## Useful commands:
You can do all these steps above with one command `npm run pm2devcleandeploy`<br>
or if you already did setup you can do `npm run pm2devdeploy`.<br>
You can also remotely destroy already running instances with: `npm run pm2devdeploydestroy`<br>
and read logs using `npm run pm2devdeploylogs` or clean them up with `npm run pm2devdeploycleanup`.