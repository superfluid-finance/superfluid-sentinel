const { FMT_NUMBER } = require("web3");

const dataFormat = {
  number: FMT_NUMBER.NUMBER
};

class Gas {
  constructor (app) {
    this.app = app;
  }

  async getGasLimit (wallet, transactionWithContext) {
    try {
      let result = await this.app.client.RPCClient.estimateGas({
        from: wallet.address,
        to: transactionWithContext.target,
        data: transactionWithContext.tx
      }, dataFormat);

      result += Math.ceil(Number(result) * 0.1);
      return {
        error: undefined,
        gasLimit: Number(result)
      };
    } catch (err) {
      return {
        error: this.app.Errors.EVMErrorParser(err),
        gasLimit: undefined
      };
    }
  }

  async getCappedGasPrice () {
    try {
      const gasPrice = await this.app.client.RPCClient.getGasPrice(dataFormat);
      let hitGasPriceLimit = false;
      if (this.app.config.MAX_GAS_PRICE !== undefined &&
          parseInt(gasPrice) >= this.app.config.MAX_GAS_PRICE
      ) {
        hitGasPriceLimit = true;
      }
      return {
        error: undefined,
        gasPrice,
        hitGasPriceLimit

      };
    } catch (err) {
      return {
        error: this.app.Errors.EVMErrorParser(err)
      };
    }
  }

  getUpdatedGasPrice (originalGasPrice, retryNumber, step) {
    let gasPrice = originalGasPrice;
    let hitGasPriceLimit = false;
    if (retryNumber > 1) {
      if (this.app.config.MAX_GAS_PRICE !== undefined &&
        parseInt(originalGasPrice) >= this.app.config.MAX_GAS_PRICE
      ) {
        this.app.logger.warn(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
        this.app.notifier.sendNotification(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
        gasPrice = this.app.config.MAX_GAS_PRICE;
        hitGasPriceLimit = true;
      } else {
        gasPrice = Math.ceil(parseInt(gasPrice) * step);
      }
      this.app.logger.debug(`update gas price from ${originalGasPrice} to ${gasPrice}`);
    }
    return {
      gasPrice,
      hitGasPriceLimit
    };
  }
}

module.exports = Gas;
