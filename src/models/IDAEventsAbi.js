module.exports = {
  IndexUpdated: {
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
        name: 'publisher',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'uint32',
        name: 'indexId',
        type: 'uint32'
      },
      {
        indexed: false,
        internalType: 'uint128',
        name: 'oldIndexValue',
        type: 'uint128'
      },
      {
        indexed: false,
        internalType: 'uint128',
        name: 'newIndexValue',
        type: 'uint128'
      },
      {
        indexed: false,
        internalType: 'uint128',
        name: 'totalUnitsPending',
        type: 'uint128'
      },
      {
        indexed: false,
        internalType: 'uint128',
        name: 'totalUnitsApproved',
        type: 'uint128'
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'userData',
        type: 'bytes'
      }
    ],
    name: 'IndexUpdated',
    type: 'event'
  },
  SubscriptionApproved: {
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
        name: 'subscriber',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'publisher',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint32',
        name: 'indexId',
        type: 'uint32'
      },
      {
        indexed: false,
        internalType: 'bytes',
        name: 'userData',
        type: 'bytes'
      }
    ],
    name: 'SubscriptionApproved',
    type: 'event'
  }
}
