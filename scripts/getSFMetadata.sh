#Generate networks file from Superfluid Metadata
#!/bin/bash

# Superfluid Metdata URL
input_json_url="https://raw.githubusercontent.com/superfluid-finance/protocol-monorepo/dev/packages/metadata/networks.json"

# Variables
#TODO: Move variable to github secret
common_domain="${COMMON_DOMAIN:-.rpc.x.superfluid.dev}"

# Download the input JSON file
wget -O input.json "$input_json_url"

# Check if jq is installed
if ! command -v jq &>/dev/null; then
    echo "jq is required but it's not installed. Aborting."
    exit 1
fi

# Process the input JSON file
# Create output file
output_file="output.txt"

# Extract data from JSON and write to text file
jq -r --arg common_domain "$common_domain" '.[] | "\(.name),https://\(.name)\($common_domain)"' input.json > networks

echo "Text file created: networks"

rm input.json
