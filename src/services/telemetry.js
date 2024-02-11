const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const appVersion = require("../../package").version;

const UUID_FILE = "data/uuid.txt";

// Implements functionality for creating prometheus formatted reports and sending them to a telemetry endpoint.
class Telemetry {
  constructor (app, httpClient) {
    this.app = app;
    this._isShutdown = false;
    this.uuid = undefined;
    this.httpClient = httpClient === undefined ? require("axios") : httpClient;
  }

  async start () {
    try {
      if (this.app._isShutdown) {
        this._isShutdown = true;
        this.app.logger.info("app.shutdown() - closing telemetry");
        return;
      }

      // Read persisted uuid or create new one if it doesn't exist.
      if (this.uuid === undefined) {
        this.app.logger.debug("trying to load uuid from file");
        try {
          this.uuid = fs.readFileSync(UUID_FILE, "utf8");
          this.app.logger.debug(`loaded uuid: ${this.uuid}`);
        } catch (err) {
          this.app.logger.debug("uuid.txt not found, creating new uuid");
          this.uuid = uuidv4();
          fs.writeFileSync(UUID_FILE, this.uuid);
          this.app.logger.info(`created new uuid: ${this.uuid}`);
        }
      }

      if (this.app.config.TELEMETRY_URL) {
        const reportData = this.createReport(await this.app.healthReport.fullReport());
        this.app.logger.info(`sending data to telemetry with uuid ${this.uuid}`);
        const resp = await this.httpClient({
          method: "post",
          url: this.app.config.TELEMETRY_URL,
          data: reportData,
          headers: { "Content-Type": "text/plain" }
        });

        return {
          error: undefined,
          msg: resp
        };
      } else {
        return {
          error: new Error("Telemetry.start() - no endpoint to send data"),
          msg: undefined
        };
      }
    } catch (err) {
      this.app.logger.error(`Telemetry.sendReport() - ${err}`);
      return {
        error: err,
        msg: undefined
      };
    }
  }

  // returns a telemetry report (as string), reusing data from a provided health report.
  // TODO: add info about pic config, nr of observed tokens, estimation points, nr of upcoming liquidations, nr of DB queries
  createReport (healthReport) {
    // only include labels which don't have high cardinality
    const labels = `app_uuid="${this.uuid}",chain_id="${healthReport.network.chainId}",app_version="${appVersion}",node_version="${process.version}"`;

    return `
# HELP sentinel_telemetry_uptime Total uptime of the application in seconds.
# TYPE sentinel_telemetry_uptime gauge
sentinel_telemetry_uptime{${labels}} ${healthReport.process.uptime}

# HELP sentinel_telemetry_healthy Health status of the application, 1 for healthy and 0 for unhealthy.
# TYPE sentinel_telemetry_healthy gauge
sentinel_telemetry_healthy{${labels}} ${healthReport.healthy ? 1 : 0}

# HELP sentinel_telemetry_rpc_requests Total number of RPC requests made since last restart.
# TYPE sentinel_telemetry_rpc_requests counter
sentinel_telemetry_rpc_requests{${labels}} ${healthReport.network.rpc.totalRequests}
` +
(healthReport.account.balance
  ? `# HELP sentinel_telemetry_account_balance Balance of the monitored account, rounded to 3 decimal places.
# TYPE sentinel_telemetry_account_balance gauge
sentinel_telemetry_account_balance{${labels}} ${Math.floor(parseInt(healthReport.account.balance) / 1e15) / 1e3}
`
  : "") +
`# HELP sentinel_telemetry_memory_used Amount of memory used by the process in bytes, as reported by process.memoryUsage().heapUsed
# TYPE sentinel_telemetry_memory_used gauge
sentinel_telemetry_memory_used{${labels}} ${process.memoryUsage().heapUsed}
`;
  }
}

module.exports = Telemetry;
