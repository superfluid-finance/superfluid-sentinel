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

        const isSyncing = await  this.app.client.web3.eth.isSyncing();
        const checkDatabase = await this.checkDatabase();
        //const sentinelBalance = await this.app.client.getAccountBalance() ?
        //const hit gas limit
        //size of queues
        const estimationQueueSize = this.app.queues.getEstimationQueueLength();
        const agreementQueueSize = this.app.queues.getAgreementQueueLength();
        //circular buffer:
            //how many tries until inclusing of tx
            //gas price
        const status = isSyncing !== false && !checkDatabase;

        return {
            process: {
                uptime: process.uptime(),
                pid: process.pid
            },
            network: {
                chainId: await this.app.client.getChainId()
            },
            status : {
                reboot: status
            },
            internal: {
                agreementQueue : agreementQueueSize,
                estimationQueue : estimationQueueSize
            },
            rpc: {
                totalRequests: this.app.client.getTotalRequests(),
                isSyncing : isSyncing
            },
            db: {
                healthCheck: checkDatabase
            },
            agent_account: {
                address: this.app.client.getAccountAddress(),
                balance: await this.app.client.getAccountBalance(),
            },
        };
    }
}


module.exports = Report;