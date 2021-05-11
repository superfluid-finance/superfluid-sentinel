# Superfluid Community Solvency Agent

- This agent uses both HTTP and WS connection to EVM node.
- Use sqlite as database layer, easy to change this if needed.
- As this version the parameters are passing as env. variables.


### Installation and boot


1. Clone the repo
   ```sh
   git clone https://github.com/ngmachado/community-solvency.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Set configuration file `.env`
   ```sh
   cat env_template > .env
   ```
4. Edit `.env` file
    ```sh
    WS_NODE = ws://localhost
    HTTP_NODE = http://localhost
    MNEMONIC = agent account mnemonic
    EPOCH_BLOCK = block to start working
    PROTOCOL_RELEASE_VERSION=v1
    PULL_STEP = 100000
    GAS_PRICE = 1
    ```
5. Run  `main.js`
    ```sh
    node main
    ```



## Concepts

Fresh Boot: No existing database at boot.
Insolvent Account: Flows from account can be terminated.
Listed SuperTokens: SuperTokens register in Superfluid resolver contract.

# Code structure

[TODO]

# Flow of Agent
Depending on the database information, the agent will try to collect all the needed information from the network.

1.  Load SuperTokens

    From the EPOCH block get all interaction from Constant Flow Agreement, register Listed SuperTokens
2.  Agreements / Flows

    Collect all agreements state changes and FlowUpdated events.
    Save all the active flows with sender and receiver.
3.  Estimate liquidation point for each account.

    Periodically get all estimations that are ready to be send, check account solvency status, build and send transaction.

---

# TODO

## Parameters
- Feed app parameters by env and args.

## Account Management
- Nonce management
- Manager multi accounts

## Transaction Management
- Remove from database terminated flows (from event subscription module)
- Retry strategy

## Event Subscription
- Processing events

## Boot Agent
- Load Tokens

## Error management
- Proper error management and resilience strategy

## Misc
- Remove all dependancies from JS-SDK (Superfluid)



# Nodejs
Find memory leaks

