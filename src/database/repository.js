const { QueryTypes, Op } = require("sequelize");
const EstimationModel = require("../database/models/accountEstimationModel");

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
      ) AS Z
      ORDER BY superToken`;


    return this.app.db.query(sqlquery, {
      replacements: { bn: fromBlock },
      type: QueryTypes.SELECT
    });
  }

  async getLastFlows(fromBlock = 0) {

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

  async getIDASubscribers(superToken, publisher) {
    const sqlquery = `SELECT DISTINCT subscriber from idaevents IDA
    INNER JOIN agreements AGR on IDA.subscriber = AGR.sender AND IDA.superToken = AGR.superToken
    WHERE eventName = "SubscriptionApproved"
    AND publisher = :pb
    AND IDA.superToken = :st`;
    return this.app.db.query(sqlquery, {
      replacements: [{ pb: publisher }, {st: superToken}],
      type: QueryTypes.SELECT
    });
  }

  async getAddressEstimation(address) {
    return EstimationModel.findAll({
      attributes: ['address', 'superToken', 'zestimation'],
      where:
      {
          address:  address
      }
  });
  }

  async getEstimations() {
    return EstimationModel.findAll({
      attributes: ['address', 'superToken', 'zestimation'],
      where:
      {
          [Op.or]: [
              { now : true},
              {
                  zestimation: { [Op.gt]: 0 }
              }
          ]
      }
  });
  }

  async getLiquidations(checkDate, onlyTokens, limitRows) {
    let inSnipped = "";
    let inSnippedLimit = "";
    if (onlyTokens !== undefined) {
      inSnipped = "and agr.superToken in (:tokens)";
    }
    if(limitRows !== undefined && limitRows > 0 && limitRows < 101) {
      inSnippedLimit = `LIMIT ${limitRows}`;
    }

    const sqlquery = `SELECT agr.superToken, agr.sender, agr.receiver, est.zestimation, est.zestimationHuman FROM agreements agr
    INNER JOIN estimations est ON agr.sender = est.address AND agr.superToken = est.superToken AND est.zestimation <> 0
    WHERE agr.flowRate <> 0 and est.zestimation <= :dt ${inSnipped}
    ORDER BY agr.superToken, agr.sender, agr.flowRate DESC ${inSnippedLimit}`;

    if(inSnipped !== "") {
      return this.app.db.query(sqlquery, {
        replacements: { dt: checkDate, tokens: onlyTokens},
        type: QueryTypes.SELECT
      });
    }
    return this.app.db.query(sqlquery, {
      replacements: { dt: checkDate },
      type: QueryTypes.SELECT
    });
  }

  async getNumberOfBatchCalls(checkDate) {
    const sqlquery = `SELECT agr.superToken, count(*) as numberTxs  FROM agreements agr
    INNER JOIN estimations est on agr.sender = est.address and agr.superToken = est.superToken and est.zestimation <> 0
    where agr.flowRate <> 0 and est.zestimation <= :dt
    group by agr.superToken
    having count(*) > 1
    order by count(*) desc`;

    return this.app.db.query(sqlquery, {
      replacements: { dt: checkDate },
      type: QueryTypes.SELECT
    });
  }

  async healthCheck() {
    return this.app.db.query("SELECT 1", {
      type: QueryTypes.SELECT
    });
  }
}

module.exports = Repository;
