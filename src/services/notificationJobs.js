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
    const healthData = `Healthy: ${healthcheck.healthy}\nChainId: ${healthcheck.network.chainId}\nAccount: ${healthcheck.account.address}: ${wad4human(healthcheck.account.balance)}`;
    this.app.notifier.sendNotification(healthData);
  }

  async start () {
      // run every hour ( value in ms)
      //this.run(this, 3600000);
      this.run(this, 10000);
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