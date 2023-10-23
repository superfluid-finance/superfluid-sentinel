const sinon = require("sinon");
const chai = require("chai");
const fs = require("fs");
const axios = require("axios");
const Telemetry = require("../../../src/services/telemetry");

const { expect } = chai;

describe("Telemetry", () => {
    let appMock;
    let fsReadStub;
    let fsWriteStub;
    let axiosPostStub;
    let telemetry;

    beforeEach(() => {
        axiosPostStub = sinon.stub(axios, 'post').resolves({ data: 'ok' });
        fsReadStub = sinon.stub(fs, "readFileSync");
        fsWriteStub = sinon.stub(fs, "writeFileSync");
        appMock = {
            _isShutdown: false,
            logger: {
                info: sinon.stub(),
                debug: sinon.stub(),
                error: sinon.stub()
            },
            config: {
                TELEMETRY_URL: "http://fake.telemetry",
            },
            healthReport: {
                fullReport: sinon.stub().resolves({
                    network: {
                        chainId: '1',
                        rpc: { totalRequests: 100 }
                    },
                    process: { uptime: 1000 },
                    healthy: true,
                    account: { balance: '1000000000000000000' }
                })
            }
        };

        telemetry = new Telemetry(appMock, axiosPostStub);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("#1.1 - should read uuid from file", async () => {
        fsReadStub.returns("existing-uuid");
        await telemetry.start();
        expect(fsReadStub.calledOnceWith("data/uuid.txt", "utf8")).to.be.true;
    });

    it("#1.2 - should write uuid to file if not exists", async () => {
        fsReadStub.throws(new Error("File not found"));
        await telemetry.start();
        expect(fsWriteStub.calledOnceWith("data/uuid.txt", sinon.match.string)).to.be.true;
    });

    it("#1.3 - should post data to telemetry endpoint", async () => {
        await telemetry.start();
        expect(axiosPostStub.calledOnce).to.be.true;
    });
});
