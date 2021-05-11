const SystemModel = require("./database/models/systemModel");
const EstimationModel = require("./database/models/accountEstimationModel");
const AgreementModel =  require("./database/models/agreementModel");
const { Op, ValidationError } = require("sequelize");
/*
 * @dev Bootstrap the app from fresh or persisted state
 */
class Bootstrap {

    constructor(app) {
        this.app = app;
    }

    async start() {
        console.debug("collecting events from the last boot or epoch block");
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

        if (blockNumber < currentBlockNumber) {
            const uniqueAccountAgreementPairs = new Set();
            try {
                let pastEvents = new Array();
                let pullCounter = blockNumber;
                while(pullCounter <= currentBlockNumber) {
                    let end = (pullCounter + pullStep);
                    let promiseResult = this.app.protocol.getAllSuperTokensEvents(
                        "AgreementStateUpdated", {
                            fromBlock: pullCounter,
                            toBlock: end > currentBlockNumber ? currentBlockNumber : end
                        }
                    );
                    pastEvents = pastEvents.concat(await Promise.all(promiseResult));
                    this.app.logger.log("from " + pullCounter + " to block " + (end > currentBlockNumber ? currentBlockNumber : end));
                    pullCounter = end;
                }
                // normalize web3 events
                for(let i = 0; i < pastEvents.length; i++) {
                    for(let event of pastEvents[i]) {
                        uniqueAccountAgreementPairs.add(
                            JSON.stringify({
                                account: event.returnValues.account
                            })
                        );
                    }
                }
                this.app.logger.stopSpinnerWithSuccess("Pulling past events");
                this.app.logger.startSpinner("Getting Agreements");
                const now = this.app.getTimeUnix();
                for(let item of uniqueAccountAgreementPairs) {
                    const senderFlows = new Map();
                    const elem = JSON.parse(item);
                    let senderFilter = {
                        filter : {
                            "sender" : elem.account
                        },
                        fromBlock: blockNumber,
                        toBlock: currentBlockNumber,
                    };

                    let allFlowUpdatedEvents = await this.app.protocol.getAgreementEvents(
                        "FlowUpdated",
                        senderFilter
                    );
                    let accountTokenInteractions = new Set();
                    allFlowUpdatedEvents = allFlowUpdatedEvents.map(this.app.models.event.transformWeb3Event);
                    allFlowUpdatedEvents.sort(function(a,b) {
                        return a.blockNumber > b.blockNumber;
                    }).forEach(e => {
                        //assuming CFA ID generation
                        e.agreementId = this.app.protocol.generateId(e.sender, e.receiver);
                        e.sender = e.sender;
                        e.receiver = e.receiver;
                        e.superToken = e.token;
                        e.zchecked = -1;

                        senderFlows.set(this.app.protocol.generateId(e.superToken, e.agreementId), e);
                        accountTokenInteractions.add(e.token);
                    });

                    for(let token of accountTokenInteractions) {
                        if(this.app.client.superTokens[token] !== undefined) {
                            const accountEstimationDate = await this.app.protocol.liquidationDate(token, elem.account);
                            try {
                                await EstimationModel.upsert({
                                    address: elem.account,
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
                //if account is mark to liquidate but there is no flows to terminate
                const estimationsNow  = await EstimationModel.findAll({
                    attributes: ['address', 'superToken'],
                    where: { now : true }
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
