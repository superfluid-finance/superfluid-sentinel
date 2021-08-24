class Gas {

    construtor(app) {
        this.app = app;
    }

    async getLimit(wallet, txObject) {
        try {
            const result = await this.app.client.estimateGas({
                from: wallet.address,
                to: txObject.target,
                data: txObject.tx
                });
            return { gasLimit : result, error: undefined };
        } catch(err) {
            return { gasLimit : undefined, error: err };
        }
    }

    async getPrice() {
        try {
            const price = this.app.client.getGasPrice();
            return { gasPrice: price, error: undefined };
        } catch(err) {
            return { gasPrice : undefined, error: err };
        }
    }
}

module.exports = Gas;
