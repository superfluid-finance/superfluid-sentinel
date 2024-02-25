const { hdkey } = require("ethereumjs-wallet");
const bip39 = require("bip39");
const BN = require("bn.js");

/*
    AccountManager is responsible for managing multi accounts based on private key or mnemonic
*/

class AccountManager {
    constructor(web3Instance) {

        if (!web3Instance) throw new Error("AccountManager: web3 is not defined");

        this.web3 = web3Instance;
        this.accounts = [];
    }
    // add account from mnemonic
    addAccountFromMnemonic(mnemonic, index = 0) {
        if (typeof mnemonic !== 'string' || !bip39.validateMnemonic(mnemonic)) {
            throw new Error("AccountManager: invalid mnemonic");
        }
        if (typeof index !== 'number' || index < 0) {
            throw new Error("AccountManager: invalid index");
        }

        const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic));
        const hdpath = "m/44'/60'/0'/0/";
        const wallet = hdwallet.derivePath(hdpath + index).getWallet();
        this.addAccountFromPrivateKey(wallet.getPrivateKeyString())
    }

    // add account from private key
    addAccountFromPrivateKey(privateKey) {

        // add "0x" prefix if not exists to private key if not exists
        if (!privateKey.startsWith("0x")) {
            privateKey = "0x" + privateKey;
        }

        const newAccount = this.web3.eth.accounts.privateKeyToAccount(privateKey);
        // reject if account already exists
        if (this.accounts.find(account => account.address === newAccount.address)) {
            throw new Error("AccountManager: account already exists : " + newAccount.address);
        }
        this.accounts.push({
            address: newAccount.address,
            signTransaction: (txParams) => newAccount.signTransaction(txParams),
            txCount: (dataFormat) => this.web3.eth.getTransactionCount(newAccount.address, undefined, dataFormat)
        });
    }

    getAccount(index = 0) {
        if (!this.accounts[index]) {
            throw new Error("AccountManager: account does not exist");
        }

        return this.accounts[index];
    }

    getAccountAddress(index = 0) {
        return this.getAccount(index).address;
    }

    getAccountFromAddress(address) {
        return this.accounts.find(account => account.address === address);
    }

    // get index from address
    getAccountIndex(address) {
        const account = this.getAccountFromAddress(address);
        if (!account) {
            throw new Error("AccountManager: account does not exist");
        }

        return this.accounts.indexOf(account);
    }

    async getAccountBalance(index = 0) {

        if (!this.accounts[index]) {
            throw new Error("AccountManager: account does not exist");
        }

        return this.web3.eth.getBalance(this.accounts[index].address);

    }

    async isAccountBalanceBelowMinimum(index = 0, threshold) {
        console.log("isAccountBalanceBelowMinimum index: ", index, " threshold: ", threshold);
        if (!this.accounts[index]) {
            throw new Error("AccountManager: account does not exist");
        }
        const thresholdBN = new BN(threshold);

        const balance = new BN(await this.getAccountBalance(index));
        return {
            isBelow: balance.lt(thresholdBN),
            balance: balance
        };
    }

    async getTransactionCount(index = 0) {
        if (!this.accounts[index]) {
            throw new Error("AccountManager: account does not exist");
        }

        return this.web3.eth.getTransactionCount(this.accounts[index].address);
    }
}

module.exports = AccountManager;
