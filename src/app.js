const Config = require("./config/configuration");
const Logger = require("./logger/logger");
const Client = require("./web3client/client");
const Protocol = require("./web3client/protocol");
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

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

async function trigger(fn, time = 15000) {
    await timeout(time);
    return fn.start();
}

class App {
    /*
     * @dev Load all dependancies needed to run the agent
    */
    constructor(config) {

        //Helpers global functions
        const delay = ms => new Promise(res => setTimeout(res, ms))

        this.config = new Config(config);
        this.logger = new Logger(this);
        this.client = new Client(this);
        this.protocol = new Protocol(this);
        this.gasEstimator = new Gas(this);
        this.loadEvents = new LoadEvents(this);
        const models = {
            event: new EventModel()
        };
        this.models = models;
        this.liquidator = new Liquidator(this);
        this.bootstrap = new Bootstrap(this);
        this.time = new Time(this);
        this.getTimeUnix = utils.getTimeUnix;
        this.genAccounts = utils.generateAccounts;
        this.utils = utils;
        this.db = DB;
        this.db.queries = new Repository(this);
        this.server = new HTTPServer(this);
        this._isShutdown = false;
        this._needResync = false;
        this.timer = {
            delay: delay
        }
    }

    async run(fn, time) {

        if(this._isShutdown)
            return;

        const result = await trigger(fn, time);
        if(result.error !== undefined) {
            this.logger.error(result.error);
            await this.timer.delay(5000);
        }

        await this.run(fn, time);
    }
    //return if client module is initialized
    isInitialized() {
        return this.client.isInitialized;
    }
    //return estimations saved on database
    async getEstimations() {
        return this.db.queries.getEstimations();
    }

    //close agent processes and exit
    async shutdown(force = false) {
        this._isShutdown = true;
        this.logger.info(`app.shutdown() - agent shutting down`);
        this.time.resetTime();
        if(force) {
            this.logger.error(`app.shutdown() - force shutdown`);
            process.exit(0);
        }

        try {
            await this.protocol.unsubscribeTokens();
            await this.protocol.unsubscribeAgreements();
            this.client.disconnect();
            await this.db.close();
            this.time.resetTime();
            return;
        } catch(err) {
            this.logger.error(`app.shutdown() - ${err}`);
            process.exit(1);
        }
    }

    //set agent time.
    //Note: the agent will not update this timestamp
    //Use a external service to update when needed. ex. ganache
    setTime(time) {
        this.time.setTime(time);
    }

    //Set client testing flags to change behavior
    setTestFlag(flag, options) {
        this.client.setTestFlag(flag, options);
    }

    async start() {
        try {
            this._isShutdown = false;
            if (this.config.COLD_BOOT) {
                //drop existing database to force a full boot
                this.logger.debug(`resync all database data`);
                await this.db.sync({ force: true });
            } else {
                await this.db.sync();
            }
            //log configuration data
            const userConfig = this.config.getConfigurationInfo();
            this.logger.debug(JSON.stringify(userConfig));
            this._needResync = await this.checkConfigurationChanges(userConfig);
            if (this._needResync) {
                this.logger.error(`ATTENTION: Configuration changed from last boot, please resync the database`);
                process.exit(1);
            }
            await this.db.queries.saveConfiguration(JSON.stringify(userConfig));

            //create all web3 infrastruture needed
            await this.client.init();
            //if we are running tests don't try to load network information
            if(!this.config.RUN_TEST_ENV)
                this.config.loadNetworkInfo(await this.client.getNetworkId());
            if(this.config.BATCH_CONTRACT !== undefined) {
                await this.client.loadBatchContract();
            }
            //Collect events to detect superTokens and accounts
            await this.loadEvents.start();
            //query balances to make liquidations estimations
            await this.bootstrap.start();
            //cold boot take some time, we missed some blocks in the boot phase, run again to be near real.time
            if(this.config.COLD_BOOT == 1) {
                await this.loadEvents.start();
                await this.bootstrap.start();
            }

            setTimeout(() => this.protocol.subscribeAllTokensEvents(), 1000);
            setTimeout(() => this.protocol.subscribeAgreementEvents(), 1000);
            setTimeout(() => this.protocol.subscribeIDAAgreementEvents(), 1000);
            //start http server to serve node health reports and dashboard
            if(this.config.METRICS == true) {
                setTimeout(() => this.server.start(), 1000);
            }
            //await x milliseconds before running next liquidation job
            this.run(this.liquidator, this.config.LIQUIDATION_JOB_AWAITS);
        } catch(err) {
            this.logger.error(`app.start() - ${err}`);
            process.exit(1);
        }
    }

    async checkConfigurationChanges(userConfig) {
        //check important change of configurations
        const res = await this.db.queries.getConfiguration();
        if (res !== null) {
            let needResync = false;
            const dbuserConfig = JSON.parse(res.config);
            if (dbuserConfig.TOKENS === undefined && userConfig.TOKENS !== undefined) {
                needResync = true;
            } else if (userConfig.TOKENS) {
                const sortedDBTokens = dbuserConfig.TOKENS.sort(this.utils.sortString);
                const sortedConfigTokens = userConfig.TOKENS.sort(this.utils.sortString);
                const match = sortedDBTokens.filter(x => sortedConfigTokens.includes(x));
                if (match.length < sortedConfigTokens.length) {
                    needResync = true;
                }
            }
            if (dbuserConfig.ONLY_LISTED_TOKENS !== userConfig.ONLY_LISTED_TOKENS && userConfig.ONLY_LISTED_TOKENS == false) {
                needResync = true;
            }
            return needResync;
        }
        return false;
    }
}

module.exports = App;
