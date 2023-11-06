const {
    QueryTypes,
    Op
} = require("sequelize");
const SQLRepository = require("./SQLRepository");

class BusinessRepository {

    constructor(app) {
        console.log("BusinessRepository constructor")
        if(!app) {
            throw new Error("BusinessRepository: app is not defined");
        }

        if (BusinessRepository._instance) {
            return BusinessRepository._instance;
        }

        this.app = app;
        if(!this.app.db.SQLRepository) {
            this.app.db.SQLRepository = SQLRepository.getInstance(app);
        }
        BusinessRepository._instance = this;
    }

    static getInstance(app) {
        console.log("calling getInstance from businessRepository");
        if (!BusinessRepository._instance) {

            BusinessRepository._instance = new BusinessRepository(app);
        }
        return BusinessRepository._instance;
    }

    async getAccounts(fromBlock = 0) {
        const sqlquery = `SELECT DISTINCT superToken, account FROM (
      SELECT * FROM (
          SELECT  superToken, sender as account, flowRate from flowupdateds
          WHERE blockNumber >= :bn
          GROUP BY hashId
          HAVING MAX(blockNumber)
          order by blockNumber desc , superToken, hashId
      ) AS P
      WHERE P.flowRate <> 0
      UNION ALL
      SELECT * FROM (
          SELECT  superToken, receiver as account, flowRate from flowupdateds
          WHERE blockNumber >= :bn
          GROUP BY hashId
          HAVING MAX(blockNumber)
          order by blockNumber desc , superToken, hashId
      ) AS O
      WHERE O.flowRate <> 0
      UNION ALL
      SELECT * FROM (
          SELECT  superToken, distributor as account, newDistributorToPoolFlowRate as flowRate from flowdistributionupdateds
          where blockNumber >= :bn
          GROUP BY agreementId
          HAVING MAX(blockNumber)
          order by blockNumber desc , superToken, agreementId
      ) AS Y
      WHERE Y.flowRate <> 0
      ) AS Z
      ORDER BY superToken`;
        return this.app.db.SQLRepository.executeSQLSelect(sqlquery, { bn: fromBlock });
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
        return this.app.db.SQLRepository.executeSQLSelect(sqlquery, { bn: fromBlock });
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
        return this.app.db.SQLRepository.executeSQLSelect(sqlquery, { bn: fromBlock });
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
            return this.app.db.SQLRepository.executeSQLSelect(sqlquery, {
                dt: checkDate,
                tokens: tokenFilter
            });
        }
        return this.app.db.SQLRepository.executeSQLSelect(sqlquery, { dt: checkDate });
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
            return this.app.db.SQLRepository.executeSQLSelect(sqlquery, {
                dt: checkDate,
                tokens: tokenFilter
            });

        }
        return this.app.db.SQLRepository.executeSQLSelect(sqlquery, { dt: checkDate });
    }

    async getPICInfo(onlyTokens) {
        let inSnipped = "";
        if (onlyTokens !== undefined) {
            inSnipped = "where address in (:tokens)";
        }
        const sqlquery = `SELECT address, symbol, name, pic from supertokens ${inSnipped}`;

        if (inSnipped !== "") {
            return this.app.db.SQLRepository.executeSQLSelect(sqlquery, { tokens: onlyTokens });
        }
        return this.app.db.SQLRepository.executeSQLSelect(sqlquery);
    }

}
BusinessRepository._instance = null;

module.exports = BusinessRepository;
