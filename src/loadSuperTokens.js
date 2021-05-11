const SystemModel = require("./database/models/systemModel");
class LoadSuperTokens {

    constructor(app) {
        this.app = app;
    }

    async start() {
        try {
            console.log("Getting Past event to find SuperTokens");
            const runningNetwork = await this.app.client.getNetworkId();
            const systemInfo = await SystemModel.findOne();
            let blockNumber = parseInt(this.app.config.EPOCH_BLOCK);
            if(systemInfo !== null) {
               blockNumber = systemInfo.superTokenBlockNumber;
               if(runningNetwork !== systemInfo.networkId) {
                    throw "different network than from the saved data";
                }
            }
            const CFA = this.app.client.CFAv1;
            let pastEvents = new Array();
            let pullCounter = blockNumber;
            let currentBlockNumber = await this.app.client.getCurrentBlockNumber();
            while(pullCounter <= currentBlockNumber) {
                let end = (pullCounter + parseInt(this.app.config.PULL_STEP));
                console.log(`${pullCounter} - ${end}`);
                pastEvents = pastEvents.concat(
                    await CFA.getPastEvents(
                        "FlowUpdated", {
                            fromBlock: pullCounter,
                            toBlock: end > currentBlockNumber ? currentBlockNumber : end
                        })
                );
                pullCounter = end;
            }
            // normalize web3 events
            pastEvents = pastEvents.map(this.app.models.event.transformWeb3Event);
            const tokens = [...new Set(pastEvents.map(({token})=>token))];
            //fresh database
            if(systemInfo === null) {
                await SystemModel.create({
                    blockNumber: blockNumber,
                    networkId :await this.app.client.getNetworkId(),
                    superTokenBlockNumber : currentBlockNumber
                });
            } else {
                systemInfo.superTokenBlockNumber = currentBlockNumber;
                await systemInfo.save();
            }
            await this.app.client.loadSuperTokens(tokens);
        } catch(error) {
            this.app.logger.error(`error getting pasted events\n ${error}`);
            process.exit(1);
        }
    }
}

module.exports = LoadSuperTokens;


