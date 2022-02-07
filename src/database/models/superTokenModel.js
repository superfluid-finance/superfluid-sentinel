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
  delay: {
    type: Sequelize.INTEGER,
    defaultValue: 900
  },
  listed: {
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
})};
