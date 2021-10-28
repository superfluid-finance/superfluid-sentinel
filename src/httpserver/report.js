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
        return {
            process: {
                uptime: process.uptime(),
                pid: process.pid
            },
            network: {
                chainId: await this.app.client.getNetworkId()
            },
            rpc: {
                totalRequests: this.app.client.getTotalRequests(),
                isSyncing : await  this.app.client.web3.eth.isSyncing()
            },
            db: {
                healthCheck: await this.checkDatabase()
            },
            agent_account: {
                address: this.app.client.getAccountAddress(),
                balance: await this.app.client.getAccountBalance(),
            },
        };
    }
}


module.exports = Report;