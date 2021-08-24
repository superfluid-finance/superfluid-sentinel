const { createLogger, format, transports } = require("winston");
const { combine, timestamp, label, printf } = format;
const ArrayTransport = require("winston-array-transport");

class Logger {

    constructor(app) {
        this.app = app;
        this.logs = new Array();
        const logFormat = printf(({ level, message, label, timestamp }) => {
            return `${timestamp} - ${level}: ${message}`;
        });
        this.logger = createLogger({
            format: combine(label({ label: this.level }), timestamp(), logFormat),
            transports: [
                new transports.Console({
                    level: "info",
                    handleExceptions: true,
                    json: false,
                    colorize: true,
                }),
                new ArrayTransport({ array: this.logs, json: true, level: "error" })
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
        if(this.app.config.shutdownOnError) {
            this.app.shutdown();
        }
    }

    warn(message) {
        this.logger.warn(message);
    }
}

module.exports = Logger;