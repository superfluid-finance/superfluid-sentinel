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
    }

    async start() {
        console.debug("collecting events from the last boot or epoch block");
        console.debug("using concurrency: ", this.concurrency);

        const systemInfo = await SystemModel.findOne();
        let blockNumber = parseInt(this.app.config.EPOCH_BLOCK);
        if(systemInfo !== null) {
            blockNumber = systemInfo.superTokenBlockNumber;
        }
        const currentBlockNumber = await this.app.client.getCurrentBlockNumber();
        const pullStep = parseInt(this.app.config.PULL_STEP);
        if(blockNumber === currentBlockNumber) {
            return;
        }
        //TODO: return if wrong block numbers
        if (blockNumber < currentBlockNumber) {
            try {
                let pastEvents = new Array();
                let pullCounter = blockNumber;
                let queue = async.queue(async function(task) {
                    let keepTrying = 1;
                    while(keepTrying > 0) {
                        try {
                            if(keepTrying == 2) {
                                console.debug(`reopen http connection`);
                                await task.self.app.client.reInitHttp();
                            }
                            const accountEstimationDate = await task.self.app.protocol.liquidationDate(task.superToken, task.account);
                            await EstimationModel.upsert({
                                address: task.account,
                                superToken: task.superToken,
                                zestimation: accountEstimationDate == "Invalid Date" ? -1 : new Date(accountEstimationDate).getTime(),
                                zestimationHuman : accountEstimationDate,
                                zlastChecked: task.self.app.getTimeUnix(),
                                found: 0,
                                now: (accountEstimationDate == -1 ? true: false),
                            });
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
                console.log("getting users");
                const users = await this.app.db.queries.getAccounts(blockNumber);
                const now = this.app.getTimeUnix();
                for(let user of users) {
                    console.log("adding here");
                    queue.push({
                        self: this,
                        account: user.account,
                        superToken: user.superToken
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
                    } catch(error) {
                        console.debug("saving agreement model error");
                        console.error(error);
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
                this.app.logger.stopSpinnerWithSuccess("Getting Agreements");
                systemInfo.blockNumber = currentBlockNumber;
                await systemInfo.save();
                console.debug("finish bootstrap");
            } catch(error) {
                console.log(error);
                this.app.logger.error(`\nsomething is wrong in getting pasted events\n ${error}`);
                this.app.logger.stopSpinnerWithError("Bootstrap");
                process.exit(1);
            }
        } else {
            this.app.logger.error(`epoch block number is from the future: ${systemInfo.blockNumber}`);
            process.exit(1);
        }
    }
}

module.exports = Bootstrap;
