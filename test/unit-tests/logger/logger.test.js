const sinon = require("sinon");
const { expect } = require("chai");
const Logger = require("../../../src/logger/logger");

describe("Logger", () => {

    let logger;
    let appMock;

    beforeEach(() => {
        appMock = {
            config: {
                LOG_LEVEL: "info",
                SHUTDOWN_ON_ERROR: false
            },
        };

        // Initialize the Logger
        logger = new Logger(appMock);
    });

    it("#1.1 - should call the appropriate log method", () => {
        logger.logger = {
            log: sinon.stub(),
            info: sinon.stub(),
            debug: sinon.stub(),
            error: sinon.stub(),
            warn: sinon.stub(),
        };

        logger.log("test log");
        expect(logger.logger.log.calledWith("info", "test log")).to.be.true;

        logger.info("test info");
        expect(logger.logger.info.calledWith("test info")).to.be.true;

        logger.debug("test debug");
        expect(logger.logger.debug.calledWith("test debug")).to.be.true;

        logger.warn("test warn");
        expect(logger.logger.warn.calledWith("test warn")).to.be.true;
    });

    it("#1.2 - should handle error and call shutdown if SHUTDOWN_ON_ERROR is true", () => {
        appMock = {
            shutdown: sinon.stub(),
            config: {
                LOG_LEVEL: "info",
                SHUTDOWN_ON_ERROR: true,
            },
        };
        logger = new Logger(appMock);
        logger.logger = {
            log: sinon.stub(),
            info: sinon.stub(),
            debug: sinon.stub(),
            error: sinon.stub(),
            warn: sinon.stub(),
        };

        logger.error("test error");

        expect(logger.logger.error.calledWith("test error")).to.be.true;
        expect(appMock.shutdown.calledWith(true)).to.be.true;
    });

    it("#1.3 - should log LOG_LEVEL correctly", () => {
        appMock = {
            config: {
                LOG_LEVEL: "info",
                SHUTDOWN_ON_ERROR: false,
            },
        };
        logger = new Logger(appMock);
        logger.logger = {
            log: sinon.stub(),
            info: sinon.stub(),
            debug: sinon.stub(),
            error: sinon.stub(),
            warn: sinon.stub(),
        };

        logger.info("test info");
        expect(logger.logger.info.calledWith("test info")).to.be.true;
        logger.app.LOG_LEVEL = "debug";
        logger.debug("test debug");
        expect(logger.logger.debug.calledWith("test debug")).to.be.true;
        logger.app.LOG_LEVEL = "warn";
        logger.warn("test warn");
        expect(logger.logger.warn.calledWith("test warn")).to.be.true;
        logger.app.LOG_LEVEL = "error";
        logger.error("test error");
        expect(logger.logger.error.calledWith("test error")).to.be.true;
    });
});