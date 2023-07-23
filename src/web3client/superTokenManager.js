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

        const { superToken, tokenName, tokenSymbol } = await this.app.client.contracts.getSuperTokenInstance(newSuperToken);
        // get liquidation period
        const pppConfig = await this.app.client.contracts.gov.methods.getPPPConfig(
            this.app.client.contracts.sf.options.address,
            newSuperToken
        ).call();

        // if liquidation period and patrician period are not set
        if (Number(pppConfig.liquidationPeriod) === 0 && Number(pppConfig.patricianPeriod) === 0) {
            this.app.logger.error(`SuperTokenManager: Liquidation period and patrician period are 0 for ${tokenSymbol} - ${tokenName} (${newSuperToken})`);
        }
        superToken.liquidation_period = parseInt(pppConfig.liquidationPeriod);
        superToken.patrician_period = parseInt(pppConfig.patricianPeriod);

        const isListed = await this.isSuperTokenListed(newSuperToken, tokenSymbol);
        const onlyListed = this.app.config.ONLY_LISTED === true && isListed ? 1 : 0;
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

    async loadSuperToken(newSuperToken, setPIC=false) {
        if (this.superTokens[newSuperToken.toLowerCase()] !== undefined) {
            return;
        }
        const { superToken, tokenName, tokenSymbol } = this.app.client.contracts.getSuperTokenInstance(newSuperToken);

        // get liquidation period
        const pppConfig = await this.app.client.contracts.gov.methods.getPPPConfig(
            this.app.client.contracts.sf.options.address,
            newSuperToken
        ).call();

        // if liquidation period and patrician period are not set
        if (pppConfig.liquidationPeriod === "0" && pppConfig.patricianPeriod === "0") {
            this.app.logger.error(`Liquidation period and patrician period are 0 for ${tokenSymbol} - ${tokenName} (${newSuperToken})`);
        }
        superToken.liquidation_period = parseInt(pppConfig.liquidationPeriod);
        superToken.patrician_period = parseInt(pppConfig.patricianPeriod);

        const superTokenAddress = await this.contracts.resolver.methods.get(
            `supertokens.${this.version}.${tokenSymbol}`
        ).call();

        let isListed = superTokenAddress === newSuperToken;
        if (this.app.config.ONLY_LISTED_TOKENS === true && isListed) {
            const tokenInfo = `SuperToken (${tokenSymbol} - ${tokenName}): ${superTokenAddress}`;
            this.app.logger.info(tokenInfo);
            this.superTokenNames[newSuperToken.toLowerCase()] = tokenInfo;
            this.superTokens[superTokenAddress.toLowerCase()] = superToken;
            this.superTokensAddresses.push(superTokenAddress.toLowerCase());
            isListed = 1;
        } else {
            const tokenInfo = `(${tokenSymbol} - ${tokenName}): ${newSuperToken}`;
            this.app.logger.info(tokenInfo);
            this.superTokenNames[newSuperToken.toLowerCase()] = tokenInfo;
            this.superTokens[newSuperToken.toLowerCase()] = superToken;
            this.superTokensAddresses.push(newSuperToken.toLowerCase());
        }
        // persistence database
        await this.app.db.models.SuperTokenModel.upsert({
            address: newSuperToken,
            symbol: tokenSymbol,
            name: tokenName,
            liquidationPeriod: parseInt(pppConfig.liquidationPeriod),
            patricianPeriod: parseInt(pppConfig.patricianPeriod),
            listed: isListed
        });
        // use for runtime subscription
        if(setPIC) {
            this.app.protocol.calculateAndSaveTokenDelay(newSuperToken, false);
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

    async isSuperTokenListed(superTokenAddress, tokenSymbol = undefined) {
        if(tokenSymbol === undefined) {
            const { tokenSymbol } = this.app.client.contracts.getSuperTokenInstance(superTokenAddress);
        }
        const resolvedSuperTokenAddress = await this.app.client.contracts.resolver.methods.get(`supertokens.${this.app.version}.${tokenSymbol}`).call();
        return resolvedSuperTokenAddress === superTokenAddress;
    }

    isSuperTokenRegistered (token) {
        return this.superTokens[token.toLowerCase()] !== undefined;
    }
}

module.exports = SuperTokenManager;