const {
    QueryTypes,
} = require("sequelize");
const SQLRepository = require("./SQLRepository");

class SystemRepository {
    constructor(app) {
        if(!app) {
            throw new Error("SystemRepository: app is not defined");
        }
        if (SystemRepository._instance) {
            return SystemRepository._instance;
        }

        this.app = app;
        if(!this.app.db.SQLRepository) {
            this.app.db.SQLRepository = SQLRepository.getInstance(app);
        }
        SystemRepository._instance = this;
    }

    static getInstance(app) {
        if (!SystemRepository._instance) {
            SystemRepository._instance = new SystemRepository(app);
        }
        return SystemRepository._instance;
    }

    async healthCheck() {
        return this.app.db.query("SELECT 1", {
            type: QueryTypes.SELECT
        });
    }

    async updateBlockNumber(newBlockNumber) {
        const systemInfo = await this.app.db.models.SystemModel.findOne();
        if (systemInfo !== null && systemInfo.blockNumber < newBlockNumber) {
            systemInfo.blockNumber = Number(newBlockNumber);
            systemInfo.superTokenBlockNumber = Number(newBlockNumber);
        }
        return systemInfo.save();
    }

    async getConfiguration() {
        return this.app.db.models.UserConfig.findOne();
    }

    async saveConfiguration(configString) {
        const fromDB = await this.app.db.models.UserConfig.findOne();
        if (fromDB !== null) {
            fromDB.config = configString;
            return fromDB.save();
        }
        return this.app.db.models.UserConfig.create({config: configString});
    }


    async updateThresholds(thresholds) {
        await this.app.db.models.ThresholdModel.destroy({truncate: true});
        // check if thresholds is empty object
        if(Object.keys(thresholds).length === 0) {
            // create table without table data
            return this.app.db.models.ThresholdModel.sync();
        } else {
            // from json data save it to table
            for (const threshold of thresholds) {
                await this.app.db.models.ThresholdModel.create(threshold);
            }
        }
    }

    async getUserSchemaVersion() {
        return this.app.db.query("PRAGMA user_version;", {
            type: QueryTypes.SELECT
        });
    }

    async setUserSchemaVersion(schemaVersion){
        return this.app.db.query(`PRAGMA user_version = ${schemaVersion};`, {
            type: QueryTypes.SELECT
        });
    }
}
SystemRepository._instance = null;

module.exports = SystemRepository;
