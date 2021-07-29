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

const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));
async function trigger(fn, time = 15000) {
    await timeout(time);
    fn.start();
}

class App {
    /*
     * @dev Load all dependancies needed to run the agent
    */
    constructor(config) {
        this.config = new Config(config);
        this.logger = new Logger(this);
        this.client = new Client(this);
        this.protocol = new Protocol(this);
        this.gasEstimator = new Gas(this);
        this.loadEvents = new LoadEvents(this);
        const models = {
            event : new EventModel()
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
        this._isShutdown
    }

    async run(fn, time) {
        if(this._isShutdown)
            return;
        await trigger(fn, time);
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
        console.debug(`agent shutting down...`)
        this.time.resetTime();
        if(force) {
            console.error(`force shutdown`);
            process.exit(0);
        }

        try {
            await this.protocol.unsubscribeTokens();
            await this.protocol.unsubscribeAgreements();
            this.client.disconnect();
            await this.db.close();
            this.time.resetTime();
            return "exit";
        } catch(err) {
            console.error(`agent shutdown ${err}`);
            process.exit(1);
        }
    }

    //set agent time.
    //Note: the agent will not update this timestamp.
    //Use a external service to update when needed. ex. ganache
    setTime(time) {
        this.time.setTime(time);
    }

    //Set client testing flags to change behavior
    setTestFlag(flag, options) {
        console.log("Setting flasgs");
        console.log("flag ", flag);
        this.client.setTestFlag(flag, options);
    }

    async start() {
        try {
            this._isShutdown = false;
            if(this.config.COLD_BOOT) {
                //drop existing database to force a full boot
                await this.db.sync({ force: true });
            } else {
                await this.db.sync();
            }

            //create all web3 infrastruture needed
            await this.client.init();
            //Collect events to detect superTokens and accounts
            await this.loadEvents.start();
            //query balances to make liquidations estimations
            await this.bootstrap.start();
            //cold boot take some time, we missed some blocks in the boot phase, run again to be near real.time
            if(this.config.COLD_BOOT == 1) {
                await this.loadEvents.start();
                await this.bootstrap.start();
            }
            //run one time the liquidation job as soon as possible
            await this.liquidator.start();
            setTimeout(() => this.protocol.subscribeAllTokensEvents(), 1000);
            setTimeout(() => this.protocol.subscribeAgreementEvents(), 1000);
            setTimeout(() => this.protocol.subscribeIDAAgreementEvents(), 1000);
            //run liquidation job every x seconds
            this.run(this.liquidator, 10000);
        } catch(error) {
            console.error(error);
            process.exit(1);
        }
    }
}

module.exports = App;
