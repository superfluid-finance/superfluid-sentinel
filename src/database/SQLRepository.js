const { QueryTypes } = require("sequelize");

class SQLRepository {
  constructor (app) {
    if (!app) {
      throw new Error("SQLRepository: app is not defined");
    }
    if (SQLRepository._instance) {
      return SQLRepository._instance;
    }
    this.app = app;
    SQLRepository._instance = this;
  }

  static getInstance (app) {
    if (!this._instance) {
      this._instance = new SQLRepository(app);
    }
    return this._instance;
  }

  async executeSQLSelect (query, replacements) {
    if (!query || typeof query !== "string") {
      throw new Error("SQLRepository: query must be a string");
    }

    if (!replacements) {
      replacements = {};
    }

    if (typeof replacements !== "object") {
      throw new Error("SQLRepository: replacements must be an object");
    }

    return this.app.db.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });
  }
}
SQLRepository._instance = null;

module.exports = SQLRepository;
