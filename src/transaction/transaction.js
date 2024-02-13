// Transaction class is a static class that handles all the transaction related operations

class Transaction {
  constructor (app) {
    if (!app) throw new Error("Transaction: app is not defined");
    this.app = app;
  }

  async signWithContext (wallet, transactionWithContext) {
    try {
      const updatedGas = this.app.gasEstimator.getUpdatedGasPrice(
        transactionWithContext.gasPrice,
        transactionWithContext.retry,
        transactionWithContext.step
      );

      transactionWithContext.gasPrice = updatedGas.gasPrice;

      const unsignedTx = {
        chainId: transactionWithContext.chainId,
        to: transactionWithContext.target,
        from: transactionWithContext.address,
        data: transactionWithContext.tx,
        nonce: transactionWithContext.nonce,
        gasPrice: transactionWithContext.gasPrice,
        gasLimit: transactionWithContext.gasLimit
      };

      const signedTransaction = await wallet.signTransaction(unsignedTx);

      const signedWithContext = transactionWithContext;
      signedWithContext.signed = signedTransaction;
      signedWithContext.hitGasPriceLimit = updatedGas.hitGasPriceLimit;

      return {
        signedWithContext,
        signingError: undefined
      };
    } catch (err) {
      return {
        signedWithContext: undefined,
        signingError: err
      };
    }
  }

  async signTransaction (wallet, transactionWithContext, ms) {
    const { signedWithContext, signingError } = await this.signWithContext(wallet, transactionWithContext);
    if (signingError !== undefined) {
      const error = this.app.Errors.EVMErrorParser(signingError);

      if (error instanceof this.app.Errors.TxUnderpricedError) {
        this.app.logger.warn("replacement transaction underpriced");
        transactionWithContext.retry++;
        return this.sendWithRetry(wallet, transactionWithContext, ms);
      }

      if (error instanceof this.app.Errors.SmartContractError) {
        this.app.logger.warn(signingError.originalMessage);
        return {
          error,
          tx: undefined
        };
      }
      return {
        error: signingError,
        tx: undefined
      };
    }
    return signedWithContext;
  }

  async sendTransaction (wallet, signedWithContext, ms) {
    try {
      signedWithContext.timeout = ms;
      this.app.logger.info(`waiting until timeout for ${ms / 1000} seconds for tx ${signedWithContext.signed.transactionHash}`);
      const tx = await this.app.timer.promiseTimeout(
        this.app.client.sendSignedTransaction(signedWithContext),
        ms
      );
      return {
        error: undefined,
        tx
      };
    } catch (err) {
      return this.handleError(err, wallet, signedWithContext, ms);
    }
  }

  async sendWithRetry (wallet, transactionWithContext, ms) {
    transactionWithContext = await this.estimateGas(wallet, transactionWithContext);
    if (transactionWithContext.error) {
      return transactionWithContext;
    }
    const signedWithContext = await this.signTransaction(wallet, transactionWithContext, ms);
    if (signedWithContext.error) {
      return signedWithContext;
    }
    return this.sendTransaction(wallet, signedWithContext, ms);
  }

  async estimateGas (wallet, transactionWithContext) {
    await this.app.timer.timeout(1000);
    const gas = await this.app.gasEstimator.getGasLimit(wallet, transactionWithContext);
    if (gas.error !== undefined) {
      if (gas.error instanceof this.app.Errors.SmartContractError) {
        await this.app.protocol.cfaHandler.checkFlow(
          transactionWithContext.agreementData.superToken,
          transactionWithContext.agreementData.sender,
          transactionWithContext.agreementData.receiver
        );
      }
      return {
        error: gas.error,
        tx: undefined
      };
    }
    transactionWithContext.gasLimit = gas.gasLimit;
    return transactionWithContext;
  }

  async handleError (err, wallet, signedWithContext, ms) {
    let retryTx;
    if (err instanceof this.app.Errors.TimeoutError) {
      this.app.logger.debug(`timeout of tx: ${signedWithContext.signed.transactionHash}`);
      signedWithContext.retry++;
      retryTx = true;
    }

    const error = this.app.Errors.EVMErrorParser(err);

    if (error instanceof this.app.Errors.TxUnderpricedError) {
      this.app.logger.warn("replacing transaction underpriced");
      signedWithContext.retry++;
      retryTx = true;
    }
    if (error instanceof this.app.Errors.AccountNonceError) {
      this.app.logger.warn("nonce too low, retry");
      signedWithContext.nonce++;
      retryTx = true;
    }

    // if we need to retry the transaction, we call sendWithRetry again
    if (retryTx) {
      return this.sendWithRetry(wallet, signedWithContext, ms);
    }

    if (error instanceof this.app.Errors.TxAlreadyKnownError) {
      this.app.logger.warn("submitted tx already known");
      return {
        error: error.message,
        tx: undefined
      };
    }
    if (error instanceof this.app.Errors.AccountFundsError) {
      this.app.logger.warn("insufficient funds on sentinel account");
      this.app.notifier.sendNotification(`Sentinel account has insufficient funds to send tx ${signedWithContext.signed.transactionHash}`);
      return {
        error: error.message,
        tx: undefined
      };
    }
    if (error instanceof this.app.Errors.GasBlockLimitError) {
      this.app.logger.warn("exceeds block gas limit");
      this.app.config.MAX_BATCH_TX = Math.ceil(parseInt(this.app.config.MAX_BATCH_TX / 2));
      this.app.logger.warn(`reducing batch size to ${this.app.config.MAX_BATCH_TX}`);
      if (this.app.config.MAX_BATCH_TX < 1) {
        this.app.logger.warn("can't reduce batch size more...");
        process.exit(1);
      }
      return {
        error: error.message,
        tx: undefined
      };
    }
    this.app.logger.error(`TransactionManager.sendWithRetry() - no logic to catch error : ${error}`);
    this.app.notifier.sendNotification(`Sending Transaction error without logic to catch error : ${error}`);
  }
}

module.exports = Transaction;
