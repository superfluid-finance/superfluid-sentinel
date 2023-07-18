const web3Utils = require("web3").utils;

const toChecksumAddress = (address) => {
  if (address == null) {
    return undefined;
  }
  const result = web3Utils.toChecksumAddress(address);
  return result ? result : undefined;
};

class EventModel {
  // @title transformWeb3Event
  // @dev transform one web3 event object to event model object
  transformWeb3Event (event) {
    try {
      if (event != null) {
        const obj = {
          eventName: event.event,
          logIndex: event.logIndex,
          token: toChecksumAddress(event.returnValues.token),
          address: toChecksumAddress(event.address),
          blockNumber: parseInt(event.blockNumber),
          blockHash: event.blockHash,
          transactionHash: event.transactionHash,
          agreementClass: event.returnValues.agreementClass,
          id: event.returnValues.id,
          data: event.returnValues.data,
          state: event.returnValues.state,
          account: toChecksumAddress(event.returnValues.account),
          sender: toChecksumAddress(event.returnValues.sender),
          receiver: toChecksumAddress(event.returnValues.receiver),
          penaltyAccount: toChecksumAddress(event.returnValues.penaltyAccount),
          bondAccount: toChecksumAddress(event.returnValues.bondAccount),
          pic: toChecksumAddress(event.returnValues.pic),
          liquidatorAccount: toChecksumAddress(event.returnValues.liquidatorAccount),
          targetAccount: toChecksumAddress(event.returnValues.targetAccount),
          rewardAccount: toChecksumAddress(event.returnValues.rewardAccount),
          to: toChecksumAddress(event.returnValues.to),
          from: toChecksumAddress(event.returnValues.from),
          admin: toChecksumAddress(event.returnValues.admin),
          pool: toChecksumAddress(event.returnValues.pool),
          distributor: toChecksumAddress(event.returnValues.distributor),
          publisher: toChecksumAddress(event.returnValues.publisher),
          adjustmentFlowRecipient: toChecksumAddress(event.returnValues.adjustmentFlowRecipient),
          operator: toChecksumAddress(event.returnValues.operator),
          indexId: event.returnValues.indexId,
          subscriber: toChecksumAddress(event.returnValues.subscriber),
          amount: event.returnValues.amount,
          value: event.returnValues.value,
          rewardAmount: event.returnValues.rewardAmount,
          bailoutAmount: event.returnValues.bailoutAmount,
          targetAccountBalanceDelta: event.returnValues.targetAccountBalanceDelta,
          bond: event.returnValues.bond,
          exitRate: event.returnValues.exitRate,
          liquidationTypeData: event.returnValues.liquidationTypeData,
          flowRate: (isNaN(parseInt(event.returnValues.flowRate))
            ? undefined
            : parseInt(event.returnValues.flowRate)),
          oldFlowRate: (isNaN(parseInt(event.returnValues.oldFlowRate))
              ? undefined
              : parseInt(event.returnValues.oldFlowRate)),
          newDistributorToPoolFlowRate: (isNaN(parseInt(event.returnValues.newDistributorToPoolFlowRate))
              ? undefined
              : parseInt(event.returnValues.newDistributorToPoolFlowRate)),
          newTotalDistributionFlowRate: (isNaN(parseInt(event.returnValues.newTotalDistributionFlowRate))
              ? undefined
              : parseInt(event.returnValues.newTotalDistributionFlowRate)),
          adjustmentFlowRate: (isNaN(parseInt(event.returnValues.adjustmentFlowRate))
              ? undefined
              : parseInt(event.returnValues.adjustmentFlowRate)),
          totalSenderFlowRate: (isNaN(parseInt(event.returnValues.totalSenderFlowRate))
            ? undefined
            : parseInt(event.returnValues.totalSenderFlowRate)),
          totalReceiverFlowRate: (isNaN(parseInt(event.returnValues.totalReceiverFlowRate))
            ? undefined
            : parseInt(event.returnValues.totalReceiverFlowRate)),
          removed: event.removed
        };

        Object.keys(obj).forEach(key => (obj[key] === undefined) && delete obj[key]);
        return obj;
      }
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = EventModel;
