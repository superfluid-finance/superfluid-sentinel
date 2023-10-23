const sinon = require("sinon");
const { expect } = require("chai");
const Gas = require("../../../src/transaction/gas");

describe("Gas Tests", () => {
    let gas;
    let mockApp;

    beforeEach(() => {
        mockApp = {
            client: {
                RPCClient: {
                        estimateGas: sinon.stub(),
                        getGasPrice: sinon.stub()
                }
            },
            config: {
                MAX_GAS_PRICE: 100
            },
            Errors: {
                EVMErrorParser: sinon.stub().returns("parsed error")
            },
            logger: {
                warn: sinon.stub(),
                debug: sinon.stub()
            },
            notifier: {
                sendNotification: sinon.stub()
            }
        };

        gas = new Gas(mockApp);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("#1.1 - should return expected gasLimit data", async () => {
        const mockWallet = { address: "walletAddress" };
        const mockTxObject = { target: "target", tx: "tx" };
        mockApp.client.RPCClient.estimateGas.resolves(90);
        const result = await gas.getGasLimit(mockWallet, mockTxObject);
        expect(result).to.deep.equal({
            error: undefined,
            gasLimit: 99 // + 10%
        });
    });

    it("#1.2 - should return error if estimateGas throws", async () => {
        const mockWallet = { address: "walletAddress" };
        const mockTxObject = { target: "target", tx: "tx" };
        mockApp.client.RPCClient.estimateGas.rejects(new Error("estimateGas error"));
        const result = await gas.getGasLimit(mockWallet, mockTxObject);
        expect(result).to.deep.equal({
            error: "parsed error",
            gasLimit: undefined
        });
    });

    it("#1.3 - should return expected getCappedGasPrice data", async () => {
        mockApp.client.RPCClient.getGasPrice.resolves("80");
        const result = await gas.getCappedGasPrice();
        expect(result).to.deep.equal({
            error: undefined,
            gasPrice: "80",
            hitGasPriceLimit: false
        });
    });

    it("#1.4 - getCappedGasPrice should return error if getGasPrice throws", async () => {
        mockApp.client.RPCClient.getGasPrice.rejects(new Error("getGasPrice error"));
        const result = await gas.getCappedGasPrice();
        expect(result).to.deep.equal({
            error: "parsed error"
        });
    });

    it("#1.5 - should return expected getUpdatedGasPrice data", () => {
        const originalGasPrice = "80";
        const retryNumber = 2;
        const step = 1.1;
        const result = gas.getUpdatedGasPrice(originalGasPrice, retryNumber, step);
        expect(result).to.deep.equal({
            gasPrice: 88, // ceil(80 * 1.1)
            hitGasPriceLimit: false
        });
    });

    it("#1.6 - should return max gas price if limit hit", () => {
        const originalGasPrice = "100";
        const retryNumber = 2;
        const step = 1.1;
        const result = gas.getUpdatedGasPrice(originalGasPrice, retryNumber, step);
        expect(result).to.deep.equal({
            gasPrice: 100,
            hitGasPriceLimit: true
        });
        expect(mockApp.logger.warn.calledOnce).to.be.true;
        expect(mockApp.notifier.sendNotification.calledOnce).to.be.true;
    });
});
