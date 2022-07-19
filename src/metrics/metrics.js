const promclient = require('prom-client');

const estQueueLength = new promclient.Histogram({
    name: 'sentinel_estimation_queue_length',
    help: 'What is the estimation queue size',
});

const agrQueueLength = new promclient.Histogram({
    name: 'sentinel_agreement_queue_length',
    help: 'What is the agreement queue size',
});

class Metrics {
    constructor (app) {
        this.app = app;
        const register = new promclient.Registry();
        this.register = register;
        //add custom metrics
        register.registerMetric(estQueueLength);
        register.registerMetric(agrQueueLength);
        //default nodejs metrics
        promclient.collectDefaultMetrics({
            app: 'sentinel-monitoring-app',
            timeout: 10000,
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
            register
        });
    }

    async getMetrics () {
        //observe data points
        estQueueLength.observe(this.app.queues.getEstimationQueueLength());
        agrQueueLength.observe(this.app.queues.getAgreementQueueLength());
        return this.register.metrics();
    }
}

module.exports = Metrics
