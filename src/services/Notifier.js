const EventEmitter = require('events');

class Notifier extends EventEmitter {
    sendNotification(message) {
        // Send notification logic here
        console.log(`Sending notification: ${message}`);
        this.emit('notification', message);
    }
}

module.exports = Notifier;