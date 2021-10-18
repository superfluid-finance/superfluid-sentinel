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

class Liquidator {

    constructor(app) {
        this.app = app;
        this.txDelay = this.app.config.ADDITIONAL_LIQUIDATION_DELAY;
        if(this.app.config.CLO_ADDR === undefined) {
            this.app.logger.info("Not configured as CLO -> adding 15 min delay");
            this.txDelay += 900;
        }
    }

    async start() {
        try {
            this.app.logger.debug(`running liquidation job`);
            const checkDate = this.app.time.getTimeWithDelay(this.txDelay);
            let haveBatchWork = [];
            //if we have a batchLiquidator contract, use batch calls
            if(this.app.config.BATCH_CONTRACT !== undefined) {
                haveBatchWork = await this.app.db.queries.getNumberOfBatchCalls(checkDate);
                this.app.logger.debug(JSON.stringify(haveBatchWork));
            }

            if(haveBatchWork.length > 0) {
                await this.multiTermination(haveBatchWork, checkDate);
            } else {
                const work = await this.app.db.queries.getLiquidations(checkDate, this.app.config.TOKENS);
                await this.singleTerminations(work);
            }
        } catch(err) {
            this.app.logger.error(`liquidator.start() - ${err}`);
            return {error:err, msg:undefined };
        } finally {
            return {error:undefined, msg:"ended"};
        }
    }

    async isPossibleToClose(superToken, sender, receiver) {
        //Note: Is flow does not exist on the network, we are going to remove from DB
        return (await this.app.protocol.checkFlow(superToken, sender, receiver)) !== undefined &&
            (await this.app.protocol.isAccountCriticalNow(superToken, sender));
    }

    async singleTerminations(work) {

        const wallet = this.app.client.getAccount();
        const chainId = await this.app.client.getNetworkId();
        let networkAccountNonce = await this.app.client.web3.eth.getTransactionCount(wallet.address);

        for(const job of work) {
            if(await this.isPossibleToClose(job.superToken, job.sender, job.receiver))
            {
                try {
                    const tx = this.app.protocol.generateDeleteFlowABI(job.superToken, job.sender, job.receiver);
                    const BaseGasPrice = await this.app.gasEstimator.getGasPrice();
                    const txObject = {
                        retry : 1,
                        step : this.app.config.RETRY_GAS_MULTIPLIER,
                        target: this.app.client.sf._address,
                        flowSender: job.sender,
                        flowReceiver: job.receiver,
                        superToken: job.superToken,
                        tx: tx,
                        gasPrice: BaseGasPrice.gasPrice,
                        nonce: networkAccountNonce,
                        chainId: chainId
                    }
                    const result = await this.sendWithRetry(wallet, txObject, this.app.config.TX_TIMEOUT);
                    if(result !== undefined && result.error !== undefined) {
                        this.app.logger.error(result.error);
                    } else {
                        this.app.logger.debug(JSON.stringify(result));
                    }
                } catch(err) {
                    this.app.logger.error(err);
                    process.exit(1);
                }
            } else {
                this.app.logger.debug(`address ${job.sender} is solvent at ${job.superToken}`);
                this.app.protocol.newEstimation(job.superToken, job.sender);
                await this.app.timer.delay(500);
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
                } else {
                    this.app.logger.debug(`address ${flow.sender} is solvent at ${flow.superToken}`);
                    this.app.protocol.newEstimation(flow.superToken, flow.sender);
                    await this.app.timer.delay(500);
                }
                if(senders.length === this.app.config.MAX_BATCH_TX) {
                    this.app.logger.debug(`sending a full batch work: load ${senders.length}`);
                    await this.sendBatch(batch.superToken, senders, receivers);
                    senders = new Array();
                    receivers = new Array();
                }
            }

            if(senders.length !== 0) {
                if(senders.length === 1) {
                    await this.singleTerminations([{
                        superToken: batch.superToken,
                        sender: senders[0],
                        receiver: receivers[0]
                    }]);
                } else {
                    this.app.logger.debug(`sending a partial batch work: load ${senders.length}`);
                    await this.sendBatch(batch.superToken, senders, receivers);
                }
                senders = new Array();
                receivers = new Array();
            }
        }
    }

    async sendBatch(superToken, senders, receivers) {
        const wallet = this.app.client.getAccount();
        const chainId = await this.app.client.getNetworkId();
        let networkAccountNonce = await this.app.client.web3.eth.getTransactionCount(wallet.address);
        try {
            const tx = this.app.protocol.generateMultiDeleteFlowABI(superToken, senders, receivers);
            const BaseGasPrice = await this.app.gasEstimator.getGasPrice();
            const txObject = {
                retry : 1,
                step : this.app.config.RETRY_GAS_MULTIPLIER,
                target: this.app.config.BATCH_CONTRACT,
                superToken: superToken,
                tx: tx,
                gasPrice: BaseGasPrice.gasPrice,
                nonce: networkAccountNonce,
                chainId: chainId
            }
            const result = await this.sendWithRetry(wallet, txObject, this.app.config.TX_TIMEOUT);
            if(result !== undefined && result.error !== undefined) {
                this.app.logger.error(result.error);
            } else {
                this.app.logger.debug(JSON.stringify(result));
            }
        } catch(err) {
            this.app.logger.error(err);
            process.exit(1);
        }
    }

    async sendWithRetry(wallet, txObject, ms) {
        await this.app.timer.delay(1000);
        //When estimate gas we get a preview of what can happen when send the transaction. Depending on the error we should execute specific logic
        const gas = await this.app.gasEstimator.getGasLimit(wallet, txObject);
        if(gas.error !== undefined) {
            this.app.logger.error(gas.error);
            if(gas.error.message === "Returned error: execution reverted: CFA: flow does not exist") {
                await this.app.protocol.checkFlow(txObject.superToken, txObject.flowSender, txObject.flowReceiver);
            }

            if(gas.error.message === "Returned error: execution reverted") {
                //TODO: Solve this EVM return error
            }

            return {error: gas.error, tx: undefined};
        }

        txObject.gasLimit = gas.gasLimit;
        const signed = await this.signTx(wallet, txObject);
        if(signed.error !== undefined) {
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
            txObject.txHash = signed.tx.transactionHash;
            signed.tx.timeout = ms;
            this.app.logger.info(`waiting until timeout for ${ms / 1000} seconds for tx ${txObject.txHash}`);
            //Broadcast transaction
            const tx =  await promiseTimeout(
                this.app.client.sendSignedTransaction(signed),
                ms
            );

            return {error: undefined, tx: tx};

        } catch(err) {
            if(err.message === "timeout rejection") {
                this.app.logger.debug(`timeout of tx: ${signed.tx.transactionHash}`)
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
                this.app.logger.warn(`insufficient funds agent account`);
                return {error: err.message, tx: undefined};
            }

            //log remaining errors
            this.app.logger.error(`liquidator.sendWithRetry() - no logic to catch error : ${err}`);
        }
    }

    async signTx(wallet, txObject) {
        try {
            txObject.gasPrice = this.app.gasEstimator.getUpdatedGasPrice(txObject.gasPrice, txObject.retry, txObject.step);
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
}

module.exports = Liquidator;
