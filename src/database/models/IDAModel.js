const Sequelize = require("sequelize");
module.exports = (db) => { return db.define("idaevents", {
  eventName: {
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
  publisher: {
    type: Sequelize.STRING,
    allowNull: false
  },
  subscriber: {
    type: Sequelize.STRING,
    allowNull: true
  },
  indexId: {
    type: Sequelize.STRING,
    allowNull: false
  }
})};
