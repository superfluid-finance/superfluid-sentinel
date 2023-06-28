const Web3 = require("web3");
const IResolver = require("@superfluid-finance/ethereum-contracts/build/contracts/IResolver.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/contracts/IConstantFlowAgreementV1.json");
const IGDA = require("../abis/IGeneralDistributionAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/contracts/IInstantDistributionAgreementV1.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/contracts/SuperfluidGovernanceBase.json");
const BatchContract = require("../abis/BatchLiquidator.json");
const TogaContract = require("@superfluid-finance/ethereum-contracts/build/contracts/TOGA.json");
const { wad4human } = require("@decentral.ee/web3-helpers");
const BN = require("bn.js");

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
    this.isConnected = false;
    this.totalRequests = 0;
    this.totalSkippedBlockRequests = 0;
  }

  async connect () {
    try {
      this.app.logger.info(`Client connecting to RPC...`);
      if(!this.app.config.HTTP_RPC_NODE) throw new Error(`Client.connect(): no HTTP RPC set`);
      const web3Provider = new Web3.providers.HttpProvider(this.app.config.HTTP_RPC_NODE, {
        keepAlive: true
      });
      this.web3 = new Web3(web3Provider);
      this.web3.eth.currentProvider.sendAsync = function (payload, callback) {
        return this.send(payload, callback);
      };
      this.isConnected = true;
      this.app.logger.info(`Client connected to RPC`);
    } catch (err) {
      this.app.logger.error(err);
      throw new Error(`Client.initialize(): ${err}`);
    }
  }

  async init () {
    try {
      if(!this.isConnected) {
        throw Error(`Client.init(): not connected to rpc`);
      }
      this.app.logger.info(`Web3Client start`);
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
        this.app.logger.warn("Configuration is set to be Observer.");
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

      this.resolver = new this.web3.eth.Contract(IResolver.abi,this.app.config.RESOLVER);
      const superfluidAddress = await this.resolver.methods.get(`Superfluid.${this.version}`).call();
      this.sf = new this.web3.eth.Contract(ISuperfluid.abi,superfluidAddress);
      const govAddress = await this.sf.methods.getGovernance().call();
      this.gov = new this.web3.eth.Contract(SuperfluidGovernance.abi, govAddress);
      // Agreements
      const cfaIdent = this.web3.utils.sha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
      const gdaIdent = this.web3.utils.sha3("org.superfluid-finance.agreements.GeneralDistributionAgreement.v1");
      const idaIdent = this.web3.utils.sha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");
      const [cfaAddress, idaAddress, gdaAddress] = await Promise.all([
          this.sf.methods.getAgreementClass(cfaIdent).call(),
          this.sf.methods.getAgreementClass(idaIdent).call(),
          this.sf.methods.getAgreementClass(gdaIdent).call()
      ]);

      this.CFAv1 = new this.web3.eth.Contract(ICFA.abi, cfaAddress);
      this.IDAv1 = new this.web3.eth.Contract(IIDA.abi, idaAddress);
      this.GDAv1 = new this.web3.eth.Contract(IGDA.abi, gdaAddress);

      this.app.logger.info(`Resolver: ${this.app.config.RESOLVER}`);
      this.app.logger.info(`Superfluid: ${superfluidAddress}`);
      this.app.logger.info(`Superfluid Governance: ${govAddress}`);
      this.app.logger.info(`CFA address: ${cfaAddress}`);
      this.app.logger.info(`GDA address: ${gdaAddress}`);
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
      for(const token of superTokensDB) {
        await this.loadSuperToken(token.address);
      }
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

  async loadSuperToken (newSuperToken, setPIC=false) {
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

    //get liquidation period
    const resp = await this.gov.methods.getPPPConfig(this.sf._address, newSuperToken).call();
    // if liquidation period and patrician period are not set
    if (resp.liquidationPeriod === "0" && resp.patricianPeriod === "0") {
      this.app.logger.error(`Liquidation period and patrician period are 0 for ${tokenSymbol} - ${tokenName} (${newSuperToken})`);
    }
    superTokenHTTP.liquidation_period = parseInt(resp.liquidationPeriod);
    superTokenHTTP.patrician_period = parseInt(resp.patricianPeriod);
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
      liquidationPeriod: parseInt(resp.liquidationPeriod),
      patricianPeriod: parseInt(resp.patricianPeriod),
      listed: isListed
    });
    // use for runtime subscription
    if(setPIC) {
      this.app.protocol.calculateAndSaveTokenDelay(newSuperToken, false);
    }
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

    async isAccountBalanceBelowMinimum () {
        const balance = await this.getAccountBalance();
        return {
          isBelow: new BN(balance).lt(new BN(this.app.config.SENTINEL_BALANCE_THRESHOLD)),
          balance: balance
        };
    }

  getAccount () {
    return this.agentAccounts;
  }

  async getCurrentBlockNumber (offset = 0) {
    return (await this.web3.eth.getBlockNumber()) - offset;
  }

  async disconnect () {
    this.web3.currentProvider.disconnect();
  }

  async sendSignedTransaction (signed) {
    const gasPrice = signed.tx.txObject.gasPrice;
    const gasLimit = signed.tx.txObject.gasLimit;

    if (this._testMode === "TIMEOUT_ON_LOW_GAS_PRICE" && gasPrice <= this._testOption.minimumGas) {
      await new Promise(resolve => setTimeout(resolve, signed.tx.timeout * 2));
    } else if (this._testMode === "REVERT_ON_BLOCK_GAS_LIMIT" && gasLimit > this._testOption.blockGasLimit) {
      throw new Error("block gas limit");
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
