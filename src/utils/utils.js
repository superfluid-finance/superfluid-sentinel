const fs = require("fs");
const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");

function getTimeUnix() {
    return Math.floor(new Date().getTime() / 1000);
}

function getNextMonthUnix() {
    return Math.floor(getTimeUnix() + (3600 * 24 * 30));
}

async function checkOrCreate(dirname) {
    fs.promises.mkdir(dirname, { recursive: true });
}

function generateAccounts(mnemonic, accountIndex) {
    const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic));
    const hdpath = "m/44'/60'/0'/0/";
    const wallet =  hdwallet.derivePath(hdpath + accountIndex).getWallet();
    return { address: wallet.getAddressString(), _privateKey: wallet.privateKey };
}


function sortString(a, b) {
    let x = a.toLowerCase(),
        y = b.toLowerCase();
    return x == y ? 0 : x > y ? 1 : -1;
}



module.exports = {
    getTimeUnix,
    getNextMonthUnix,
    checkOrCreate,
    generateAccounts,
    sortString
};
