const BN = require("bn.js");

class Protocol {

    constructor(app) {
        this.app = app;
        this.client = this.app.client;
    }

    async getAccountRealtimeBalance(token, address, timestamp) {
        try {
            if(timestamp === undefined) {
                timestamp = Math.floor(new Date().getTime() / 1000);
            }

            return this.client.superTokens[token.toLowerCase()].methods.realtimeBalanceOf(
                address,
                timestamp
            ).call();

        } catch(err) {
            console.error(err)
            throw Error(`account balance (${token}): ${err}`)
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
        } catch(err) {
            console.error(err)
            throw Error({msg: `account realtime balance: ${err}`, code: -1})
        }
    }

    async getUserNetFlow(token, account) {
        try {
            return this.client.CFAv1.methods.getNetFlow(token, account).call();
        } catch(err) {
            console.error(err);
            throw Error(`account flowRate: ${err}`);
        }
    }

    async getAgreementEvents(eventName, filter) {
        try {
            return this.client.CFAv1.getPastEvents(eventName, filter);
        } catch(err) {
            console.error(err);
            throw Error(`getAgreementEvents: ${err}`);
        }
    }

    async getIDAAgreementEvents(eventName, filter) {
        try {
            return this.client.IDAv1.getPastEvents(eventName, filter);
        } catch(err) {
            console.error(err);
            throw Error(`getAgreementEvents: ${err}`);
        }
    }

    getLastFlowUpdated(filter) {
        try {
            return this.getLastFlowUpdated(
                this.getAgreementEvents("FlowUpdated", filter)
            );
        } catch(err) {
            console.error(err);
            throw Error(`getLastFlowUpdated: ${err}`);
        }
    }

    getLatestFlows(flows) {
        return Object.values(flows.reduce((acc, i) => {
            acc[i.args.sender + ":" + i.args.receiver] = i;
            return acc;
        }, {})).filter(i => i.args.flowRate.toString() != "0");
    }

    async isAccountCriticalNow(superToken, account) {
        try {
            return this.app.client.superTokens[superToken.toLowerCase()].methods.isAccountCriticalNow(account).call();
        } catch(err) {
            throw Error(`protocol.isAccountCriticalNow: ${err}`);
        }
    }

    async liquidationData(token, account) {
        try {
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
        } catch(err) {
            console.error(err);
            throw Error(`Protocol.liquidationData() - ${err}`);
        }
    }

    async checkFlow(superToken, sender, receiver) {
        try {
            const result = await this.app.client.CFAv1.methods.getFlow(superToken, sender, receiver).call();
            if(result.flowRate !== "0") {
                return result;
            }
            return undefined;
        } catch(err) {
            throw Error(`checkFlow : ${err}`)
        }
    }

    generateId(sender, receiver) {
        try {
            return this.client.web3.utils.soliditySha3(sender, receiver);
        } catch(err) {
            this.app.logger.error(err);
            throw Error(`generateId: ${err}`);
        }
    }

    generateDeleteFlowABI(superToken, sender, receiver) {
        try {
            return this.app.client.sf.methods.callAgreement(
                this.app.client.CFAv1._address,
                this.app.client.CFAv1.methods.deleteFlow(
                    superToken,
                    sender,
                    receiver,
                    "0x").encodeABI(),
                "0x"
            ).encodeABI();


        } catch(err) {
            this.app.logger.error(err);
            throw Error(`generateDeleteFlowABI : ${err}`);
        }
    }

    generateMultiDeleteFlowABI(superToken, senders, receivers) {
        try {
            return this.app.client.batch.methods.deleteFlows(
                this.app.client.sf._address,
                this.app.client.CFAv1._address,
                superToken,
                senders,
                receivers
            ).encodeABI();
        } catch(err) {
            this.app.logger.error(err);
            throw Error(`generateMultiDeleteFlowABI : ${err}`);
        }
    }

    _getLiquidationData(totalNetFlowRate, totalBalance) {

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
}

module.exports = Protocol;
