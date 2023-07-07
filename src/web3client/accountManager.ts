import { ethers, HDNodeWallet, Wallet } from "ethers";

interface App {
    provider: ethers.Provider;
}

/*
    WalletManager is responsible for managing multi Wallets based on private key or mnemonic
*/
class WalletManager {
    private app: App;
    private wallets: Wallet[];

    constructor(app: App) {
        if (!app) throw new Error("WalletManager: app is not defined");
        this.app = app;
        this.wallets = [];
    }

    // add Wallet from mnemonic
    addWalletFromMnemonic(mnemonic: string, index: number = 0): void {
        if (index < 0) {
            throw new Error("WalletManager: invalid index");
        }
        const hdNodeWallet = HDNodeWallet.fromPhrase(mnemonic, "" , `m/44'/60'/0'/0/${index}`);
        this.wallets.push(new ethers.Wallet(hdNodeWallet.privateKey, this.app.provider));
    }

    // add Wallet from private key
    addWalletFromPrivateKey(privateKey: string): void {
        const wallet = new ethers.Wallet(privateKey, this.app.provider);
        this.wallets.push(wallet);
    }

    getWallet(walletIndex: number = 0): Wallet {
        if (!this.wallets[walletIndex]) {
            throw new Error("WalletManager: Wallet does not exist");
        }
        return this.wallets[walletIndex];
    }

    getWalletAddress(walletIndex: number = 0): string {
        return this.getWallet(walletIndex).address;
    }

    getWalletFromAddress(walletAddress: string): Wallet | undefined {
        return this.wallets.find(wallet => wallet.address === walletAddress);
    }

    // get index from address
    getWalletIndex(address: string): number {
        const wallet = this.getWalletFromAddress(address);
        if (!wallet) {
            throw new Error("WalletManager: wallet does not exist");
        }
        return this.wallets.indexOf(wallet);
    }

    async getWalletBalance(walletIndex: number = 0): Promise<bigint> {
        if (!this.wallets[walletIndex]) {
            throw new Error("WalletManager: wallet does not exist");
        }
        return this.app.provider.getBalance(this.wallets[walletIndex].address);
    }

    async isWalletBalanceBelowMinimum(walletIndex: number = 0, threshold: bigint): Promise<{isBelow: boolean, balance: bigint}> {
        if (!this.wallets[walletIndex]) {
            throw new Error("WalletManager: Wallet does not exist");
        }
        const balance = await this.getWalletBalance(walletIndex);
        return {
            isBelow: balance < threshold,
            balance: balance,
        };
    }
}

export default WalletManager;
