const {wad4human} = require("@decentral.ee/web3-helpers/src/math-utils");

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));
async function trigger (obj, ms) {
  await timeout(ms);
  await obj.sendReport();
}

class NotificationJobs {
  constructor(app) {
    this.app = app;
  }

  async sendReport () {
    const healthcheck = await this.app.healthReport.fullReport();
    if(!healthcheck.healthy) {
      const healthData = `Healthy: ${healthcheck.healthy}\nChainId: ${healthcheck.network.chainId}`;
      this.app.notifier.sendNotification(healthData);
    }
  }

  async start () {
    // run every hour ( value in ms)
    this.run(this, 3600*1000);
  }

  async run (self, time) {
    if (self.app._isShutdown) {
      self.app.logger.info(`app.shutdown() - closing NotificationJobs`);
      return;
    }
    await trigger(self, time);
    await this.run(self, time);
  }
}

module.exports = NotificationJobs;