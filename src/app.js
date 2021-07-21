const Config = require("./config/configuration");
const Logger = require("./logger/logger");
const Client = require("./web3client/client");
const Protocol = require("./web3client/protocol");
const LoadEvents = require("./loadEvents");
const Liquidation = require("./web3client/txbuilder");
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
        this.liquidation = new Liquidation(this);
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

    isInitialized() {
        return this.client.isInitialized;
    }

    async getEstimations() {
        return this.db.queries.getEstimations();
    }

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
            this.client.web3.currentProvider.disconnect();
            this.client.web3HTTP.currentProvider.disconnect();
            await this.db.close();
            //process.exit(0);
            this.time.resetTime();
            return "exit";
        } catch(err) {
            console.error(`agent shutdown ${err}`);
            process.exit(1);
        }
    }

    setTime(time) {
        this.time.setTime(time);
    }

    async start() {
        try {
            this._isShutdown = false;
            if(this.config.COLD_BOOT) {
                await this.db.sync({ force: true });
            } else {
                await this.db.sync();
            }

            await this.client.start();
            await this.loadEvents.start();
            await this.bootstrap.start();
            await this.liquidation.start();
            setTimeout(() => this.protocol.subscribeAllTokensEvents(), 1000);
            setTimeout(() => this.protocol.subscribeAgreementEvents(), 1000);
            setTimeout(() => this.protocol.subscribeIDAAgreementEvents(), 1000);
            this.run(this.liquidation, 10000);
        } catch(error) {
            console.error(error);
            process.exit(1);
        }
    }
}

module.exports = App;
