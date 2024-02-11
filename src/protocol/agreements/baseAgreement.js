/**
 * BaseAgreement serves as a foundational class for handling Superfluid agreements.
 * It provides common functionalities that are shared across different types of agreements,
 * such as utility methods and shared properties.
 */
class BaseAgreement {
  /**
     * Constructs a new BaseAgreement instance.
     * @param {Object} app The main application context, providing access to shared resources and utilities.
     */
  constructor (app) {
    if (!app) throw new Error("BaseAgreement: app is not defined");
    this.app = app;
  }

  /**
     * A utility method for adding a request to the total request count. This is an example of a common
     * functionality that might be used across different agreement handlers.
     */
  addTotalRequest () {
    this.app.client.addTotalRequest();
  }

  /**
     * Template method for getting the net flow of an account. Specific agreement classes should override this method.
     * @param {string} token The address of the token.
     * @param {string} account The address of the account.
     */
  async getNetFlow (token, account) {
    throw new Error("getNetFlow method should be implemented by subclasses");
  }

  /**
     * Template method for getting agreement-specific events. Specific agreement classes should override this method.
     * @param {string} eventName The name of the event to fetch.
     * @param {Object} filter An object containing filter criteria.
     */
  async getPastEvents (eventName, filter) {
    throw new Error("getAgreementEvents method should be implemented by subclasses");
  }
}

module.exports = BaseAgreement;
