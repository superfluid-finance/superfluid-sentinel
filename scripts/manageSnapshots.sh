#!/bin/bash

set -xe

#Variables
filename="networks"
ipfs_api="${IPFS_API}"

generate_snapshot() {
    echo "Generating new snapshots..."
    yarn install

    if [ ! -d "snapshots" ]; then
        mkdir snapshots
    fi

    while IFS=, read -r _ rpc; do
        echo "${rpc} - ${rpc:-no rpc found}"
        [ -n "$rpc" ] && node ./scripts/buildSnapshot.js "$rpc"
    done < "$filename"
    echo "Generating done"
}

upload_snapshot() {
    echo "Uploading snapshots..."
    ipfs_logfile="logs/ipfs_$(date '+%Y-%m-%d').txt"
    rm -f -- "$ipfs_logfile"
    for file in ./snapshots/*.sqlite.gz; do
    ipfs_hash=`ipfs --api "$ipfs_api" add -q $file`
    echo $file,$ipfs_hash >> "$ipfs_logfile"
    done
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
    echo "  -g    Generate snapshots"
    echo "  -u    Upload snapshots"
    echo "  -c    Clean snapshots"
    exit 1
}

# Command line options
while getopts "gupc" opt; do
    case $opt in
        g) generate_snapshot ;;
        u) upload_snapshot ;;
        c) clean_snapshots ;;
        *) usage ;;
    esac
done

# If no options are provided, show usage
if [[ $# -eq 0 ]]; then
    usage
fi
