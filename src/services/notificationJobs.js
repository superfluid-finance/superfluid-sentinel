const { wad4human } = require('@decentral.ee/web3-helpers/src/math-utils')
const timeout = ms => new Promise(resolve => setTimeout(resolve, ms))
async function trigger (obj, ms) {
  await timeout(ms)
  await obj.sendReport()
}
// if balance report interval is <= 5 min will always send a balance alert because global report interval is 5 min
const BALANCE_REPORT_INTERVAL = 12 * 1000 * 60 * 60 // 12 hours

class NotificationJobs {
  constructor (app) {
    this.app = app
    this._lastBalanceReportTime = Date.now()
  }

  async sendReport () {
    const healthcheck = await this.app.healthReport.fullReport()
    if (!healthcheck.healthy) {
      const healthData = `Instance Name: ${this.app.config.INSTANCE_NAME}\nHealthy: ${healthcheck.healthy}\nChainId: ${healthcheck.network.chainId}\nReasons: ${healthcheck.reasons.join('\n')}`
      this.app.notifier.sendNotification(healthData)
    }
    const currentTime = Date.now()
    if (currentTime - this._lastBalanceReportTime >= BALANCE_REPORT_INTERVAL) {
      const balanceQuery = await this.app.client.isAccountBalanceBelowMinimum()
      if (balanceQuery.isBelow) {
        this.app.notifier.sendNotification(`Attention: Sentinel balance: ${wad4human(balanceQuery.balance)}`)
        // update the time of last balance report
        this._lastBalanceReportTime = currentTime
      }
    }
  }

  async start () {
    // run every 5 min ( value in ms)
    this.run(this, 300000)
  }

  async run (self, time) {
    if (self.app._isShutdown) {
      self.app.logger.info('app.shutdown() - closing NotificationJobs')
      return
    }
    await trigger(self, time)
    await this.run(self, time)
  }
}

module.exports = NotificationJobs
