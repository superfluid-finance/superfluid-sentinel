const sinon = require("sinon");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const TestRPCClient = require("../../../src/test/testRPCClient");
const RPCClient = require("../../../src/web3client/rpcClient");
const Web3 = require("web3");

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('TestRPCClient sendSignedTransaction', () => {
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
        testRPCClient = new TestRPCClient(app, web3Mock);
        sinon.stub(Web3, 'HttpProvider').returns({});
    });

    afterEach(() => {
        sinon.restore();
    });

    it('should timeout on low gas price', async () => {
        testRPCClient.setTestMode("TIMEOUT_ON_LOW_GAS_PRICE", { minimumGas: 100 });
        const signedMock = {
            tx: {
                txObject: {
                    gasPrice: 50,
                    gasLimit: 21000
                },
                timeout: 100
            }
        };
        await expect(testRPCClient.sendSignedTransaction(signedMock)).to.be.fulfilled;
    });

    it('should send the transaction normally when gas price is above the minimum', async () => {
        testRPCClient.setTestMode("TIMEOUT_ON_LOW_GAS_PRICE", { minimumGas: 50 });
        const signedMock = {
            tx: {
                txObject: {
                    gasPrice: 100, // > minimumGas
                    gasLimit: 21000
                },
                timeout: 100
            }
        };

        web3Mock.eth.sendSignedTransaction.resolves("transactionHash");
        await expect(testRPCClient.sendSignedTransaction(signedMock)).to.eventually.equal("transactionHash");
    });

    it('should throw an error when the gas limit exceeds the block gas limit', async () => {
        testRPCClient.setTestMode("REVERT_ON_BLOCK_GAS_LIMIT", { blockGasLimit: 20000 });
        const signedMock = {
            tx: {
                txObject: {
                    gasPrice: 100,
                    gasLimit: 21000
                },
                timeout: 100
            }
        };

        await expect(testRPCClient.sendSignedTransaction(signedMock)).to.be.rejectedWith("block gas limit");
    });
    
    it('should operate normally outside of test modes', async () => {
        // no test mode implies normal operation
        const signedMock = {
            tx: {
                txObject: {
                    gasPrice: 100,
                    gasLimit: 21000
                },
                timeout: 100
            }
        };
        web3Mock.eth.sendSignedTransaction.resolves("normalOperationHash");
        await expect(testRPCClient.sendSignedTransaction(signedMock)).to.eventually.equal("normalOperationHash");
    });
});
