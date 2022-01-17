const Sequelize = require("sequelize");
module.exports = (db) => { return  db.define("system", {
  blockNumber: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  chainId: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  superTokenBlockNumber: {
    type: Sequelize.INTEGER
  }
})};

