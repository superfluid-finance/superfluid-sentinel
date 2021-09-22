const express = require("express");
const Report = require("./report");

class HTTPServer {

    constructor(app) {
        this.app = app;
        this.server = express();
        this.runningInstance;
        this.port = this.app.config.HTTP_SERVER_PORT;
        this.healthReport = new Report(app);
    }

    start() {
        this.server.get('/', async (req, res) => {
            const healthcheck = {
                statusCode: 200,
                message: 'OK',
                timestamp: Date.now(),
                detailReport: await this.healthReport.fullReport()
            };
            try {
                res.send(healthcheck);
            } catch (e) {
                healthcheck.message = e;
                res.status(503).send();
            }
        });


        this.server.get('/nextliquidations', async (req, res) => {
            try {
                res.send(await this.app.db.queries.getLiquidations(
                    this.app.time.getTimeWithDelay(-3600),
                    this.app.config.TOKENS)
                );
            } catch (e) {
                liquidations.message = e;
                res.status(503).send();
            }
        });

        this.runningInstance = this.server.listen(this.port, () => {
            this.app.logger.info(`listening at http://localhost:${this.port}`)
        });
    }

    close() {
        this.runningInstance.close(() => {
            console.debug('HTTP server closed')
          })
    }
}

module.exports = HTTPServer



