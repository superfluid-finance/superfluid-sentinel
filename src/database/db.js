const Sequelize = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    logging: false,
    storage: './' + process.env.DB
  });

module.exports = sequelize;
