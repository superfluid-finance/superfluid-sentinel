// The DB is split into raw data
// and information derived from it.

const Sequelize = require('sequelize')

module.exports = (dbPath) => {
  return new Sequelize({
    dialect: 'sqlite',
    logging: false,
    storage: './' + dbPath
  })
}
