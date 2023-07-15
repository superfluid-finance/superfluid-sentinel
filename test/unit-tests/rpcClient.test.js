const sinon = require("sinon");
const { expect } = require("chai");
const RPCClient = require("../../src/web3client/RPCClient");
const Web3 = require("web3");

describe("RPC Client", () => {
    let rpcClient, app, loggerStub, configStub, web3Mock;

    beforeEach(() => {
        loggerStub = {
            info: sinon.stub(),
            error: sinon.stub(),
        };
        configStub = {
            HTTP_RPC_NODE: "http://fake:8545",
        };
        app = {
            logger: loggerStub,
            config: configStub,
        };
        web3Mock = {
            eth: {
                currentProvider: { sendAsync: function() {} },
                getChainId: sinon.stub().resolves(1),
                getBlockNumber: sinon.stub().resolves(100),
                sendSignedTransaction: sinon.stub().resolves({}),
                accounts: {
                    signTransaction: sinon.stub().resolves({}),
                },
            },
        };
        rpcClient = new RPCClient(app, web3Mock);
        sinon.stub(Web3, 'HttpProvider').returns({});
    });

    afterEach(() => {
        sinon.restore();
    });

    it("#1.1 - should throw an error if app is not defined", () => {
        expect(() => new RPCClient()).to.throw("RPCClient: app is not defined");
    });

    it("#1.2 - should construct with correct parameters", () => {
        expect(rpcClient.app).to.equal(app);
        expect(rpcClient.isConnected).to.be.false;
    });

    it("#1.3 - should connect to the RPC", async () => {
        rpcClient.connect();
        expect(loggerStub.info.calledTwice).to.be.true;
        expect(rpcClient.isConnected).to.be.true;
    });

    it("#1.4 - should get the chain id", async () => {
        const chainId = await rpcClient.getChainId();
        sinon.assert.calledOnce(web3Mock.eth.getChainId);
        expect(chainId).to.equal(1);
    });

    it("#1.5 - should get the current block number", async () => {
        const blockNumber = await rpcClient.getCurrentBlockNumber();
        sinon.assert.calledOnce(web3Mock.eth.getBlockNumber);
        expect(blockNumber).to.equal(100);
    });

    it("#1.6 - should sign a transaction", async () => {
        const unsignedTx = {
            from: "0x123",
            to: "0x456",
            value: "1000000000000000000", // 1 ether
        };
        const privateKey = "0x789";
        const signedTx = {
            rawTransaction: "0xabc",
        };
        web3Mock.eth.accounts.signTransaction.returns(Promise.resolve(signedTx));
        const result = await rpcClient.signTransaction(unsignedTx, privateKey);
        expect(result).to.eql(signedTx);
    });

    it.skip("#1.x - should disconnect from the RPC", async () => {
        rpcClient.disconnect();
        expect(web3Mock.currentProvider.disconnect.calledOnce).to.be.true;
    });

    it.skip("#1.x - should send a signed transaction", async () => {
        const rawTx = "0x123";
        const signed = {
            tx: {
                rawTransaction: rawTx,
            },
        };
        web3Mock.eth.sendSignedTransaction.returns(Promise.resolve(rawTx));
        const result = await rpcClient.sendSignedTransaction(signed);
        expect(result).to.equal(rawTx);
    });
});
