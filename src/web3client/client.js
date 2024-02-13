const { wad4human } = require("@decentral.ee/web3-helpers");

const AccountManager = require("./accountManager");
const RPCClient = require("./rpcClient");
const TestRPCClient = require("../test/testRPCClient");
const ContractManager = require("./contractManager");
const SuperTokenManager = require("./superTokenManager");

const { FMT_NUMBER } = require("web3");
const dataFormat = {
  number: FMT_NUMBER.NUMBER
};

/*
 *   Web3 and superfluid client:
 * - Create web3 connections
 * - Load superfluid contracts
 */
class Client {
  constructor (app) {
    this.app = app;
    this.superTokenNames = new Map();
    this.superTokens = new Map();
    this.superTokensAddresses = [];
    this.version = this.app.config.PROTOCOL_RELEASE_VERSION;
    this.totalRequests = 0;
    this.totalSkippedBlockRequests = 0;
  }

  // having to connect() before init() is a bit weird
  async connect () {
    try {
      if (this.app.config.RUN_TEST_ENV) {
        this.app.logger.info("Running in test environment");
        this.RPCClient = new TestRPCClient(this.app, this.app.web3);
      }
      this.RPCClient = new RPCClient(this.app);
      await this.RPCClient.connect();
      this.accountManager = new AccountManager(this.RPCClient.web3);

      // we need web3 instance for contract loader
      this.contracts = new ContractManager(this.app);
    } catch (err) {
      this.app.logger.error(err);
      throw new Error(`Client.RPC.connect(): ${err}`);
    }
  }

  async init () {
    try {
      this.app.logger.info("Web3Client start");
      if (!this.RPCClient.isConnected) {
        throw Error("Client.init(): not connected to rpc");
      }

      this.app.logger.info(`ChainId: ${await this.RPCClient.getChainId()}`);

      // Load contracts
      await this.contracts.initialize();

      this.superToken = new SuperTokenManager(this.app);

      // Account Manager - Load account
      if (this.app.config.PRIVATE_KEY !== undefined) {
        this.accountManager.addAccountFromPrivateKey(this.app.config.PRIVATE_KEY);
      } else if (this.app.config.MNEMONIC !== undefined) {
        this.accountManager.addAccountFromMnemonic(this.app.config.MNEMONIC, Number(this.app.config.MNEMONIC_INDEX));
      } else if (this.app.config.OBSERVER) {
        this.app.logger.warn("Configuration is set to be Observer.");
      } else {
        throw Error("No account configured. Either PRIVATE_KEY or MNEMONIC needs to be set.");
      }

      if (!this.app.config.OBSERVER) {
        // get first account from manager
        this.app.logger.info(`account: ${this.accountManager.getAccountAddress(0)}`);
        const accBalance = await this.accountManager.getAccountBalance(0);
        this.app.logger.info(`balance: ${wad4human(accBalance)}`);
        if (accBalance === "0") {
          this.app.logger.warn("!!!ACCOUNT NOT FUNDED!!!  Will fail to execute liquidations!");
        }
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Client.init(): ${err}`);
    }
  }

  async getChainId () {
    if (this.chainId === undefined) {
      this.chainId = Number(await this.RPCClient.web3.eth.getChainId());
    }
    return this.chainId;
  }

  // legacy
  getAccountAddress () {
    return this.accountManager.getAccountAddress(0);
  }

  async getAccountBalance () {
    return this.accountManager.getAccountBalance(0);
  }

  async isAccountBalanceBelowMinimum () {
    return this.accountManager.isAccountBalanceBelowMinimum(0, this.app.config.SENTINEL_BALANCE_THRESHOLD);
  }

  getAccount () {
    return this.accountManager.getAccount(0);
  }

  async getCurrentBlockNumber (offset = 0) {
    const blockNumber = await this.RPCClient.web3.eth.getBlockNumber();
    return Number(blockNumber) - offset;
  }

  async disconnect () {
    this.RPCClient.web3.currentProvider.disconnect();
  }

  async sendSignedTransaction (signedTransactionWithContext) {
    const gasPrice = signedTransactionWithContext.gasPrice;
    const gasLimit = signedTransactionWithContext.gasLimit;

    if (this._testMode === "TIMEOUT_ON_LOW_GAS_PRICE" && gasPrice <= this._testOption.minimumGas) {
      await new Promise(resolve => setTimeout(resolve, signedTransactionWithContext.timeout * 2));
    } else if (this._testMode === "REVERT_ON_BLOCK_GAS_LIMIT" && gasLimit > this._testOption.blockGasLimit) {
      throw new Error("block gas limit");
    } else {
      return this.RPCClient.web3.eth.sendSignedTransaction(signedTransactionWithContext.signed.rawTransaction, dataFormat);
    }
  }

  async signTransaction (unsignedTx, pk) {
    return this.RPCClient.web3.eth.accounts.signTransaction(
      unsignedTx,
      pk
    );
  }

  toChecksumAddress (address) {
    return this.RPCClient.web3.utils.toChecksumAddress(address);
  }

  soliditySha3 (...args) {
    return this.RPCClient.web3.utils.soliditySha3(...args);
  }

  getSFAddresses () {
    const agreementsAddresses = this.contracts.getAgreementsAddresses();
    const togaAddress = this.contracts.getTogaAddress();
    return [...this.superToken.superTokensAddresses, ...agreementsAddresses, togaAddress].filter(n => n);
  }

  getTotalRequests () {
    return this.totalRequests;
  }

  addTotalRequest (numReqs = 1) {
    this.totalRequests = this.totalRequests + numReqs;
  }

  addSkipBlockRequest (numReqs = 1) {
    this.totalSkippedBlockRequests = this.totalSkippedBlockRequests + numReqs;
  }

  setTestFlag (flag, options) {
    this._testMode = flag;
    this._testOption = options;
  }
}

module.exports = Client;
