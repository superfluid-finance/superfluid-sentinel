const fs = require('fs')
const axios = require('axios')
const zlib = require('zlib')

function sortString (a, b) {
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x === y ? 0 : x > y ? 1 : -1
}

function fileExist (path) {
  return fs.existsSync(path)
}

// TODO: implement retry or remove retries param
async function downloadFile (url, dest, retries = 3) {
  const writer = fs.createWriteStream(dest)
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  })
  response.data.pipe(writer)

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

function unzip (file) {
  const rd = fs.readFileSync(file)
  const data = zlib.gunzipSync(rd)
  fs.writeFileSync(`${file.slice(0, -3)}`, data)
  fs.unlinkSync(file)
}

module.exports = {
  sortString,
  fileExist,
  downloadFile,
  unzip
}
