const Sequelize = require("sequelize");
module.exports = (db) => { return db.define("poolcreated", {
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
  admin: {
    type: Sequelize.STRING,
    allowNull: false
  },
  pool: {
    type: Sequelize.STRING,
    allowNull: false
  }
})};

