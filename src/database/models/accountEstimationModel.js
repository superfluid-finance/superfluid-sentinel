const Sequelize = require("sequelize");
const db = require("../db");

const AccountEstimationModel = db.define("estimations", {
  address: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  superToken: {
    type: Sequelize.STRING,
    primaryKey: true
  },

  totalNetFlowRate: {
    type: Sequelize.STRING
  },
  totalBalance: {
    type: Sequelize.STRING
  },
  zestimation: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  zestimationHuman: {
    type: Sequelize.DATE,
    allowNull: false
  },
  blockNumber: {
    type: Sequelize.INTEGER
  }
});

module.exports = AccountEstimationModel;
