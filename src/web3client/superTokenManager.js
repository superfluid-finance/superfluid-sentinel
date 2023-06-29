const ISuperToken = require("@superfluid-finance/ethereum-contracts/build/contracts/ISuperToken.json");

class SuperTokenManager {
    constructor(app) {
        if(!app) throw new Error("SuperTokenManager: app is not defined");
        this.app = app;
        //TODO: this should be refactored
        this.superTokenNames = new Map();
        this.superTokens = new Map();
        this.superTokensAddresses = [];
    }

    // save super tokens to DB and memory. Optionally set PIC for that token
    async saveSuperToken (newSuperToken, setPIC=false) {
        // check if the super token is already loaded
        if (this.superTokens[newSuperToken.toLowerCase()] !== undefined) {
            return;
        }
        const { superToken, tokenName, tokenSymbol } = this.app.contractLoader.getSuperToken(newSuperToken);
        // get liquidation period
        const pppConfig = await this.app.contractLoader.gov.methods.getPPPConfig(this.app.contractLoader.sf._address, newSuperToken).call();

        
        // if liquidation period and patrician period are not set
        if (pppConfig.liquidationPeriod === "0" && pppConfig.patricianPeriod === "0") {
            this.app.logger.error(`SuperTokenManager: Liquidation period and patrician period are 0 for ${tokenSymbol} - ${tokenName} (${newSuperToken})`);
        }

        superToken.liquidation_period = parseInt(pppConfig.liquidationPeriod);
        superToken.patrician_period = parseInt(pppConfig.patricianPeriod);


        const isListed = this.isSuperTokenListed(newSuperToken);
        const onlyListed = this.app.config.ONLY_LISTED === true && isListed ? 1 : null;
        const tokenAddress = newSuperToken.toLowerCase();
        const tokenInfo = isListed ? `SuperToken (${tokenSymbol} - ${tokenName}): ${tokenAddress}` : `(${tokenSymbol} - ${tokenName}): ${tokenAddress}`;


        this.app.logger.info(tokenInfo);
        this.superTokenNames[tokenAddress] = tokenInfo;
        this.superTokens[tokenAddress] = superToken;
        this.superTokensAddresses.push(tokenAddress);

        // persistence database
        await this.app.db.models.SuperTokenModel.upsert({
            address: newSuperToken,
            symbol: tokenSymbol,
            name: tokenName,
            liquidationPeriod: superToken.liquidation_period,
            patricianPeriod: superToken.patrician_period,
            listed: onlyListed
        });

        // use for runtime subscription
        if(setPIC) {
            await this.app.protocol.calculateAndSaveTokenDelay(newSuperToken, false);
        }
    }

    // add new Super Tokens to database and memory if needed
    async loadSuperTokens(newSuperTokens) {
        try {
            await this._loadSuperTokensFromDB();
            const promises = newSuperTokens.map(async (token) => {
                return this.saveSuperToken(token);
            });
            await Promise.all(promises);
        } catch (err) {
            this.app.logger.error(err);
            throw new Error(`SuperTokenManager.loadSuperTokens(): ${err}`);
        }
    }

    // get super tokens and load them
    async _loadSuperTokensFromDB() {
        try {

            const filter = {
                attributes: ["address"],
                where: this.app.config.ONLY_LISTED_TOKENS ? { listed: 1 } : undefined
            };

            const superTokensDB = await this.app.db.models.SuperTokenModel.findAll(filter);
            for(const token of superTokensDB) {
                await this.saveSuperToken(token.address);
            }
        } catch (err) {
            this.app.logger.error(err);
            throw new Error(`SuperTokenManager: _loadSuperTokensFromDB(): ${err}`);
        }
    }

    async isSuperTokenListed(superTokenAddress) {
        const resolvedSuperTokenAddress = await this.resolver.methods.get(`supertokens.${this.app.version}.${tokenSymbol}`).call();
        return resolvedSuperTokenAddress === superTokenAddress;
    }
}

module.exports = SuperTokenManager;