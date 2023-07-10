const {
    QueryTypes,
    Op
} = require("sequelize");

class Repository {
    constructor(app) {
        this.app = app;
    }

    async getAccounts(fromBlock = 0) {
        const sqlquery = `SELECT DISTINCT superToken, account FROM (
      SELECT * FROM (
          SELECT  superToken, sender as account, flowRate from flowupdateds
          WHERE blockNumber > :bn
          GROUP BY hashId
          HAVING MAX(blockNumber)
          order by blockNumber desc , superToken, hashId
      ) AS P
      WHERE P.flowRate <> 0
      UNION ALL
      SELECT * FROM (
          SELECT  superToken, receiver as account, flowRate from flowupdateds
          WHERE blockNumber > :bn
          GROUP BY hashId
          HAVING MAX(blockNumber)
          order by blockNumber desc , superToken, hashId
      ) AS O
      WHERE O.flowRate <> 0
      UNION ALL
      SELECT * FROM (
          SELECT  superToken, distributor as account, newDistributorToPoolFlowRate as flowRate from flowdistributionupdateds
          where blockNumber > :bn
          GROUP BY agreementId
          HAVING MAX(blockNumber)
          order by blockNumber desc , superToken, agreementId
      ) AS Y
      WHERE Y.flowRate <> 0
      ) AS Z
      ORDER BY superToken`;

        return this.app.db.query(sqlquery, {
            replacements: {bn: fromBlock},
            type: QueryTypes.SELECT
        });
    }

    async getLastCFAFlows(fromBlock = 0) {
        const sqlquery = `SELECT * FROM (
    SELECT  agreementId, superToken, sender, receiver, flowRate, "CFA" as source from flowupdateds
    WHERE blockNumber > :bn
    GROUP BY hashId
    HAVING MAX(blockNumber)
    order by blockNumber desc , superToken, hashId
    ) AS P
    WHERE P.flowRate <> 0`;
        return this.app.db.query(sqlquery, {
            replacements: {bn: fromBlock},
            type: QueryTypes.SELECT
        });
    }

    async getLastGDAFlows(fromBlock = 0) {
        const sqlquery = `SELECT * FROM (
    SELECT  agreementId, superToken, distributor as sender, pool as receiver, newDistributorToPoolFlowRate as flowRate, "GDA" as source from flowdistributionupdateds
    WHERE blockNumber > :bn
    GROUP BY agreementId
    HAVING MAX(blockNumber)
    order by blockNumber desc , superToken, agreementId
    ) AS P
    WHERE P.flowRate <> 0`;
        return this.app.db.query(sqlquery, {
            replacements: {bn: fromBlock},
            type: QueryTypes.SELECT
        });
    }

    async getAddressEstimations(address) {
        return this.app.db.models.AccountEstimationModel.findAll({
            attributes: ["address", "superToken", "estimation"],
            where:
                {
                    address: address
                }
        });
    }

    async getEstimations() {
        return this.app.db.models.AccountEstimationModel.findAll({
            attributes: ["address", "superToken", "estimation"],
            where: {estimation: {[Op.gt]: 0}}
        });
    }

    // liquidations where flowRate is above a certain threshold
    async getLiquidations(checkDate, onlyTokens, excludeTokens, limitRows, useThresholds = true) {
        let inSnipped = "";
        let inSnippedLimit = "";

        // if configured onlyTokens we don't filter by excludeTokens
        const tokenFilter = onlyTokens !== undefined ? onlyTokens : excludeTokens;
        if (tokenFilter !== undefined) {
            inSnipped = `and out.superToken ${ onlyTokens !== undefined ? "in" : "not in" } (:tokens)`;
        }
        if (limitRows !== undefined && limitRows > 0 && limitRows < 101) {
            inSnippedLimit = `LIMIT ${limitRows}`;
        }

        const joinThresholds = useThresholds ? 'LEFT JOIN thresholds thr on agr.superToken = thr.address' : '';
        const flowRateCondition = useThresholds ? 'out.flowRate >= COALESCE(out.above, 0)' : 'out.flowRate > 0';

        const sqlquery = `SELECT * FROM (SELECT agr.superToken, agr.sender, agr.receiver,
CASE pppmode
WHEN 0 THEN est.estimation
WHEN 1 THEN est.estimationPleb
WHEN 2 THEN est.estimationPirate
END as estimation,
pppmode,
flowRate,
source,
${useThresholds ? 'COALESCE(thr.above, 0) as above' : '0 as above'}
FROM agreements agr
INNER JOIN supertokens st on agr.superToken == st.address
INNER JOIN estimations est ON agr.sender = est.address AND agr.superToken = est.superToken AND est.estimation <> 0
${joinThresholds}
) AS out
WHERE ${flowRateCondition} AND out.estimation <= :dt ${inSnipped}
ORDER BY out.estimation ASC ${inSnippedLimit}`;

        if (inSnipped !== "") {
            return this.app.db.query(sqlquery, {
                replacements: {
                    dt: checkDate,
                    tokens: tokenFilter
                },
                type: QueryTypes.SELECT
            });
        }

        return this.app.db.query(sqlquery, {
            replacements: {dt: checkDate},
            type: QueryTypes.SELECT
        });
    }

    async getNumberOfBatchCalls(checkDate, onlyTokens, excludeTokens, useThresholds = true) {
        let inSnipped = "";
        // if configured onlyTokens we don't filter by excludeTokens
        const tokenFilter = onlyTokens !== undefined ? onlyTokens : excludeTokens;
        if (tokenFilter !== undefined) {
            inSnipped = `and out.superToken ${ onlyTokens !== undefined ? "in" : "not in" } (:tokens)`;
        }

        const joinThresholds = useThresholds ? 'LEFT JOIN thresholds thr on agr.superToken = thr.address' : '';
        const flowRateCondition = useThresholds ? 'out.flowRate >= COALESCE(out.above, 0)' : 'out.flowRate > 0';

        const sqlquery = `SELECT superToken, count(*) as numberTxs  FROM (SELECT agr.superToken, agr.sender, agr.receiver,
CASE pppmode
WHEN 0 THEN est.estimation
WHEN 1 THEN est.estimationPleb
WHEN 2 THEN est.estimationPirate
END as estimation,
pppmode,
flowRate,
${useThresholds ? 'COALESCE(thr.above, 0) as above' : '0 as above'}
FROM agreements agr
INNER JOIN supertokens st on agr.superToken == st.address
INNER JOIN estimations est ON agr.sender = est.address AND agr.superToken = est.superToken AND est.estimation <> 0
${joinThresholds}
) AS out
WHERE ${flowRateCondition} AND out.estimation <= :dt ${inSnipped}
group by out.superToken
having count(*) > 1
order by count(*) desc`;

        if (inSnipped !== "") {
            return this.app.db.query(sqlquery, {
                replacements: {
                    dt: checkDate,
                    tokens: tokenFilter
                },
                type: QueryTypes.SELECT
            });
        }
        return this.app.db.query(sqlquery, {
            replacements: {dt: checkDate},
            type: QueryTypes.SELECT
        });
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

    async getPICInfo(onlyTokens) {
        let inSnipped = "";
        if (onlyTokens !== undefined) {
            inSnipped = "where address in (:tokens)";
        }
        const sqlquery = `SELECT address, symbol, name, pic from supertokens ${inSnipped}`;

        if (inSnipped !== "") {
            return this.app.db.query(sqlquery, {
                replacements: {
                    tokens: onlyTokens
                },
                type: QueryTypes.SELECT
            });
        }

        return this.app.db.query(sqlquery, {
            type: QueryTypes.SELECT
        });
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
}

module.exports = Repository;
