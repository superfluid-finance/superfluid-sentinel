const SystemModel = require("./database/models/systemModel");
const FlowUpdatedModel = require("./database/models/flowUpdatedModel");
const async = require("async");
class LoadEvents {

    constructor(app) {
        this.app = app;
        this.concurrency = this.app.config.CONCURRENCY;
        this.numRetries = this.app.config.NUM_RETRIES;
    }

    async start() {
        try {
            console.debug("getting Past event to find SuperTokens");
            console.debug("using concurrency: ", this.concurrency);
            const runningNetwork = await this.app.client.getNetworkId();
            const systemInfo = await SystemModel.findOne();
            const lastEventBlockNumber = await FlowUpdatedModel.findOne({
                order: [['blockNumber', 'DESC']]
            });
            let blockNumber = lastEventBlockNumber === null 
                ? parseInt(this.app.config.EPOCH_BLOCK) : lastEventBlockNumber.blockNumber;
            if(systemInfo !== null) {
                if(systemInfo.superTokenBlockNumber > blockNumber) {
                    blockNumber = systemInfo.superTokenBlockNumber;
                }
                if(runningNetwork !== systemInfo.networkId) {
                    throw "different network than from the saved data";
                }
            }
            const CFA = this.app.client.CFAv1;
            let pullCounter = blockNumber;
            let currentBlockNumber = await this.app.client.getCurrentBlockNumber();
            console.debug(`scanning blocks from ${pullCounter} to ${currentBlockNumber}`);
            var queue = async.queue(async function(task) {
                let keepTrying = 1;
                while(keepTrying > 0) {
                    try {
                        if(keepTrying == 2) {
                            console.debug(`reopen http connection`);
                            await task.self.app.client.reInitHttp();
                        }
                        console.log(`#${keepTrying} - ${task.fromBlock} - ${task.toBlock}`);
                        let result = await task.self.app.protocol.getAgreementEvents(
                            "FlowUpdated", {
                                fromBlock: task.fromBlock,
                                toBlock: task.toBlock
                            },
                            keepTrying > 5 ? true : false
                        );

                        result = result.map(task.self.app.models.event.transformWeb3Event);
                        for(let event of result) {
                                const agreementId = task.self.app.protocol.generateId(event.sender, event.receiver);
                                const hashId = task.self.app.protocol.generateId(event.token, agreementId); 
                                await FlowUpdatedModel.upsert({
                                    address: event.address,
                                    blockNumber: event.blockNumber,
                                    superToken: event.token,
                                    sender: event.sender,
                                    receiver: event.receiver,
                                    flowRate: event.flowRate,
                                    agreementId: agreementId,
                                    hashId: hashId
                                });
                        } 
                        keepTrying = 0;
                    } catch(error) {
                        keepTrying++;
                        console.log("retry");
                        console.error(error);
                        if(keepTrying > task.self.numRetries) {
                            process.exit(1);
                        }
                    }
                }
            }, this.concurency);

            while(pullCounter <= currentBlockNumber) {
                let end = (pullCounter + parseInt(this.app.config.PULL_STEP));
                queue.push({
                    self: this,
                    fromBlock: pullCounter,
                    toBlock: end > currentBlockNumber ? currentBlockNumber : end
                });
                pullCounter = end + 1;
            }
            await queue.drain();
            const tokens  = await FlowUpdatedModel.findAll({
                attributes: ['superToken'],
                group: ['superToken']
            });

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
            await this.app.client.loadSuperTokens(tokens.map(({superToken}) => superToken));
            console.debug("finish Past event to find SuperTokens");
        } catch(error) {
            this.app.logger.error(`error getting pasted events\n ${error}`);
            process.exit(1);
        }
    }
}

module.exports = LoadEvents;
