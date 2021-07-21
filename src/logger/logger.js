const winston = require("winston");
const ArrayTransport = require("winston-array-transport");

class Logger {

    constructor(app) {
        this.app = app;
        this.logs = new Array();
        this.logger = winston.createLogger({
            transports: [
                new winston.transports.Console(),
                new ArrayTransport({ array: this.logs, json: true, level: 'error' })
            ]
        });
    }

    log(message) {
        this.logger.log("info", message);
    }

    info(message) {
        this.logger.info(message);
    }

    debug(message) {
        this.logger.debug(message);
    }

    error(message) {
        this.logger.error(message);
    }

    warn(message) {
        this.logger.warn(message);
    }
}

module.exports = Logger;