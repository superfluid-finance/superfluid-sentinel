const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");
const BN = require("bn.js");

/**
 * AccountManager is responsible for managing Ethereum accounts, allowing the addition
 * and management of accounts based on private keys or mnemonics. It requires a web3
 * instance to interact with the EVM blockchain
 */
class AccountManager {
  /**
     * Creates an instance of AccountManager
     * @param {Object} web3Instance An instance of Web3
     * @throws {Error} If the web3 instance is not provided
     */
  constructor (web3Instance) {
    if (!web3Instance) throw new Error("AccountManager: web3 is not defined");
    this.web3 = web3Instance;
    this.accounts = [];
  }

  /**
     * Adds an account from a mnemonic
     * @param {string} mnemonic The mnemonic phrase
     * @param {number} [index=0] The index of the account to derive from the mnemonic
     * @throws {Error} If the mnemonic is invalid or the index is negative
     */
  addAccountFromMnemonic (mnemonic, index = 0) {
    if (typeof mnemonic !== "string" || !bip39.validateMnemonic(mnemonic)) {
      throw new Error("AccountManager: invalid mnemonic");
    }
    if (typeof index !== "number" || index < 0) {
      throw new Error("AccountManager: invalid index");
    }

    const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic));
    const hdpath = "m/44'/60'/0'/0/";
    const wallet = hdwallet.derivePath(hdpath + index).getWallet();
    this.addAccountFromPrivateKey(wallet.getPrivateKeyString());
  }

  /**
     * Adds an account from a private key
     * @param {string} privateKey The private key for the account
     * @throws {Error} If the account already exists
     */
  addAccountFromPrivateKey (privateKey) {
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }

    const newAccount = this.web3.eth.accounts.privateKeyToAccount(privateKey);
    if (this.accounts.find(account => account.address === newAccount.address)) {
      throw new Error("AccountManager: account already exists : " + newAccount.address);
    }
    this.accounts.push({
      address: newAccount.address,
      signTransaction: (txParams) => newAccount.signTransaction(txParams),
      txCount: (dataFormat) => this.web3.eth.getTransactionCount(newAccount.address, undefined, dataFormat)
    });
  }

  /**
     * Retrieves an account by index
     * @param {number} [index=0] The index of the account
     * @returns {Object} The account object
     * @throws {Error} If the account does not exist
     */
  getAccount (index = 0) {
    if (!this.accounts[index]) {
      throw new Error("AccountManager: account does not exist");
    }
    return this.accounts[index];
  }

  /**
     * Retrieves an account's address by index
     * @param {number} [index=0] The index of the account
     * @returns {string} The account's address
     */
  getAccountAddress (index = 0) {
    return this.getAccount(index).address;
  }

  /**
     * Finds an account by its address
     * @param {string} address The address of the account
     * @returns {Object|undefined} The account object or undefined if not found
     */
  getAccountFromAddress (address) {
    return this.accounts.find(account => account.address === address);
  }

  /**
     * Gets the index of an account by its address
     * @param {string} address The address of the account
     * @returns {number} The index of the account or throws an error if not found
     * @throws {Error} If the account does not exist
     */
  getAccountIndex (address) {
    const account = this.getAccountFromAddress(address);
    if (!account) {
      throw new Error("AccountManager: account does not exist");
    }
    return this.accounts.indexOf(account);
  }

  /**
     * Retrieves the balance of an account by index
     * @param {number} [index=0] The index of the account
     * @returns {Promise<string>} The balance of the account as a promise
     * @throws {Error} If the account does not exist
     */
  async getAccountBalance (index = 0) {
    if (!this.accounts[index]) {
      throw new Error("AccountManager: account does not exist");
    }
    return this.web3.eth.getBalance(this.accounts[index].address);
  }

  /**
     * Checks if an account's balance is below a given threshold
     * @param {number} [index=0] The index of the account
     * @param {BN} threshold The threshold to compare against
     * @returns {Promise<{isBelow: boolean, balance: BN}>} Object containing whether the balance is below the threshold and the current balance
     * @throws {Error} If the account does not exist or if the threshold is not a BN instance
     */
  async isAccountBalanceBelowMinimum (index = 0, threshold) {
    if (!this.accounts[index]) {
      throw new Error("AccountManager: account does not exist");
    }
    if (!BN.isBN(threshold)) {
      throw new Error("AccountManager: invalid threshold");
    }

    const balance = new BN(await this.getAccountBalance(index));
    return {
      isBelow: balance.lt(threshold),
      balance
    };
  }

  /**
     * Retrieves the transaction count for an account by index
     * @param {number} [index=0] The index of the account
     * @returns {Promise<number>} The number of transactions sent from the account
     * @throws {Error} If the account does not exist
     */
  async getTransactionCount (index = 0) {
    if (!this.accounts[index]) {
      throw new Error("AccountManager: account does not exist");
    }
    return this.web3.eth.getTransactionCount(this.accounts[index].address);
  }
}

module.exports = AccountManager;
