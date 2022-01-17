require("dotenv").config();
const { promises: Fs } = require('fs')
const Utils = require("./../src/utils/utils");

const Client = require("./../src/web3client/client");
const Protocol = require("./../src/protocol/protocol");
const Queues = require("./../src/protocol/queues");
const EventModel = require("./../src/models/EventModel");
const Bootstrap = require("./../src/boot/bootstrap");
const LoadEvents = require("./../src/boot/loadEvents");
const DB = require("./../src/database/db");
const Repository = require("./../src/database/repository");
const networkConfigs = require("./../package.json").networks;
/*
 * Build a fresh snapshot
 */
(async () => {
    const genAccounts = Utils.generateAccounts;
    try {
        const config = {
            HTTP_RPC_NODE: process.env.HTTP_RPC_NODE,
            PROTOCOL_RELEASE_VERSION: "test",
            MNEMONIC: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
            MNEMONIC_INDEX: 0,
            LOG_LEVEL: "debug",
            BLOCK_OFFSET: 12,
            NUM_RETRIES: 10,
            MAX_QUERY_BLOCK_RANGE: 10000
        }

        const app = {
            config: config,
            logger: console,
            genAccounts: genAccounts
        }

        app.client = new Client(app);
        await app.client.init();
        const chainId = await app.client.getChainId();

        /*Set up database*/
        config.db_path = `./snapshots/snapshot_${chainId}_${new Date().getTime()}.tmp`;
        const db = DB(config.db_path);
        db.models = {
            AccountEstimationModel: require("./../src/database/models/accountEstimationModel")(db),
            AgreementModel: require("./../src/database/models/agreementModel")(db),
            FlowUpdatedModel: require("./../src/database/models/flowUpdatedModel")(db),
            SuperTokenModel: require("./../src/database/models/superTokenModel")(db),
            SystemModel: require("./../src/database/models/systemModel")(db)
        }

        await db.sync({ force: true });
        app.db = db;
        app.models = {
            event: new EventModel()
        };
        db.queries = new Repository(app);
        config.EPOCH_BLOCK = networkConfigs[chainId].epoch || 0;
        app.protocol = new Protocol(app);
        app.queues = new Queues(app);
        const loadEvents = new LoadEvents(app);
        const bootstrap = new Bootstrap(app);
        await loadEvents.start();
        await bootstrap.start();

        const newFile = `./snapshots/snapshot_${chainId}_${new Date().getTime()}.sqlite`;
        await Fs.rename(config.db_path, newFile);
        console.log("Snapshot generated...");
        console.log(`chainId: ${chainId}`);
        console.log(`Protocol Version: ${config.PROTOCOL_RELEASE_VERSION}`);
        console.log(`file: ${newFile}`);

    } catch(err) {
        console.error(err);
    }
})();

