const SystemModel = require("./database/models/systemModel");
const EstimationModel = require("./database/models/accountEstimationModel");
const FlowUpdatedModel = require("./database/models/flowUpdatedModel");
const AgreementModel =  require("./database/models/agreementModel");
const { Op } = require("sequelize");
const async = require("async");
/*
 * @dev Bootstrap the app from fresh or persisted state
 */
class Bootstrap {

    constructor(app) {
        this.app = app;
        this.concurrency = this.app.config.CONCURRENCY;
        this.numRetries = this.app.config.NUM_RETRIES;
        this.listenMode = this.app.config.LISTEN_MODE;
    }

    async start() {
        console.debug("collecting events from the last boot or epoch block");
        console.debug("using concurrency: ", this.concurrency);

        const systemInfo = await SystemModel.findOne();
        let blockNumber = parseInt(this.app.config.EPOCH_BLOCK);
        if(systemInfo !== null) {
            blockNumber = systemInfo.blockNumber;
        }
        const currentBlockNumber = await this.app.client.getCurrentBlockNumber();
        if(blockNumber === currentBlockNumber) {
            return;
        }
        //TODO: return if wrong block numbers
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
                                    zlastChecked: task.self.app.getTimeUnix(),
                                    recalculate : 0,
                                    found: 0,
                                    now: 0,
                                });
                            }
                            break;
                        } catch(error) {
                            keepTrying++;
                            console.error(error);
                            if(keepTrying > task.self.numRetries) {
                                process.exit(1);
                            }
                        }
                    }
                }, this.concurency);
                const users = await this.app.db.queries.getAccounts(blockNumber);
                const now = this.app.getTimeUnix();
                for(let user of users) {
                    queue.push({
                        self: this,
                        account: user.account,
                        token: user.superToken
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
                            zlastChecked: now
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
                    if(flows.length == 0) {
                        console.debug(`${est.address} - no active streams at ${est.superToken}`);
                        await est.destroy();
                    }
                }
                this.app.logger.info("Getting Agreements");
                systemInfo.blockNumber = currentBlockNumber;
                await systemInfo.save();
                console.debug("finish bootstrap");
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
