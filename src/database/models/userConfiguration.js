const Sequelize = require("sequelize");
const db = require("../db");

const UserConfig = db.define("configuration", {
  config: {
    type: Sequelize.STRING
  }
});

module.exports = UserConfig;
