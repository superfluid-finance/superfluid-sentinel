class Report {

    constructor(app) {
        this.app = app;
    }

    async checkDatabase() {
        try {
            return (await this.app.db.queries.healthCheck()) !== undefined;
        } catch(err) {
            console.log(err);
            return false;
        }
    }

    async fullReport() {
        const rpcIsSyncing = await  this.app.client.web3.eth.isSyncing();
        const databaseOk = await this.checkDatabase();
        const estimationQueueSize = this.app.queues.getEstimationQueueLength();
        const agreementQueueSize = this.app.queues.getAgreementQueueLength();
        const lastTimeNewBlocks = this.app.eventTracker.lastTimeNewBlocks;
        const waitingForNewBlocksSince = Math.floor(Math.abs(new Date() - lastTimeNewBlocks) / 1000);
        const RPCStuck = waitingForNewBlocksSince * 1000 > this.app.config.POLLING_INTERVAL * 2;
        const overallHealthy = rpcIsSyncing === false && databaseOk && !RPCStuck;
        // TODO: add DB stats - size, nr table entries
        // TODO: add liquidation stats: past and future 1h, 24h, 30d
        // TODO add PIC status
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
                    lastTimeNewBlocks : lastTimeNewBlocks,
                    waitingForNewBlocksSince : waitingForNewBlocksSince
                }
            },
            account: {
                address: this.app.client.getAccountAddress(),
                balance: await this.app.client.getAccountBalance()
            },
            queues: {
                agreementQueue : agreementQueueSize,
                estimationQueue : estimationQueueSize
            },
            protocol: {
                cfa: this.app.client.CFAv1._address,
                ida: this.app.client.IDAv1._address,
                supertokens: Object.values(this.app.client.superTokenNames)
            }
        };
    }
}


module.exports = Report;