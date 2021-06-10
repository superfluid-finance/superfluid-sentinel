const Sequelize = require('sequelize');
const db = require('../db');

const FlowUpdatedModel = db.define("evt_flowupdated", {
    address: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    blockNumber: {
        type: Sequelize.INTERGER,
        allowNull: false,
    },
    superToken: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    sender: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    receiver: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    flowRate: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    totalSenderFlowRate: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    totalReceiverFlowRate: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
});

module.exports = FlowUpdatedModel;
