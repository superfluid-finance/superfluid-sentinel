class Report {

    constructor(app) {
        this.app = app;
    }

    async checkDatabase() {
        try {
            return (await this.app.db.queries.healthCheck()) !== undefined;
        } catch(err) {
            console.log(err);
            return false;
        }
    }

    async fullReport() {
        //DB
        return {
            process: {
                uptime: process.uptime(),
                pid: process.pid
            },
            db: {
                healthCheck: await this.checkDatabase()
            },
        };
    }
}


module.exports = Report;