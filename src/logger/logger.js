const winston = require('winston');

class Logger {

    constructor(app) {
        this.app = app;
        this.logger = winston.createLogger({
            transports: [
                new winston.transports.Console()
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