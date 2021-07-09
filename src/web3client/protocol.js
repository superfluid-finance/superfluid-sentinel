const async = require("async");
const BN = require("bn.js");
const EstimationModel = require("../database/models/accountEstimationModel");
const AgreementModel =  require("../database/models/agreementModel");

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));
async function trigger(fn, ms) {
    await timeout(ms);
    await fn.drain();
}

const estimationQueue = async.queue(async function(task) {
    let keepTrying = 1;
    while(true) {
        try {
            if(task.self.app.client.isSuperTokenRegister(task.token)) {
                const estimationData = await task.self.liquidationData(task.token, task.account);
                console.debug(`account: ${task.account } supertoken: ${task.token} - ${estimationData.estimation}`);

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
                    now: (estimationData.estimation == -1 ? true: false),
                });
            } else {
                console.debug(`reject account: ${task.account } supertoken: ${task.token} not listed`);
            }
            break;
        } catch(error) {
            keepTrying++
            console.error(error);
            if(keepTrying > task.self.numRetries) {
                process.exit(1);
            }
        }
    }
}, 1);

const agreementUpdateQueue = async.queue(async function(task) {
    let keepTrying = 1;
    while(true) {
        try {
            const now = Math.floor(new Date().getTime() / 1000);
            console.log('agreementUpdateQueue');
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
                e.zchecked = -1;
            });

            for(let event of allFlowUpdatedEvents) {
                await AgreementModel.upsert({
                    agreementId: event.agreementId,
                    superToken: event.superToken,
                    sender: event.sender,
                    receiver: event.receiver,
                    flowRate: event.flowRate,
                    zlastChecked: now
                });

                estimationQueue.push([{
                    self: task.self,
                    account: event.sender,
                    token: event.superToken
                }, {
                    self: task.self,
                    account: event.receiver,
                    token: event.superToken
                }]);
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

}, 1);

class Protocol {

    constructor(app) {
        this.app = app;
        this.client = this.app.client;
        this.numRetries = this.app.config.NUM_RETRIES;
        this.subs = new Map();
    }

    async getAccountRealtimeBalance(token, address, timestamp) {
        try {
            if(timestamp === undefined) {
                timestamp = Math.floor(new Date().getTime() / 1000);
            }

            return this.client.superTokens[token].methods.realtimeBalanceOf(
                address,
                timestamp
            ).call();

        } catch(error) {
            console.error(error)
            throw Error(`account balance (${token}): ${error}`)
        }
    }

    async getAccountAgreementRealtimeBalance(token, account, timestamp) {
        try {
            if(timestamp === undefined) {
                timestamp = Math.floor(new Date().getTime() / 1000);
            }
            return this.client.CFAv1.methods.realtimeBalanceOf(
                token,
                account,
                timestamp
            ).call();
        } catch(error) {
            console.error(error)
            throw Error({msg: `account realtime balance: ${error}`, code: -1})
        }
    }

    async getUserNetFlow(token, account) {
        try {
            return this.client.CFAv1.methods.getNetFlow(token, account).call();
        } catch(error) {
            console.log(error);
            throw Error(`account flowRate: ${error}`)
        }
    }

    async getAgreementEvents(eventName, filter, ws = false) {
        if(!ws) {
            return this.client.CFAv1.getPastEvents(eventName, filter);
        }
        return this.client.CFAv1WS.getPastEvents(eventName, filter);
    }

    async getIDAAgreementEvents(eventName, filter, ws = false) {
        if(!ws) {
            return this.client.IDAv1.getPastEvents(eventName, filter);
        }
        return this.client.IDAv1WS.getPastEvents(eventName, filter);
    }

    getLastFlowUpdated(filter) {
        return this.getLastFlowUpdated(
            this.getAgreementEvents("FlowUpdated", filter)
        );
    }

    getLatestFlows(flows) {
        return Object.values(flows.reduce((acc, i) => {
            acc[i.args.sender + ":" + i.args.receiver] = i;
            return acc;
        }, {})).filter(i => i.args.flowRate.toString() != "0");
    }

    getAllSuperTokensEvents(eventName, filter, ws = false) {
        const keys = Object.keys(this.client.getSuperTokenInstances());
        const arrPromise = new Array();
        if(!ws) {
            for(const key of keys){
                arrPromise.push(
                    this.client.superTokensHTTP[key].getPastEvents(eventName, filter)
                )
            }
            return arrPromise.flat();
        }
        for(const key of keys){
            arrPromise.push(
                this.client.superTokens[key].getPastEvents(eventName, filter)
            )
        }
        return arrPromise.flat();
    }

    async liquidationData(token, account) {
        const now = Math.floor(new Date().getTime() / 1000);
        let arrPromise = [
            this.getUserNetFlow(token, account),
            this.getAccountRealtimeBalance(token,account,now)
        ];
        arrPromise = await Promise.all(arrPromise);
        return this._getLiquidationData(
            new BN(arrPromise[0]),
            new BN(arrPromise[1].availableBalance),
        );
    }

    async run(fn, time) {
        await trigger(fn, time);
        await this.run(fn, time);
    }

    newEstimation(token, account) {
        estimationQueue.push({
            self: this,
            account: account,
            token: token
        });
    }

    async subscribeAllTokensEvents() {
        const superTokenInstances = this.client.getSuperTokenInstances();
        for(let key of Object.keys(superTokenInstances)) {
            this.subscribeEvents(key);
        }
        console.debug("starting draining queues");
        this.run(estimationQueue, 10000);
        this.run(agreementUpdateQueue, 10000);
    }

    async subscribeEvents(token) {
        try {
            const superToken = this.client.superTokens[token];
            this.app.logger.log("starting listen superToken: " + token);
            this.subs.set(token,
                superToken.events.allEvents(
                    async(err, evt) => {
                        if (err === undefined || err == null) {
                            let event = this.app.models.event.transformWeb3Event(evt);
                            switch(event.eventName) {
                                case "AgreementStateUpdated" : {
                                    agreementUpdateQueue.push({
                                        self: this,
                                        account: event.account,
                                        blockNumber: event.blockNumber
                                    });
                                    break;
                                }
                                case "TokenUpgraded" :
                                case "TokenDowngraded" : {
                                    estimationQueue.push({
                                        self: this,
                                        account: event.account,
                                        token: event.address
                                    });
                                    break;
                                }
                                case "Transfer" : {
                                    estimationQueue.push([
                                        {
                                            self: this,
                                            account: event.from,
                                            token: event.address
                                        },
                                        {
                                            self: this,
                                            account: event.to,
                                            token: event.address
                                        }
                                    ]);
                                    break;
                                }
                            }
                        } else {
                            console.error(`Event Subscription: ${err}`);
                            process.exit(1);
                        }
                    })
            );
        } catch(err) {
            console.error(`subscription ${err}`);
            throw Error(`subscription ${err}`);
        }
    }

    async subscribeAgreementEvents() {
        try {
        const CFA = this.client.CFAv1WS;
        this.app.logger.log("starting listen CFAv1: " + CFA._address);
        CFA.events.FlowUpdated(async(err, evt) => {
            if(err === undefined || err == null) {
                let event = this.app.models.event.transformWeb3Event(evt);
                if(!this.client.isSuperTokenRegister(event.token)) {
                    console.debug("found new token: ", event.token);
                    await this.client.loadSuperToken(event.token);
                    setTimeout(() => this.subscribeEvents(event.token), 1000);
                    estimationQueue.push([
                        {
                            self: this,
                            account: event.sender,
                            superToken: event.token
                        },
                        {
                            self: this,
                            account: event.receiver,
                            superToken: event.token
                        }
                    ]);
                    agreementUpdateQueue.push([
                        {
                            self: this,
                            account: event.sender,
                            blockNumber: event.blockNumber
                        },
                        {
                            self: this,
                            account: event.receiver,
                            blockNumber: event.blockNumber
                        }
                    ]);
                }
            } else {
                console.error(err);
                process.exit(1);
            }
        });
        } catch(err) {
            console.error(`agreement subscription ${err}`);
            throw Error(`agreement subscription ${err}`);
        }
    }

    async subscribeIDAAgreementEvents() {
        try {
        const IDA = this.client.IDAv1WS;
        this.app.logger.log("starting listen IDAv1: " + IDA._address);
        IDA.events.allEvents(
            async(err, evt) => {
                if(err === undefined || err == null) {
                    let event = this.app.models.event.transformWeb3Event(evt);
                    if(this.client.isSuperTokenRegister(event.token)) {

                        console.debug(`IDA: ${event.eventName} detected`);
                        switch(event.eventName) {
                            case "IndexUpdated" : {
                                //Recalculate balances
                                console.debug(event);
                                const subscribers = await this.app.db.queries.getIDASubscribers(event.token, event.publisher);
                                    estimationQueue.push([
                                        {
                                            self: this,
                                            account: event.publisher,
                                            token: event.token
                                        }
                                    ]);
                                for(const sub of subscribers) {
                                    console.debug(sub);
                                    estimationQueue.push([
                                        {
                                            self: this,
                                            account: sub.subscriber,
                                            token: event.token
                                        }
                                    ]);
                                }
                                break;
                            }
                            default: {
                                if(event.eventName !== undefined) {
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
                            } 
                        }
                    }
                } else {
                    console.error(err);
                    process.exit(1);
                }
        });
        } catch(err) {
            console.error(`ida agreement subscription ${err}`);
            throw Error(`ida agreement subscription ${err}`);
        }
    }
    generateId(sender, receiver) {
        return this.client.web3.utils.soliditySha3(sender, receiver);
    }

    _getLiquidationData(totalNetFlowRate, totalBalance, totalDeposit) {

        let result = {
            totalNetFlowRate: totalNetFlowRate.toString(),
            totalBalance: totalBalance.toString(),
            estimation: new Date(0)
        }

        if(totalNetFlowRate.lt(new BN(0))) {
            if(totalBalance.lt(new BN(0))) {
                result.estimation = new Date();
                return result;
            }

            const seconds = isFinite(totalBalance.div(totalNetFlowRate)) ? totalBalance.div(totalNetFlowRate) : 0;
            const roundSeconds = Math.round( Math.abs(isNaN(seconds) ? 0 : seconds));
            let estimation = new Date();
            const dateFuture = new Date(estimation.setSeconds(roundSeconds));
            result.estimation = (isNaN(dateFuture) ? new Date("2999-12-31") : dateFuture);
        }

        return result;
    }

    async _printEstimationsToLog() {
        const estimations  = await EstimationModel.findAll({
            attributes: ['address', 'superToken', 'zestimation'],
        });
    }
}

module.exports = Protocol;
