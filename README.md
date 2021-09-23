# Superfluid Community Agent

The agent monitors the state of Superfluid agreements on the configured network and liquidates [critical agreements](https://docs.superfluid.finance/superfluid/docs/constant-flow-agreement#liquidation-and-solvency).

## Quickstart

Currently supported setups:
* Native
* Docker

### Prerequisites

An account funded with native coins.

### Native Setup

Requires Node.js v12+ and npm already installed. 

First, check out this repository and cd into it:
```
git clone https://github.com/superfluid-finance/superfluid-community-agent.git
cd superfluid-community-agent
```

Then install dependencies with:
```
npm ci
```
Then prepare a file `.env` with your configuration.  
You can start with the provided example:
```
cp .env-example .env
```
The following configuration items are required and don't have default values:
* HTTP_RPC_NODE (cmdline argument: -H)
* WS_RPC_NODE (cmdline argument: -W)

Check the example file for additional configuration items and their documentatoin.

The configuration can be provided via cmdline args, via env variables and via `.env` file (with this order of precedence).

For persistent operation in the background, you can use the provided systemd unit template.
```
cp superfluid-agent.service.template superfluid-agent.service
```
Then edit `superfluid-agent.service` to match your setup. You need to set the working directory to the root directory of the agent, the usernam to execute with and the path to npm on your system.  
Then you can install and start the service:
```
ln -s superfluid-agent.service /etc/systemd/system/superfluid-agent.service
systemctl daemon-reload
systemctl start superfluid-agent.service
```
Now check if it's running:
```
journalctl -f -u superfluid-agent
```
If all is well, you may want to set the service to autostart:
```
systemctl enable superfluid-agent.service
```

### Docker Setup

This part of the guide assumes you have a recent version of Docker and docker-compose installed.

#### Build Docker image
```
COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 docker-compose build
```

#### Run Docker container
Ensure your ```.env``` file is configured correctly, then run:
```
docker-compose up
```

#### Upload Docker image to ECR (optional)
This assumes you have created a repository named ```<REPOSITORY>``` in your AWS account.
```
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
docker images
docker tag <IMAGE_ID> <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPOSITORY>:<TAG>
docker push <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPOSITORY>:<TAG>
```

## Control flow

At startup, the agent syncs its state (persisted in the local sqlite DB) by issuing range queries to the RPC node for relevant log events emitted by Superfluid contracts.    
Based on that state data it then executes the following steps in an endless loop:

1.  Load `FlowUpdated` events

2.  Get all SuperToken addresses

3.  Get all accounts (senders and receiver)

4.  Estimate liquidation point (predicted time of the agreement becoming critical) for each account

5.  Periodically get all estimations that are ready to be send, check account solvency status, build and send transaction

Resulting transactions are then independently monitored and the gas price bid up until executed (or reaching the configured gas price cap).

## Design choices

### Minimal external dependencies

This agent should be self sufficient without depending on external services other than an RPC node (which ideally is local too).  
Currently both an http and a websocket RPC endpoint are needed. In a future version, an http endpoint may be enough.

### Fault tolerant

Failing RPC queries will be retried several times before giving up and exiting in error state.

### Stateful

The agent needs to keep track of past events in order to allow it to quickly resume operation after a downtime.  
This is achieved by persisting the current state to a local sqlite database.  
Deletion of that file or changing of the path to the DB will cause the agent to start syncing from scratch on next start.

### Gas efficient

When the agent submits a transaction, it starts a timeout clock. When the timeout triggers, we resubmit the transaction (same nonce) with a higher gas price.  
The starting gas price is currently determined using the `eth_gasPrice` RPC method (updated per transaction). May change in the future.

## Code structure

[TODO]

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Disclaimer

YOU (MEANING ANY INDIVIDUAL OR ENTITY ACCESSING, USING OR BOTH THE SOFTWARE INCLUDED IN THIS GITHUB REPOSITORY) EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SOFTWARE IS AT YOUR SOLE RISK. THE SOFTWARE IN THIS GITHUB REPOSITORY IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. YOU RELEASE AUTHORS OR COPYRIGHT HOLDERS FROM ALL LIABILITY FOR YOU HAVING ACQUIRED OR NOT ACQUIRED CONTENT IN THIS GITHUB REPOSITORY. THE AUTHORS OR COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS CONCERNING ANY CONTENT CONTAINED IN OR ACCESSED THROUGH THE SERVICE, AND THE AUTHORS OR COPYRIGHT HOLDERS WILL NOT BE RESPONSIBLE OR LIABLE FOR THE ACCURACY, COPYRIGHT COMPLIANCE, LEGALITY OR DECENCY OF MATERIAL CONTAINED IN OR ACCESSED THROUGH THIS GITHUB REPOSITORY.   
