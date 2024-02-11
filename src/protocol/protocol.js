const BN = require("bn.js");
const CFAHandler = require("./agreements/CFAHandler");
const GDAHandler = require("./agreements/GDAHandler");
const IDAHandler = require("./agreements/IDAHandler");

/**
 * The Protocol class serves as a central point for managing interactions with the Superfluid protocol,
 * including querying account balances, flow rates, and handling liquidation data calculations
 * It utilizes specific handler classes for each type of Superfluid agreement (CFA, GDA, IDA)
 */
class Protocol {
  /**
   * Initializes the Protocol class with necessary handlers for Superfluid agreements and sets the PPP modes
   * @param {Object} app - The main application context providing access to the blockchain client, database, and utility functions
   */
  constructor (app) {
    this.app = app;
    this.cfaHandler = new CFAHandler(app);
    this.gdaHandler = new GDAHandler(app);
    this.idaHandler = new IDAHandler(app);
    this.PPPMode = {
      Patrician: 0,
      Pleb: 1,
      Pirate: 2
    };
  }

  /**
   * Retrieves the current realtime balance of an account for a given SuperToken
   * @param {string} token - The SuperToken address
   * @param {string} address - The account address
   * @returns {Promise<Object>} - The realtime balance of the account
   */
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

  /**
   * Calculates the total net flow for an account combining flows sender CFA and GDA
   * @param {string} superToken - The SuperToken address
   * @param {string} account - The account address
   * @returns {Promise<string>} - The total net flow as a string
   */
  async getTotalNetFlow (superToken, account) {
    const cfaNetFlow = await this.cfaHandler.getUserNetFlow(superToken, account);
    const gdaNetFlow = await this.gdaHandler.getUserNetFlow(superToken, account);
    const totalNetFlow = new BN(cfaNetFlow).add(new BN(gdaNetFlow));
    return totalNetFlow.toString();
  }

  /**
   * Checks if an account is in a critical state now for a given SuperToken
   * @param {string} superToken - The SuperToken address
   * @param {string} account - The account address
   * @returns {Promise<boolean>} - True if the account is critical, otherwise false
   */
  async isAccountCriticalNow (superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.superToken.superTokens[superToken.toLowerCase()].methods.isAccountCriticalNow(account).call();
    } catch (err) {
      throw Error(`Protocol.isAccountCriticalNow(): ${err}`);
    }
  }

  /**
   * Checks if an account is solvent now for a given SuperToken
   * @param {string} superToken - The SuperToken address
   * @param {string} account - The account address
   * @returns {Promise<boolean>} - True if the account is solvent, otherwise false
   */
  async isAccountSolventNow (superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.superToken.superTokens[superToken.toLowerCase()].methods.isAccountSolventNow(account).call();
    } catch (err) {
      throw Error(`Protocol.isAccountCriticalNow(): ${err}`);
    }
  }

  async isPossibleToClose (superToken, sender, receiver, pppmode) {
    try {
      const checkFlow = await this.cfaHandler.checkFlow(superToken, sender, receiver);
      const isCritical = await this.isAccountCriticalNow(superToken, sender);
      if (pppmode === this.PPPMode.Patrician) {
        return checkFlow !== undefined && isCritical;
      } else if (pppmode === this.PPPMode.Pleb) {
        const isPatrician = await this.isPatricianPeriodNow(superToken, sender);
        return checkFlow !== undefined && isCritical && !isPatrician.isPatricianPeriod;
      } else {
        const isSolvent = await this.isAccountSolventNow(superToken, sender);
        return checkFlow !== undefined && isCritical && !isSolvent;
      }
    } catch (err) {
      this.app.logger.error(`Protocol.isPossibleToClose() - ${err}`);
      return false;
    }
  }

  /**
   * Calculates liquidation data for an account for a given SuperToken
   * @param {string} superToken - The SuperToken address
   * @param {string} account - The account address
   * @returns {Promise<Object>} - Liquidation data including various estimation points
   */
  async liquidationData (superToken, account) {
    try {
      this.app.client.addTotalRequest(2);
      const totalNetFlow = await this.getTotalNetFlow(superToken, account);
      const accountRealtimeBalanceOfNow = await this.getAccountRealtimeBalanceOfNow(superToken, account);

      return this._getLiquidationData(
        new BN(totalNetFlow),
        new BN(accountRealtimeBalanceOfNow.availableBalance),
        new BN(accountRealtimeBalanceOfNow.deposit),
        this.app.client.superToken.superTokens[superToken.toLowerCase()].liquidation_period,
        this.app.client.superToken.superTokens[superToken.toLowerCase()].patrician_period
      );
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.liquidationData(): ${err}`);
    }
  }

  /**
   * Retrieves the current PIC for a given SuperToken
   * @param {string} superToken - The SuperToken address
   * @returns {Promise<string>} - The address of the current PIC or an empty string if TOGA is not defined or the PIC is not set
   */
  async getCurrentPIC (superToken) {
    try {
      if (this.app.client.contracts.toga !== undefined) {
        return await this.app.client.contracts.toga.methods.getCurrentPICInfo(superToken).call();
      }
    } catch (err) {
      throw Error(`Protocol.getCurrentPIC(): ${err}`);
    }
  }

  /**
   * Retrieves the reward address associated with a given SuperToken
   * @param {string} superToken - The SuperToken address
   * @returns {Promise<string>} - The reward address for the given SuperToken
   */
  async getRewardAddress (superToken) {
    try {
      return await this.app.client.contracts.gov.methods.getRewardAddress(this.app.client.contracts.getSuperfluidAddress(), superToken).call();
    } catch (err) {
      throw Error(`Protocol.getRewardAddress(): ${err}`);
    }
  }

  /**
   * Checks if the Patrician period is currently active for a given account and SuperToken
   * @param {string} superToken - The SuperToken address
   * @param {string} account - The account address
   * @returns {Promise<boolean>} - True if the Patrician period is active
   */
  async isPatricianPeriodNow (superToken, account) {
    try {
      this.app.client.addTotalRequest();
      return await this.app.client.contracts.CFAv1.methods.isPatricianPeriodNow(superToken, account).call();
    } catch (err) {
      throw Error(`Protocol.isPatricianPeriodNow(): ${err}`);
    }
  }

  getBatchDeleteTransaction (superToken, liquidationParams) {
    try {
      const structParams = [];
      for (let i = 0; i < liquidationParams.length; i++) {
        structParams.push({
          agreementOperation: liquidationParams[i].source === "CFA" ? "0" : "1",
          sender: liquidationParams[i].sender,
          receiver: liquidationParams[i].receiver
        });
      }
      const tx = this.app.client.contracts.batch.methods.deleteFlows(superToken, structParams).encodeABI();
      return { tx, target: this.app.client.contracts.getBatchAddress() };
    } catch (error) {
      this.app.logger.error(error);
      throw new Error(`Protocol.generateBatchLiquidationTxData(): ${error.message}`);
    }
  }

  generateBatchLiquidationTxData (superToken, senders, receivers) {
    try {
      const tx = this.app.client.contracts.batch.methods.deleteFlows(superToken, senders, receivers).encodeABI();
      return { tx, target: this.app.client.contracts.getBatchAddress() };
    } catch (error) {
      this.app.logger.error(error);
      throw new Error(`Protocol.generateBatchLiquidationTxData(): ${error.message}`);
    }
  }

  /**
   * Calculates and saves the delay for liquidation based on the current PIC and PPP mode
   * @param {string} superToken - The SuperToken address
   * @param {boolean} sendNotification - Whether to send a notification about the token delay calculation
   */
  async calculateAndSaveTokenDelay (superToken, sendNotification = false) {
    try {
      if (this.app.config.OBSERVER) {
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

      if (sendNotification) {
        this.app.notifier.sendNotification(msg);
      }

      await token.save();
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.calculateAndSaveTokenDelay(): ${err}`);
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
      result.estimation = this._calculateEstimationPoint(availableBalance, totalNetFlowRate);
      const liquidationPeriod = new BN(liqPeriod);
      const patricianPeriod = new BN(plebPeriod);
      const zero = new BN(0);
      const proportionalDeposit = liquidationPeriod.eq(zero) ? zero : patricianPeriod.mul(deposit).div(liquidationPeriod);
      result.estimationPleb = this._calculateEstimationPoint((availableBalance.add(proportionalDeposit)), totalNetFlowRate);
      result.estimationPirate = this._calculateEstimationPoint(availableBalance.add(deposit), totalNetFlowRate);
    }

    return result;
  }

  _calculateEstimationPoint (balance, netFlowRate) {
    if (balance.lt(new BN(0))) {
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
