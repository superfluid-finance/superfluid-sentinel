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
}

module.exports = Repository;
