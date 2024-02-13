const Sequelize = require("sequelize");
module.exports = (db) => {
  return db.define("thresholds", {
    address: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true
    },
    above: {
      type: Sequelize.INTEGER,
      defaultValue: 0
    }
  });
};
