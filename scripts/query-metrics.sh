#!/bin/bash

# requires curl and jq

set -e
set -o pipefail

host=${HOST:-http://localhost:9100}
timeframe=${TIMEFRAME:-"1h"}

# Check if curl is installed
if ! command -v curl &> /dev/null
then
    echo "curl could not be found"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null
then
    echo "jq could not be found"
    exit 1
fi

# Function to display help
function display_help() {
    echo "Usage: $0 <command> [argument(s)]"
    echo
    echo "Commands:"
    echo "  streams                             List of streams due for liqudation in the given timeframe"
    echo "  nr-streams                          Number of streams due for liqudation in the given timeframe"
    echo "  streams-filter-token <token>        List of streams due, filtered by SuperToken address"
    echo "  streams-filter-sender <sender>      List of streams due, filtered by sender address"
    echo "  streams-filter-receiver <receiver>  List of streams due, filtered by receiver address"
    echo "  streams-above-flowrate <flowrate>   List of streams due, filtered by flowrate being above (wad/seconds)"
    echo "  streams-above-flowrate <flowrate>   List of streams due, filtered by flowrate being below (wad/seconds)"
    echo "  nr-streams-by-token                 Number of streams due, grouped by SuperToken"
    echo "  nr-streams-by-sender                Number of streams due, grouped by sender"
    echo "  nr-streams-by-receiver              Number of streams due, grouped by receiver"
    echo
    echo "ENV vars:"
    echo "  HOST: use a host other than 'http://localhost:9100'"
    echo "  TIMEFRAME: use a timeframe other than '1h' - supported units range from minutes to years: m, h, d, w, M, y"
    echo "  DEBUG: if set, the command executed is printed before its execution. This can be useful if you want to modify a query"
    echo
    echo "Note that you can further process all list formatted output with jq, e.g. in order to count items returned by a filter query just append ' | jq length'."
    echo "This works only if the DEBUG var is not set"
    exit 0
}

# Check if no command is provided
if [ $# -eq 0 ]; then
    echo "No command provided"
    display_help
    exit 1
fi

# Process command
case "$1" in
    streams)
        cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq"
        [[ $DEBUG ]] && echo "$cmd"
        eval "$cmd" || echo "### FAILED"
        ;;
    nr-streams)
        cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq length"
        [[ $DEBUG ]] && echo "$cmd"
        eval "$cmd" || echo "### FAILED"
        ;;
    streams-filter-token)
        if [ $# -eq 2 ]; then
            token=${2,,} # convert to lowercase
            cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq '.[] | select(.superToken | ascii_downcase == \"$token\")'"
            [[ $DEBUG ]] && echo "$cmd"
            eval "$cmd" || echo "### FAILED"
        else
            echo "Error: '$1' requires a token (address) argument"
            exit 1
        fi
        ;;
    streams-filter-sender)
        if [ $# -eq 2 ]; then
            sender=${2,,} # convert to lowercase
            cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq '.[] | select(.sender | ascii_downcase == \"$sender\")'"
            [[ $DEBUG ]] && echo "$cmd"
            eval "$cmd" || echo "### FAILED"
        else
            echo "Error: '$1' requires a sender (address) argument"
            exit 1
        fi
        ;;
    streams-filter-receiver)
        if [ $# -eq 2 ]; then
            receiver=${2,,} # convert to lowercase
            cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq '.[] | select(.receiver | ascii_downcase == \"$receiver\")'"
            [[ $DEBUG ]] && echo "$cmd"
            eval "$cmd" || echo "### FAILED"
        else
            echo "Error: '$1' requires a receiver (address) argument"
            exit 1
        fi
        ;;
    streams-above-flowrate)
        if [ $# -eq 2 ]; then
            flowrate=$2
            cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq '[.[] | select(.flowRate > $flowrate)]'"
            [[ $DEBUG ]] && echo "$cmd"
            eval "$cmd" || echo "### FAILED"
        else
            echo "Error: '$1' requires a flowrate (wad/second) argument"
            exit 1
        fi
        ;;
    streams-below-flowrate)
        if [ $# -eq 2 ]; then
            flowrate=$2
            cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq '[.[] | select(.flowRate < $flowrate)]'"
            [[ $DEBUG ]] && echo "$cmd"
            eval "$cmd" || echo "### FAILED"
        else
            echo "Error: '$1' requires a flowrate (wad/second) argument"
            exit 1
        fi
        ;;
    nr-streams-by-token)
        cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq 'group_by(.superToken) | map({superToken: .[0].superToken, count: length})'"
        [[ $DEBUG ]] && echo "$cmd"
        eval "$cmd" || echo "### FAILED"
        ;;
    nr-streams-by-sender)
        cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq 'group_by(.sender) | map({sender: .[0].sender, count: length})'"
        [[ $DEBUG ]] && echo "$cmd"
        eval "$cmd" || echo "### FAILED"
        ;;
    nr-streams-by-receiver)
        cmd="curl -s $host/nextliquidations?timeframe=$timeframe | jq 'group_by(.receiver) | map({receiver: .[0].receiver, count: length})'"
        [[ $DEBUG ]] && echo "$cmd"
        eval "$cmd" || echo "### FAILED"
        ;;
    --help)
        display_help
        ;;
    *)
        echo "Unknown command: $1"
        display_help
        exit 1
        ;;
esac
