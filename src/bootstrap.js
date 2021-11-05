const SystemModel = require("./database/models/systemModel");
const EstimationModel = require("./database/models/accountEstimationModel");
const AgreementModel =  require("./database/models/agreementModel");
const { Op } = require("sequelize");
const async = require("async");
/*
 * @dev Bootstrap the app from fresh or persisted state
 */
class Bootstrap {

    constructor(app) {
        this.app = app;
        this.numRetries = this.app.config.NUM_RETRIES;
    }

    async start() {
        this.app.logger.info("starting bootstrap");
        const systemInfo = await SystemModel.findOne();
        let blockNumber = parseInt(this.app.config.EPOCH_BLOCK);
        if(systemInfo !== null) {
            blockNumber = systemInfo.blockNumber;
        }
        const currentBlockNumber = await this.app.client.getCurrentBlockNumber();
        if(blockNumber === currentBlockNumber) {
            return;
        }
        if (blockNumber < currentBlockNumber) {
            try {
                let queue = async.queue(async function(task) {
                    let keepTrying = 1;
                    while(true) {
                        try {
                            if(task.self.app.client.isSuperTokenRegister(task.token)) {
                                const estimationData = await task.self.app.protocol.liquidationData(task.token, task.account);
                                await EstimationModel.upsert({
                                    address: task.account,
                                    superToken: task.token,
                                    totalNetFlowRate: estimationData.totalNetFlowRate,
                                    totalBalance: estimationData.totalBalance,
                                    zestimation: new Date(estimationData.estimation).getTime(),
                                    zestimationHuman : estimationData.estimation,
                                    blockNumber: task.blockNumber
                                });
                            }
                            break;
                        } catch(err) {
                            keepTrying++;
                            console.error(err);
                            if(keepTrying > task.self.numRetries) {
                                process.exit(1);
                            }
                        }
                    }
                }, this.concurency);
                const users = await this.app.db.queries.getAccounts(blockNumber);
                for(let user of users) {
                    queue.push({
                        self: this,
                        account: user.account,
                        token: user.superToken,
                        blockNumber: currentBlockNumber
                    });
                }

                if(users.length > 0) {
                    await queue.drain();
                }

                const flows = await this.app.db.queries.getLastFlows(blockNumber);
                for(let flow of flows) {
                    try {
                        await AgreementModel.upsert({
                            agreementId: flow.agreementId,
                            superToken: flow.superToken,
                            sender: flow.sender,
                            receiver: flow.receiver,
                            flowRate: flow.flowRate,
                            blockNumber: blockNumber
                        });
                    } catch(err) {
                        console.error(err);
                        throw Error(`saving AgreementModel: ${err}`);
                    }
                }

                const estimationsNow  = await EstimationModel.findAll({
                    attributes: ['address', 'superToken']
                });

                for(let est of estimationsNow) {
                    let flows  = await AgreementModel.findAll({
                        where: {
                            [Op.and]: [
                                {
                                    sender: est.address
                                },
                                {
                                    superToken: est.superToken
                                }
                            ]
                        }
                    });
                    //if the sender don't have open stream, delete it from database
                    if(flows.length == 0) {
                        await est.destroy();
                    }
                }
                systemInfo.blockNumber = currentBlockNumber;
                await systemInfo.save();
                this.app.logger.info("finish bootstrap");
                return currentBlockNumber;
            } catch(err) {
                this.app.logger.error(err);
                process.exit(1);
            }
        } else {
            this.app.logger.error(`epoch block number is from the future: ${systemInfo.blockNumber}`);
            process.exit(1);
        }
    }
}

module.exports = Bootstrap;
