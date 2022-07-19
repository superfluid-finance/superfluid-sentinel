const express = require("express");
const Metrics = require("../metrics/metrics");

class HTTPServer {
  constructor (app) {
    this.app = app;
    this.server = express();
    this.port = this.app.config.METRICS_PORT;
    this.metrics = new Metrics(app);
  }

  start () {
    this.server.get("/", async (req, res) => {
      const healthcheck = await this.app.healthReport.fullReport();
      try {
        res.send(healthcheck);
      } catch (e) {
        healthcheck.message = e;
        res.status(503).send();
      }
    });

    this.server.get("/nextliquidations", async (req, res) => {
      const liquidations = await this.app.db.queries.getLiquidations(
        this.app.time.getTimeWithDelay(-3600),
        this.app.config.TOKENS);
      try {
        res.send(liquidations);
      } catch (e) {
        liquidations.message = e;
        res.status(503).send();
      }
    });

    this.server.get('/metrics', async (req, res) => {
      res.setHeader('Content-Type', this.metrics.register.contentType);
      res.send(await this.metrics.getMetrics());
    });

    this.runningInstance = this.server.listen(this.port, () => {
      this.app.logger.info(`Metrics: listening via http on port ${this.port}`);
    });
  }

  close () {
    this.runningInstance.close(() => {
      console.debug("HTTP server closed");
    });
  }
}

module.exports = HTTPServer;
