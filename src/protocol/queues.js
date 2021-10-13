const async = require("async");
const BN = require("bn.js");
const EstimationModel = require("../database/models/accountEstimationModel");
const AgreementModel =  require("../database/models/agreementModel");
const IDAModel = require("../database/models/IDAModel");
const { Op } = require("sequelize");
const { wad4human } = require("@decentral.ee/web3-helpers");

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));
async function trigger(fn, ms) {
    await timeout(ms);
    await fn.drain();
}

class Queues {

    constructor(app) {
        this.app = app;
        this.client = this.app.client;
        this.numRetries = this.app.config.NUM_RETRIES;
    }

    init() {
        this.estimationQueue = async.queue(async function(task) {
            let keepTrying = 1;
            console.log("Estimation running")
            if(task.account === "0x0000000000000000000000000000000000000000") {
                return;
            }
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
                        console.log(`${task.account} - ${estimationData.estimation}`)
                    } else {
                        console.log(`reject account: ${task.account } supertoken: ${task.token} not subscribed`);
                    }
                    break;
                } catch(err) {
                    keepTrying++
                    task.self.app.logger.error(err);
                    if(keepTrying > task.self.config.NUM_RETRIES) {
                        process.exit(1);
                    }
                }
            }
        }, 1);

        this.agreementUpdateQueue = async.queue(async function(task) {
            let keepTrying = 1;
            if(task.account === "0x0000000000000000000000000000000000000000") {
                return;
            }
            while(true) {
                try {
                    let senderFilter = {
                        filter : {
                            "sender" : task.account
                        },
                        fromBlock: task.blockNumber,
                        toBlock: task.blockNumber,
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
                        e.blockNumber = e.blockNumber;
                    });

                    for(let event of allFlowUpdatedEvents) {
                        await AgreementModel.upsert({
                            agreementId: event.agreementId,
                            superToken: event.superToken,
                            sender: event.sender,
                            receiver: event.receiver,
                            flowRate: event.flowRate,
                            blockNumber: event.blockNumber
                        });

                        task.self.estimationQueue.push([{
                            self: task.self,
                            account: event.sender,
                            token: event.superToken,
                            blockNumber: event.blockNumber
                        }, {
                            self: task.self,
                            account: event.receiver,
                            token: event.superToken,
                            blockNumber: event.blockNumber
                        }]);
                    }
                    break;
                } catch(err) {
                    keepTrying++;
                    console.error(`#${task.self.config.NUM_RETRIES} - agreementUpdateQueue: ${err}`);
                    if(keepTrying > task.self.config.NUM_RETRIES) {
                        process.exit(1);
                    }
                }
            }
        }, 1);

        this.IDAQueue = async.queue(async function(task) {
            let keepTrying = 1;
            while(true) {
                try {
                    if(task.event.eventName !== undefined) {
                        await IDAModel.upsert({
                            eventName: task.event.eventName,
                            address: task.event.address,
                            blockNumber: task.event.blockNumber,
                            superToken: task.event.token,
                            publisher: task.event.publisher,
                            subscriber: task.event.subscriber,
                            indexId: task.event.indexId.toString(),
                        });
                    }
                } catch(err) {
                    keepTrying++;
                    console.error(`#${task.self.config.NUM_RETRIES} - IDAQueue: ${err}`);
                    if(keepTrying > task.self.config.NUM_RETRIES) {
                        process.exit(1);
                    }
                }
            }
        }, 1);
    }

    async run(fn, time) {
        if(this.app._isShutdown)
            return;
        await trigger(fn, time);
        await this.run(fn, time);
    }

    async start() {
        this.run(this.estimationQueue, 5000);
        this.run(this.agreementUpdateQueue, 5000);
        this.run(this.IDAQueue, 5000);
    }

    async addQueuedEstimation(token, account) {
        this.estimationQueue.push({
            self: this,
            account: account,
            token: token
        });
    }

    async addQueuedAgreement(account, blockNumber) {
        agreementUpdateQueue.push({
            self: this,
            account: account,
            blockNumber: blockNumber
        });
    }
}

module.exports = Queues;
