const Web3 = require("web3");
const SDKConfig = require("@superfluid-finance/js-sdk/src/getConfig.js");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/contracts/SuperfluidGovernanceBase.json");
const BatchContract = require("@superfluid-finance/ethereum-contracts/build/contracts/BatchLiquidator.json");
const TogaContract = require("@superfluid-finance/ethereum-contracts/build/contracts/TOGA.json");
const { wad4human } = require("@decentral.ee/web3-helpers");

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
    this.isInitialized = false;
    this.totalRequests = 0;
    this.totalSkippedBlockRequests = 0;
  }

  async initialize () {
    try {
      if(!this.app.config.HTTP_RPC_NODE) throw new Error("No HTTP RPC set");
      const web3Provider = new Web3.providers.HttpProvider(this.app.config.HTTP_RPC_NODE, {
        keepAlive: true
      });
      this.web3 = new Web3(web3Provider);
      this.web3.eth.currentProvider.sendAsync = function (payload, callback) {
        return this.send(payload, callback);
      };
      this.isInitialized = true;
    } catch (err) {
      this.app.logger.error(err);
      throw new Error(`Client.initialize(): ${err}`);
    }
  }

  async init () {
    try {
      this.app.logger.info(`Web3Client start`);
      await this.initialize();
      this.app.logger.info(`ChainId: ${await this.getChainId()}`)
      await this._loadSuperfluidContracts();
      if (this.app.config.PRIVATE_KEY !== undefined) {
        this.app.logger.info("using provided private key");
        const account = this.web3.eth.accounts.privateKeyToAccount(this.app.config.PRIVATE_KEY);
        this.agentAccounts = {
          address: account.address,
          _privateKey: account.privateKey
        };
      } else if (this.app.config.MNEMONIC !== undefined) {
        this.app.logger.info("using provided mnemonic");
        this.agentAccounts = this.app.genAccounts(this.app.config.MNEMONIC, this.app.config.MNEMONIC_INDEX);
      } else if(this.app.config.OBSERVER) {
        this.app.logger.warn(`Configuration is set to be Observer.`);
      } else {
        throw Error("No account configured. Either PRIVATE_KEY or MNEMONIC needs to be set.");
      }
      if(!this.app.config.OBSERVER) {
        this.app.logger.info(`account: ${this.agentAccounts.address}`);
        const accBalance = await this.app.client.getAccountBalance();
        this.app.logger.info(`balance: ${wad4human(accBalance)}`);
        if (accBalance === "0") {
          this.app.logger.warn("!!!ACCOUNT NOT FUNDED!!!  Will fail to execute liquidations!");
        }
      }
      this.app.logger.info("Connecting to Node: HTTP");
      this.web3.eth.transactionConfirmationBlocks = 3;
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Client.init(): ${err}`);
    }
  }

  async loadBatchContract () {
    try {
      if (this.app.config.BATCH_CONTRACT !== undefined) {
        this.batch = new this.web3.eth.Contract(BatchContract.abi, this.app.config.BATCH_CONTRACT);
      } else {
        this.app.logger.info("Batch Contract not found");
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Client.loadBatchContract() : ${err}`);
    }
  }

  async loadTogaContract () {
    try {
      if (this.app.config.TOGA_CONTRACT !== undefined) {
        this.toga = new this.web3.eth.Contract(TogaContract.abi, this.app.config.TOGA_CONTRACT);
      } else {
        this.app.logger.info("TOGA Contract not found");
      }
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Client.loadTogaContract() : ${err}`);
    }
  }

  async _loadSuperfluidContracts () {
    try {
      let resolverAddress;
      if (this.app.config.RESOLVER !== undefined) {
        resolverAddress = this.app.config.RESOLVER;
      } else {
        resolverAddress = SDKConfig(await this.getChainId()).resolverAddress;
      }
      const superfluidIdent = `Superfluid.${this.version}`;
      this.resolver = new this.web3.eth.Contract(IResolver.abi,resolverAddress);
      const superfluidAddress = await this.resolver.methods.get(superfluidIdent).call();
      this.sf = new this.web3.eth.Contract(ISuperfluid.abi,superfluidAddress);
      const govAddress = await this.sf.methods.getGovernance().call();
      this.gov = new this.web3.eth.Contract(SuperfluidGovernance.abi, govAddress);
      const cfaIdent = this.web3.utils.sha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
      const idaIdent = this.web3.utils.sha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
      const [cfaAddress, idaAddress] = await Promise.all([this.sf.methods.getAgreementClass(cfaIdent).call(), this.sf.methods.getAgreementClass(idaIdent).call()]);
      this.CFAv1 = new this.web3.eth.Contract(ICFA.abi, cfaAddress);
      this.IDAv1 = new this.web3.eth.Contract(IIDA.abi, idaAddress);
      this.app.logger.info(`Resolver: ${resolverAddress}`);
      this.app.logger.info(`Superfluid: ${superfluidAddress}`);
      this.app.logger.info(`Superfluid Governance: ${govAddress}`);
      this.app.logger.info(`CFA address: ${cfaAddress}`);
      this.app.logger.info(`IDA address: ${idaAddress}`);
    } catch (err) {
      this.app.logger.error(err);
      throw Error(`Client._loadSuperfluidContracts(): ${err}`);
    }
  }

  async _loadSuperTokensFromDB () {
    try {
      let filter = {
        attributes: ["address"]
      };

      if (this.app.config.ONLY_LISTED_TOKENS === true) {
        filter = {
          attributes: ["address"],
          where: { listed: 1 }
        };
      }
      const superTokensDB = await this.app.db.models.SuperTokenModel.findAll(filter);
      const promises = superTokensDB.map(async (token) => {
        return this.loadSuperToken(token.address);
      });
      await Promise.all(promises);
    } catch (err) {
      this.app.logger.error(err);
      throw new Error(`Client._loadSuperTokensFromDB(): ${err}`);
    }
  }

  async loadSuperTokens (newSuperTokens) {
    try {
      await this._loadSuperTokensFromDB();
      const promises = newSuperTokens.map(async (token) => {
        return this.loadSuperToken(token);
      });
      await Promise.all(promises);
    } catch (err) {
      this.app.logger.error(err);
      throw new Error(`Client.loadSuperTokens(): ${err}`);
    }
  }

  async loadSuperToken (newSuperToken) {
    if (this.superTokens[newSuperToken.toLowerCase()] !== undefined) {
      return;
    }
    const superTokenHTTP = new this.web3.eth.Contract(ISuperToken.abi, newSuperToken);
    const [tokenName, tokenSymbol] = await Promise.all(
      [
        superTokenHTTP.methods.name().call(),
        superTokenHTTP.methods.symbol().call()
      ]
    );
    //TOOD: assuming default if not defined, remove when all networks are using 3Ps
    let liquidation_period = 14400;
    let patrician_period = 1800;
    try {
      //get liquidation period
      const resp = await this.gov.methods.getPPPConfig(this.sf._address, newSuperToken).call();
      liquidation_period = parseInt(resp.liquidationPeriod);
      patrician_period = parseInt(resp.patricianPeriod);
    } catch(err) {
      this.app.logger.error(`client.loadSuperToken(): ${err}`);
      this.app.logger.warn(`default to liquidation period to ${liquidation_period} and ${patrician_period}`);
    }
    superTokenHTTP.liquidation_period = liquidation_period;
    superTokenHTTP.patrician_period = patrician_period;
    const superTokenAddress = await this.resolver.methods.get(
      `supertokens.${this.version}.${tokenSymbol}`
    ).call();

    let isListed = superTokenAddress === newSuperToken;
    if (this.app.config.ONLY_LISTED_TOKENS === true && isListed) {
      const tokenInfo = `SuperToken (${tokenSymbol} - ${tokenName}): ${superTokenAddress}`;
      this.app.logger.info(tokenInfo);
      this.superTokenNames[newSuperToken.toLowerCase()] = tokenInfo;
      this.superTokens[superTokenAddress.toLowerCase()] = superTokenHTTP;
      this.superTokensAddresses.push(superTokenAddress.toLowerCase());
      isListed = 1;
    } else {
      const tokenInfo = `(${tokenSymbol} - ${tokenName}): ${newSuperToken}`;
      this.app.logger.info(tokenInfo);
      this.superTokenNames[newSuperToken.toLowerCase()] = tokenInfo;
      this.superTokens[newSuperToken.toLowerCase()] = superTokenHTTP;
      this.superTokensAddresses.push(newSuperToken.toLowerCase());
    }
    // persistence database
    await this.app.db.models.SuperTokenModel.upsert({
      address: newSuperToken,
      symbol: tokenSymbol,
      name: tokenName,
      liquidationPeriod: liquidation_period,
      patricianPeriod: patrician_period,
      listed: isListed
    });
  }

  isSuperTokenRegistered (token) {
    return this.superTokens[token.toLowerCase()] !== undefined;
  }

  async getChainId () {
    if (this.chainId === undefined) {
      this.chainId = await this.web3.eth.getChainId();
    }
    return this.chainId;
  }

  getAccountAddress () {
    if(this.agentAccounts !== undefined) {
      return this.agentAccounts.address;
    }
  }

  async getAccountBalance () {
    if(this.agentAccounts !== undefined) {
      return this.web3.eth.getBalance(this.agentAccounts.address);
    }
  }

  getAccount () {
    return this.agentAccounts;
  }

  async getCurrentBlockNumber (offset) {
    return (await this.web3.eth.getBlockNumber()) - offset;
  }

  async disconnect () {
    this.web3.currentProvider.disconnect();
  }

  async sendSignedTransaction (signed) {
    if (this._testMode === "TIMEOUT_ON_LOW_GAS_PRICE") {
      if (signed.tx.txObject.gasPrice <= this._testOption.minimumGas) {
        // eslint-disable-next-line promise/param-names
        const delay = ms => new Promise(res => setTimeout(res, ms));
        await delay(signed.tx.timeout * 2);
      } else {
        return this.web3.eth.sendSignedTransaction(signed.tx.rawTransaction);
      }
    } else {
      return this.web3.eth.sendSignedTransaction(signed.tx.rawTransaction);
    }
  }

  async signTransaction (unsignedTx, pk) {
    return this.web3.eth.accounts.signTransaction(
      unsignedTx,
      pk
    );
  }

  getSFAddresses () {
    const togaAddress = this.toga !== undefined ? this.toga._address : undefined;
    return [...this.superTokensAddresses, this.IDAv1._address, this.CFAv1._address, togaAddress].filter(n => n);
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
