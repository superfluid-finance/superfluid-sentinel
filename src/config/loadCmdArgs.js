const path = require('path')
let args = process.argv.slice(2)[0];
if(args === undefined) {
    require("dotenv").config();
} else {
    require('dotenv').config({ path: path.resolve(__dirname, `../../.env-${args}`) })
}


const program = require("commander");
const package = require("../../package.json");
program.version(package.version, '-v, --version');
program
    .description("Superfluid Sentinel")
    .option("-H, --http-rpc-node [value]", "HTTP RPC Node URL")
    .option("-W, --ws-rpc-node [value]", "WebSocket RPC Node URL")
    .option("-k, --private-key [value]","Private Key")
    .option("-m, --mnemonic [value]","Mnemonic")
    .option("--max-query-block-range [value]", "Max query block range (default: 2000)")
    .option("-t, --tokens [value]", "Addresses of SuperTokens the sentinel should watch (default: all SuperTokens)")
    .option("-p, --db-path [value]", "Path of the DB file (default: db.sqlite)")
    .option("-d, --additional-liquidation-delay [value]", "Time to wait (seconds) after an agreement becoming critical before doing a liquidation (default: 0)")
    .option("--tx-timeout [value]", "Time to wait (seconds) before re-broadcasting a pending transaction with higher gas price (default: 60)")
    .option("--protocol-release-version [value]", "Superfluid Protocol Release Version (default: v1)")
    .option("--max-gas-price [value]", "Max gas price (wei) for liquidation transactions (default: 500000000000)")
    .option("-r, --retry-gas-multiplier [value]", "Gas price multiplier applied to pending transactions at every timeout until reaching the max gas price (default: 1.15")
    .option("-c, --clo-address [value]", "CLO Address (default: not set)")
    .action(function (args) {
        if(args.httpRpcNode !== undefined) {
            process.env.HTTP_RPC_NODE = args.httpRpcNode;
        }
        if(args.wsRpcNode !== undefined) {
            process.env.WS_RPC_NODE = args.wsRpcNode;
        }
        if(args.mnemonic !== undefined) {
            process.env.MNEMONIC = args.mnemonic;
        }
        if(args.privateKey !== undefined) {
            process.env.PRIVATE_KEY = args.privateKey;
        }
        if(args.maxQueryBlockRange !== undefined) {
            process.env.MAX_QUERY_BLOCK_RANGE = args.maxQueryBlockRange;
        }
        if(args.tokens !== undefined) {
            process.env.TOKENS = args.tokens;
        }
        if(args.dbPath !== undefined) {
            process.env.DB_PATH = args.dbPath;
        }
        if(args.additionalLiquidationDelay !== undefined) {
            process.env.ADDITIONAL_LIQUIDATION_DELAY = args.additionalLiquidationDelay;
        }
        if(args.txTimeout !== undefined) {
            process.env.TX_TIMEOUT = args.txTimeout;
        }
        if(args.protocolReleaseVersion !== undefined) {
            process.env.PROTOCOL_RELEASE_VERSION = args.protocolReleaseVersion;
        }
        if(args.maxGasPrice !== undefined) {
            process.env.MAX_GAS_PRICE = args.maxGasPrice;
        }
        if(args.retryGasMultiplier !== undefined) {
            process.env.RETRY_GAS_MULTIPLIER = args.retryGasMultiplier;
        }
        if(args.cloAddress !== undefined) {
            process.env.CLO_ADDR = args.cloAddress;
        }
    });
program.parse(process.argv);