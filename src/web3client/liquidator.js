const utils = require("../utils/utils");

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
            this.app.logger.debug("running liquidation job");
            if(this.runningMux > 0) {
                this.runningMux--;
                this.app.logger.warn(`skip liquidation.start() - ${this.runningMux}`);
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
            const work = await this.app.db.queries.getLiquidations(checkDate, this.app.config.TOKENS);
            if(haveBatchWork.length > 0) {
                //await this.multiTermination(haveBatchWork, work);
                await this.singleTerminations(work);
            } else {
                await this.singleTerminations(work);
            }
        } catch(err) {
            this.app.logger.error(`liquidator.start() - ${err}`);
        } finally {
            this.runningMux = 0;
        }
    }

    async singleTerminations(work) {

        const wallet = this.app.client.getAccount();
        const chainId = await this.app.client.getNetworkId();
        let networkAccountNonce = await this.app.client.web3.eth.getTransactionCount(wallet.address);
        const BaseGasPrice = await this.app.client.estimateGasPrice();

        for(const job of work) {
            await this.app.protocol.checkFlow(job.superToken, job.sender, job.receiver);
            if(await this.app.protocol.isAccountCriticalNow(job.superToken, job.sender))
            {
                try {
                    const tx = this.app.protocol.generateDeleteFlowABI(job.superToken, job.sender, job.receiver);
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
            }
        }
    }

    async multiTermination(batchWork, work) {
        throw Error("Not implemented");
    }

    async sendWithRetry(wallet, txObject, ms) {
        //gas limit estimation
        const gas = await this.estimateGasLimit(wallet, txObject);
        if(gas.error !== undefined) {
            this.app.logger.error(gas.error);
            if(gas.error.message === "Returned error: execution reverted: CFA - flow does not exist") {
                await this.app.protocol.checkFlow(txObject.superToken, txObject.flowSender, txObject.flowReceiver);
                return {error: gas.error, tx: undefined};
            }
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
            this.app.logger.info(`waiting until timeout for ${this.timeout / 1000} seconds` );
            txObject.txHash = signed.tx.transactionHash;
            signed.tx.timeout = ms;
            const tx =  await utils.promiseTimeout(
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

            if(err.message === "Error: Returned error: nonce too low") {
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

            console.log("catch error - ", err);
        }
    }
    async estimateGasLimit(wallet, txObject) {
        try {
            const result = await this.app.client.web3.eth.estimateGas({
                from: wallet.address,
                to: txObject.target,
                data: txObject.tx
                });
            return { error: undefined, gasLimit : result };
        } catch(err) {
            return { error: err, gasLimit : undefined };
        }
    }

    async signTx(wallet, txObject) {
        try {
            let gasPrice = txObject.gasPrice;
            if(txObject.retry > 1) {
                console.log("old gasprice: ", txObject.gasPrice);
                if(this.app.config.MAX_GAS_PRICE !== undefined && parseInt(txObject.gasPrice) >= this.app.config.MAX_GAS_PRICE) {
                    this.app.logger.debug(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
                    gasPrice = parseInt(txObject.gasPrice) + 1;
                } else {
                    gasPrice = Math.ceil(parseInt(txObject.gasPrice) * txObject.step);
                }
                this.app.logger.debug(`update gas price from ${txObject.gasPrice} to ${gasPrice}`);
                txObject.gasPrice = gasPrice;
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

            this.app.logger.info("signing tx");
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
