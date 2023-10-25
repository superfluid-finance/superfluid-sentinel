const sinon = require("sinon");
const { expect } = require("chai");
const Queues = require("../../../src/protocol/queues");

describe("Queues", () => {
    let queue;
    let appMock;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        appMock = {
            logger: {
                debug: sinon.stub(),
                info: sinon.stub(),
                error: sinon.stub()
            },

            _isShutdown: false,
            config: {
                NUM_RETRIES: 3,
                CONCURRENCY: 2
            },
        };

        queue = new Queues(appMock);
    });

    afterEach(() => {
        sandbox.restore();
    });


    it("#1.1 - should not run if app is shutting down", async () => {
        appMock._isShutdown = true;
        await queue.run(sinon.stub(), 5000);
        expect(appMock.logger.info.calledOnce).to.be.true;
        expect(appMock.logger.info.calledWith("app.shutdown() - closing queues")).to.be.true;
    });


    it("#1.2 - should not add tasks to the queue if app is shutting down", async () => {
        queue.init();
        await queue.shutdown();
        try {
            await queue.addQueuedEstimation("token", "account", "source");
            expect.fail("Expected addQueuedEstimation to throw");
        } catch (error) {
            expect(error.message).to.include("Queues.addQueuedEstimation(): shutdown");
        }
    });
});
