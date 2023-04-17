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

Requires Node.js v16+ and npm already installed.

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

### Monitoring & Alerting

The sentinel can provide monitoring information. In the default configuration, this is available on port 9100 and json formatted.
This includes a flag "healthy" which turns to `false` in case of malfunction, e.g. if there's a problem with the local DB or with the RPC connection.

You can also set up notifications to Slack or Telegram. Events triggering a notification include
* sentinel restarts
* transactions held back to due the configured gas price limit
* PIC changes relevant for your instance
* insufficient funds for doing liquidations

In order to set up notifications, see `.env-example` for the relevant configuration items.

The notification system is modular. If you want support for more channels, consider adding it. See `src/services/slackNotifier.js` for a blueprint. PRs are welcome!

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

#### Update

In order to update to a new version, first go to https://github.com/superfluid-finance/superfluid-sentinel/releases in order to see recent releases and a brief description.  
New releases may also add or change default configuration items, documented in this README and `.env-example`.

Once you decided to do an update to the latest version, cd into the sentinel directory and do
```
git pull
```
in order to get the latest version of the code. Then do
```
NODE_ENV=production npm ci
```
in order to update dependencies if needed.
Then restart the service(s). E.g. for a single instance running with systemd, do
```
systemctl restart superfluid-sentinel.service
```

Finally, you may check the logs in order to make sure the restart went well.

### Docker Setup

This part of the guide assumes you have a recent version of Docker and docker-compose installed.  
You also need to have an `.env` file with the wanted configuration in the project root directory.

If running with Docker, you can choose between a minimal and a default configuration.  
The default configuration `docker-compose.yml` runs the sentinel together with [Prometheus](https://prometheus.io/) and [Grafana](https://grafana.com/) for monitoring.  
The minimal configuration `docker-compose-minimal.yml` runs only the sentinel service. Choose this if you have a resource constrained environment and/or have your own monitoring solution.  
You can switch to the minimal configuration by setting `COMPOSE_FILE=docker-compose-minimal.yml` in your `.env` file.

In order to start the container(s):

```
docker-compose up
```

On first invocation, this builds a Docker image for the sentinel from source (which can take a while) and then starts it.
On consecutive runs, the image is reused.  
The sqlite DB is stored in a Docker volume named `superfluid-sentinel_data` (can differ based on the name of your local
directory).

In order to run in the background (incl. auto-restart on crash and on reboot), start with

```
docker-compose up -d
``` 

Use `docker-compose logs` in order to see the logs in this case (add `-f` to follow the live log).

If you're running the default configuration, you can now access a Grafana dashboard at the configured port (default: 3000).  
The initial credentials are admin:admin, you will be asked to change the password on first login.  
A sentinel specific dashboard is not yet included, but you can already select a generic dashboard for node.js applications.
Work is in progress for adding more sentinel specific metrics to the prometheus exporter of the sentinel application which feeds Grafana.

If you need to or want to rebuild the sentinel database from scratch, delete the volume:  
First, destroy the container with `docker-compose rm`.  
Then delete the volume with `docker volume rm superfluid-sentinel_data` (adapt the name if it differs on your system).

### Update

The process for updating docker based sentinel instances will be simplified soon.  

Currently, after cd'ing into the sentinel directory, you need to first stop with
```
docker-compose down
```
Then get the latest code with
```
git pull
```
Then remove the sentinel docker container and image:
```
docker rm superfluid-sentinel_sentinel_1 && docker image rm superfluid-sentinel_sentinel
```
(the container and image name may differ if your directory is named differently)

Now you can trigger a re-building of the sentinel image with
```
docker-compose up
```
After building the image, this will also create a new container based on it and start it.

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
REPOSITORY IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. YOU
RELEASE AUTHORS OR COPYRIGHT HOLDERS FROM ALL LIABILITY FOR YOU HAVING ACQUIRED OR NOT ACQUIRED CONTENT IN THIS GITHUB
REPOSITORY. THE AUTHORS OR COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS CONCERNING ANY CONTENT CONTAINED IN OR ACCESSED
THROUGH THE SERVICE, AND THE AUTHORS OR COPYRIGHT HOLDERS WILL NOT BE RESPONSIBLE OR LIABLE FOR THE ACCURACY, COPYRIGHT
COMPLIANCE, LEGALITY OR DECENCY OF MATERIAL CONTAINED IN OR ACCESSED THROUGH THIS GITHUB REPOSITORY.
