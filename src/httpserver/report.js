class Report {
    constructor(app) {
        this.app = app;
        this._isSyncingMethodExist = true; //default we will try to call web3.eth.isSyncing.
    }

    async checkDatabase() {
        try {
            const isHealthy = (await this.app.db.sysQueries.healthCheck()) !== undefined;
            return {isHealthy, reason: ''};
        } catch (err) {
            this.app.logger.error(`Report.checkDatabase(): ${err}`);
            return {isHealthy: false, reason: `Database check failed: ${err.message}`};
        }
    }

    async checkRPCSyncing() {
        if (!this._isSyncingMethodExist) {
            return {isHealthy: true, reason: 'RPC does not implement web3.eth.isSyncing'};
        }

        try {
            const isSyncing = await this.app.client.RPCClient.web3.eth.isSyncing();
            return {isHealthy: !isSyncing, reason: isSyncing ? 'RPC is syncing' : ''};
        } catch (err) {
            this._isSyncingMethodExist = false;
            this.app.logger.error('Report.checkRPCSyncing()', err);
            return {isHealthy: false, reason: `RPC syncing check failed: ${err.message}`};
        }
    }

    async checkRPCStuck() {

        const waitingForNewBlocksSince = this.awaitingForNewBlocksSince();
        const rpcStuckThreshold = this.app.config.RPC_STUCK_THRESHOLD;
        const isStuck = waitingForNewBlocksSince > rpcStuckThreshold;
        const reason = isStuck ? `RPC is stuck. No new blocks for ${waitingForNewBlocksSince} s` : '';
        return {isHealthy: !isStuck, reason};
    }

    awaitingForNewBlocksSince() {
        const currentTime = Date.now();
        const lastTimeNewBlocks = this.app.eventTracker.lastTimeNewBlocks.getTime();
        return Math.floor(Math.abs(currentTime - lastTimeNewBlocks) / 1000);
    }


    async fullReport() {

        const healthDiagnostics = {
            database: await this.checkDatabase(),
            rpcSyncing: await this.checkRPCSyncing(),
            rpcStuck: await this.checkRPCStuck()
        };

        const overallHealthy = Object.values(healthDiagnostics).every(check => check.isHealthy);
        const reasons = Object.entries(healthDiagnostics)
            .filter(([_, check]) => !check.isHealthy)
            .map(([key, check]) => `${key}: ${check.reason}`);

        return {
            timestamp: Date.now(),
            healthy: overallHealthy,
            reasons: reasons,

            process: {
                uptime: Math.floor(process.uptime()),
                pid: process.pid
            },

            network: {
                chainId: await this.app.client.getChainId(),
                rpc: {
                    rpcProvider: (new URL(this.app.config.HTTP_RPC_NODE)).hostname,
                    totalRequests: this.app.client.getTotalRequests(),
                    isSyncing: healthDiagnostics.rpcSyncing.isHealthy,
                    lastTimeNewBlocks: this.app.eventTracker.lastTimeNewBlocks,
                    waitingForNewBlocksSince: this.awaitingForNewBlocksSince(),
                    msg: this._isSyncingMethodExist ? "" : "RPC doesn't implement web3.eth.isSyncing",
                }
            },

            ...(this.app.config.OBSERVER ? {} : {
                account: {
                    address: this.app.client.getAccountAddress(),
                    balance: (await this.app.client.getAccountBalance()).toString(),
                }
            }),

            queues: {
                agreementQueue: this.app.queues.getAgreementQueueLength(),
                estimationQueue: this.app.queues.getEstimationQueueLength()
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
