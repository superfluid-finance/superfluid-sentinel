module.exports = {
    BufferAdjusted: {
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
                name: "pool",
                type: "address"
            },
            {
                indexed: true,
                internalType: "address",
                name: "from",
                type: "address"
            },
            {
                indexed: false,
                internalType: "int256",
                name: "bufferDelta",
                type: "int256"
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "newBufferAmount",
                type: "uint256"
            },
            {
                indexed: false,
                internalType: "uint256",
                name: "totalBufferAmount",
                type: "uint256"
            }
        ],
        name: "BufferAdjusted",
        type :"event"
    },
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
            }
        ],
        name: "InstantDistributionUpdated",
        type: "event"
    },
    PoolConnectionUpdated: {
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
                name: "account",
                type: "address"
            },
            {
                indexed: false,
                internalType: "bool",
                name: "connected",
                type: "bool"
            }
        ],
        name: "PoolConnectionUpdated",
        type: "event"
    },
    PoolCreated: {
        anonymous: false,
        input: [
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

    }
}