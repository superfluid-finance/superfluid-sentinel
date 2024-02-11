const BaseAgreement = require("./baseAgreement");

/**
 * Handles operations related to the Instant Distribution Agreement.
 */
class IDAHandler extends BaseAgreement {
  // eslint-disable-next-line no-useless-constructor
  constructor (app) {
    super(app);
  }
}

module.exports = IDAHandler;
