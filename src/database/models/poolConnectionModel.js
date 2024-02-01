const Sequelize = require("sequelize");
module.exports = (db) => { return db.define("poolconnections", {
        address: {
            type: Sequelize.STRING,
            primaryKey: true
        },
        account: {
            type: Sequelize.STRING,
            primaryKey: true
        },
        blockNumber: {
            type: Sequelize.INTEGER,
            allowNull: false
        },

    }
)};
