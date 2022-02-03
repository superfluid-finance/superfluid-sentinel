const Sequelize = require("sequelize");
module.exports = (db) => { return db.define("estimations", {
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
  availableBalance: {
    type: Sequelize.STRING
  },
  totalCFADeposit: {
    type: Sequelize.STRING
  },
  estimation: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  estimationPleb: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  estimationPirate: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  estimationHuman: {
    type: Sequelize.DATE,
    allowNull: false
  },
  estimationHumanPirate: {
    type: Sequelize.DATE,
    allowNull: false
  },
  blockNumber: {
    type: Sequelize.INTEGER
  }
})};
