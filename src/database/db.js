const Sequelize = require('sequelize');

const DB = (process.env.PATH_DB !== undefined && process.env.PATH_DB !== "") ? process.env.PATH_DB : "./datadir/db.sqlite";

const sequelize = new Sequelize({
    dialect: 'sqlite',
    logging: false,
    storage: './' + DB
  });

module.exports = sequelize;
