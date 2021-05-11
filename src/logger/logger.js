const ora = require("ora");

class Logger {

    constructor(app) {
        this.spinner = new ora({
            spinner: "dots6"
        });
        this.app = app;
    }

    startSpinner(message) {
        this.spinner.start(message);
    }

    stopSpinnerWithSuccess(message) {
        this.spinner.succeed(message);
    }

    stopSpinnerWithError(message) {
        this.spinner.fail(message);
    }

    spotSpinnerWithWarn(message) {
        this.spinner.warn(message);
    }

    spotSpinnerWithInfo(message) {
        this.spinner.info(message);
    }

    log(message) {
        console.log(message);
    }

    info(message) {
        console.info(message);
    }

    debug(message) {
        console.debug(message);
    }

    error(message) {
        console.error(message);
    }

    warn(message) {
        console.warn(message);
    }
}

module.exports = Logger;