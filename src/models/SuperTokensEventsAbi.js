module.exports = {
  AgreementAccountStateUpdated: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "agreementClass",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address"
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "state",
        type: "bytes"
      }
    ],
    name: "AgreementAccountStateUpdated",
    type: "event"
  },
  AgreementLiquidatedBy: {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "address",
        name: "liquidatorAccount",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "agreementClass",
        type: "address"
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "id",
        type: "bytes32"
      },
      {
        indexed: true,
        internalType: "address",
        name: "penaltyAccount",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "bondAccount",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "rewardAmount",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "bailoutAmount",
        type: "uint256"
      }
    ],
    name: "AgreementLiquidatedBy",
    type: "event"
  },
  AgreementLiquidatedV2:{
  "anonymous": false,
    "inputs": [
  {
    "indexed": true,
    "internalType": "address",
    "name": "agreementClass",
    "type": "address"
  },
  {
    "indexed": false,
    "internalType": "bytes32",
    "name": "id",
    "type": "bytes32"
  },
  {
    "indexed": true,
    "internalType": "address",
    "name": "liquidatorAccount",
    "type": "address"
  },
  {
    "indexed": true,
    "internalType": "address",
    "name": "targetAccount",
    "type": "address"
  },
  {
    "indexed": false,
    "internalType": "address",
    "name": "rewardAccount",
    "type": "address"
  },
  {
    "indexed": false,
    "internalType": "uint256",
    "name": "rewardAmount",
    "type": "uint256"
  },
  {
    "indexed": false,
    "internalType": "int256",
    "name": "targetAccountBalanceDelta",
    "type": "int256"
  },
  {
    "indexed": false,
    "internalType": "bytes",
    "name": "liquidationTypeData",
    "type": "bytes"
  }
],
    "name": "AgreementLiquidatedV2",
    "type": "event"
},
  AgreementStateUpdated: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "agreementClass",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "slotId",
        type: "uint256"
      }
    ],
    name: "AgreementStateUpdated",
    type: "event"
  },
  AgreementUpdated: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "agreementClass",
        type: "address"
      },
      {
        indexed: false,
        internalType: "bytes32",
        name: "id",
        type: "bytes32"
      },
      {
        indexed: false,
        internalType: "bytes32[]",
        name: "data",
        type: "bytes32[]"
      }
    ],
    name: "AgreementUpdated",
    type: "event"
  },
  TokenDowngraded: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      }
    ],
    name: "TokenDowngraded",
    type: "event"
  },
  TokenUpgraded: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "account",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      }
    ],
    name: "TokenUpgraded",
    type: "event"
  },
  Transfer: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address"
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256"
      }
    ],
    name: "Transfer",
    type: "event"
  }
};
