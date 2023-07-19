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

    }
}