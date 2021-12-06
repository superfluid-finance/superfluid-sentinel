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
        //const sentinelBalance = await this.app.client.getAccountBalance() ?
        //const hit gas limit
        //size of queues
        const estimationQueueSize = this.app.queues.getEstimationQueueLength();
        const agreementQueueSize = this.app.queues.getAgreementQueueLength();
        //circular buffer:
            //how many tries until inclusing of tx
            //gas price
        const lastTimeNewBlocks = this.app.eventTracker.lastTimeNewBlocks;
        const waitingForNewBlocksAt = Math.floor(Math.abs(new Date() - lastTimeNewBlocks) / 1000);
        const RPCStuck = waitingForNewBlocksAt * 1000 > this.app.config.POLLING_INTERNVAL * 2;
        const overallHealthy = rpcIsSyncing === false && databaseOk;

        // TODO: add DB stats - size, nr table entries
        // TODO: add liquidation stats: past and future 1h, 24h, 30d
        // TODO add PIC status
        return {
            timestamp: Date.now(),
            healthy: overallHealthy,
            process: {
                uptime: process.uptime(),
                pid: process.pid
            },
            network: {
                chainId: await this.app.client.getChainId(),
                rpc: {
                    totalRequests: this.app.client.getTotalRequests(),
                    isSyncing: rpcIsSyncing,
                    lastTimeNewBlocks : lastTimeNewBlocks,
                    waitingForNewBlocksAt : waitingForNewBlocksAt
                }
            },
            account: {
                address: this.app.client.getAccountAddress(),
                balance: await this.app.client.getAccountBalance()
            },
            queues: {
                agreementQueue : agreementQueueSize,
                estimationQueue : estimationQueueSize
            }
        };
    }
}


module.exports = Report;