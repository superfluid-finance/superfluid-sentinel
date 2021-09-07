require("dotenv").config();
const program = require("commander");
const package = require("../../package.json");
program.version(package.version);
program
    .description("Superfluid Community Agent")
    .option("-h, --http-eth-node [value]", "HTTP ETH Node URL")
    .option("-w, --ws-eth-node [value]", "WebSocket ETH Node URL")
    .option("-m, --mnemonic [value]","Node Wallet Mnemonic")
    .option("-p, --private-key [value]","Node Private Key")
    .option("-n, --token [value]", "Addresses of SuperToken agent should perform liquidation")
    .option("-d, --path-db [value]", "Directory and DB to save/load agent information")
    .option("-c, --chain-id [value]", "Network to run")
    .option("-l, --liquidation-delay [value]", "delay liquidaton in seconds")
    .option("-c, --chain-id [value]", "Network to run")
    .option("-c, --chain-id [value]", "Network to run")
    .option("-c, --chain-id [value]", "Network to run")
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
        if(args.tokens !== undefined) {
            process.env.TOKENS = args.tokens;
        }
        if(args.pathDb !== undefined) {
            process.env.PATH_DB = args.pathDb;
        }
        if(args.chainId !== undefined) {
            process.env.CHAIN_ID = args.chainId;
        }
    });
program.parse(process.argv);