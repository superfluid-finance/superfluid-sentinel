const BN = require("bn.js");

class Protocol {
  constructor (app) {
    this.app = app;
    this.PPPMode = {
      Patrician: 0,
      Pleb: 1,
      Pirate: 2
    }
  }

  async getAccountRealtimeBalanceOfNow (token, address) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.superToken.superTokens[token.toLowerCase()].methods.realtimeBalanceOfNow(
        address
      ).call();
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.getAccountRealtimeBalanceOfNow(): (${token}): ${err}`);
    }
  }

  async getCFAUserNetFlow (token, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.contracts.CFAv1.methods.getNetFlow(token, account).call();
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.getCFAUserNetFlow(): ${err}`);
    }
  }

  // get GDA User Net Flow, if GDA is not deployed, return 0
  async getGDAUserNetFlow (token, account) {
    try {
      this.app.client.addTotalRequest();
      if (this.app.client.contracts.getGDAv1Address() === undefined) {
        return 0;
      }
      // return this.app.client.contracts.GDAv1.methods.getNetFlow(token, account).call();
      const gdaUserNetFlow = await this.app.db.bizQueries.getGDAOutFlowRate(token, account);
      return gdaUserNetFlow[0].aggrDistributorFlowRate === null ?
          new BN(0) : (new BN(gdaUserNetFlow[0].aggrDistributorFlowRate.toString())).neg();
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.getGDAUserNetFlow(): ${err}`);
    }
  }

  // get total net flow (CFA + GDA)
  async getTotalNetFlow (token, account) {
      const CFAUserNetFlow = new BN(await this.getCFAUserNetFlow(token, account));
      const GDAUserNetFlow = new BN(await this.getGDAUserNetFlow(token, account));
      return CFAUserNetFlow.add(GDAUserNetFlow).toString();
  }

  async getCFAAgreementEvents (eventName, filter, app = undefined) {
    try {
      app = app || this.app;
      app.client.addTotalRequest();
      return app.client.contracts.CFAv1.getPastEvents(eventName, filter);
    } catch (err) {
      console.error("getCFAAgreementEvents " + err);
      throw Error(`Protocol.getCFAAgreementEvents(): ${err}`);
    }
  }

  // getGDAgreementEvents, if GDA is not deployed, return empty array
  async getGDAgreementEvents (eventName, filter, app = undefined) {
    try {
      app = app || this.app;
      app.client.addTotalRequest();
      // if GDA is not deployed, return empty array
      if (app.client.contracts.getGDAv1Address() === undefined) {
          return [];
      }
      return app.client.contracts.GDAv1.getPastEvents(eventName, filter);
    } catch (err) {
      console.error("getGDAgreementEvents" + err);
      throw Error(`Protocol.getGDAgreementEvents(): ${err}`);
    }
  }

  async isAccountCriticalNow (superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.superToken.superTokens[superToken.toLowerCase()].methods.isAccountCriticalNow(account).call();
    } catch (err) {
      throw Error(`Protocol.isAccountCriticalNow(): ${err}`);
    }
  }

  async isAccountSolventNow (superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.superToken.superTokens[superToken.toLowerCase()].methods.isAccountSolventNow(account).call();
    } catch (err) {
      throw Error(`Protocol.isAccountCriticalNow(): ${err}`);
    }
  }

  // TODO: periods
  async liquidationData (token, account) {
    try {
      this.app.client.addTotalRequest(2);
      const totalNetFlow = await this.getTotalNetFlow(token, account);
      const accountRealtimeBalanceOfNow = await this.getAccountRealtimeBalanceOfNow(token, account);

      return this._getLiquidationData(
        new BN(totalNetFlow),
        new BN(accountRealtimeBalanceOfNow.availableBalance),
        new BN(accountRealtimeBalanceOfNow.deposit),
        this.app.client.superToken.superTokens[token.toLowerCase()].liquidation_period,
        this.app.client.superToken.superTokens[token.toLowerCase()].patrician_period
      );
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.liquidationData(): ${err}`);
    }
  }

  async checkFlow (superToken, sender, receiver) {
    try {
      this.app.client.addTotalRequest();
      const result = await this.app.client.contracts.CFAv1.methods.getFlow(superToken, sender, receiver).call();
      const flowRate = new BN(result.flowRate);
      if (!flowRate.eq(new BN(0))) {
        return result;
      }
    } catch (err) {
      throw Error(`Protocol.checkFlow(): ${err}`);
    }
  }

  async getCurrentPIC (superToken) {
    try {
      if (this.app.client.contracts.toga !== undefined) {
        return await this.app.client.contracts.toga.methods.getCurrentPICInfo(superToken).call();
      }
    } catch (err) {
      throw Error(`Protocol.getCurrentPIC(): ${err}`);
    }
  }

  async getRewardAddress (superToken) {
    try {
      return await this.app.client.contracts.gov.methods.getRewardAddress(this.app.client.contracts.getSuperfluidAddress(), superToken).call();
    } catch (err) {
      throw Error(`Protocol.getRewardAddress(): ${err}`);
    }
  }

  async isPatricianPeriodNow(superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return await this.app.client.contracts.CFAv1.methods.isPatricianPeriodNow(superToken, account).call();
    } catch (err) {
      throw Error(`Protocol.isPatricianPeriodNow(): ${err}`);
    }
  }

  async calculateAndSaveTokenDelay (superToken, sendNotification = false) {
    try {

      if(this.app.config.OBSERVER) {
        this.app.logger.info("running as observer, ignoring PIC event");
        return;
      }

      const tokenInfo = this.app.client.superToken.superTokenNames[superToken.toLowerCase()];
      const currentTokenPIC = await this.getCurrentPIC(superToken);
      const rewardAccount = await this.getRewardAddress(superToken);
      const checkedSuperTokenAddress = this.app.client.toChecksumAddress(superToken);
      const token = await this.app.db.models.SuperTokenModel.findOne({ where: { address: checkedSuperTokenAddress } });
      token.pic = currentTokenPIC === undefined ? undefined : currentTokenPIC.pic;
      token.pppmode = this.app.config.PIRATE ? this.PPPMode.Pirate : this.PPPMode.Pleb;

      let msg;
      if (this.app.config.PIC === undefined) {
        msg = `${tokenInfo}: no PIC configured, default to ${this.app.config.PIRATE ? "Pirate" : "Pleb"}`;
        this.app.logger.debug(msg);
      } else if (currentTokenPIC !== undefined && this.app.config.PIC.toLowerCase() === currentTokenPIC.pic.toLowerCase()) {
        token.pppmode = this.PPPMode.Patrician;
        msg = `${tokenInfo}: you are the active PIC now`;
        this.app.logger.info(msg);
      } else if (rewardAccount.toLowerCase() === this.app.config.PIC.toLowerCase()) {
        token.pppmode = this.PPPMode.Patrician;
        msg = `${tokenInfo}: your configured PIC matches the token's reward address (no TOGA set)`;
        this.app.logger.debug(msg);
      } else {
        msg = `${tokenInfo}: you are not the PIC, default to ${this.app.config.PIRATE ? "Pirate" : "Pleb"}`;
        this.app.logger.debug(msg);
      }

      if(sendNotification) {
        this.app.notifier.sendNotification(msg);
      }

      await token.save();
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.calculateAndSaveTokenDelay(): ${err}`);
    }
  }

  generateCFAId (sender, receiver, app) {
    try {
      app = app || this.app;
      //TODO: shouldn't call web3 directly
      return app.client.soliditySha3(sender, receiver);
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.generateCFAId(): ${err}`);
    }
  }

  // generateGDAId, if GDA is not deployed, return undefined
  async generateGDAId (from, to, app) {
    try {
      app = app || this.app;
      if(app.client.contracts.getGDAv1Address() === undefined) {
        return undefined;
      }
      const chainId = await app.client.RPCClient.getChainId();
      return this.app.client.soliditySha3(chainId, "distributionFlow", from, to);
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.generateGDAId(): ${err}`);
    }
  }

  generateDeleteCFAStreamTxData(superToken, sender, receiver) {
    try {
      const isBatchContractExist = this.app.client.contracts.batch !== undefined && this.app.config.NETWORK_TYPE === "evm-l2";

      if (isBatchContractExist) {
        // on rollups, it's cheaper to always use the batch interface due to smaller calldata (which goes to L1)
        const tx = this.app.client.contracts.batch.methods.deleteFlow(superToken, {
          agreementOperation: "0", // CFA delete flow
          sender: sender,
          receiver: receiver
        }).encodeABI();
        return { tx: tx, target: this.app.client.contracts.getBatchAddress()};
      } else {
        // on L1s, use the conventional host interface
        const CFAv1Address = this.app.client.contracts.getCFAv1Address();
        const deleteFlowABI = this.app.client.contracts.CFAv1.methods.deleteFlow(superToken, sender, receiver, "0x").encodeABI();
        const tx = this.app.client.contracts.sf.methods.callAgreement(CFAv1Address, deleteFlowABI, "0x").encodeABI();
        return { tx: tx, target: this.app.client.contracts.getSuperfluidAddress()};
      }
    } catch (error) {
      this.app.logger.error(error);
      throw new Error(`Protocol.generateDeleteCFAStreamTxData(): ${error.message}`);
    }
  }

  generateDeleteGDAStreamTxData(superToken, sender, receiver) {
    try {
        const GDAv1Address = this.app.client.contracts.getGDAv1Address();
        const distributeFlowABI = this.app.client.contracts.GDAv1.methods.distributeFlow(superToken, sender, receiver, 0, "0x").encodeABI();
        const tx = this.app.client.contracts.sf.methods.callAgreement(GDAv1Address, distributeFlowABI, "0x").encodeABI();
        return { tx: tx, target: this.app.client.contracts.getSuperfluidAddress()};
    } catch (error) {
      this.app.logger.error(error);
      throw new Error(`Protocol.generateDeleteGDAStreamTxData(): ${error.message}`);
    }
  }

  generateBatchLiquidationTxDataNewBatch(superToken, liquidationParams) {
    try {
      let structParams = [];
      for(let i = 0; i < liquidationParams.length; i++) {
        structParams.push({
            agreementOperation: liquidationParams[i].source === "CFA" ? "0" : "1",
            sender: liquidationParams[i].sender,
            receiver: liquidationParams[i].receiver
        })
      }
      const tx = this.app.client.contracts.batch.methods.deleteFlows(superToken, structParams).encodeABI();
      return { tx: tx, target: this.app.client.contracts.getBatchAddress()};
    } catch (error) {
      this.app.logger.error(error);
      throw new Error(`Protocol.generateBatchLiquidationTxData(): ${error.message}`);
    }
  }
  generateBatchLiquidationTxData(superToken, senders, receivers) {
    try {
      const tx = this.app.client.contracts.batch.methods.deleteFlows(superToken, senders, receivers).encodeABI();
      return { tx: tx, target: this.app.client.contracts.getBatchAddress()};
    } catch (error) {
      this.app.logger.error(error);
      throw new Error(`Protocol.generateBatchLiquidationTxData(): ${error.message}`);
    }
  }

  _getLiquidationData (totalNetFlowRate, availableBalance, deposit, liqPeriod, plebPeriod) {

    const result = {
      totalNetFlowRate: totalNetFlowRate.toString(),
      availableBalance: availableBalance.toString(),
      totalCFADeposit: deposit.toString(),
      estimation: new Date(0),
      estimationPleb: new Date(0),
      estimationPirate: new Date(0)
    };

    if (totalNetFlowRate.lt(new BN(0))) {
      result.estimation = this._calculateDatePoint(availableBalance, totalNetFlowRate);
      const liquidation_period = new BN(liqPeriod);
      const patrician_period = new BN(plebPeriod);
      const zero = new BN(0);
      const proportional_deposit = liquidation_period.eq(zero) ? zero : patrician_period.mul(deposit).div(liquidation_period);
      result.estimationPleb = this._calculateDatePoint((availableBalance.add(proportional_deposit)), totalNetFlowRate);
      result.estimationPirate = this._calculateDatePoint(availableBalance.add(deposit), totalNetFlowRate);
    }

    return result;
  }

  _calculateDatePoint(balance, netFlowRate) {
    if(balance.lt(new BN(0))) {
      return new Date();
    }

    const seconds = isFinite(balance.div(netFlowRate)) ? balance.div(netFlowRate) : 0;
    const roundSeconds = Math.round(Math.abs(isNaN(seconds) ? 0 : seconds));
    const estimation = new Date();
    const dateFuture = new Date(estimation.setSeconds(roundSeconds));
    return (isNaN(dateFuture) ? new Date("2999-12-31") : dateFuture);
  }
}

module.exports = Protocol;
