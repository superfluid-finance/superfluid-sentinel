const async = require("async");
const BN = require("bn.js");

class Protocol {

    constructor(app) {
        this.app = app;
        this.client = this.app.client;
        this.subs = new Array();

        this.estimationQueue = async.queue(function(task, callback) {
            console.log('estimationQueue ' + task);
            //const estimation = this.liquidationDate(task.superToken, task.account);
            callback();
        }, 5);

        this.agreementUpdateQueue = async.queue(function(task, callback) {
            console.log('agreementUpdateQueue ' + task);
            callback();
        }, 5);
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
        }
    }

    async getUserNetFlow(token, account) {
        try {
            return this.client.CFAv1.methods.getNetFlow(token, account).call();
        } catch(error) {
            console.log(error);
        }
    }

    async getAgreementEvents(eventName, filter) {
        return this.client.CFAv1.getPastEvents(eventName, filter);
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

    getAllSuperTokensEvents(eventName, filter) {
        const keys = Object.keys(this.client.getSuperTokenInstances());
        const arrPromise = new Array();
        for(const key of keys){
            arrPromise.push(
                this.client.superTokens[key].getPastEvents(eventName, filter)
            )
        }
        return arrPromise.flat();
    }

    async liquidationDate(token, account) {
        const now = Math.floor(new Date().getTime() / 1000);
        let arrPromise = [
            this.getUserNetFlow(token, account),
            this.getAccountRealtimeBalance(token,account,now),
            this.getAccountAgreementRealtimeBalance(token, account,now)
        ];
        arrPromise = await Promise.all(arrPromise);
        return this._getLiquidationDate(
            new BN(arrPromise[0]),
            new BN(arrPromise[1].availableBalance),
            new BN(arrPromise[2].deposit)
        );
    }

    async subscribeAllTokensEvents() {
        const superTokenInstances = this.client.getSuperTokenInstances();
        for(let key of Object.keys(superTokenInstances)) {
            this.subscribeEvents(key);
        }
    }

    async subscribeEvents(token) {
        const superToken = this.client.superTokens[token];
        this.app.logger.log("starting listen to " + token);
        this.subs.push(
            superToken.events.allEvents(
            async(err, evt) => {
                if(err === undefined || err == null) {
                    this.app.logger.log(evt.event);
                    let event = this.app.models.event.transformWeb3Event(evt);
                    switch(evt.eventName) {

                        case "AgreementStateUpdated" : {
                            this.agreementUpdateQueue.push({account: event.account, blockNumber: event.blockNumber})
                            break;
                        }
                        case "TokenUpgraded" :
                        case "TokenDowngraded" : {
                            this.estimationQueue.push({account: event.account, superToken: event.address});
                            break;
                        }
                        case "Transfer" : {
                            this.estimationQueue.push({account: event.from, superToken: event.address});
                            this.estimationQueue.push({account: event.to, superToken: event.address});
                            break;
                        }
                        }
                } else {
                    console.error(err);
                }
            })
        );
    }

    generateId(sender, receiver) {
        return this.client.web3.utils.soliditySha3(sender, receiver);
    }

    _getLiquidationDate(totalNetFlowRate, totalBalance, totalDeposit) {
        if(totalNetFlowRate.lt(new BN(0))) {
            if(totalBalance.add(totalDeposit).lt(new BN(0))) {
                return -1;
            } else {
                let seconds = totalBalance.div(totalNetFlowRate);
                seconds = isFinite(seconds) ? seconds : 0;
                let secondsX = Math.abs(isNaN(seconds) ? 0 : seconds);
                secondsX = Math.round(secondsX);
                let estimation = new Date();
                return new Date(estimation.setSeconds(secondsX));
            }
        }

        return new Date(0);
    }
}

module.exports = Protocol;