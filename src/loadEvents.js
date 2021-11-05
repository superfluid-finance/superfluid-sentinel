const SystemModel = require("./database/models/systemModel");
const FlowUpdatedModel = require("./database/models/flowUpdatedModel");
const async = require("async");
class LoadEvents {

    constructor(app) {
        this.app = app;
        this.numRetries = this.app.config.NUM_RETRIES;
    }

    async start() {
        try {
            this.app.logger.info("getting past event to find SuperTokens");
            const systemInfo = await SystemModel.findOne();
            const lastEventBlockNumber = await FlowUpdatedModel.findOne({
                order: [['blockNumber', 'DESC']]
            });
            let blockNumber = lastEventBlockNumber === null
                ? parseInt(this.app.config.EPOCH_BLOCK) : lastEventBlockNumber.blockNumber;
            if (systemInfo !== null) {
                if (systemInfo.superTokenBlockNumber > blockNumber) {
                    blockNumber = systemInfo.superTokenBlockNumber;
                }
                if ((await this.app.client.getNetworkId()) !== systemInfo.networkId) {
                    throw new Error("different network than from the saved data");
                }
            }
            let pullCounter = blockNumber;
            let currentBlockNumber = await this.app.client.getCurrentBlockNumber();
            this.app.logger.info(`scanning blocks from ${pullCounter} to ${currentBlockNumber}`);
            var queue = async.queue(async function (task) {
                let keepTrying = 1;
                while (true) {
                    try {
                        task.self.app.logger.info(`getting blocks: trying #${keepTrying} - from:${task.fromBlock} to:${task.toBlock}`);
                        let result = await task.self.app.protocol.getAgreementEvents(
                            "FlowUpdated", {
                            fromBlock: task.fromBlock,
                            toBlock: task.toBlock
                        },
                            keepTrying > 5
                        );

                        result = result.map(task.self.app.models.event.transformWeb3Event);

                        for (let event of result) {
                            const agreementId = task.self.app.protocol.generateId(event.sender, event.receiver);
                            const hashId = task.self.app.protocol.generateId(event.token, agreementId);
                            await FlowUpdatedModel.create({
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
                        break;
                    } catch (err) {
                        keepTrying++;
                        task.self.app.logger.error(err);
                        if (keepTrying > task.self.numRetries) {
                            process.exit(1);
                        }
                    }
                }
            }, this.concurency);

            while (pullCounter <= currentBlockNumber) {
                let end = (pullCounter + parseInt(this.app.config.MAX_QUERY_BLOCK_RANGE));
                queue.push({
                    self: this,
                    fromBlock: pullCounter,
                    toBlock: end > currentBlockNumber ? currentBlockNumber : end
                });
                pullCounter = end + 1;
            }
            await queue.drain();
            const tokens = await FlowUpdatedModel.findAll({
                attributes: ['superToken'],
                group: ['superToken']
            });
            //fresh database
            if (systemInfo === null) {
                await SystemModel.create({
                    blockNumber: blockNumber,
                    networkId: await this.app.client.getNetworkId(),
                    superTokenBlockNumber: currentBlockNumber
                });
            } else {
                systemInfo.superTokenBlockNumber = currentBlockNumber;
                await systemInfo.save();
            }
            //Load supertokens
            await this.app.client.loadSuperTokens(tokens.map(({ superToken }) => superToken));

            this.app.logger.info("start getting delays PIC system");
            //we need to query each supertoken to check pic address
            var DelayChecker = async.queue(async function (task) {
                let keepTrying = 10;
                while (true) {
                    try {
                        await task.self.app.protocol.calculateAndSaveTokenDelay(task.token);
                        break;
                    } catch (err) {
                        keepTrying++;
                        task.self.app.logger.error(err);
                        if (keepTrying > task.self.numRetries) {
                            task.self.app.logger.error(`exhausted number of retries`);
                            process.exit(1);
                        }
                    }
                }
            }, this.concurency);
            const superTokens = this.app.client.superTokensAddresses;
            for (const st of superTokens) {
                DelayChecker.push({
                    self: this,
                    token: st
                });
            }
            await DelayChecker.drain();
            this.app.logger.info("finish getting delays PIC system");

            this.app.logger.info("finish past event to find SuperTokens");
            return currentBlockNumber;
        } catch (err) {
            this.app.logger.error(err);
            process.exit(1);
        }
    }
}

module.exports = LoadEvents;
