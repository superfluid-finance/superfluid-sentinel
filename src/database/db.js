const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    logging: false,
    storage: './database.sqlite'
  });

module.exports = sequelize;