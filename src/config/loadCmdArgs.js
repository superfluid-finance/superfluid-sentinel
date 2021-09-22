require("dotenv").config();
const program = require("commander");
const package = require("../../package.json");
program.version(package.version);
program
    .description("Superfluid Community Agent")
    .option("-h, --http-eth-node [value]", "HTTP ETH Node URL")
    .option("-w, --ws-eth-node [value]", "WebSocket ETH Node URL")
    .option("-p, --private-key [value]","Node Private Key")
    .option("-m, --mnemonic [value]","Node Wallet Mnemonic")
    .option("-mb, --max-query-block-range [value]", "max query block range")
    .option("-t, --tokens [value]", "Addresses of SuperToken agent should perform liquidation")
    .option("-d, --path-db [value]", "Directory and DB to save/load agent information")
    .option("-d, --additional-liquidation-delay [value]", "addition liquidaton delay in seconds")
    .option("-to, --tx-timeout [value]", "Network to run")
    .option("-p, --protocol-release-version [value]", "Protocol Release Version")
    .option("-g, --max-gas-price [value]", "Max gas price for a liquidation")
    .option("-r, --retry-gas-multiplier [value]", "Retry Gas Multiplier")
    .option("-a, --clo-address [value]", "CLO Address")
    .action(function (args) {
        if(args.httpEthNode !== undefined) {
            process.env.HTTP_RPC_NODE = args.httpEthNode;
        }
        if(args.wsEthNode !== undefined) {
            process.env.WS_RPC_NODE = args.wsEthNode;
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
        if(args.pathDb !== undefined) {
            process.env.PATH_DB = args.pathDb;
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