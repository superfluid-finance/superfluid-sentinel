const sinon = require("sinon");
const { expect } = require("chai");
const NotificationJobs = require("../../../src/services/notificationJobs");

describe("NotificationJobs", () => {
    let jobs;
    let appMock;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        appMock = {
            healthReport: {
                fullReport: sinon.stub().resolves({ healthy: false, network: { chainId: 1 }, reasons: ["test"] }),
            },
            notifier: {
                sendNotification: sinon.stub(),
            },
            client: {
                isAccountBalanceBelowMinimum: sinon.stub().resolves({ isBelow: true, balance: "1" }),
            },
            logger: {
                info: sinon.stub(),
            },
            config: {
                INSTANCE_NAME: "test",
            },
            _isShutdown: false,
        };

        jobs = new NotificationJobs(appMock);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("#1.1 - should send report correctly", async () => {
        await jobs.sendReport();

        // Check that fullReport was called and notification was sent
        expect(appMock.healthReport.fullReport.calledOnce).to.be.true;
        expect(appMock.notifier.sendNotification.calledOnce).to.be.true;

        // todo: mock time to test
        //expect(appMock.client.isAccountBalanceBelowMinimum.calledOnce).to.be.true;
        //expect(appMock.notifier.sendNotification.calledTwice).to.be.true;
    });

    it("#1.2 - should not send report if healthy and balance is not below minimum", async () => {
        appMock.healthReport.fullReport.resolves({ healthy: true, network: { chainId: 1 } });
        appMock.client.isAccountBalanceBelowMinimum.resolves({ isBelow: false, balance: "1" });

        await jobs.sendReport();

        // Check that fullReport was called but notification was not sent
        expect(appMock.healthReport.fullReport.calledOnce).to.be.true;
        expect(appMock.notifier.sendNotification.called).to.be.false;
    });

    it("#1.3 - should stop running if app is shutting down", async () => {
        appMock._isShutdown = true;

        await jobs.start();

        expect(appMock.logger.info.calledOnce).to.be.true;
        expect(appMock.logger.info.calledWith("app.shutdown() - closing NotificationJobs")).to.be.true;
    });
});
