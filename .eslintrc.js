module.exports = {
    "extends": "walmart/configurations/es6-node",
    "plugins": [
        "import",
        "babel",
        "mocha"
    ],
    "parser": "babel-eslint",
    "parserOptions": {
        "sourceType": "module"
    },
    "rules": {
        "mocha/no-exclusive-tests": "error",
        "indent": ["error", 4],
        "quotes": ["error", "single"],
        "no-console": 0,
        "max-params": ["error", 4],
        "eol-last": 0,
        "no-magic-numbers": 0,
        "func-style": 0,
        "no-use-before-define": 0,
        "valid-jsdoc": 0,
        "max-len": 0,
        "max-nested-callbacks": 0,
        "max-statements": 0,
        "consistent-return": 0,
        "new-cap": 0,
        "callback-return": 0
    },
    "env": {
        "node": true,
        "es6": true,
        "mocha": true
    }
};
