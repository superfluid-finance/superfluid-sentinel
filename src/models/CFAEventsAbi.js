module.exports = {
  FlowUpdated: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'contract ISuperfluidToken',
        name: 'token',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'sender',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'receiver',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'int96',
        name: 'flowRate',
        type: 'int96'
      },
      {
        indexed: false,
        internalType: 'int256',
        name: 'totalSenderFlowRate',
        type: 'int256'
      },
      {
        indexed: false,
        internalType: 'int256',
        name: 'totalReceiverFlowRate',
        type: 'int256'
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'userData',
        type: 'bytes'
      }
    ],
    name: 'FlowUpdated',
    type: 'event'
  }
}
