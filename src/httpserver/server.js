const express = require("express");
const promclient = require('prom-client');

class HTTPServer {
  constructor (app) {
    this.app = app;
    this.server = express();
    this.port = this.app.config.METRICS_PORT;
    const register = new promclient.Registry();
    this.register = register;
    promclient.collectDefaultMetrics({
      app: 'sentinel-monitoring-app',
      timeout: 10000,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      register
    });

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
        this.app.config.TOKENS,
        this.app.config.EXCLUDED_TOKENS
      );
      try {
        res.send(liquidations);
      } catch (e) {
        liquidations.message = e;
        res.status(503).send();
      }
    });

    this.server.get('/metrics', async (req, res) => {
      res.setHeader('Content-Type', this.register.contentType);
      res.send(await this.register.metrics());
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
