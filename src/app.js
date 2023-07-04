const Config = require("./config/configuration");
const Logger = require("./logger/logger");
const Client = require("./web3client/client");
const EventTracker = require("./web3client/eventTracker");
const Queues = require("./protocol/queues");
const Protocol = require("./protocol/protocol");
const LoadEvents = require("./boot/loadEvents");
const Liquidator = require("./web3client/liquidator");
const Gas = require("./transaction/gas");
const Time = require("./utils/time");
const Timer = require("./utils/timer");
const EventModel = require("./models/EventModel");
const Bootstrap = require("./boot/bootstrap.js");

const Repository = require("./database/repository");
const utils = require("./utils/utils.js");
const HTTPServer = require("./httpserver/server");
const Report = require("./httpserver/report");
const Notifier = require("./services/notifier");
const SlackNotifier = require("./services/slackNotifier");
const TelegramNotifier = require("./services/telegramNotifier");
const NotifierJobs = require("./services/notificationJobs");
const Errors = require("./utils/errors/errors");
const { wad4human } = require("@decentral.ee/web3-helpers");

class App {
    /*
     * @dev Load all dependencies needed to run the agent
     */
    constructor(config) {
        this.Errors = Errors;
        this.eventTracker = new EventTracker(this);
        this.config = new Config(config);
        this.logger = new Logger(this);
        this.db = require("./database/db")(this.config.DB);
        this.db.models = {
            AccountEstimationModel: require("./database/models/accountEstimationModel")(this.db),
            AgreementModel: require("./database/models/agreementModel")(this.db),
            FlowUpdatedModel: require("./database/models/flowUpdatedModel")(this.db),
            SuperTokenModel: require("./database/models/superTokenModel")(this.db),
            PoolCreatedModel: require("./database/models/poolCreatedModel")(this.db),
            SystemModel: require("./database/models/systemModel")(this.db),
            UserConfig: require("./database/models/userConfiguration")(this.db),
            ThresholdModel: require("./database/models/thresholdModel")(this.db),
        }
        this.db.queries = new Repository(this);
        this.eventTracker = new EventTracker(this);
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

        this.healthReport = new Report(this);
        this.server = new HTTPServer(this);
        this.timer = new Timer();

        this.notifier = new Notifier(this);
        // at this stage we only work with slack or telegram
        if (this.config.SLACK_WEBHOOK_URL) {
            this._slackNotifier = new SlackNotifier(this, {timeout: 3000});
        }
        if (this.config.TELEGRAM_BOT_TOKEN && this.config.TELEGRAM_CHAT_ID) {
            this._telegramNotifier = new TelegramNotifier(this);
        }
        if (this._slackNotifier || this._telegramNotifier) {
            this.logger.info("initializing notification jobs")
            this.notificationJobs = new NotifierJobs(this);
        }

        this._isShutdown = false;
        this._isInitialized = false;
    }

    async run(fn, time) {
        if (this._isShutdown) {
            this.logger.info(`app.shutdown() - closing app runner`);
            return;
        }

        const result = await this.timer.triggerStart(fn, time);
        if (result.error !== undefined) {
            this.logger.error(result.error);
            await this.timer.timeout(5000);
        }

        await this.run(fn, time);
    }

    // return if client module is initialized
    isInitialized() {
        return this._isInitialized;
    }

    // return estimations saved on database
    async getEstimations() {
        return this.db.queries.getEstimations();
    }

    // return PIC saved on database
    async getPICInfo(onlyTokens) {
        return this.db.queries.getPICInfo(onlyTokens);
    }

    // return configuration used
    getConfigurationInfo() {
        return this.config.getConfigurationInfo();
    }

    // close agent processes and exit
    async shutdown(force = false) {
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

            if(!this.config.OBSERVER) {
                let counter = 10;
                while (counter > 0) {
                    await this.timer.timeout(this.config.LIQUIDATION_JOB_AWAITS);
                    if (this.liquidator._isShutdown) {
                        return;
                    }
                    counter--;
                }
            }
            this.logger.info(`app.shutdown() - closing database`);
            await this.db.close();
        } catch (err) {
            this.logger.error(`App.shutdown(): ${err}`);
            process.exit(1);
        }
    }

    // set agent time.
    // Note: the agent will not update this timestamp
    // Use an external service to update when needed. ex. ganache
    setTime(time) {
        this.time.setTime(time);
    }

    // Set client testing flags to change behavior
    setTestFlag(flag, options) {
        this.client.setTestFlag(flag, options);
    }

    async start() {
        try {
            this.logger.debug(`booting sentinel`);
            this._isShutdown = false;
            // send notification about time sentinel started including timestamp
            this.notifier.sendNotification(`Sentinel started at ${new Date()}`);
            // connect to provided rpc
            await this.client.connect();
            // if we are running tests don't try to load network information
            if (!this.config.RUN_TEST_ENV) {
                await this.config.loadNetworkInfo(await this.client.getChainId());
            }
            // create all web3 infrastructure needed
            await this.client.init();
            this.notifier.sendNotification(`RPC connected with chainId ${await this.client.getChainId()}, account ${this.client.agentAccounts?.address} has balance ${this.client.agentAccounts ? wad4human(await this.client.getAccountBalance()) : "N/A"}`);
            if (this.config.BATCH_CONTRACT !== undefined) {
                await this.client.loadBatchContract();
            }
            if (this.config.TOGA_CONTRACT !== undefined) {
                await this.client.loadTogaContract();
            }
            //check conditions to decide if getting snapshot data
            if ((!this.utils.fileExist(this.config.DB) || this.config.COLD_BOOT) &&
                this.config.FASTSYNC && this.config.CID) {
                this.logger.info(`getting snapshot from ${this.config.IPFS_GATEWAY + this.config.CID}`);
                await this.utils.downloadFile(this.config.IPFS_GATEWAY + this.config.CID, this.config.DB + ".gz");
                this.logger.info("unzipping snapshot...");
                this.utils.unzip(this.config.DB + ".gz", this.config.DB);
                await this.db.sync();
            } else if (this.config.COLD_BOOT) {
                // drop existing database to force a full boot
                this.logger.debug(`resyncing database data`);
                await this.db.sync({force: true});
            } else {
                await this.db.sync();
            }
            // log configuration data
            const userConfig = this.config.getConfigurationInfo();
            this.logger.debug(JSON.stringify(userConfig));
            if (await this.isResyncNeeded(userConfig)) {
                this.logger.error(`ATTENTION: Configuration changed since last run, please re-sync.`);
                // send notification about configuration change, and exit
                this.notifier.sendNotification(`Configuration changed since last run, please re-sync.`);
                await this.timer.timeout(3500);
                process.exit(1);
            }
            await this.db.queries.saveConfiguration(JSON.stringify(userConfig));
            // get json file with tokens and their thresholds limits. Check if it exists and loaded to json object
            try {
                const thresholds = require("../thresholds.json");
                const tokensThresholds = thresholds.networks[await this.client.getChainId()];
                this.config.SENTINEL_BALANCE_THRESHOLD = tokensThresholds.minSentinelBalanceThreshold;
                // update thresholds on database
                await this.db.queries.updateThresholds(tokensThresholds.thresholds);
            } catch (err) {
                this.logger.warn(`error loading thresholds.json`);
                await this.db.queries.updateThresholds({});
                this.config.SENTINEL_BALANCE_THRESHOLD = 0;
            }


            // collect events to detect superTokens and accounts
            const currentBlock = await this.loadEvents.start();
            // query balances to make liquidations estimations
            await this.bootstrap.start();
            this.queues.init();
            this.timer.startAfter(this.queues);
            this.timer.startAfter(this.eventTracker, currentBlock);
            // start http server to serve node health reports and dashboard
            if (this.config.METRICS === true) {
                this.timer.startAfter(this.server);
            }
            // Only start notification jobs if notifier is enabled
            if (this.notificationJobs) {
                this.logger.info(`Starting notification jobs`);
                this.timer.startAfter(this.notificationJobs);
            }
            //from this point on, sentinel is considered initialized.
            this._isInitialized = true;
            // await x milliseconds before running next liquidation job
            if (!this.config.OBSERVER) {
                this.run(this.liquidator, this.config.LIQUIDATION_JOB_AWAITS);
            } else {
                this.logger.warn(`ATTENTION: Configuration is set to be Observer. Liquidations will not be sent`);
            }

        } catch (err) {
            this.logger.error(`App.start(): ${err}`);
            process.exit(1);
        }
    }

    async isResyncNeeded(userConfig) {
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

    isRPCDrifting() {
        const now = Date.now();
        const tracker = this.eventTracker.lastTimeNewBlocks.getTime();
        return Math.floor(Math.abs(now - tracker)) > (this.config.POLLING_INTERVAL * 5);
    }
}

module.exports = App;
