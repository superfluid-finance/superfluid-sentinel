class Gas {

    constructor(app) {
        this.app = app;
    }

    async gasLimit(wallet, txObject) {
        try {
            let result = await this.app.client.web3HTTP.eth.estimateGas({
                from: wallet.address,
                to: txObject.target,
                data: txObject.tx
                });
                result += Math.ceil(parseInt(result) * 1.2);
            return { error: undefined, gasLimit : result };
        } catch(err) {
            console.error(err);
            return { error: err, gasLimit : undefined };
        }
    }

    async gasPrice() {
        try {
            const price = await this.app.client.web3HTTP.eth.getGasPrice();
            return { gasPrice: price, error: undefined };
        } catch(err) {
            console.error(err);
            return { gasPrice : undefined, error: err };
        }
    }

    updateGasPrice(originalGasPrice, retryNumber, step) {
        let gasPrice = originalGasPrice;
        if(retryNumber > 1) {
            if(this.app.config.MAX_GAS_PRICE !== undefined
                && parseInt(originalGasPrice) >= this.app.config.MAX_GAS_PRICE
            )
            {
                this.app.logger.debug(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
                gasPrice = this.app.config.MAX_GAS_PRICE;
            } else {
                gasPrice = Math.ceil(parseInt(gasPrice) * step);
            }
            this.app.logger.debug(`update gas price from ${originalGasPrice} to ${gasPrice}`);
        }
        return gasPrice;
    }
}

module.exports = Gas;
