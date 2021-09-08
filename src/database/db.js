const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    logging: false,
    storage: './' + process.env.PATH_DB || "database.sqlite"
  });

module.exports = sequelize;
