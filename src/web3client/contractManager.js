const IResolver = require("@superfluid-finance/ethereum-contracts/build/truffle/IResolver.json");
const ISuperfluid = require("@superfluid-finance/ethereum-contracts/build/truffle/ISuperfluid.json");
const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/truffle/ISuperToken.json");
const SuperfluidGovernance = require("@superfluid-finance/ethereum-contracts/build/truffle/SuperfluidGovernanceBase.json");
const ICFA = require("@superfluid-finance/ethereum-contracts/build/truffle/IConstantFlowAgreementV1.json");
const IGDA = require("@superfluid-finance/ethereum-contracts/build/truffle/IGeneralDistributionAgreementV1.json");
const IIDA = require("@superfluid-finance/ethereum-contracts/build/truffle/IInstantDistributionAgreementV1.json");
const BatchContract = require("@superfluid-finance/ethereum-contracts/build/truffle/BatchLiquidator.json");
const TogaContract = require("@superfluid-finance/ethereum-contracts/build/truffle/TOGA.json");

/**
 * The Contracts class initializes and provides access to all the Superfluid-related contracts
 * needed for the Sentinel to interact with the Superfluid protocol. It includes methods for
 * initializing these contracts and fetching their instances
 */
class ContractManager {
  /**
     * Constructs a new Contracts instance.
     * @param {Object} app The application context, providing access to various services and configurations
     * @throws {Error} If the application context is not provided.
     */
  constructor (app) {
    if (!app) throw new Error("Contracts: app is not defined");

    this.app = app;
    // signal that the contracts have not been loaded yet
    this.initialized = false;
  }

  /**
     * Initializes all necessary Superfluid contracts
     * This method ensures that the contract instances are ready for use by the rest of the application
     */
  async initialize () {
    if (this.initialized) return;
    this.app.logger.info("Contracts: Initializing contracts...");
    await this._loadResolverContract(this.app.config.RESOLVER);
    const superfluidAddress = await this.resolver.methods.get(`Superfluid.${this.app.config.PROTOCOL_RELEASE_VERSION}`).call();
    await this._loadSuperfluidContract(superfluidAddress);

    const governanceAddress = await this.sf.methods.getGovernance().call();
    await this._loadSuperfluidGovernanceContract(governanceAddress);

    const cfaHashID = this.app.client.soliditySha3("org.superfluid-finance.agreements.ConstantFlowAgreement.v1");
    const gdaHashID = this.app.client.soliditySha3("org.superfluid-finance.agreements.GeneralDistributionAgreement.v1");
    const idaHashID = this.app.client.soliditySha3("org.superfluid-finance.agreements.InstantDistributionAgreement.v1");

    const cfaAddress = await this.sf.methods.getAgreementClass(cfaHashID).call();
    const idaAddress = await this.sf.methods.getAgreementClass(idaHashID).call();
    // sentinel will continue without GDA if it is not found
    let gdaAddress;
    try {
      gdaAddress = await this.sf.methods.getAgreementClass(gdaHashID).call();
    } catch (err) {
      this.app.logger.warn("Contracts: GDA contract not found, sentinel will continue without it");
    }

    await this._loadAgreementContracts(cfaAddress, idaAddress, gdaAddress);
    // depending on the network/configuration we are using, we might not have a batch contract or a toga contract
    await this._loadBatchContract(this.app.config.BATCH_CONTRACT);
    await this._loadTogaContract(this.app.config.TOGA_CONTRACT);
    this.initialized = true;

    this.app.logger.info("Contracts: Contracts initialized");
  }

  /**
     * Retrieves an instance of a SuperToken contract, including its name and symbol
     * @param {string} superTokenAddress The smart contract address of the SuperToken
     * @returns {Object} An object containing the SuperToken contract instance, token name, and token symbol
     */
  async getSuperTokenInstance (superTokenAddress) {
    const superToken = this.app.client.RPCClient.getContract(ISuperToken.abi, superTokenAddress);
    const [tokenName, tokenSymbol] = await Promise.all(
      [
        superToken.methods.name().call(),
        superToken.methods.symbol().call()
      ]
    );
    return { superToken, tokenName, tokenSymbol };
  }

  /**
     * Returns an array of addresses for the agreement contracts (CFA, IDA, GDA) loaded by the manager
     * @returns {Array<string>} An array containing the addresses of the CFA, IDA, and GDA contracts
     */
  getAgreementsAddresses () {
    return [this.CFAv1.options.address, this.IDAv1.options.address, this.GDAv1.options.address];
  }

  /**
     * Returns the address of the TOGA contract if it has been loaded
     * @returns {string|undefined} The address of the TOGA contract or undefined if not loaded
     */
  getTogaAddress () {
    if (this.toga) {
      return this.toga.options.address;
    }
  }

  /**
     * Returns the address of the CFAv1 contract
     * @returns {string|undefined} The address of the CFAv1 contract or undefined if not loaded
     */
  getCFAv1Address () {
    if (this.CFAv1) {
      return this.CFAv1.options.address;
    }
  }

  /**
     * Returns the address of the IDAv1 contract
     * @returns {string|undefined} The address of the IDAv1 contract or undefined if not loaded
     */
  getIDAv1Address () {
    if (this.IDAv1) {
      return this.IDAv1.options.address;
    }
  }

  /**
     * Returns the address of the GDAv1 contract
     * @returns {string|undefined} The address of the GDAv1 contract or undefined if not loaded
     */
  getGDAv1Address () {
    if (this.GDAv1) {
      return this.GDAv1.options.address;
    }
  }

  /**
     * Returns the address of the Batch contract
     * @returns {string|undefined} The address of the Batch contract or undefined if not loaded
     */
  getBatchAddress () {
    if (this.batch) {
      return this.batch.options.address;
    }
  }

  /**
     * Returns the address of the Superfluid contract
     * @returns {string|undefined} The address of the Superfluid contract or undefined if not loaded
     */
  getSuperfluidAddress () {
    if (this.sf) {
      return this.sf.options.address;
    }
  }

  /**
     * Loads the Resolver contract instance from the blockchain
     * @param {string} resolverAddress The smart contract address of the Resolver contract
     * @private
     */
  async _loadResolverContract (resolverAddress) {
    try {
      this.resolver = this.app.client.RPCClient.getContract(IResolver.abi, resolverAddress);
    } catch (err) {
      this.app.logger.error("Contracts: Error loading resolver contract");
      throw err;
    }
  }

  /**
     * Loads the Superfluid contract instance from the blockchain
     * @param {string} superfluidAddress The smart contract address of the Superfluid contract
     * @private
     */
  async _loadSuperfluidContract (superfluidAddress) {
    try {
      this.sf = this.app.client.RPCClient.getContract(ISuperfluid.abi, superfluidAddress);
      this.app.logger.info("Contracts: loaded superfluid contract at address: " + superfluidAddress);
    } catch (err) {
      this.app.logger.error("Contracts: Error loading superfluid contract");
      throw err;
    }
  }

  /**
     * Loads the Governance contract instance from the blockchain
     * @param {string} governanceAddress The smart contract address of the Governance contract
     * @private
     */
  async _loadSuperfluidGovernanceContract (governanceAddress) {
    try {
      this.gov = this.app.client.RPCClient.getContract(SuperfluidGovernance.abi, governanceAddress);
      this.app.logger.info("Contracts: loaded governance contract at address: " + governanceAddress);
    } catch (err) {
      this.app.logger.error("Contracts: Error loading superfluid governance contract");
      throw err;
    }
  }

  /**
     * Loads the agreement contracts (CFA, IDA, GDA) from the blockchain
     * @param {string} cfaAddress The smart contract address of the CFA contract
     * @param {string} idaAddress The smart contract address of the IDA contract
     * @param {string} gdaAddress The smart contract address of the GDA contract
     * @private
     */
  async _loadAgreementContracts (cfaAddress, idaAddress, gdaAddress) {
    try {
      this.CFAv1 = this.app.client.RPCClient.getContract(ICFA.abi, cfaAddress);
      this.IDAv1 = this.app.client.RPCClient.getContract(IIDA.abi, idaAddress);
      this.GDAv1 = this.app.client.RPCClient.getContract(IGDA.abi, gdaAddress);
      this.app.logger.info("Contracts: loaded agreements contracts");
      this.app.logger.info(`CFA at address: ${cfaAddress} | IDA at address: ${idaAddress} | GDA at address: ${gdaAddress}`);
    } catch (err) {
      this.app.logger.error("Contracts: Error loading agreement contracts");
      throw err;
    }
  }

  /**
     * Loads the Batch contract instance from the blockchain
     * @param {string} batchAddress The smart contract address of the Batch contract
     * @private
     */
  async _loadBatchContract (batchAddress) {
    try {
      if (batchAddress !== undefined) {
        this.batch = this.app.client.RPCClient.getContract(BatchContract.abi, batchAddress);
        this.app.logger.info("Contracts: loaded batch contract at address: " + batchAddress);
      } else {
        this.app.logger.info("Contracts: Batch Contract not found");
      }
    } catch (err) {
      this.app.logger.error("Contracts: Error loading batch contract");
      throw err;
    }
  }

  /**
     * Loads the TOGA contract instance from the blockchain
     * @param {string} togaAddress The smart contract address of the TOGA contract
     * @private
     */
  async _loadTogaContract (togaAddress) {
    try {
      if (togaAddress !== undefined) {
        this.toga = this.app.client.RPCClient.getContract(TogaContract.abi, togaAddress);
        this.app.logger.info("Contracts: loaded toga contract at address: " + togaAddress);
      } else {
        this.app.logger.info("Contracts: TOGA Contract not found");
      }
    } catch (err) {
      this.app.logger.error("Contracts: Error loading toga contract");
      throw err;
    }
  }
}

module.exports = ContractManager;
