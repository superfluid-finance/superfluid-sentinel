const Sequelize = require('sequelize');
const db = require('../db');

const AccountEstimationModel = db.define("estimations", {
    address: {
        type: Sequelize.STRING,
        primaryKey: true
    },
    superToken: {
        type: Sequelize.STRING,
        primaryKey: true
    },

    totalNetFlowRate: {
        type: Sequelize.STRING,
    },
    totalBalance: {
        type: Sequelize.STRING,
    },
    zestimation: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    zestimationHuman: {
        type: Sequelize.DATE,
        allowNull: false,
    },
    zlastChecked: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    found: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
    },
    recalculate: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    now: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    }
});

module.exports = AccountEstimationModel;
