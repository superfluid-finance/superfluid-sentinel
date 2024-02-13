const BaseAgreement = require("./baseAgreement");

/**
 * Handles operations related to the Instant Distribution Agreement.
 */
class CFAHandler extends BaseAgreement {
  /**
     * Get the net flow rate for a user under the CFA
     * @param {string} token The address of the SuperToken
     * @param {string} account The address of the user account
     * @returns {Promise<BN>} The user's net flow rate under the GDA as a BigNumber. Returns 0 if GDA is not deployed
     */
  async getUserNetFlow (token, account) {
    try {
      this.app.client.addTotalRequest();
      return this.app.client.contracts.CFAv1.methods.getNetFlow(token, account).call();
    } catch (err) {
      console.error(err);
      throw Error(`Protocol.CFAHandler.getUserNetFlow(): ${err}`);
    }
  }

  /**
     * Fetches past events for the CFA agreement based on given filters.
     * @param {string} eventName The name of the event to query.
     * @param {Object} filter An object containing the filter criteria for the event query.
     * @param {Object} [app=this.app] Optionally, the application context can be explicitly provided. Defaults to the instance's app context.
     * @returns {Promise<Array>} An array of event objects matching the query. Returns an empty array if GDA is not deployed.
     */
  async getPastEvents (eventName, filter, app = undefined) {
    try {
      app = app || this.app;
      app.client.addTotalRequest();
      return app.client.contracts.CFAv1.getPastEvents(eventName, filter);
    } catch (err) {
      console.error("getCFAAgreementEvents " + err);
      throw Error(`Protocol.CFAHandler.getPastEvents(): ${err}`);
    }
  }

  /**
     * Generates a unique identifier for a CFA agreement between two accounts, if CFA is deployed
     * @param {string} sender The address of the sender in the agreement
     * @param {string} receiver The address of the receiver in the agreement
     * @param {Object} [app=this.app] Optionally, the application context can be explicitly provided. Defaults to the instance's app context
     * @returns {string} A unique identifier for the CFA agreement
     */
  getAgreementID (sender, receiver, app) {
    try {
      app = app || this.app;
      return app.client.soliditySha3(sender, receiver);
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Protocol.CFAHandler.getAgreementID(): ${err}`);
    }
  }

  /**
     * Checks the flow of tokens between two accounts under the Constant Flow Agreement (CFA) for a given SuperToken
     * @param {string} superToken The address of the SuperToken for which the flow is being checked
     * @param {string} sender The address of the account sending the SuperToken
     * @param {string} receiver The address of the account receiving the SuperToken
     * @returns {Promise<Object|undefined>} A promise that resolves to the flow details object if an active flow exists
     */
  async checkFlow (superToken, sender, receiver) {
    try {
      this.app.client.addTotalRequest(); // Tracks the request for analytics or rate limiting purposes.
      const result = await this.app.client.contracts.CFAv1.methods.getFlow(superToken, sender, receiver).call();
      if (result.flowRate !== "0") {
        return result; // Return the flow details if there's an active flow.
      }
    } catch (err) {
      throw Error(`Protocol.checkFlow(): ${err}`); // Rethrows any encountered error with additional context.
    }
  }

  /**
     * Constructs the transaction data required to delete a constant agreement under CFA
     * @param {string} superToken The address of the SuperToken involved in the CFA
     * @param {string} sender The address of the sender in the agreement
     * @param {string} receiver The address of the receiver in the agreement
     * @returns {Object} An object containing the transaction data and the target contract address to execute the deletion
     */
  getDeleteTransaction (superToken, sender, receiver) {
    try {
      const useBatch = this.app.client.contracts.batch !== undefined && this.app.config.NETWORK_TYPE === "evm-l2";
      if (useBatch) {
        // on rollups, it's cheaper to always use the batch interface due to smaller calldata (which goes to L1)
        const tx = this.app.client.contracts.batch.methods.deleteFlow(superToken, {
          agreementOperation: "0", // CFA delete flow
          sender,
          receiver
        }).encodeABI();
        return { tx, target: this.app.client.contracts.getBatchAddress() };
      } else {
        // on L1s, use the conventional host interface
        const CFAv1Address = this.app.client.contracts.getCFAv1Address();
        const deleteFlowABI = this.app.client.contracts.CFAv1.methods.deleteFlow(superToken, sender, receiver, "0x").encodeABI();
        const tx = this.app.client.contracts.sf.methods.callAgreement(CFAv1Address, deleteFlowABI, "0x").encodeABI();
        return { tx, target: this.app.client.contracts.getSuperfluidAddress() };
      }
    } catch (error) {
      this.app.logger.error(error);
      throw new Error(`Protocol.CFAHandler.getDeleteTransaction(): ${error.message}`);
    }
  }
}

module.exports = CFAHandler;
