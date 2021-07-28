const SystemModel = require("./database/models/systemModel");
const FlowUpdatedModel = require("./database/models/flowUpdatedModel");
const IDAModel = require("./database/models/IDAModel");
const async = require("async");
class LoadEvents {

    constructor(app) {
        this.app = app;
        this.concurrency = this.app.config.CONCURRENCY;
        this.numRetries = this.app.config.NUM_RETRIES;
    }

    async start() {
        try {
            this.app.logger.info("getting Past event to find SuperTokens");
            this.app.logger.info(`using concurrency: ${this.concurrency}`);
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
                if((await this.app.client.getNetworkId()) !== systemInfo.networkId) {
                    throw "different network than from the saved data";
                }
            }
            let pullCounter = blockNumber;
            let currentBlockNumber = await this.app.client.getCurrentBlockNumber();
            this.app.logger.info(`scanning blocks from ${pullCounter} to ${currentBlockNumber}`);
            var queue = async.queue(async function(task) {
                let keepTrying = 1;
                while(true) {
                    try {
                        task.self.app.logger.info(`#${keepTrying}-${task.fromBlock}-${task.toBlock}`);
                        let result = await task.self.app.protocol.getAgreementEvents(
                            "FlowUpdated", {
                                fromBlock: task.fromBlock,
                                toBlock: task.toBlock
                            },
                            keepTrying > 5
                        );

                        let resultIDA = await task.self.app.protocol.getIDAAgreementEvents(
                            "SubscriptionApproved", {
                                fromBlock: task.fromBlock,
                                toBlock: task.toBlock
                            },
                            keepTrying > 5
                        );

                        result = result.map(task.self.app.models.event.transformWeb3Event);
                        resultIDA = resultIDA.map(task.self.app.models.event.transformWeb3Event)
                            .filter(i => i.eventName !== undefined);

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
                        for(let event of resultIDA) {
                            await IDAModel.upsert({
                                eventName: event.eventName,
                                address: event.address,
                                blockNumber: event.blockNumber,
                                superToken: event.token,
                                publisher: event.publisher,
                                subscriber: event.subscriber,
                                indexId: event.indexId,
                            });
                        }
                        break;
                    } catch(err) {
                        keepTrying++;
                        task.self.app.logger.error(err);
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

            /*const IDATokens =  await IDAModel.findAll({
                    attributes: ['superToken'],
                    group: ['superToken']
                });
            */

            //console.log(IDATokens)

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
            //await this.app.client.loadSuperTokens(IDATokens.map(({superToken}) => superToken));
            console.debug("finish Past event to find SuperTokens");
        } catch(err) {
            this.app.logger.error(err);
            process.exit(1);
        }
    }
}

module.exports = LoadEvents;
