# Superfluid Sentinel

The sentinel monitors the state of Superfluid agreements on the configured network and
liquidates [critical agreements](https://docs.superfluid.finance/docs/protocol/advanced-topics/solvency/liquidations-and-toga#liquidation-and-solvency).
It also allows you to configure a related PIC account and other parameters related to [3Ps & TOGA](https://docs.superfluid.finance/docs/protocol/advanced-topics/solvency/liquidations-and-toga#patricians-plebs-and-pirates-3ps).

## How to run a Sentinel

Currently supported setups:

* Docker
* Native

### Prerequisites

First, prepare an account funded with native coins for transaction fees.
Then prepare a file `.env` with your configuration. You can start with the provided example:

```
cp .env.example .env
```

The following configuration items are required and don't have default values:

* `HTTP_RPC_NODE` (cmdline argument: `-H`)
* `PRIVATE_KEY` (cmdline argument: `-k`) or `MNEMONIC` (cmdline argument: `-m`)

In order to associate a sentinel instance with a PIC account, set the `PIC` env variable (cmdline argument: `--pic`).

Check `.env.example` for additional configuration items and their documentation.

### Docker Setup

This part of the guide assumes you have a recent version of Docker and Compose v2 installed.

1. Create a directory and enter it
```
mkdir superfluid-sentinel && cd superfluid-sentinel
```

2. Create a file `docker-compose.yml`. You can copy one contained in this repository or write one yourself.

3. Create a file (see prerequisites section)

4. Start the application with `docker compose up` (add ` -d` to run in the background)

This should pull the latest sentinel image and start it with the provided configuration.

An sqlite DB is stored in a Docker volume named `superfluid-sentinel_data` (can differ based on the name of your local
directory).

Use `docker compose logs` in order to see the logs in this case (add `-f` to follow the live log).

#### Update

In order to update to the latest published image, run `docker compose pull`, then restart the application with `docker compose up -d`.

Sometimes you may need to re-sync the sentinel DB. That is the case if you change network (different chainId) or if the DB schema changes.
In this case, first shutdown the container with `docker compose down`.
Then either identify and delete the data volume, or add a config flag `COLD_BOOT=1` to `.env` and then run with `docker compose up`. This tells the sentinel to drop the previous DB and rebuild it from scratch.
As soon as you see the sentinel syncing, you can again shut it down, remove the flag from `.env` and start it again.

Caution: don't forget to remove the flag `COLD_BOOT` from your config, otherwise the sentinel will rebuild the DB on every restart, which may considerably delay its operation and consume a lot of RPC requests.

#### Local build

Instead of using a published Docker image, you can also build your own image and use it.
In order to do so, clone this repository and create an `.env` file, then run
```
docker compose up --build
```

#### Bundled monitoring services

If you want to run the sentinel bundled with Prometheus and Grafana, use the compose file `docker-compose-with-monitoring.yml` instead of the default one.
In order to do so, you can either set `COMPOSE_FILE=docker-compose-with-monitoring.yml` in your .env, or copy and rename to `docker-compose.yml`.

When running this, you can access a Grafana dashboard at the configured port (default: 3000).
The initial credentials are admin:admin, you will be asked to change the password on first login.

A sentinel specific dashboard is not yet included, but you can already select a generic dashboard for node.js applications.
Work is in progress for adding more sentinel specific metrics to the prometheus exporter of the sentinel application which feeds Grafana.

### Native Setup

Requires Node.js v18+ and yarn already installed.

First, check out this repository and cd into it:

```
git clone https://github.com/superfluid-finance/superfluid-sentinel.git
cd superfluid-sentinel
```

Then install dependencies with:

```
NODE_ENV=production yarn install
```

Before starting the instance, make sure it's configured according to your needs. The configuration can be provided
via `.env` file, via env variables and/or via cmdline args, with the latter taking higher precedence than the former.

For persistent operation in the background, you can use the provided systemd unit template.

```
cp superfluid-sentinel.service.template superfluid-sentinel.service
```

Then edit `superfluid-sentinel.service` to match your setup. You need to set the working directory to the root directory
of the sentinel, the username to execute with and the path to yarn on your system. Then you can install and start the
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
E.g. if you want to run a sentinel for Gnosis Chain and a sentinel for polygon, you can prepare env files `.env-gnosis` and `.env-polygon`
with the respective settings.
You need to set `DB_PATH` to different values instead of using the default value, otherwise the instances will conflict.
You may also want to set the variable `CHAIN_ID` (e.g. `CHAIN_ID=100` for gnosis). This makes sure you don't accidentally
use the wrong RPC node or write to a sqlite file created for a different network.

With the env files in place, you can start instances like this:

```
yarn start <network-name>
```

For example: `yarn start gnosis`will start an instance configured according to the settings in `.env-gnosis`.

If you use systemd, create instance specific copies of the service file, e.g. `superfluid-sentinel-gnosis.service`, and
add the network name to the start command, e.g. `ExecStart=/home/ubuntu/.nvm/nvm-exec yarn start xdai`.
Instead of duplicating service definitions, you may instead also use [instantiated units](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/using_systemd_unit_files_to_customize_and_optimize_your_system/assembly_working-with-systemd-unit-files_working-with-systemd#con_working-with-instantiated-units_assembly_working-with-systemd-unit-files) to keep the setup simple with multiple sentinel instances. Such a template systemd unit file could be named `superfluid-sentinel-@.service` and contain this execution command:
```
ExecStart=<path to yarn> start %i
```

#### Update

In order to update to a new version, first go to https://github.com/superfluid-finance/superfluid-sentinel/releases in order to see recent releases and a brief description.
New releases may also add or change default configuration items, documented in this README and `.env.example`.

Once you decided to do an update to the latest version, cd into the sentinel directory and do
```
git pull
```
in order to get the latest version of the code. Then do
```
NODE_ENV=production yarn ci
```
in order to update dependencies if needed.
Then restart the service(s). E.g. for a single instance running with systemd, do
```
systemctl restart superfluid-sentinel.service
```

Finally, you may check the logs in order to make sure the restart went well.

## Advanced configuration

### Flowrate Thresholds

In order to exclude _dust streams_ from liquidations, you can provide a file `thresholds.json` declaring a list of such thresholds.
An example is provided in `thresholds.json.example`:
```
{
  "schema-version": "1",
  "name": "sentinel-threshold",
  "networks": {
    "137": {
      "name": "Polygon",
      "thresholds": [{
        "address": "0xCAa7349CEA390F89641fe306D93591f87595dc1F",
        "above": "3858024691"
      }]
    }
  }
}
```

* `address` is a Super Token address
* `above` is a flowrate threshold (in wei per second)

If critical or insolvent streams of a Super Token with a flowrate belove that value are found, they are ignored.
This mechanism can be used to avoid spending tx fees for dust streams with negligible buffer amounts compensating for the liquidation tx fees.

Note that dust streams don't intrinsically come with negligible buffer. The protocol allows to set a minimum buffer amount to be paid.
There is however existing streams which were created before such a minimum buffer was put in place.

## Monitoring, Alerting & Telemetry

The sentinel can provide monitoring information. In the default configuration, this is available on port 9100 and returns json formatted data.

The endpoint `/` returns a status summary, including a flag `healthy` which turns to `false` in case of malfunction, e.g. if there's a problem with the local DB or with the RPC connection.
The endpoint `/nextliquidations` returns a list accounts likely up for liquidation next. The timeframe for that preview defaults to 1h. You can set a custom timeframe by setting an url parameter `timeframe`. Supported units are m (minutes), h (hours), d(days), w(weeks), M(months), y(years). Example: `/nextliquidations?timeframe=3d`

Using the json parsing tool `jq`, you can pretty-print the output of the metris endpoint and also run queries on it.
There's also a convenience script available with a few potentially useful queries, see `scripts/query-metrics.sh --help`.
(Note: this script doesn't use the ENV vars related to metrics from the .env file - you need to set the HOST env var if your sentinel isn't listening at http://localhost:9100).

You can also set up notifications to Slack or Telegram. Events triggering a notification include
* sentinel restarts
* transactions held back to due the configured gas price limit
* PIC changes relevant for your instance
* insufficient funds for doing liquidations

In order to set up notifications, see `.env.example` for the relevant configuration items.

The notification system is modular. If you want support for more channels, consider adding it. See `src/services/slackNotifier.js` for a blueprint. PRs are welcome!

Sentinel instances also periodically (default: every 12 hours) report basic metrics to a telemetry endpoint.
This helps understanding how many instances are active and what their approximate configuration is.
Reported metrics:
* uuid (randomly generated on first start and preserved in a file "data/uuid.txt")
* chain i
* nodejs version
* sentinel version
* healthy flag (false e.g. if the configured RPC is drifting)
* nr of rpc requests (since last restart)
* account balance (rounded to 3 decimal places)
* memory used by the process

## Control flow

At startup, the sentinel syncs its state (persisted in the local sqlite DB) by issuing range queries to the RPC node for
relevant log events emitted by Superfluid contracts. Based on that state data it then executes the following steps in an
endless loop:

1. Load relevant agreement events like `FlowUpdated`

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
