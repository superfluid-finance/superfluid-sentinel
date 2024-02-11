const Sequelize = require("sequelize");
module.exports = (db) => {
  return db.define("agreements", {
    agreementId: {
      type: Sequelize.STRING,
      primaryKey: true
    },
    superToken: {
      type: Sequelize.STRING,
      primaryKey: true
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
    blockNumber: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    source: {
      type: Sequelize.STRING,
      allowNull: false
    }
  }, {
    indexes: [{
      unique: false,
      fields: ["superToken", "sender"]
    }]
  }
  );
};
