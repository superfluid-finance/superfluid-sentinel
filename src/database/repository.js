const {
  QueryTypes,
  Op
} = require("sequelize");

class Repository {
  constructor (app) {
    this.app = app;
  }

  async getAccounts (fromBlock = 0) {
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
      ) AS Z
      ORDER BY superToken`;

    return this.app.db.query(sqlquery, {
      replacements: { bn: fromBlock },
      type: QueryTypes.SELECT
    });
  }

  async getLastFlows (fromBlock = 0) {
    const sqlquery = `SELECT * FROM (
    SELECT  agreementId, superToken, sender, receiver, flowRate from flowupdateds
    WHERE blockNumber > :bn
    GROUP BY hashId
    HAVING MAX(blockNumber)
    order by blockNumber desc , superToken, hashId
    ) AS P
    WHERE P.flowRate <> 0`;
    return this.app.db.query(sqlquery, {
      replacements: { bn: fromBlock },
      type: QueryTypes.SELECT
    });
  }

  async getAddressEstimation (address) {
    return this.app.db.models.AccountEstimationModel.findAll({
      attributes: ["address", "superToken", "zestimation"],
      where:
        {
          address: address
        }
    });
  }

  async getEstimations () {
    return this.app.db.models.AccountEstimationModel.findAll({
      attributes: ["address", "superToken", "zestimation"],
      where: { zestimation: { [Op.gt]: 0 } }
    });
  }

  async getLiquidations (checkDate, onlyTokens, limitRows) {
    let inSnipped = "";
    let inSnippedLimit = "";
    if (onlyTokens !== undefined) {
      inSnipped = "and agr.superToken in (:tokens)";
    }
    if (limitRows !== undefined && limitRows > 0 && limitRows < 101) {
      inSnippedLimit = `LIMIT ${limitRows}`;
    }

    const sqlquery = `SELECT agr.superToken, agr.sender, agr.receiver, est.zestimation, est.zestimationHuman, (est.zestimation + (st.delay * 1000)) as computedEstimation FROM agreements agr
    INNER JOIN supertokens st on agr.superToken == st.address
    INNER JOIN estimations est ON agr.sender = est.address AND agr.superToken = est.superToken AND est.zestimation <> 0
    WHERE agr.flowRate <> 0 and (est.zestimation + (st.delay * 1000)) <= :dt ${inSnipped}
    ORDER BY est.zestimation ASC ${inSnippedLimit}`;

    if (inSnipped !== "") {
      return this.app.db.query(sqlquery, {
        replacements: {
          dt: checkDate,
          tokens: onlyTokens
        },
        type: QueryTypes.SELECT
      });
    }
    return this.app.db.query(sqlquery, {
      replacements: { dt: checkDate },
      type: QueryTypes.SELECT
    });
  }

  async getNumberOfBatchCalls (checkDate) {
    const sqlquery = `SELECT agr.superToken, count(*) as numberTxs  FROM agreements agr
    INNER JOIN supertokens st on agr.superToken == st.address
    INNER JOIN estimations est on agr.sender = est.address and agr.superToken = est.superToken and est.zestimation <> 0
    where agr.flowRate <> 0 and (est.zestimation + (st.delay * 1000))  <= :dt
    group by agr.superToken
    having count(*) > 1
    order by count(*) desc`;

    return this.app.db.query(sqlquery, {
      replacements: { dt: checkDate },
      type: QueryTypes.SELECT
    });
  }

  async healthCheck () {
    return this.app.db.query("SELECT 1", {
      type: QueryTypes.SELECT
    });
  }

  async updateBlockNumber (newBlockNumber) {
    const systemInfo = await this.app.db.models.SystemModel.findOne();
    if (systemInfo !== null && systemInfo.blockNumber < newBlockNumber) {
      systemInfo.blockNumber = Number(newBlockNumber);
      systemInfo.superTokenBlockNumber = Number(newBlockNumber);
    }
    return systemInfo.save();
  }

  async getConfiguration () {
    return this.app.db.models.UserConfig.findOne();
  }

  async saveConfiguration (configString) {
    const fromDB = await this.app.db.models.UserConfig.findOne();
    if (fromDB !== null) {
      fromDB.config = configString;
      return fromDB.save();
    }
    return this.app.db.models.UserConfig.create({ config: configString });
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
}

module.exports = Repository;
