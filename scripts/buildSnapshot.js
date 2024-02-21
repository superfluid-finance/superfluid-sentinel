/*
 * Generate a new network snapshot.
 * Requires HTTP_RPC_NODE to be set. If an .env file exists in the project root, it reads it.
 * exec: yarn build-snap RPC_URL
 */
require("dotenv").config();
const zlib = require("zlib");
const fs = require("fs");
const Utils = require("./../src/utils/utils");

const Client = require("./../src/web3client/client");
const Protocol = require("./../src/protocol/protocol");
const Queues = require("./../src/protocol/queues");
const EventModel = require("./../src/models/EventModel");
const Bootstrap = require("./../src/boot/bootstrap");
const LoadEvents = require("./../src/boot/loadEvents");
const DB = require("./../src/database/db");
const Repository = require("./../src/database/businessRepository");
const Timer = require("./../src/utils/timer");
const metadata = require("@superfluid-finance/metadata/networks.json");
const {QueryTypes} = require("sequelize");

const DB_SCHEMA_VERSION = 3;
/*
 * Build a fresh snapshot
 */
(async () => {
    const myArgs = process.argv.slice(2);
    const genAccounts = Utils.generateAccounts;
    try {
        const config = {
            HTTP_RPC_NODE: myArgs[0] ? myArgs[0] : process.env.HTTP_RPC_NODE,
            PROTOCOL_RELEASE_VERSION: "v1",
            OBSERVER: true,
            LOG_LEVEL: "info",
            BLOCK_OFFSET: 12,
            NUM_RETRIES: 10,
            MAX_QUERY_BLOCK_RANGE: 2000
        }

        const app = {
            config: config,
            logger: console,
            timer: new Timer(),
            genAccounts: genAccounts
        }

        app.client = new Client(app);
        await app.client.connect();
        const chainId = await app.client.getChainId();
        const network = metadata.filter(x => x.chainId === chainId)[0];
        if (network === undefined) {
            throw Error(`unknown chainId: ${chainId}`);
        }
        const resolver = network.contractsV1.resolver;
        app.config.RESOLVER = resolver;
        await app.client.init();
        /*Set up database*/
        config.db_path = `./snapshots/snapshot_${chainId}_${Math.round(new Date().getTime() / 1000)}.tmp`;
        const db = DB(config.db_path);
        db.models = {
            AccountEstimationModel: require("./../src/database/models/accountEstimationModel")(db),
            AgreementModel: require("./../src/database/models/agreementModel")(db),
            FlowUpdatedModel: require("./../src/database/models/flowUpdatedModel")(db),
            SuperTokenModel: require("./../src/database/models/superTokenModel")(db),
            FlowDistributionModel: require("./../src/database/models/flowDistributionUpdatedModel")(db),
            PoolCreatedModel: require("./../src/database/models/poolCreatedModel")(db),
            SystemModel: require("./../src/database/models/systemModel")(db)
        }

        await db.sync({ force: true });

        app.db = db;
        app.models = {
            event: new EventModel()
        };
        db.queries = new Repository(app);
        config.EPOCH_BLOCK = network.startBlockV1 || 0;
        app.protocol = new Protocol(app);
        app.queues = new Queues(app);
        const loadEvents = new LoadEvents(app);
        const bootstrap = new Bootstrap(app);
        await loadEvents.start();
        await bootstrap.start();
        await db.query(`PRAGMA user_version = ${DB_SCHEMA_VERSION};`, {
            type: QueryTypes.SELECT
        });
        //compress database
        const newFile = config.db_path.slice(0, -3).concat("sqlite.gz");
        const gzip = zlib.createGzip();
        const rd = fs.createReadStream(config.db_path);
        rd.on("close", () => {
            fs.unlinkSync(config.db_path);
        });
        const wr = fs.createWriteStream(newFile);
        rd.pipe(gzip).pipe(wr);
        console.log("Snapshot generated...");
        console.log(`chainId: ${chainId}`);
        console.log(`protocol version: ${config.PROTOCOL_RELEASE_VERSION}`);
        console.log(`file: ${newFile}`);
    } catch(err) {
        console.error(err);
    }
})();
