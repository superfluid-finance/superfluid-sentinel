const Config = require("./config/configuration");
const Logger = require("./logger/logger");
const Client = require("./web3client/client");
const Protocol = require("./web3client/protocol");
const LoadEvents = require("./loadEvents");
const Liquidation = require("./web3client/txbuilder");

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

    constructor() {
        this.config = new Config();
        this.logger = new Logger(this);
        this.client = new Client(this);
        this.protocol = new Protocol(this);
        this.loadEvents = new LoadEvents(this);
        const models = {
            event : new EventModel()
        };
        this.models = models;
        this.liquidation = new Liquidation(this);
        this.bootstrap = new Bootstrap(this);
        this.getTimeUnix = utils.getTimeUnix;
        this.genAccounts = utils.generateAccounts;
        this.utils = utils;
        this.db = DB;
        this.db.queries = new Repository(this);
    }

    async run(fn, time) {
        await trigger(fn, time);
        await this.run(fn, time);
    }

    async start() {
        try {
            if(this.config.COLD_BOOT) {
                console.debug("dropping data...");
                await this.db.sync({ force: true })
            } else {
                await this.db.sync();
            }
            await this.client.start();
            await this.loadEvents.start();
            await this.bootstrap.start();
            //await this.loadEvents.start();
            //await this.bootstrap.start();
            await this.liquidation.start();
            setTimeout(() => this.protocol.subscribeAllTokensEvents(), 1000);
            setTimeout(() => this.protocol.subscribeAgreementEvents(), 1000);
            this.run(this.liquidation, 30000);
        } catch(error) {
            console.error(error);
            process.exit(1);
        }
    }
}

module.exports = App;
