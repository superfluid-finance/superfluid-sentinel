require("dotenv").config();
class Config {

    constructor() {
        this.WS_NODE = process.env.WS_NODE;
        this.HTTP_NODE = process.env.HTTP_NODE;
        this.MNEMONIC = process.env.MNEMONIC;
        this.EPOCH_BLOCK = process.env.EPOCH_BLOCK | 0;
        this.DB = process.env.DB | "database.sqlite";
        this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION;
        this.TIMEOUT_FN = process.env.TIMEOUT_FN | 60000;
        this.PULL_STEP = process.env.PULL_STEP | 10000;
        this.GAS_PRICE = process.env.GAS_PRICE;
        this.GAS_LIMIT = process.env.GAS_LIMIT;
        this.CONCURRENCY = process.env.CONCURRENCY !== undefined ? process.env.CONCURRENCY : 1;
        this.COLD_BOOT = process.env.COLD_BOOT == 1 ? true : false;
        this.LISTEN_MODE = process.env.LISTEN_MODE;
    }
}

module.exports = Config;
