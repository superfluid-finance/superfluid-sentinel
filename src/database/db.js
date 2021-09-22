const Sequelize = require('sequelize');

const DB = (process.env.DB_PATH !== undefined && process.env.DB_PATH !== "") ? process.env.DB_PATH : "./db.sqlite";

const sequelize = new Sequelize({
    dialect: 'sqlite',
    logging: false,
    storage: './' + DB
  });

module.exports = sequelize;
