const Sequelize = require('sequelize')
module.exports = (db) => {
  return db.define('flowupdated', {
    hashId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    address: {
      type: Sequelize.STRING,
      allowNull: false
    },
    blockNumber: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    superToken: {
      type: Sequelize.STRING,
      allowNull: false
    },
    sender: {
      type: Sequelize.STRING,
      allowNull: false
    },
    receiver: {
      type: Sequelize.STRING,
      allowNull: false
    },
    flowRate: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    agreementId: {
      type: Sequelize.STRING,
      allowNull: false
    }
  })
}
