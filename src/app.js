const Config = require("./config/configuration");
const Logger = require("./logger/logger");
const Client = require("./web3client/client");
const EventTracker = require("./web3client/eventTracker");
const Queues = require("./protocol/queues");
const Protocol = require("./protocol/protocol");
const LoadEvents = require("./loadEvents");
const Liquidator = require("./web3client/liquidator");
const Gas = require("./transaction/gas");
const Time = require("./utils/time");
const EventModel = require("./models/EventModel");
const Bootstrap = require("./bootstrap.js");
const DB = require("./database/db");
const Repository = require("./database/repository");
const utils = require("./utils/utils.js");
const HTTPServer = require("./httpserver/server");
const Report = require("./httpserver/report");

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

async function trigger (fn, time = 15000) {
  await timeout(time);
  return fn.start();
}

class App {
  /*
     * @dev Load all dependencies needed to run the agent
    */
  constructor (config) {
    // Helpers global functions
    // eslint-disable-next-line promise/param-names
    const delay = ms => new Promise(res => setTimeout(res, ms));
    this.eventTracker = new EventTracker(this);
    this.config = new Config(config);
    this.logger = new Logger(this);
    this.client = new Client(this);
    this.protocol = new Protocol(this);
    this.queues = new Queues(this);
    this.gasEstimator = new Gas(this);
    this.loadEvents = new LoadEvents(this);
    this.models = {
      event: new EventModel()
    };
    this.liquidator = new Liquidator(this);
    this.bootstrap = new Bootstrap(this);
    this.time = new Time();
    this.genAccounts = utils.generateAccounts;
    this.utils = utils;
    this.db = DB;
    this.db.queries = new Repository(this);
    this.healthReport = new Report(this);
    this.server = new HTTPServer(this);
    this.timer = {
      delay: delay
    };

    this._isShutdown = false;
  }

  async run (fn, time) {
    if (this._isShutdown) {
      this.logger.info(`app.shutdown() - closing app runner`);
      return;
    }

    const result = await trigger(fn, time);
    if (result.error !== undefined) {
      this.logger.error(result.error);
      await this.timer.delay(5000);
    }

    await this.run(fn, time);
  }

  // return if client module is initialized
  isInitialized () {
    return this.client.isInitialized;
  }

  // return estimations saved on database
  async getEstimations () {
    return this.db.queries.getEstimations();
  }

  // close agent processes and exit
  async shutdown (force = false) {
    this._isShutdown = true;
    this.logger.info(`app.shutdown() - agent shutting down`);
    this.time.resetTime();
    if (force) {
      process.exit(0);
    }

    try {
      this.logger.info(`app.shutdown() - closing event tracker`);
      this.eventTracker._disconnect();
      this.logger.info(`app.shutdown() - closing client`);
      this.client.disconnect();
      this.time.resetTime();
      // this.logger.info(`app.shutdown() - closing database`);
      // await this.db.close();
      let counter = 10;
      while (counter > 0) {
        await this.timer.delay(3000);
        if (this.liquidator._isShutdown) {
          return;
        }
        counter--;
      }
    } catch (err) {
      this.logger.error(`app.shutdown() - ${err}`);
      process.exit(1);
    }
  }

  // set agent time.
  // Note: the agent will not update this timestamp
  // Use an external service to update when needed. ex. ganache
  setTime (time) {
    this.time.setTime(time);
  }

  // Set client testing flags to change behavior
  setTestFlag (flag, options) {
    this.client.setTestFlag(flag, options);
  }

  async start () {
    try {
      this.logger.debug(`booting sentinel`);
      this._isShutdown = false;
      if (this.config.COLD_BOOT) {
        // drop existing database to force a full boot
        this.logger.debug(`resyncing database data`);
        await this.db.sync({ force: true });
      } else {
        await this.db.sync();
      }
      // log configuration data
      const userConfig = this.config.getConfigurationInfo();
      this.logger.debug(JSON.stringify(userConfig));
      if (await this.isResyncNeeded(userConfig)) {
        this.logger.error(`ATTENTION: Configuration changed since last run, please re-sync.`);
        process.exit(1);
      }
      await this.db.queries.saveConfiguration(JSON.stringify(userConfig));

      // create all web3 infrastructure needed
      await this.client.init();
      // if we are running tests don't try to load network information
      if (!this.config.RUN_TEST_ENV) {
        this.config.loadNetworkInfo(await this.client.getChainId());
      }
      if (this.config.BATCH_CONTRACT !== undefined) {
        await this.client.loadBatchContract();
      }
      if (this.config.TOGA_CONTRACT !== undefined) {
        await this.client.loadTogaContract();
      }
      // collect events to detect superTokens and accounts
      const currentBlock = await this.loadEvents.start();
      // query balances to make liquidations estimations
      await this.bootstrap.start();
      this.queues.init();
      setTimeout(() => this.queues.start(), 1000);
      setTimeout(() => this.eventTracker.start(currentBlock), 1000);
      // start http server to serve node health reports and dashboard
      if (this.config.METRICS === true) {
        setTimeout(() => this.server.start(), 1000);
      }
      // await x milliseconds before running next liquidation job
      this.run(this.liquidator, this.config.LIQUIDATION_JOB_AWAITS);
    } catch (err) {
      this.logger.error(`app.start() - ${err}`);
      process.exit(1);
    }
  }

  async isResyncNeeded (userConfig) {
    // check important change of configurations
    const res = await this.db.queries.getConfiguration();
    if (res !== null) {
      const dbuserConfig = JSON.parse(res.config);
      // if user was filtering tokens and now is not, then should resync
      if (dbuserConfig.TOKENS !== undefined && userConfig.TOKENS === undefined) {
        return true;
      }
      // if user changes the set of filtered tokens, check if it's a subset of the previous ones
      if (dbuserConfig.TOKENS !== undefined && userConfig.TOKENS !== undefined) {
        const sortedDBTokens = dbuserConfig.TOKENS.sort(this.utils.sortString);
        const sortedConfigTokens = userConfig.TOKENS.sort(this.utils.sortString);
        const match = sortedDBTokens.filter(x => sortedConfigTokens.includes(x));
        if (match.length < sortedConfigTokens.length) {
          return true;
        }
      }
      // if there's no filter and the user switched from listed-only to all tokens, resync is needed
      if (userConfig.TOKENS === undefined && dbuserConfig.ONLY_LISTED_TOKENS === true && userConfig.ONLY_LISTED_TOKENS === false) {
        return true;
      }
    }
    return false;
  }
}

module.exports = App;
