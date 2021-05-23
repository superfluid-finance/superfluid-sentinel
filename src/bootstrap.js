const SystemModel = require("./database/models/systemModel");
const EstimationModel = require("./database/models/accountEstimationModel");
const AgreementModel =  require("./database/models/agreementModel");
const { Op, ValidationError } = require("sequelize");
const async = require("async");
/*
 * @dev Bootstrap the app from fresh or persisted state
 */
class Bootstrap {

    constructor(app) {
        this.app = app;
        this.concurrency = this.app.config.CONCURRENCY;
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
        const runningNetwork = await this.app.client.getNetworkId();
        const pullStep = parseInt(this.app.config.PULL_STEP);
        if(systemInfo !== undefined && runningNetwork !== systemInfo.networkId) {
            throw "different network than from the saved data";
        }
        if(blockNumber === currentBlockNumber) {
            return;
        }
        //TODO: return if wrong block numbers
        if (blockNumber < currentBlockNumber) {
            const uniqueAccountAgreementPairs = new Set();
            try {
                let pastEvents = new Array();
                let pullCounter = blockNumber;

                var queue = async.queue(async function(task) {
                    console.log(`${task.fromBlock} - ${task.toBlock}`);
                    try {
                        let promiseResult = task.self.app.protocol.getAllSuperTokensEvents("AgreementStateUpdated", {
                                fromBlock: task.fromBlock,
                                toBlock: task.toBlock
                        });
                        pastEvents = pastEvents.concat(await Promise.all(promiseResult));
                    } catch(error) {
                        console.debug("error with retry");
                        console.error(error);
                        queue.unshift(task);
                    }
                }, this.concurency);

                while(pullCounter <= currentBlockNumber) {
                    let end = (pullCounter + pullStep);
                    queue.push({
                        self: this,
                        fromBlock: pullCounter,
                        toBlock: end > currentBlockNumber ? currentBlockNumber : end
                    });
                    pullCounter = end;
                }

                await queue.drain();
                // normalize web3 events
                for(let i = 0; i < pastEvents.length; i++) {
                    for(let event of pastEvents[i]) {
                        uniqueAccountAgreementPairs.add(
                            event.returnValues.account
                        );
                    }
                }
                this.app.logger.stopSpinnerWithSuccess("Pulling past events");
                //this.app.logger.startSpinner("Getting Agreements");
                this.app.logger.log("getting agreements");
                queue = async.queue(async function(task) {
                    //console.log(`${task.account} : ${task.fromBlock} - ${task.toBlock}`);
                    try {
                        let senderFilter = {
                            filter : {
                                "sender" : task.account
                            },
                            fromBlock: task.fromBlock,
                            toBlock: task.toBlock,
                        };


                        let allFlowUpdatedEvents = await task.self.app.protocol.getAgreementEvents(
                            "FlowUpdated",
                            senderFilter
                        );

                        allFlowUpdatedEvents = allFlowUpdatedEvents.map(
                            task.self.app.models.event.transformWeb3Event
                        );
                        allFlowUpdatedEvents.sort(function(a,b) {
                            return a.blockNumber > b.blockNumber;
                        }).forEach(e => {
                            e.agreementId = task.self.app.protocol.generateId(e.sender, e.receiver);
                            e.sender = e.sender;
                            e.receiver = e.receiver;
                            e.superToken = e.token;
                            e.zchecked = -1;

                            task.senderFlows.set(task.self.app.protocol.generateId(e.superToken, e.agreementId), e);
                            task.accountTokenInteractions.add(e.token);
                        });

                    } catch(error) {
                        console.debug("error with retry");
                        console.error(error);
                        queue.unshift(task);
                    }
                }, this.concurency);

                for(let account of uniqueAccountAgreementPairs) {
                    let accountTokenInteractions = new Set();
                    let senderFlows = new Map();
                    let pullCounter = blockNumber;
                    while(pullCounter <= currentBlockNumber) {
                        let end = (pullCounter + pullStep);
                        queue.push({
                            self: this,
                            account: account,
                            senderFlows: senderFlows,
                            accountTokenInteractions: accountTokenInteractions,
                            fromBlock: pullCounter,
                            toBlock: end > currentBlockNumber ? currentBlockNumber : end
                        });
                        pullCounter = end;
                    }
                    await queue.drain();
                    const now = this.app.getTimeUnix();
                    for(let token of accountTokenInteractions) {
                        if(this.app.client.superTokens[token] !== undefined) {
                            const accountEstimationDate = await this.app.protocol.liquidationDate(token, account);
                            try {
                                await EstimationModel.upsert({
                                    address: account,
                                    superToken: token,
                                    zestimation: accountEstimationDate == "Invalid Date" ? -1 : new Date(accountEstimationDate).getTime(),
                                    zestimationHuman : accountEstimationDate,
                                    zlastChecked: now,
                                    found: 0,
                                    now: (accountEstimationDate == -1 ? true: false),
                                });
                            } catch(error) {
                                console.debug("saving estimation model error");
                                console.error(error);
                            }
                            // eslint-disable-next-line no-unused-vars
                            for (let [key, value] of senderFlows) {
                                if(value.flowRate.toString() !== "0") {
                                    try {
                                        await AgreementModel.upsert({
                                            agreementId: value.agreementId,
                                            superToken: value.superToken,
                                            sender: value.sender,
                                            receiver: value.receiver,
                                            flowRate: value.flowRate,
                                            zlastChecked: now
                                        });
                                    } catch(error) {
                                        console.error("saving agreement model error");
                                        console.error(error);
                                    }
                            }
                            }
                        }
                    }
                }

                const estimationsNow  = await EstimationModel.findAll({
                    attributes: ['address', 'superToken']
                    //where: { now : true }
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
                        console.debug(`removing ${est.address} from database - no active streams at ${est.superToken}`);
                        await est.destroy();
                    }
                }
                this.app.logger.stopSpinnerWithSuccess("Getting Agreements");
                systemInfo.blockNumber = currentBlockNumber;
                await systemInfo.save();
                console.log("finish bootstrap");
            } catch(error) {
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
