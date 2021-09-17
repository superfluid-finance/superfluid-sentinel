const { filter } = require("async");

function promiseTimeout(promise, ms) {

    let timeout = new Promise((resolve, reject) => {
        let id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error("timeout rejection"))
        }, ms)
    });

    // Returns a race between timeout and promise
    return Promise.race([
        promise,
        timeout
    ]);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

class Liquidator {

    constructor(app) {
        this.app = app;
        this.timeout = this.app.config.TX_TIMEOUT;
        this.runningMux = 0;
        this.splitBatch = 10;
        this.clo = this.app.config.CLO_ADDR;
        this.txDelay = this.app.config.ADDITIONAL_LIQUIDATION_DELAY;
        this.gasMultiplier = this.app.config.RETRY_GAS_MULTIPLIER;
        if(this.clo === undefined) {
            this.app.logger.info("liquidator - adding non clo delay (15min)");
            this.txDelay += 900;
        }
    }

    async start() {
        try {
            this.app.logger.info("running liquidation job");
            if(this.runningMux > 0) {
                this.runningMux--;
                this.app.logger.warn(`skip liquidation.start() - Mutex: ${this.runningMux}/10`);
                return;
            }
            this.runningMux = 10;
            if(this.app.config.TOKENS !== undefined) {
                this.app.logger.info(`SuperTokens to liquidate`);
                for(const addr of this.app.config.TOKENS) {
                    this.app.logger.info(this.app.client.superTokenNames[addr]);
                }
            }
            const checkDate = this.app.time.getTimeWithDelay(this.txDelay);
            const haveBatchWork = await this.app.db.queries.getNumberOfBatchCalls(checkDate);
            if(haveBatchWork.length > 0) {
                this.app.logger.info("Running batch")
                await this.multiTermination(haveBatchWork, checkDate);
                //await this.singleTerminations(work);
            } else {
                await this.singleTerminations(
                    await this.app.db.queries.getLiquidations(
                        checkDate,
                        this.app.config.TOKENS
                    )
                );
            }
        } catch(err) {
            this.app.logger.error(`liquidator.start() - ${err}`);
        } finally {
            this.runningMux = 0;
        }
    }

    async isPossibleToClose(superToken, sender, receiver) {
        //Note: Is flow does not exist on the network, we are going to remove from DB
        const flowExist = (await this.app.protocol.checkFlow(superToken, sender, receiver)) !== undefined;
        return flowExist && (await this.app.protocol.isAccountCriticalNow(superToken, sender));
    }

    async singleTerminations(work) {

        const wallet = this.app.client.getAccount();
        const chainId = await this.app.client.getNetworkId();
        let networkAccountNonce = await this.app.client.web3.eth.getTransactionCount(wallet.address);

        for(const job of work) {
            //Returned error: header not found (??)
            if(await this.isPossibleToClose(job.superToken, job.sender, job.receiver))
            {
                try {
                    const tx = this.app.protocol.generateDeleteFlowABI(job.superToken, job.sender, job.receiver);
                    const BaseGasPrice = Math.ceil(parseInt(await this.app.client.estimateGasPrice()) * 1.2);
                    const txObject = {
                        retry : 1,
                        step : this.gasMultiplier,
                        target: this.app.client.sf._address,
                        flowSender: job.sender,
                        flowReceiver: job.receiver,
                        superToken: job.superToken,
                        tx: tx,
                        gasPrice: BaseGasPrice,
                        nonce: networkAccountNonce,
                        chainId: chainId
                    }
                    this.app.logger.debug(`sending tx from account ${wallet.address}`);
                    const result = await this.sendWithRetry(wallet, txObject, this.timeout);
                    if(result !== undefined && result.error !== undefined) {
                        this.app.logger.error(result.error);
                    } else {
                        this.app.logger.info(JSON.stringify(result));
                    }
                } catch(err) {
                    this.app.logger.error(err);
                    process.exit(1);
                }
            } else {
                this.app.logger.debug(`address ${job.sender} is solvent at ${job.superToken}`);
                this.app.protocol.newEstimation(job.superToken, job.sender);
                await delay(500);
            }
        }
    }

    async multiTermination(batchWork, checkDate) {
        for(const batch of batchWork) {

            let senders = new Array();
            let receivers = new Array();

            const streams = await this.app.db.queries.getLiquidations(
                    checkDate,
                    batch.superToken
            );

            for(const flow of streams) {
                if(await this.isPossibleToClose(flow.superToken, flow.sender, flow.receiver)) {
                    senders.push(flow.sender);
                    receivers.push(flow.receiver);
                }

                if(senders.length === this.splitBatch) {
                    console.log(senders);
                    console.log("Send batch");
                    await this.sendBatch(batch.superToken, senders, receivers);
                    senders = new Array();
                    receivers = new Array();
                }
            }

            if(senders.length !== 0) {
                console.log(senders);
                console.log("Send batch - remain");
                await this.sendBatch(batch.superToken, senders, receivers);
                senders = new Array();
                receivers = new Array();
            }
            //console.log(streams);
        }
    }

    async sendBatch(superToken, senders, receivers) {
        const wallet = this.app.client.getAccount();
        const chainId = await this.app.client.getNetworkId();
        let networkAccountNonce = await this.app.client.web3.eth.getTransactionCount(wallet.address);
        try {
            const tx = this.app.protocol.generateMultiDeleteFlowABI(superToken, senders, receivers);
            console.log(tx);
            const BaseGasPrice = Math.ceil(parseInt(await this.app.client.estimateGasPrice()) * 1.2);
            const txObject = {
                retry : 1,
                step : this.gasMultiplier,
                target: this.app.config.BATCH_CONTRACT,
                superToken: superToken,
                tx: tx,
                gasPrice: BaseGasPrice,
                nonce: networkAccountNonce,
                chainId: chainId
            }
            this.app.logger.debug(`sending tx from account ${wallet.address}`);
            const result = await this.sendWithRetry(wallet, txObject, this.timeout);
            if(result !== undefined && result.error !== undefined) {
                this.app.logger.error(result.error);
            } else {
                this.app.logger.info(JSON.stringify(result));
            }
        } catch(err) {
            this.app.logger.error(err);
            process.exit(1);
        }
    }

    async sendWithRetry(wallet, txObject, ms) {
        await delay(1000);
        //gas limit estimation
        const gas = await this.estimateGasLimit(wallet, txObject);
        if(gas.error !== undefined) {
            this.app.logger.error(gas.error);

            if(gas.error.message === "Returned error: execution reverted: CFA: flow does not exist") {
                await this.app.protocol.checkFlow(txObject.superToken, txObject.flowSender, txObject.flowReceiver);
            }

            if(gas.error.message === "Returned error: execution reverted") {
                console.log("TODO")
            }

            return {error: gas.error, tx: undefined};
        }
        txObject.gasLimit = gas.gasLimit;
        const signed = await this.signTx(wallet, txObject);
        if(signed.error !== undefined) {
            console.log(signed.error);
            if(signed.error === "Returned error: replacement transaction underpriced") {
                this.app.logger.warn(`replacement transaction underpriced`);
                txObject.retry = txObject.retry + 1;
                return this.sendWithRetry(wallet, txObject, ms);
            }

            if(signed.error === "Returned error: execution reverted: CFA: flow does not exist") {
                this.app.logger.warn(`flow don't exist anymore`);
                return {error: signed.error, tx: undefined};
            }
            return {error: signed.error, tx: undefined};
        }

        try {
            this.app.logger.info(`waiting until timeout for ${ms / 1000} seconds` );
            txObject.txHash = signed.tx.transactionHash;
            signed.tx.timeout = ms;
            const tx =  await promiseTimeout    (
                this.app.client.sendSignedTransaction(signed),
                ms
            );

            return {error: undefined, tx: tx};

        } catch(err) {
            if(err.message === "timeout rejection") {
                this.app.logger.debug(`agent account: ${wallet.address} - replacement with nonce: ${txObject.nonce} tx: ${signed.tx.transactionHash}`)
                txObject.retry = txObject.retry + 1;
                return this.sendWithRetry(wallet, txObject, ms);
            }

            if(err.message === "Returned error: replacement transaction underpriced") {
                this.app.logger.debug(`replacing transaction underpriced`);
                txObject.retry++;
                return this.sendWithRetry(wallet, txObject, ms);
            }

            if(err.message === "Returned error: nonce too low") {
                this.app.logger.debug(`nonce too low, retry`);
                txObject.nonce++;
                return this.sendWithRetry(wallet, txObject, ms);
            }

            if(err.message === "Returned error: already known") {
                this.app.logger.debug(`submited tx already known`);
                return {error: err.message, tx: undefined};
            }

            if(err.message === "Returned error: insufficient funds for gas * price + value") {
                this.app.logger.error(`insufficient funds agent account`);
                return {error: err.message, tx: undefined};
            }

            //Error: Transaction has been reverted by the EVM
            console.log("catch error - ", err);
        }
    }
    async estimateGasLimit(wallet, txObject) {
        try {
            let result = await this.app.client.web3.eth.estimateGas({
                from: wallet.address,
                to: txObject.target,
                data: txObject.tx
                });
                result += Math.ceil(parseInt(result) * 1.2);
                //result += result * 0.2;
                /*
                if(result < 28312) {
                    result = 28312;
                }
                */
            return { error: undefined, gasLimit : result };
        } catch(err) {
            return { error: err, gasLimit : undefined };
        }
    }
    async signTx(wallet, txObject) {
        try {
            txObject.gasPrice = this._updateGasPrice(txObject.gasPrice, txObject.retry, txObject.step);
            const unsignedTx = {
                chainId : txObject.chainId,
                to : txObject.target,
                from : wallet.address,
                data : txObject.tx,
                nonce : txObject.nonce,
                gasPrice: txObject.gasPrice,
                gasLimit : txObject.gasLimit
            };
            const signed = await this.app.client.signTransaction(
                unsignedTx,
                wallet._privateKey.toString("hex")
            );
            signed.txObject = txObject;
            return { tx: signed, error: undefined };
        } catch(err) {
            return { tx: undefined, error: err};
        }
    }

    _updateGasPrice(originalGasPrice, retryNumber, step) {
        let gasPrice = originalGasPrice;
        if(retryNumber > 1) {
            if(this.app.config.MAX_GAS_PRICE !== undefined
                && parseInt(originalGasPrice) >= this.app.config.MAX_GAS_PRICE
            )
            {
                this.app.logger.debug(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
                gasPrice = parseInt(txObject.gasPrice) + 1;
            } else {
                gasPrice = Math.ceil(parseInt(gasPrice) * step);
            }
            this.app.logger.debug(`update gas price from ${originalGasPrice} to ${gasPrice}`);
        }
        return gasPrice;
    }
}

module.exports = Liquidator;
