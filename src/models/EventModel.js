class EventModel {

    // @title transformWeb3Event
    // @dev transform one web3 event object to event model object
    transformWeb3Event(event) {
        try {
        if(event != null && event !== undefined) {
            let obj = {
                eventName: event.event,
                token: event.returnValues.token,
                address: event.address,
                blockNumber: parseInt(event.blockNumber),
                syncedBlockNumber : parseInt(event.blockNumber),
                transactionHash: event.transactionHash,
                agreementClass : event.returnValues.agreementClass,
                id : event.returnValues.id,
                data : event.returnValues.data,
                state : event.returnValues.state,
                account: event.returnValues.account,
                sender: event.returnValues.sender,
                receiver: event.returnValues.receiver,
                to: event.returnValues.to,
                from: event.returnValues.from,
                amount: event.returnValues.amount,
                value: event.returnValues.value,
                flowRate: (isNaN(parseInt(event.returnValues.flowRate)) ?
                    undefined : parseInt(event.returnValues.flowRate)),
                totalSenderFlowRate: (isNaN(parseInt(event.returnValues.totalSenderFlowRate)) ?
                    undefined : parseInt(event.returnValues.totalSenderFlowRate)),
                totalReceiverFlowRate: (isNaN(parseInt(event.returnValues.totalReceiverFlowRate)) ?
                    undefined : parseInt(event.returnValues.totalReceiverFlowRate))
            };

            Object.keys(obj).forEach(key => (obj[key] === undefined) && delete obj[key]);
            return obj;
        }
        } catch(error) {
            console.error(error);
        }
    }
}

module.exports = EventModel;
