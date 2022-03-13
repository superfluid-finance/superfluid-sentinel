const Sequelize = require("sequelize");
module.exports = (db) => { return  db.define("supertokens", {
  address: {
    type: Sequelize.STRING,
    allowNull: false,
    primaryKey: true
  },
  symbol: {
    type: Sequelize.STRING,
    allowNull: false
  },
  name: {
    type: Sequelize.STRING,
    allowNull: false
  },
  pic: {
    type: Sequelize.STRING
  },
  pppmode:{
    type: Sequelize.INTEGER,
    defaultValue: 1
  },
  liquidationPeriod: {
    type: Sequelize.INTEGER,
    defaultValue: 0
  },
  patricianPeriod: {
    type: Sequelize.INTEGER,
    defaultValue: 0
  },
  listed: {
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
})};
