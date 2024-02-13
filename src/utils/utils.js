const fs = require("fs");
const axios = require("axios");
const zlib = require("zlib");

function sortString (a, b) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x === y ? 0 : x > y ? 1 : -1;
}

function fileExist (path) {
  return fs.existsSync(path);
}

async function downloadFile (url, dest, retries = 3) {
  const writer = fs.createWriteStream(dest);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream"
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      break;
    } catch (error) {
      if (i === retries - 1) {
        throw new Error(`Failed to download file from ${url} to ${dest} after ${retries} attempts`);
      }
    }
  }
}

function unzip (file) {
  const rd = fs.readFileSync(file);
  const data = zlib.gunzipSync(rd);
  fs.writeFileSync(`${file.slice(0, -3)}`, data);
  fs.unlinkSync(file);
}

module.exports = {
  sortString,
  fileExist,
  downloadFile,
  unzip
};
