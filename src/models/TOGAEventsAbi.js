module.exports = {
  NewPIC: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "contract ISuperToken",
        name: "token",
        type: "address"
      },
      {
        indexed: false,
        internalType: "address",
        name: "pic",
        type: "address"
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "bond",
        type: "uint256"
      },
      {
        indexed: false,
        internalType: "int96",
        name: "exitRate",
        type: "int96"
      }
    ],
    name: "NewPIC",
    type: "event"
  },
  ExitRateChanged: {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "contract ISuperToken",
        name: "token",
        type: "address"
      },
      {
        indexed: false,
        internalType: "int96",
        name: "exitRate",
        type: "int96"
      }
    ],
    name: "ExitRateChanged",
    type: "event"
  }
};
