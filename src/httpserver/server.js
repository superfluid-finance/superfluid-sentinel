const express = require("express");
const app = express();
const port = 3000;

app.get('/', async (req, res) => {
    const healthcheck = {
		uptime: process.uptime(),
        pid: process.pid,
		message: 'OK',
		timestamp: Date.now()
	};
	try {
		res.send(healthcheck);
	} catch (e) {
		healthcheck.message = e;
		res.status(503).send();
	}
});

app.listen(port, () => {
    console.log(`listening at http://localhost:${port}`)
});