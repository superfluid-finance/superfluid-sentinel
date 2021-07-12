const ganache = require("ganache-core");
const option = {
    locked: false,
    port:8545,
    mnemonic: "clutch mutual favorite scrap flag rifle tone brown forget verify galaxy return",
    total_accounts: 100
}
const server = ganache.server();
const port = 8546;
server.listen(option, function(err, data) {
    if(err) {
        console.error(err);
    }
});

module.exports = server;