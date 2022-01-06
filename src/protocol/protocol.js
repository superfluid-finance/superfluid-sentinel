const BN = require("bn.js");
const SuperTokenModel = require("./../database/models/superTokenModel");

class Protocol {
  constructor (app) {
    this.app = app;
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
        new BN(arrPromise[1].availableBalance)
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
      return undefined;
    } catch (err) {
      throw Error(`Protocol.checkFlow(): ${err}`);
    }
  }

  async getCurrentPIC (superToken) {
    try {
      if (this.app.client.toga !== undefined) {
        return await this.app.client.toga.methods.getCurrentPICInfo(superToken).call();
      }
      return undefined;
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

  async calculateAndSaveTokenDelay (superToken) {
    try {
      const tokenInfo = this.app.client.superTokenNames[superToken];
      const currentTokenPIC = await this.getCurrentPIC(superToken);
      const rewardAccount = await this.getRewardAddress(superToken);
      const token = await SuperTokenModel.findOne({ where: { address: this.app.client.web3.utils.toChecksumAddress(superToken) } });
      token.pic = currentTokenPIC === undefined ? undefined : currentTokenPIC.pic;
      if (this.app.config.PIC === undefined) {
        // TOOD: When 3P is implement, change this to be in pirate mode
        token.delay = 900 + parseInt(this.app.config.ADDITIONAL_LIQUIDATION_DELAY);
        this.app.logger.debug(`${tokenInfo}: no PIC configured, adding ${token.delay}s of delay`);
      } else if (currentTokenPIC !== undefined && this.app.config.PIC.toLowerCase() === currentTokenPIC.pic.toLowerCase()) {
        token.delay = 0;
        this.app.logger.info(`${tokenInfo}: PIC active, removing delay`);
      } else if (rewardAccount.toLowerCase() === this.app.config.PIC.toLowerCase()) {
        token.delay = 0;
        this.app.logger.debug(`${tokenInfo}: configured PIC match reward address directly, removing delay`);
      } else {
        token.delay = 900 + parseInt(this.app.config.ADDITIONAL_LIQUIDATION_DELAY);
        this.app.logger.debug(`${tokenInfo}: you are not the PIC, adding ${token.delay}s of delay`);
      }

      await token.save();
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
      return this.app.client.batch.methods.deleteFlows(
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

  _getLiquidationData (totalNetFlowRate, totalBalance) {
    const result = {
      totalNetFlowRate: totalNetFlowRate.toString(),
      totalBalance: totalBalance.toString(),
      estimation: new Date(0)
    };

    if (totalNetFlowRate.lt(new BN(0))) {
      if (totalBalance.lt(new BN(0))) {
        result.estimation = new Date();
        return result;
      }

      const seconds = isFinite(totalBalance.div(totalNetFlowRate)) ? totalBalance.div(totalNetFlowRate) : 0;
      const roundSeconds = Math.round(Math.abs(isNaN(seconds) ? 0 : seconds));
      const estimation = new Date();
      const dateFuture = new Date(estimation.setSeconds(roundSeconds));
      result.estimation = (isNaN(dateFuture) ? new Date("2999-12-31") : dateFuture);
    }

    return result;
  }
}

module.exports = Protocol;
