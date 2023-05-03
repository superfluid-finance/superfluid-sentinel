const BN = require("bn.js");
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
    const accountBalance = await this.app.client.getAccountBalance();
    if(new BN(accountBalance).lt(new BN(this.app.config.SENTINEL_BALANCE_THRESHOLD))) {
      const balanceData = `Attention: Sentinel balance: ${wad4human(accountBalance)}`;
       this.app.notifier.sendNotification(balanceData);
    }
  }

  async start () {
    // run every 5 min ( value in ms)
    this.run(this, 300000);
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