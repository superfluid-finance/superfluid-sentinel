const sinon = require("sinon");
const chai = require("chai");
const fs = require("fs");
const Telemetry = require("../../../src/services/telemetry");

const { expect } = chai;

describe("Telemetry", () => {
    let appMock, telemetry, fsReadStub, fsWriteStub, uuidStub;

    beforeEach(() => {
        // Mocking app object
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
                fullReport: sinon.stub().resolves({}),
            },
        };

        fsReadStub = sinon.stub(fs, "readFileSync");
        fsWriteStub = sinon.stub(fs, "writeFileSync");

        telemetry = new Telemetry(appMock);
    });

    afterEach(() => {
        sinon.restore();
    });

    it("should read uuid from file", async () => {
        fsReadStub.returns("existing-uuid");
        await telemetry.start();
        expect(fsReadStub.calledOnceWith("data/uuid.txt", "utf8")).to.be.true;
    });

    it("should write uuid to file if not exists", async () => {
        fsReadStub.throws(new Error("File not found"));
        await telemetry.start();
        expect(fsWriteStub.calledOnceWith("data/uuid.txt", sinon.match.string)).to.be.true;
    });
});
