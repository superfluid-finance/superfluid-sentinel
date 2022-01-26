const Sequelize = require("sequelize");
module.exports = (db) => { return  db.define("configuration", {
  config: {
    type: Sequelize.STRING
  }
})};
