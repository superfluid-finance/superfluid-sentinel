const axios = require("axios");
class Telemetry {

    constructor(app) {
        this.app = app;
        this._isShutdown = false;
    }
    //post report data to endpoint
    async start() {
        try {
            if (this.app._isShutdown) {
                this._isShutdown = true;
                this.app.logger.info(`app.shutdown() - closing telemetry`);
                return;
            }
            if(this.app.config.TELEMETRY_ENDPOINT) {
                const resp = await axios(
                    this.app.config.TELEMETRY_ENDPOINT,
                    await this.app.healthReport.fullReport()
                );
                return {
                    error: undefined,
                    msg: resp
                }
            } else {
                return {
                    error: new Error("Telemetry.start() - no endpoint to send data"),
                    msg: undefined
                }
            }
        } catch(err) {
            this.app.logger.error(`Telemetry.sendReport() - ${err}`);
            return {
                error: err,
                msg: undefined
            };
        }
    }
}

module.exports = Telemetry;