const { FMT_NUMBER } = require("web3");

const dataFormat = {
  number: FMT_NUMBER.NUMBER
};

class Liquidator {
  constructor (app) {
    this.app = app;
    this.transaction = new (require("../transaction/transaction"))(app);
    this._isShutdown = false;
  }

  async start () {
    try {
      if (this.app._isShutdown) {
        this._isShutdown = true;
        this.app.logger.info("app.shutdown() - closing liquidation");
        return;
      }

      if (this.app.client.RPCClient.isRPCDrifting()) {
        return {
          error: "liquidation.start() - RPC drifting",
          msg: undefined
        };
      }

      this.app.logger.debug("running liquidation job");
      const checkDate = this.app.time.getDelayedTime();
      let haveBatchWork = [];
      // if we have a batchLiquidator contract, use batch calls
      if (this.app.config.BATCH_CONTRACT !== undefined) {
        haveBatchWork = await this.app.db.bizQueries.getNumberOfBatchCalls(checkDate, this.app.config.TOKENS, this.app.config.EXCLUDED_TOKENS);
        if (haveBatchWork.length > 0) {
          this.app.logger.debug(JSON.stringify(haveBatchWork));
        }
      }
      if (haveBatchWork.length > 0) {
        await this.multiTermination(haveBatchWork, checkDate);
      } else {
        const work = await this.app.db.bizQueries.getLiquidations(checkDate, this.app.config.TOKENS, this.app.config.EXCLUDED_TOKENS, this.app.config.MAX_TX_NUMBER);
        await this.singleTerminations(work);
      }
    } catch (err) {
      this.app.logger.error(`liquidator.start() - ${err}`);
      return {
        error: err,
        msg: undefined
      };
    }

    return {
      error: undefined,
      msg: "ended"
    };
  }

  async processLiquidations (liquidations) {
    // common logic for processing liquidations
    for (const job of liquidations) {
      if (await this.app.protocol.isPossibleToClose(job.superToken, job.sender, job.receiver, job.pppmode)) {
        try {
          const txData = (job.source === "CFA")
            ? this.app.protocol.cfaHandler.getDeleteTransaction(job.superToken, job.sender, job.receiver)
            : this.app.protocol.gdaHandler.getDeleteTransaction(job.superToken, job.sender, job.receiver);

          const baseGasPrice = await this.app.gasEstimator.getCappedGasPrice();
          // if we hit the gas price limit or estimation error, we stop the liquidation job and return to main loop
          if (baseGasPrice.error) {
            this.app.logger.error(`Liquidator.baseGasPrice - ${baseGasPrice.error}`);
            return;
          }
          if (baseGasPrice.hitGasPriceLimit) {
            this.app.logger.warn(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
            this.app.notifier.sendNotification(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
            return;
          }
          const agreementData = {
            superToken: job.superToken,
            sender: job.sender,
            receiver: job.receiver,
            source: job.source
          };
          const transactionWithContext = {
            retry: 1,
            step: Number(this.app.config.RETRY_GAS_MULTIPLIER),
            target: txData.target,
            agreementData,
            tx: txData.tx,
            gasPrice: Number(baseGasPrice.gasPrice),
            nonce: Number(networkAccountNonce),
            chainId: Number(chainId)
          };
          const result = await this.sendWithRetry(wallet, transactionWithContext, this.app.config.TX_TIMEOUT);
          if (result !== undefined && result.error !== undefined) {
            this.app.logger.error(`Liquidator.sendWithRetry: ${result.error}`);
          } else {
            this.app.logger.debug(JSON.stringify(result));
          }
        } catch (err) {
          this.app.logger.error(`liquidator.processLiquidations() - ${err}`);
          process.exit(1);
        }
      } else {
        this.app.logger.debug(`address ${job.sender} is solvent at ${job.superToken}`);
        await this.app.queues.addQueuedEstimation(job.superToken, job.sender, "Liquidation job");
        await this.app.timer.timeout(500);
      }
    }
  }

  async singleTerminations (liquidations) {
    if (liquidations.length === 0) {
      return;
    }
    const wallet = this.app.client.getAccount();
    const chainId = await this.app.client.getChainId();
    const networkAccountNonce = await wallet.txCount(dataFormat);
    for (const job of liquidations) {
      if (await this.app.protocol.isPossibleToClose(job.superToken, job.sender, job.receiver, job.pppmode)) {
        try {
          const txData = (job.source === "CFA")
            ? this.app.protocol.cfaHandler.getDeleteTransaction(job.superToken, job.sender, job.receiver)
            : this.app.protocol.gdaHandler.getDeleteTransaction(job.superToken, job.sender, job.receiver);

          const baseGasPrice = await this.app.gasEstimator.getCappedGasPrice();
          // if we hit the gas price limit or estimation error, we stop the liquidation job and return to main loop
          if (baseGasPrice.error) {
            this.app.logger.error(`Liquidator.baseGasPrice - ${baseGasPrice.error}`);
            return;
          }
          if (baseGasPrice.hitGasPriceLimit) {
            this.app.logger.warn(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
            this.app.notifier.sendNotification(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
            return;
          }
          const agreementData = {
            superToken: job.superToken,
            sender: job.sender,
            receiver: job.receiver,
            source: job.source
          };
          const transactionWithContext = {
            retry: 1,
            step: Number(this.app.config.RETRY_GAS_MULTIPLIER),
            target: txData.target,
            agreementData,
            tx: txData.tx,
            gasPrice: Number(baseGasPrice.gasPrice),
            nonce: Number(networkAccountNonce),
            chainId: Number(chainId)
          };
          const result = await this.sendWithRetry(wallet, transactionWithContext, this.app.config.TX_TIMEOUT);
          if (result !== undefined && result.error !== undefined) {
            this.app.logger.error(`Liquidator.sendWithRetry: ${result.error}`);
          } else {
            this.app.logger.debug(JSON.stringify(result));
          }
        } catch (err) {
          this.app.logger.error(`liquidator.singleTerminations() - ${err}`);
          process.exit(1);
        }
      } else {
        this.app.logger.debug(`address ${job.sender} is solvent at ${job.superToken}`);
        await this.app.queues.addQueuedEstimation(job.superToken, job.sender, "Liquidation job");
        await this.app.timer.timeout(500);
      }
    }
  }

  async multiTermination (batchWork, checkDate) {
    for (const batch of batchWork) {
      let liquidations = [];
      const streams = await this.app.db.bizQueries.getLiquidations(
        checkDate,
        batch.superToken,
        this.app.config.EXCLUDED_TOKENS,
        this.app.config.MAX_TX_NUMBER
      );

      for (const flow of streams) {
        if (await this.app.protocol.isPossibleToClose(flow.superToken, flow.sender, flow.receiver, flow.pppmode)) {
          liquidations.push({ sender: flow.sender, receiver: flow.receiver, source: flow.source });
        } else {
          this.app.logger.debug(`address ${flow.sender} is solvent at ${flow.superToken}`);
          await this.app.queues.addQueuedEstimation(flow.superToken, flow.sender, "Liquidation job");
          await this.app.timer.timeout(500);
        }

        if (liquidations.length === parseInt(this.app.config.MAX_BATCH_TX)) {
          this.app.logger.debug(`sending a full batch work: load ${liquidations.length}`);
          await this.sendBatch(batch.superToken, liquidations);
          liquidations = [];
        }
      }

      if (liquidations.length !== 0) {
        if (liquidations.length === 1) {
          await this.singleTerminations([{
            superToken: batch.superToken,
            sender: liquidations[0].sender,
            receiver: liquidations[0].receiver
          }]);
        } else {
          this.app.logger.debug(`sending a partial batch work: load ${liquidations.length}`);
          await this.sendBatch(batch.superToken, liquidations);
        }
      }
    }
  }

  async sendBatch (superToken, liquidations) {
    const wallet = this.app.client.getAccount();
    const chainId = await this.app.client.getChainId();
    const networkAccountNonce = await wallet.txCount(dataFormat);
    try {
      const txData = this.app.protocol.getBatchDeleteTransaction(superToken, liquidations);
      const baseGasPrice = await this.app.gasEstimator.getCappedGasPrice();
      // if we hit the gas price limit or estimation error, we stop the liquidation job and return to main loop
      if (baseGasPrice.error) {
        this.app.logger.error(baseGasPrice.error);
        return;
      }
      if (baseGasPrice.hitGasPriceLimit) {
        this.app.logger.warn(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
        this.app.notifier.sendNotification(`Hit gas price limit of ${this.app.config.MAX_GAS_PRICE}`);
        return;
      }
      const transactionWithContext = {
        retry: 1,
        step: this.app.config.RETRY_GAS_MULTIPLIER,
        target: txData.target,
        superToken,
        tx: txData.tx,
        gasPrice: baseGasPrice.gasPrice,
        nonce: networkAccountNonce,
        chainId
      };
      const result = await this.sendWithRetry(wallet, transactionWithContext, this.app.config.TX_TIMEOUT);
      if (result !== undefined && result.error !== undefined) {
        this.app.logger.error(`Liquidation.sendBatch - ${result.error}`);
      } else {
        this.app.logger.debug(JSON.stringify(result));
      }
    } catch (err) {
      this.app.logger.error(err);
      process.exit(1);
    }
  }

  async sendWithRetry (wallet, transactionWithContext, ms) {
    await this.app.timer.timeout(1000);
    // When estimate gas we get a preview of what can happen when send the transaction. Depending on the error we should execute specific logic
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
    const { signedWithContext, signingError } = await this.transaction.signWithContext(wallet, transactionWithContext);

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

    try {
      signedWithContext.timeout = ms;
      this.app.logger.info(`waiting until timeout for ${ms / 1000} seconds for tx ${signedWithContext.signed.transactionHash}`);
      // Broadcast transaction
      const tx = await this.app.timer.promiseTimeout(
        this.app.client.sendSignedTransaction(signedWithContext),
        ms
      );

      return {
        error: undefined,
        tx
      };
    } catch (err) {
      if (err instanceof this.app.Errors.TimeoutError) {
        this.app.logger.debug(`timeout of tx: ${signedWithContext.signed.transactionHash}`);
        signedWithContext.retry++;
        return this.sendWithRetry(wallet, signedWithContext, ms);
      }
      // get errors from EVM
      const error = this.app.Errors.EVMErrorParser(err);
      if (error instanceof this.app.Errors.TxUnderpricedError) {
        this.app.logger.warn("replacing transaction underpriced");
        signedWithContext.retry++;
        return this.sendWithRetry(wallet, signedWithContext, ms);
      }
      if (error instanceof this.app.Errors.AccountNonceError) {
        this.app.logger.warn("nonce too low, retry");
        signedWithContext.nonce++;
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
      // log remaining errors
      this.app.logger.error(`Liquidator.sendWithRetry() - no logic to catch error : ${error}`);
    }
  }
}

module.exports = Liquidator;
