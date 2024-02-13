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
      if (this.checkAppShutdown()) return;
      if (this.checkRPCDrift()) return;

      this.app.logger.debug("running liquidation job");
      const checkDate = this.app.time.getDelayedTime();

      const numberOfLiquidationsByToken = await this.getNumberOfLiquidationsByToken();

      await this.runLiquidationJob(numberOfLiquidationsByToken, checkDate);
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

  checkAppShutdown () {
    if (this.app._isShutdown) {
      this._isShutdown = true;
      this.app.logger.info("app.shutdown() - closing liquidation");
      return true;
    }
    return false;
  }

  checkRPCDrift () {
    if (this.app.client.RPCClient.isRPCDrifting()) {
      return {
        error: "liquidation.start() - RPC drifting",
        msg: undefined
      };
    }
    return false;
  }

  async getNumberOfLiquidationsByToken () {
    let numberOfLiquidationsByToken = [];
    if (this.app.client.contracts.haveBatchContract()) {
      numberOfLiquidationsByToken = await this.app.db.bizQueries.getNumberOfTransactionByToken();
      if (numberOfLiquidationsByToken.length > 0) {
        this.app.logger.debug(JSON.stringify(numberOfLiquidationsByToken));
      }
    }
    return numberOfLiquidationsByToken;
  }

  async runLiquidationJob (numberOfLiquidationsByToken, checkDate) {
    if (numberOfLiquidationsByToken.length > 0) {
      await this.multiTermination(numberOfLiquidationsByToken, checkDate);
    } else {
      const liquidations = await this.app.db.bizQueries.getLiquidationsWithConfigParams();
      await this.singleTerminations(liquidations);
    }
  }

  async _isPossibleToClose (superToken, sender, receiver, pppmode) {
    if (await this.app.protocol.isPossibleToClose(superToken, sender, receiver, pppmode)) {
      return true;
    }
    this.app.logger.debug(`address ${sender} is solvent at ${superToken}`);
    await this.app.queues.addQueuedEstimation(superToken, sender, "Liquidation job");
    await this.app.timer.timeout(500);
  }

  async singleTerminations (liquidations) {
    if (liquidations.length === 0) {
      return;
    }
    const wallet = this.app.client.getAccount();
    const chainId = await this.app.client.getChainId();
    const networkAccountNonce = await wallet.txCount(dataFormat);
    for (const liq of liquidations) {
      if (await this._isPossibleToClose(liq.superToken, liq.sender, liq.receiver, liq.pppmode)) {
        try {
          const txData = (liq.source === "CFA")
            ? this.app.protocol.cfaHandler.getDeleteTransaction(liq.superToken, liq.sender, liq.receiver)
            : this.app.protocol.gdaHandler.getDeleteTransaction(liq.superToken, liq.sender, liq.receiver);

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
            superToken: liq.superToken,
            sender: liq.sender,
            receiver: liq.receiver,
            source: liq.source
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
          const result = await this.transaction.sendWithRetry(wallet, transactionWithContext, this.app.config.TX_TIMEOUT);

          if (result !== undefined && result.error !== undefined) {
            this.app.logger.error(`Liquidator.sendWithRetry: ${result.error}`);
          } else {
            this.app.logger.debug(JSON.stringify(result));
          }
        } catch (err) {
          this.app.logger.error(`liquidator.singleTerminations() - ${err}`);
          process.exit(1);
        }
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
        if (await this._.isPossibleToClose(flow.superToken, flow.sender, flow.receiver, flow.pppmode)) {
          liquidations.push({ sender: flow.sender, receiver: flow.receiver, source: flow.source });
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
      const result = await this.transaction.sendWithRetry(wallet, transactionWithContext, this.app.config.TX_TIMEOUT);
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
}

module.exports = Liquidator;
