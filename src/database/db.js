// The DB is split into raw data
// and information derived from it.

const Sequelize = require("sequelize");

module.exports = (db_path) => {
  return new Sequelize({
    dialect: "sqlite",
    logging: false,
    storage: "./" + db_path
  });
};
