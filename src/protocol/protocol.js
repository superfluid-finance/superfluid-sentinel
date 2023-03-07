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
      return this.app.client.superTokens[token.toLowerCase()].methods.realtimeBalanceOfNow(
        address
      ).call();
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.getAccountRealtimeBalanceOfNow(): (${token}): ${err}`);
    }
  }

  async getUserNetFlow (token, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.CFAv1.methods.getNetFlow(token, account).call();
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.getUserNetFlow(): ${err}`);
    }
  }

  async getAgreementEvents (eventName, filter) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.CFAv1.getPastEvents(eventName, filter);
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.getAgreementEvents(): ${err}`);
    }
  }

  async isAccountCriticalNow (superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.superTokens[superToken.toLowerCase()].methods.isAccountCriticalNow(account).call();
    } catch (err) {
      throw Error(`Protocol.isAccountCriticalNow(): ${err}`);
    }
  }

  async isAccountSolventNow (superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.superTokens[superToken.toLowerCase()].methods.isAccountSolventNow(account).call();
    } catch (err) {
      throw Error(`Protocol.isAccountCriticalNow(): ${err}`);
    }
  }

  async liquidationData (token, account) {
    try {
      this.app.client.addTotalRequest(2);
      let arrPromise = [
        this.getUserNetFlow(token, account),
        this.getAccountRealtimeBalanceOfNow(token, account)
      ];
      arrPromise = await Promise.all(arrPromise);
      return this._getLiquidationData(
        new BN(arrPromise[0]),
        new BN(arrPromise[1].availableBalance),
        new BN(arrPromise[1].deposit),
          this.app.client.superTokens[token.toLowerCase()].liquidation_period,
          this.app.client.superTokens[token.toLowerCase()].patrician_period
      );
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.liquidationData(): ${err}`);
    }
  }

  async checkFlow (superToken, sender, receiver) {
    try {
      this.app.client.addTotalRequest();
      const result = await this.app.client.CFAv1.methods.getFlow(superToken, sender, receiver).call();
      if (result.flowRate !== "0") {
        return result;
      }
    } catch (err) {
      throw Error(`Protocol.checkFlow(): ${err}`);
    }
  }

  async getCurrentPIC (superToken) {
    try {
      if (this.app.client.toga !== undefined) {
        return await this.app.client.toga.methods.getCurrentPICInfo(superToken).call();
      }
    } catch (err) {
      throw Error(`Protocol.getCurrentPIC(): ${err}`);
    }
  }

  async getRewardAddress (superToken) {
    try {
      return await this.app.client.gov.methods.getRewardAddress(this.app.client.sf._address, superToken).call();
    } catch (err) {
      throw Error(`Protocol.getRewardAddress(): ${err}`);
    }
  }

  async isPatricianPeriodNow(superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return await this.app.client.CFAv1.methods.isPatricianPeriodNow(superToken, account).call();
    } catch (err) {
      throw Error(`Protocol.isPatricianPeriodNow(): ${err}`);
    }
  }

  async calculateAndSaveTokenDelay (superToken) {
    try {
      if(!this.app.config.OBSERVER) {
        const tokenInfo = this.app.client.superTokenNames[superToken.toLowerCase()];
        const currentTokenPIC = await this.getCurrentPIC(superToken);
        const rewardAccount = await this.getRewardAddress(superToken);
        const token = await this.app.db.models.SuperTokenModel.findOne({ where: { address: this.app.client.web3.utils.toChecksumAddress(superToken) } });
        token.pic = currentTokenPIC === undefined ? undefined : currentTokenPIC.pic;
        token.pppmode = this.app.config.PIRATE ? this.PPPMode.Pirate : this.PPPMode.Pleb;

        if (this.app.config.PIC === undefined) {
          this.app.logger.debug(`${tokenInfo}: no PIC configured, default to ${this.app.config.PIRATE ? "Pirate" : "Pleb"}`);
        } else if (currentTokenPIC !== undefined && this.app.config.PIC.toLowerCase() === currentTokenPIC.pic.toLowerCase()) {
          token.pppmode = this.PPPMode.Patrician;
          this.app.logger.info(`${tokenInfo}: PIC active`);
        } else if (rewardAccount.toLowerCase() === this.app.config.PIC.toLowerCase()) {
          token.pppmode = this.PPPMode.Patrician;
          this.app.logger.debug(`${tokenInfo}: configured PIC match reward address directly, set as PIC`);
        } else {
          this.app.logger.debug(`${tokenInfo}: you are not the PIC, default to ${this.app.config.PIRATE ? "Pirate" : "Pleb"}`);
        }
        await token.save();
      } else {
        this.app.logger.info("running as observer, ignoring PIC event");
      }

    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.calculateAndSaveTokenDelay(): ${err}`);
    }
  }

  generateId (sender, receiver) {
    try {
      return this.app.client.web3.utils.soliditySha3(sender, receiver);
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.generateId(): ${err}`);
    }
  }

  generateDeleteFlowABI (superToken, sender, receiver) {
    try {
      return this.app.client.sf.methods.callAgreement(
        this.app.client.CFAv1._address,
        this.app.client.CFAv1.methods.deleteFlow(
          superToken,
          sender,
          receiver,
          "0x").encodeABI(),
        "0x"
      ).encodeABI();
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.generateDeleteFlowABI() : ${err}`);
    }
  }

  generateMultiDeleteFlowABI (superToken, senders, receivers) {
    try {
      return
        this.app.config.BATCHV2_CONTRACT !== undefined ?
        this.app.client.batch.methods.deleteFlows( // batch v2
          superToken,
          senders,
          receivers
        ).encodeABI() :
        this.app.client.batch.methods.deleteFlows( // batch v1
          this.app.client.sf._address,
          this.app.client.CFAv1._address,
          superToken,
          senders,
          receivers
        ).encodeABI();
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.generateMultiDeleteFlowABI() : ${err}`);
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
      const propDeposit = patrician_period.mul(deposit).div(liquidation_period);
      result.estimationPleb = this._calculateDatePoint((availableBalance.add(propDeposit)), totalNetFlowRate);
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
