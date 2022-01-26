const bip39 = require("bip39");
const { hdkey } = require("ethereumjs-wallet");
const fs = require("fs");
const path = require('path')
const axios = require("axios")
const zlib = require("zlib");

function generateAccounts (mnemonic, accountIndex) {
  const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeedSync(mnemonic));
  const hdpath = "m/44'/60'/0'/0/";
  const wallet = hdwallet.derivePath(hdpath + accountIndex).getWallet();
  return {
    address: wallet.getAddressString(),
    _privateKey: wallet.privateKey
  };
}

function sortString (a, b) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y ? 0 : x > y ? 1 : -1;
}

function fileExist(path) {
  return fs.existsSync(path);
}

async function downloadFile(url, dest, retries=3) {
  const writer = fs.createWriteStream(dest);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })

}

function unzip(file) {
  const rd = fs.readFileSync(file);
  const data = zlib.gunzipSync(rd);
  fs.writeFileSync(`${file.slice(0, -3)}`, data);
  fs.unlinkSync(file);
}

module.exports = {
  generateAccounts,
  sortString,
  fileExist,
  downloadFile,
  unzip
};
