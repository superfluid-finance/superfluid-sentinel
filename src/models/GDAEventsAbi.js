module.exports = {
    FlowDistributionUpdated: {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address"
            },
            {
                indexed: true,
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address"
            },
            {
                indexed: true,
                internalType: "address",
                name: "distributor",
                type: "address"
            },
            {
                indexed: false,
                internalType: "address",
                name: "operator",
                type: "address"
            },
            {
                indexed: false,
                internalType: "int96",
                name: "oldFlowRate",
                type: "int96"
            },
            {
                indexed: false,
                internalType: "int96",
                name: "newDistributorToPoolFlowRate",
                type: "int96"
            },
            {
                indexed: false,
                internalType: "int96",
                name: "newTotalDistributionFlowRate",
                type: "int96"
            },
            {
                indexed: false,
                internalType: "address",
                name: "adjustmentFlowRecipient",
                type: "address"
            },
            {
                indexed: false,
                internalType: "int96",
                name: "adjustmentFlowRate",
                type: "int96"
            },
            {
                "indexed": false,
                "internalType": "bytes",
                "name": "userData",
                "type": "bytes"
            }
        ],
        name: "FlowDistributionUpdated",
        type: "event"
    },
    InstantDistributionUpdated: {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address"
            },
            {
                indexed: true,
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address"
            },
            {
                indexed: true,
                internalType: "address",
                name: "distributor",
                type: "address"
            },
            {
                indexed: false,
                internalType: "address",
                name: "operator",
                type: "address"
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "requestedAmount",
                type: "uint256"
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "actualAmount",
                type: "uint256"
            },
            {
                "indexed": false,
                "internalType": "bytes",
                "name": "userData",
                "type": "bytes"
            }
        ],
        name: "InstantDistributionUpdated",
        type: "event"
    },
    PoolCreated: {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "contract ISuperfluidToken",
                name: "token",
                type: "address"
            },
            {
                indexed: true,
                internalType: "address",
                name: "admin",
                type: "address"
            },
            {
                indexed: false,
                internalType: "contract ISuperfluidPool",
                name: "pool",
                type: "address"
            }
        ],
        name: "PoolCreated",
        type: "event"

    },
    MemberUnitsUpdated: {
        "anonymous":false,
        "inputs":[
            {
                "name":"token",
                "type":"address",
                "indexed":true,
                "internalType":"contract ISuperfluidToken"
            },
            {
                "name":"member",
                "type":"address",
                "indexed":true,
                "internalType":"address"
            },
            {
                "name":"oldUnits",
                "type":"uint128",
                "indexed":false,
                "internalType":"uint128"
            },
            {
                "name":"newUnits",
                "type":"uint128",
                "indexed":false,
                "internalType":"uint128"
            }
        ],
        "name":"MemberUnitsUpdated",
        "type":"event",
},
    PoolConnectionUpdated: {
        "anonymous":false,
        "inputs":[
            {
                "name":"token",
                "type":"address",
                "indexed":true,
                "internalType":"contract ISuperfluidToken"
            },
            {
                "name":"pool",
                "type":"address",
                "indexed":true,
                "internalType":"contract ISuperfluidPool"
            },
            {
                "name":"account",
                "type":"address",
                "indexed":true,
                "internalType":"address"
            },
            {
                "name":"connected",
                "type":"bool",
                "indexed":false,
                "internalType":"bool"
            },
            {
                "name":"userData",
                "type":"bytes",
                "indexed":false,
                "internalType":"bytes"
            }
        ],
        "type":"event",
        "name":"PoolConnectionUpdated"
    }
}