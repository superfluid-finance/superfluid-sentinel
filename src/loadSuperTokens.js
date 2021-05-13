const SystemModel = require("./database/models/systemModel");
const async = require("async");
class LoadSuperTokens {

    constructor(app) {
        this.app = app;
        this.concurrency = this.app.config.CONCURRENCY;
    }

    async start() {
        try {
            console.log("getting Past event to find SuperTokens");
            console.debug("using concurrency: ", this.concurrency);
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

            var queue = async.queue(async function(task) {
                console.log(`${task.fromBlock} - ${task.toBlock}`);
                pastEvents = pastEvents.concat(
                    await CFA.getPastEvents(
                        "FlowUpdated", {
                            fromBlock: task.fromBlock,
                            toBlock: task.toBlock
                        })
                );
            }, this.concurency);

            while(pullCounter <= currentBlockNumber) {
                let end = (pullCounter + parseInt(this.app.config.PULL_STEP));
                queue.push({
                    fromBlock: pullCounter,
                    toBlock: end > currentBlockNumber ? currentBlockNumber : end
                });
                pullCounter = end;
            }
            await queue.drain();
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
            console.log("finish Past event to find SuperTokens");
        } catch(error) {
            this.app.logger.error(`error getting pasted events\n ${error}`);
            process.exit(1);
        }
    }
}

module.exports = LoadSuperTokens;