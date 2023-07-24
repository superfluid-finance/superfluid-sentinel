class Report {
  constructor (app) {
    this.app = app;
    this._isSyncingMethodExist = true; //default we will try to call web3.eth.isSyncing.
  }

  async checkDatabase () {
    try {
      return (await this.app.db.queries.healthCheck()) !== undefined;
    } catch (err) {
      this.app.logger.error(`Report.checkDatabase(): ${err}`);
      return false;
    }
  }

  async fullReport () {
    let rpcIsSyncing = false;
    // not available on all networks
    if(this._isSyncingMethodExist) {
      try {
        rpcIsSyncing = await this.app.client.RPCClient.web3.eth.isSyncing();
      } catch(err) {
        this._isSyncingMethodExist = false;
        this.app.logger.error(`report.fullReport() - web3.eth.isSyncing failed: ${err}`);
      }
    }

    const databaseOk = await this.checkDatabase();
    const estimationQueueSize = this.app.queues.getEstimationQueueLength();
    const agreementQueueSize = this.app.queues.getAgreementQueueLength();
    const lastTimeNewBlocks = this.app.eventTracker.lastTimeNewBlocks;
    const waitingForNewBlocksSince = Math.floor(Math.abs(new Date() - lastTimeNewBlocks) / 1000);
    const RPCStuck = waitingForNewBlocksSince * 1000 > this.app.config.POLLING_INTERVAL * 2;
    const overallHealthy = rpcIsSyncing === false && databaseOk && !RPCStuck;
    return {
      timestamp: Date.now(),
      healthy: overallHealthy,
      process: {
        uptime: Math.floor(process.uptime()),
        pid: process.pid
      },
      network: {
        chainId: await this.app.client.getChainId(),
        rpc: {
          totalRequests: this.app.client.getTotalRequests(),
          isSyncing: rpcIsSyncing,
          lastTimeNewBlocks: lastTimeNewBlocks,
          waitingForNewBlocksSince: waitingForNewBlocksSince,
          msg: this._isSyncingMethodExist ? "" : "RPC doesn't implement web3.eth.isSyncing",
        }
      },
      account: {
        address: this.app.client.getAccountAddress(),
        balance: await this.app.client.getAccountBalance()
      },
      queues: {
        agreementQueue: agreementQueueSize,
        estimationQueue: estimationQueueSize
      },
      protocol: {
        cfa: this.app.client.contracts.getCFAv1Address(),
        ida: this.app.client.contracts.getIDAv1Address(),
        gda: this.app.client.contracts.getGDAv1Address(),
        supertokens: Object.values(this.app.client.superToken.superTokenNames)
      }
    };
  }
}

module.exports = Report;
