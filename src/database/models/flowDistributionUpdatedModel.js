const Sequelize = require('sequelize')
module.exports = (db) => {
  return db.define('flowdistributionupdated', {
    agreementId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    superToken: {
      type: Sequelize.STRING,
      allowNull: false
    },
    pool: {
      type: Sequelize.STRING,
      allowNull: false
    },
    distributor: {
      type: Sequelize.STRING,
      allowNull: false
    },
    operator: {
      type: Sequelize.STRING,
      allowNull: false
    },
    oldFlowRate: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    newDistributorToPoolFlowRate: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    newTotalDistributionFlowRate: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    adjustmentFlowRate: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    blockNumber: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  })
}
