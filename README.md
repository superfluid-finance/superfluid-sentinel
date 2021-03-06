# Superfluid Sentinel

The sentinel monitors the state of Superfluid agreements on the configured network and
liquidates [critical agreements](https://docs.superfluid.finance/superfluid/docs/constant-flow-agreement#liquidation-and-solvency).  
It also allows you to configure a related PIC account and other parameters related to [3Ps & TOGA](https://docs.superfluid.finance/superfluid/docs/liquidations-and-toga).

## Quickstart

Currently supported setups:

* Native
* Docker

### Prerequisites

First, prepare an account funded with native coins for transaction fees.  
Then prepare a file `.env` with your configuration. You can start with the provided example:

```
cp .env-example .env
```

The following configuration items are required and don't have default values:

* `HTTP_RPC_NODE` (cmdline argument: `-H`)
* `PRIVATE_KEY` (cmdline argument: `-k`) or MNEMONIC (cmdline argument: `-m`)

In order to associate a sentinel instance with a PIC account, set the `PIC` env variable (cmdline argument: `--pic`).

Check `.env.example` for additional configuration items and their documentation.

### Native Setup

Requires Node.js v14+ and npm already installed.

First, check out this repository and cd into it:

```
git clone https://github.com/superfluid-finance/superfluid-sentinel.git
cd superfluid-sentinel
```

Then install dependencies with:

```
NODE_ENV=production npm ci
```

Before starting the instance, make sure it's configured according to your needs. The configuration can be provided
via `.env` file, via env variables and/or via cmdline args, with the latter taking higher precedence than the former.

For persistent operation in the background, you can use the provided systemd unit template.

```
cp superfluid-sentinel.service.template superfluid-sentinel.service
```

Then edit `superfluid-sentinel.service` to match your setup. You need to set the working directory to the root directory
of the sentinel, the username to execute with and the path to npm on your system. Then you can install and start the
service:

```
ln -s $PWD/superfluid-sentinel.service /etc/systemd/system/superfluid-sentinel.service
systemctl daemon-reload
systemctl start superfluid-sentinel.service
```

Now check if it's running:

```
journalctl -f -u superfluid-sentinel
```

If all is well, you may want to set the service to autostart:

```
systemctl enable superfluid-sentinel.service
```

#### Run multiple instances

In order to run sentinels for multiple networks in parallel, create network specific env files which are
named `.env-<network-name>`.  
E.g. if you want to run a sentinel for xdai and a sentinel for polygon, prepare env files `.env-xdai` and `.env-polygon`
with the respective settings.    
You need to set `DB_PATH` to different values instead of using the default value.  
You may also want to set the variable `CHAIN_ID` (e.g. `CHAIN_ID=100` for xdai). This makes sure you don't accidentally
use the wrong RPC node or write to a sqlite file created for a different network.

With the env files in place, you can start instances like this:

```
npm start <network-name>
```

For example: `npm start xdai`will start an instance configured according to the settings in `.env-xdai`.

If you use systemd, create instance specific copies of the service file, e.g. `superfluid-sentinel-xdai.service`, and
add the network name to the start command, e.g. `ExecStart=/usr/bin/npm start xdai`.

### Docker Setup

This part of the guide assumes you have a recent version of Docker and docker-compose installed.  
You also need to have an `.env` file with the wanted configuration in the project root directory.

Build Docker image:

```
COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 docker-compose build
```

Run Docker container:

```
docker-compose up
```

This starts a sentinel in a container based on the image just built.  
The sqlite DB is stored in a Docker volume named `superfluid-sentinel_data` (can differ based on the name of your local
directory).

In order to run in the background (incl. auto-restart on crash and on reboot), start with

```
docker-compose up -d
``` 

Use `docker-compose logs` in order to see the logs in this case (add `-f` to follow the live log).

If you need to or want to rebuild the sentinel database from scratch, delete the volume:  
First, destroy the container with `docker-compose rm`.  
Then delete the volume with `docker volume rm superfluid-sentinel_data` (adapt the name if it differs on your system).

## Control flow

At startup, the sentinel syncs its state (persisted in the local sqlite DB) by issuing range queries to the RPC node for
relevant log events emitted by Superfluid contracts. Based on that state data it then executes the following steps in an
endless loop:

1. Load `FlowUpdated` events

2. Get all SuperToken addresses

3. Get all accounts (senders and receiver)

4. Estimate liquidation point (predicted time of the agreement becoming critical) for each account

5. Periodically get all estimations that are ready to be send, check account solvency status, build and send transaction

Resulting transactions are then independently monitored and the gas price bid up until executed (or reaching the
configured gas price cap).

## Design choices

### Minimal external dependencies

This sentinel should be self sufficient without depending on external services other than an RPC node (which ideally is
local too). Currently only http RPC endpoint are needed.

### Fault tolerant

Failing RPC queries will be retried several times before giving up and exiting in error state.

### Stateful

The sentinel needs to keep track of past events in order to allow it to quickly resume operation after a downtime. This
is achieved by persisting the current state to a local sqlite database. Deletion of that file or changing of the path to
the DB will cause the sentinel to start syncing from scratch on next start.

### Gas efficient

When the sentinel submits a transaction, it starts a timeout clock. When the timeout triggers, we resubmit the
transaction (same nonce) with a higher gas price. The starting gas price is currently determined using
the `eth_gasPrice` RPC method (updated per transaction). May change in the future.

## Code structure

[TODO]

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Disclaimer

YOU (MEANING ANY INDIVIDUAL OR ENTITY ACCESSING, USING OR BOTH THE SOFTWARE INCLUDED IN THIS GITHUB REPOSITORY)
EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SOFTWARE IS AT YOUR SOLE RISK. THE SOFTWARE IN THIS GITHUB
REPOSITORY IS PROVIDED ???AS IS???, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. YOU
RELEASE AUTHORS OR COPYRIGHT HOLDERS FROM ALL LIABILITY FOR YOU HAVING ACQUIRED OR NOT ACQUIRED CONTENT IN THIS GITHUB
REPOSITORY. THE AUTHORS OR COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS CONCERNING ANY CONTENT CONTAINED IN OR ACCESSED
THROUGH THE SERVICE, AND THE AUTHORS OR COPYRIGHT HOLDERS WILL NOT BE RESPONSIBLE OR LIABLE FOR THE ACCURACY, COPYRIGHT
COMPLIANCE, LEGALITY OR DECENCY OF MATERIAL CONTAINED IN OR ACCESSED THROUGH THIS GITHUB REPOSITORY.
