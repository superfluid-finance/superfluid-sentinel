class Gas {
  constructor (app) {
    this.app = app;
  }

  async getGasLimit (wallet, txObject) {
    try {
      let result = await this.app.client.web3.eth.estimateGas({
        from: wallet.address,
        to: txObject.target,
        data: txObject.tx
      });
      result += Math.ceil(parseInt(result) * 0.1);
      return {
        error: undefined,
        gasLimit: result
      };
    } catch (err) {
      return {
        error: this.app.Errors.EVMErrorParser(err),
        gasLimit: undefined
      };
    }
  }

  async getGasPrice () {
    try {
      const price = await this.app.client.web3.eth.getGasPrice();
      return {
        error: undefined,
        gasPrice: price

      };
    } catch (err) {
      return {
        error: this.app.Errors.EVMErrorParser(err),
        gasPrice: undefined
      };
    }
  }

  getUpdatedGasPrice (originalGasPrice, retryNumber, step) {
    let gasPrice = originalGasPrice;
    if (retryNumber > 1) {
      if (this.app.config.MAX_GAS_PRICE !== undefined &&
        parseInt(originalGasPrice) >= this.app.config.MAX_GAS_PRICE
      ) {
        this.app.logger.debug(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
        this.app.notifier.sendNotification(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
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
