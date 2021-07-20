class Time {

    construtor(app) {
        this.app = app;
        //save time we want agent to be in
        this.baseTime;
    }

    getTime() {
        if(this.baseTime === undefined) {
            console.log("Base date is not defined: ", new Date())
            return new Date();
        }

        return new Date(this.baseTime);
    }

    setTime(time) {
        this.baseTime = time;
    }

    resetTime() {
        this.baseTime = undefined;
    }

}

module.exports = Time;