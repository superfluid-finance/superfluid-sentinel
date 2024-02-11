const ganache = require("ganache-core");
const option = {
  locked: false,
  port: 8545,
  mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
  total_accounts: 10,
  blockTime: 5
};
const server = ganache.server();
server.listen(option, function (err, data) {
  if (err) {
    console.error(err);
  }
});

module.exports = server;
