const { writeFileSync, readFileSync } = require("fs");

function cleanLogData(path) {
    const newCIDs = new Map();
    try {
        readFileSync(path, "utf8").split(/\r?\n/).forEach(line => {
            const splitLine = line.split(",");
            const fileName = splitLine[0];
            const filtered = fileName.match("_(.*)_")
            if(filtered) {
                newCIDs.set(filtered[1], splitLine[1]);
            }
        });
        return newCIDs;
    } catch (err) {
        console.log(err);
    }
}

(() => {
    try {
        const myArgs = process.argv.slice(2);
        const ipfsLog = myArgs[0];
        const outputFile = myArgs[1];
	
        console.log(`ipfs log file: ${ipfsLog}, output file: ${outputFile}`);
	
        if(!ipfsLog) {
            throw new Error("No IPFS log")
        }
        if(!outputFile) {
            throw new Error("No output file")
        }

        const newCIDs = cleanLogData(ipfsLog);
        /*if(newCIDs.size !== 10) {
            throw new Error("IPFS log not complety")
        }*/

        // Read manifest data from local file
        const manifestJson = JSON.parse(readFileSync('manifest.json', 'utf8'));

        // Update manifest in memory
        for (const [key, value] of newCIDs) {
            manifestJson.networks[key].cid = value;
        }

        // Write updated manifest to output file
        writeFileSync(outputFile, JSON.stringify(manifestJson, null, 2));
        
    } catch (err) {
        console.error(err)
    }
})();
