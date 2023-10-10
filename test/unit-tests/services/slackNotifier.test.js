const sinon = require("sinon");
const { expect } = require("chai");
const { IncomingWebhook } = require("@slack/webhook");
const SlackNotifierTest = require("../../../src/services/slackNotifier");

describe("SlackNotifier", () => {
    let slackNotifier;
    let appMock;
    let sandbox;
    let sendStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Mock the app and its methods
        appMock = {
            config: {
                SLACK_WEBHOOK_URL: "https://fake",
            },
            notifier: {
                on: sinon.stub(),
            },
            logger: {
                info: sinon.stub(),
                error: sinon.stub(),
            },
        };

        sendStub = sandbox.stub();
        sandbox.stub(IncomingWebhook.prototype, "send").callsFake(sendStub);

        slackNotifier = new SlackNotifierTest(appMock);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it("#1.1 - should throw an error if SLACK_WEBHOOK_URL is not set", () => {
        appMock.config.SLACK_WEBHOOK_URL = null;

        expect(() => new SlackNotifierTest(appMock)).to.throw("Slack webhook url must be set in config");
    });

    it("#1.2 - should throw an error if notifier is not initialized", () => {
        appMock.notifier = null;

        expect(() => new SlackNotifierTest(appMock)).to.throw("Notifier must be initialized before SlackNotifier");
    });

    it("#1.3 - should send a notification to slack", async () => {
        const message = "test message";
        await slackNotifier.sendNotification(message);

        expect(sendStub.calledOnceWith({ text: message })).to.be.true;
        expect(appMock.logger.info.calledOnceWith(`SlackNotifier: Sent notification to Slack: ${message}`)).to.be.true;
    });

    it("#1.4 - should handle an error when sending a notification to slack", async () => {
        const message = "test message";
        const error = new Error("test error");
        sendStub.throws(error);

        await slackNotifier.sendNotification(message);

        expect(appMock.logger.error.calledOnceWith(`SlackNotifier: Error sending notification to Slack: ${error}`)).to.be.true;
    });
});
