#!/bin/bash

set -xe

#Variables
filename="networks"
ipfs_api="${IPFS_API:-/ip4/65.21.152.182/tcp/5001}"

generate_snapshot() {
    echo "Generating new snapshots..."
    yarn install

    if [ ! -d "snapshots" ]; then
        mkdir snapshots
    fi

    # Check if network argument is provided
    if [ -z "$1" ]; then
        echo "Usage: $0 -g <network>"
        exit 1
    fi

    # Search for the specified network in the filename
    if grep -q "^$1," "$filename"; then
        echo "Generating snapshot for $1..."
        url=$(grep "^$1," "$filename" | cut -d ',' -f 2)  # Extract URL
        [ -n "$url" ] && node ./scripts/buildSnapshot.js "$url"
        echo "Generating done"
    else
        echo "Error: Network '$1' not found in '$filename'."
        exit 1
    fi
}


upload_snapshot() {
    echo "Uploading snapshots..."
    ipfs_logfile="logs/ipfs_$(date '+%Y-%m-%d').txt"
    rm -f -- "$ipfs_logfile"
    for file in ./snapshots/*.sqlite.gz; do
      ipfs_hash=`ipfs --api "$ipfs_api" add -q $file`
      echo $file,$ipfs_hash >> "$ipfs_logfile"
    done
    rm manifest.json
    node ./scripts/generateManifest.js "$ipfs_logfile" manifest.json
    ipfs_hash=`ipfs --api "$ipfs_api" add -q manifest.json`
    echo manifest.json,$ipfs_hash >> "$ipfs_logfile"
    # updating the manifest ipns link
    ipfs --api "$ipfs_api" name publish --key=sentinel-manifest "$ipfs_hash"
    echo "Uploading snapshots done"
}

clean_snapshots() {
    echo "Cleaning snapshot folder..."
    rm -f -- "$HOME/snapshots"/*.gz
    echo "Cleaning done"
}

# Usage
usage() {
    echo "Usage: $0 [-g] [-u] [-p] [-c]"
    echo "Options:"
    echo "  -g <network-name> Generate snapshots"
    echo "  -u    Upload snapshots"
    echo "  -c    Clean snapshots"
    exit 1
}

# Command line options
while getopts "g:upc" opt; do
    case $opt in
        g) generate_snapshot "$OPTARG" ;;
        u) upload_snapshot ;;
        c) clean_snapshots ;;
        *) usage ;;
    esac
done


# If no options are provided, show usage
if [[ $# -eq 0 ]]; then
    usage
fi
