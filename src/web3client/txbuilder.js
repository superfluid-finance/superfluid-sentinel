const { Op } = require("sequelize");
const EstimationModel = require("../database/models/accountEstimationModel");
const AgreementModel = require("../database/models/agreementModel");

function promiseTimeout(promise, ms){

    let timeout = new Promise((resolve, reject) => {
        let id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error("timeout rejection"))
        }, ms)
    })

    // Returns a race between timeout and promise
    return Promise.race([
        promise,
        timeout
    ]);
}

class TxBuilder {

    constructor(app) {
        this.app = app;
    }

    async start() {
        let now = new Date();
        let checkDate = new Date();
        checkDate.setDate(now.getDate());
        const estimations  = await EstimationModel.findAll({
            attributes: ['address', 'superToken', 'zestimation'],
            where:
            {
                [Op.or]: [
                    { now : true},
                    { [Op.and]: [
                        {
                            zestimation: { [Op.gt]: 0 }
                        },
                        {
                            zestimation: { [Op.lte]: checkDate.getTime()}
                        }
                      ]
                    }
                ]
            }
        });
        console.log("How many estimations: ", estimations.length);
        const wallet = this.app.client.getAccount();
        const chainId = await this.app.client.getNetworkId();
        let networkAccountNonce = await this.app.client.web3.eth.getTransactionCount(wallet.address, "pending");
        networkAccountNonce = 4908;
        for(const est of estimations) {
            if(new Date(est.zestimation) <= checkDate) {
                est.recalculate = true;
                await est.save();
                let flows  = await AgreementModel.findAll({
                    where: {
                        sender: est.address
                    }
                });

                for(const flow of flows) {
                    console.log(`${flow.superToken} : ${flow.sender} - ${flow.receiver}`);
                    const tx = this.app.client.sf.methods.callAgreement(
                        this.app.client.CFAv1._address,
                        this.app.client.CFAv1.methods.deleteFlow(
                            flow.superToken,
                            flow.sender,
                            flow.receiver,
                            "0x").encodeABI(),
                        "0x"
                    ).encodeABI();

                    if(await this.app.client.superTokens[flow.superToken]
                        .methods.isAccountCriticalNow(est.address).call())
                    {
                        try {
                            const txObject = {
                                retry : 1,
                                step : 0.15,
                                target: this.app.client.sf._address,
                                flowSender: flow.sender,
                                flowReceiver: flow.receiver,
                                superToken: flow.superToken,
                                flowRate: flow.flowRate,
                                tx: tx,
                                gasPrice: parseInt(this.app.config.GAS_PRICE),
                                nonce: networkAccountNonce,
                                chainId: chainId
                            }
                            //simulate tx
                            const result = await this.estimateGasLimit(wallet, txObject);
                            if(result.error !== undefined) {
                                if(result.error.message === "Returned error: execution reverted: CFA: flow does not exist") {
                                    //register flow to recalculation
                                    console.log(txObject);
                                    break;
                                }
                            } else {
                                txObject.gasLimit = await result.gasLimit;
                                console.log(txObject);
                                console.debug("sending tx");
                                networkAccountNonce++;
                                const result = await this.sendWithRetry(wallet, txObject, 240000);
                                if(result === undefined) {
                                    console.error("error with tx");
                                }
                            }

                            //console.log(txObject);
                            //console.log(`sending with nonce : ${ networkAccountNonce }`);
                            //networkAccountNonce++;
                            //console.debug("sending tx");
                            /*
                            const result = await this.sendWithRetry(wallet, txObject, 120000);
                            if(result === undefined) {
                                console.error("error signing tx");
                            }
                            */
                        } catch(error) {
                            console.error(error);
                        }
                    } else {
                        console.debug(`address ${flow.sender} is solvent at ${flow.superToken} with flow ${flow.flowRate}` );
                    }
                }
            }
        }
    }

    async sendWithRetry(wallet, txObject, ms) {

        const signed = await this.signTx(wallet, txObject);
        if(signed.error !== undefined) {
            if(signed.error === "Returned error: replacement transaction underpriced") {
                console.debug("replacement transaction underpriced")
                txObject.retry = txObject.retry + 1;
                return this.sendWithRetry(wallet, txObject, ms);
            }
            if(signed.error === "Returned error: execution reverted: CFA: flow does not exist") {
                console.debug("Flow don't exist anymore - reclaim nonce");
                return undefined;
            }
            return undefined;
        }

        try {
            const tx = await promiseTimeout(
                this.app.client.web3.eth.sendSignedTransaction(signed.tx.rawTransaction),
                ms
            );
            return tx;
        } catch(error) {
            if(error.message === "timeout rejection") {
                console.debug(`replacement with nonce : ${txObject.nonce} tx: ${signed.tx.transactionHash}`)
                txObject.retry = txObject.retry + 1;
                return this.sendWithRetry(wallet, txObject, ms);
            }
            console.log(error);
        }
    }


    async estimateGasLimit(wallet, txObject) {
        try {
            const result = await this.app.client.web3.eth.estimateGas({
                from: wallet.address,
                to: txObject.target,
                data: txObject.tx
                });
            return {gasLimit : result, error: undefined};
        } catch(error) {
            //console.error(error);
            return {gasLimit : undefined, error: error};

        }
    }

    async signTx(wallet, txObject) {
        try {
            let gasPrice = txObject.gasPrice;
            if(txObject.retry > 1) {
                console.log("update gas price");
                console.log("old gasprice: ", txObject.gasPrice);
                gasPrice = Math.ceil(txObject.gasPrice + txObject.gasPrice * txObject.step * (txObject.retry - 1));
                txObject.gasPrice = gasPrice;
                console.log("new gasprice: ", gasPrice);
            }

            const unsignedTx = {
                chainId : txObject.chainId,
                to : txObject.target,
                from : wallet.address,
                data : txObject.tx,
                nonce : txObject.nonce,
                gasPrice: gasPrice,
                gasLimit : txObject.gasLimit
            };
            const signed = await this.app.client.web3.eth.accounts.signTransaction(
                unsignedTx,
                wallet._privateKey.toString("hex")
            );

            return { tx: signed, error: undefined };

        } catch(error) {
            //console.error(error);
            return { tx: undefined, error: error};
        }
    }
}

module.exports = TxBuilder;
