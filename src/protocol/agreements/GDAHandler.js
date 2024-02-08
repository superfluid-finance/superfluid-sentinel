const BaseAgreement = require('./baseAgreement')
const BN = require('bn.js')

/**
 * Handles operations related to the Generalized Distribution Agreement (GDA) within the Superfluid protocol.
 * This class provides methods to interact with GDA-specific functionalities, such as querying net flows and handling agreement events.
 */
class GDAHandler extends BaseAgreement {
  /**
     * Get the net flow rate for a user under the GDA, if the GDA is deployed. Returns 0 if GDA is not deployed
     * @param {string} token The address of the SuperToken
     * @param {string} account The address of the user account
     * @returns {Promise<BN>} The user's net flow rate under the GDA as a BigNumber. Returns 0 if GDA is not deployed
     */
  async getUserNetFlow (token, account) {
    try {
      this.app.client.addTotalRequest()
      if (this.app.client.contracts.getGDAv1Address() === undefined) {
        return 0
      }
      // return this.app.client.contracts.GDAv1.methods.getNetFlow(token, account).call();
      const gdaUserNetFlow = await this.app.db.bizQueries.getGDAOutFlowRate(token, account)
      return gdaUserNetFlow[0].aggrDistributorFlowRate === null
        ? new BN(0)
        : (new BN(gdaUserNetFlow[0].aggrDistributorFlowRate.toString())).neg()
    } catch (err) {
      console.error(err)
      throw Error(`Protocol.getGDAUserNetFlow(): ${err}`)
    }
  }

  /**
     * Fetches past events for the GDA agreement based on given filters
     * @param {string} eventName The name of the event to query
     * @param {Object} filter An object containing the filter criteria for the event query
     * @param {Object} [app=this.app] Optionally, the application context can be explicitly provided. Defaults to the instance's app context
     * @returns {Promise<Array>} An array of event objects matching the query. Returns an empty array if GDA is not deployed
     */
  async getPastEvents (eventName, filter, app = undefined) {
    try {
      app = app || this.app
      app.client.addTotalRequest()
      // if GDA is not deployed, return empty array
      if (app.client.contracts.getGDAv1Address() === undefined) {
        return []
      }
      return app.client.contracts.GDAv1.getPastEvents(eventName, filter)
    } catch (err) {
      console.error('getGDAgreementEvents' + err)
      throw Error(`Protocol.getGDAgreementEvents(): ${err}`)
    }
  }

  /**
     * Generates a unique identifier for a GDA agreement between two accounts, if GDA is deployed
     * @param {string} sender The address of the sender in the agreement
     * @param {string} receiver The address of the receiver in the agreement
     * @param {Object} [app=this.app] Optionally, the application context can be explicitly provided. Defaults to the instance's app context
     * @returns {Promise<string|undefined>} A unique identifier for the GDA agreement. Returns undefined if GDA is not deployed
     */
  async getAgreementID (sender, receiver, app) {
    try {
      app = app || this.app
      if (app.client.contracts.getGDAv1Address() === undefined) {
        return undefined
      }
      const chainId = await app.client.RPCClient.getChainId()
      return this.app.client.soliditySha3(chainId, 'distributionFlow', sender, receiver)
    } catch (err) {
      this.app.logger.error(err)
      throw Error(`Protocol.generateGDAId(): ${err}`)
    }
  }

  /**
     * Constructs the transaction data required to delete a distribution agreement under GDA
     * @param {string} superToken The address of the SuperToken involved in the GDA
     * @param {string} sender The address of the sender in the agreement
     * @param {string} receiver The address of the receiver in the agreement
     * @returns {Object} An object containing the transaction data and the target contract address to execute the deletion
     */
  getDeleteTransaction (superToken, sender, receiver) {
    try {
      const useBatch = this.app.client.contracts.batch !== undefined && this.app.config.NETWORK_TYPE === 'evm-l2'
      if (useBatch) {
        // on rollups, it's cheaper to always use the batch interface due to smaller calldata (which goes to L1)
        const tx = this.app.client.contracts.batch.methods.deleteFlow(superToken, {
          agreementOperation: '1', // GDA delete flow
          sender,
          receiver
        }).encodeABI()
        return { tx, target: this.app.client.contracts.getBatchAddress() }
      } else {
        const GDAv1Address = this.app.client.contracts.getGDAv1Address()
        const distributeFlowABI = this.app.client.contracts.GDAv1.methods.distributeFlow(superToken, sender, receiver, 0, '0x').encodeABI()
        const tx = this.app.client.contracts.sf.methods.callAgreement(GDAv1Address, distributeFlowABI, '0x').encodeABI()
        return { tx, target: this.app.client.contracts.getSuperfluidAddress() }
      }
    } catch (error) {
      this.app.logger.error(error)
      throw new Error(`Protocol.GDAHandler.getDeleteTransaction(): ${error.message}`)
    }
  }
}

module.exports = GDAHandler
