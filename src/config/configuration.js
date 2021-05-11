require("dotenv").config();
class Config {

    constructor() {
        this.WS_NODE = process.env.WS_NODE;
        this.HTTP_NODE = process.env.HTTP_NODE;
        this.MNEMONIC = process.env.MNEMONIC;
        this.EPOCH_BLOCK = process.env.EPOCH_BLOCK | 0;
        this.DATA_DIR = process.env.DATA_DIR;
        this.DB_FILENAME = "db.sqlite";
        this.PROTOCOL_RELEASE_VERSION = process.env.PROTOCOL_RELEASE_VERSION;
        this.TIMEOUT_FN = process.env.TIMEOUT_FN;
        this.PULL_STEP = process.env.PULL_STEP | 10000;
        this.GAS_PRICE = process.env.GAS_PRICE;
        this.GAS_LIMIT = process.env.GAS_LIMIT;
    }
}

module.exports = Config;
