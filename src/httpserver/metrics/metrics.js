const promclient = require("prom-client");

// Collect default metrics
const collectDefaultMetrics = promclient.collectDefaultMetrics;
const register = new promclient.Registry();
collectDefaultMetrics({
    app: 'sentinel-monitoring-app',
    timeout: 10000,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    register
});

const accountBalanceGauge = new promclient.Gauge({
    name: 'sentinel_account_balance',
    help: 'Current balance of the Sentinel account'
});

// Register your custom metrics
register.registerMetric(accountBalanceGauge);

module.exports = {
    register,
    accountBalanceGauge
};