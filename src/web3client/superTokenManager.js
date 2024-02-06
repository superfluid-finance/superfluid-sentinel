/**
 * The SuperTokenManager class is responsible for managing SuperToken instances,
 * including loading, saving, and querying their state. It interacts with the
 * blockchain to fetch SuperToken details and stores relevant information in both
 * memory and the database for quick access
 */

class SuperTokenManager {
    /**
     * Constructs a new SuperTokenManager instance
     * @param {Object} app The application context, providing access to various services and configurations
     * @throws {Error} If the application context is not provided
     */
    constructor(app) {

        if(!app) throw new Error("SuperTokenManager: app is not defined");

        this.app = app;

        //TODO: this should be refactored
        this.superTokenNames = new Map();
        this.superTokens = new Map();
        this.superTokensAddresses = [];
    }

    /**
     * Saves a new SuperToken to both memory and database. Optionally sets the PIC for the token
     * @param {string} newSuperToken The address of the SuperToken to save
     * @param {boolean} setPIC Indicates whether to set the PIC for the token
     */
    async saveSuperToken (newSuperToken, setPIC=false) {
        // check if the super token is already loaded
        if (this.superTokens[newSuperToken.toLowerCase()] !== undefined) {
            return;
        }

        const { superToken, tokenName, tokenSymbol } = await this.app.client.contracts.getSuperTokenInstance(newSuperToken);
        // get liquidation period
        const pppConfig = await this.app.client.contracts.gov.methods.getPPPConfig(
            this.app.client.contracts.getSuperfluidAddress(),
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

    /**
     * Adds new SuperTokens to the database and memory if they are not already loaded
     * This method ensures that all provided SuperTokens are managed by the instance
     * @param {Array<string>} newSuperTokens An array of new SuperToken addresses to load
     */
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

    /**
     * Loads a single SuperToken into the manager, if it's not already loaded
     * Optionally sets the PIC for the SuperToken
     * @param {string} newSuperToken The address of the SuperToken to load
     * @param {boolean} setPIC Indicates whether to set the PIC for the token
     */
    async loadSuperToken(newSuperToken, setPIC=false) {
        if (this.superTokens[newSuperToken.toLowerCase()] !== undefined) {
            return;
        }
        const { superToken, tokenName, tokenSymbol } = await this.app.client.contracts.getSuperTokenInstance(newSuperToken);
        // get liquidation period
        const pppConfig = await this.app.client.contracts.gov.methods.getPPPConfig(
            this.app.client.contracts.getSuperfluidAddress(),
            newSuperToken
        ).call();

        // if liquidation period and patrician period are not set
        if (pppConfig.liquidationPeriod === "0" && pppConfig.patricianPeriod === "0") {
            this.app.logger.error(`Liquidation period and patrician period are 0 for ${tokenSymbol} - ${tokenName} (${newSuperToken})`);
        }
        superToken.liquidation_period = parseInt(pppConfig.liquidationPeriod);
        superToken.patrician_period = parseInt(pppConfig.patricianPeriod);

        const superTokenAddress = await this.app.client.contracts.resolver.methods.get(
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

    /**
     * Checks if a SuperToken is listed on the Superfluid Resolver contract
     * This can be used to filter tokens based on their listing status
     * @param {string} superTokenAddress The address of the SuperToken to check
     * @param {string} [tokenSymbol=undefined] Optional. The symbol of the SuperToken, if already known
     * @returns {Promise<boolean>} True if the SuperToken is listed, false otherwise
     */
    async isSuperTokenListed(superTokenAddress, tokenSymbol = undefined) {
        if(tokenSymbol === undefined) {
            const { tokenSymbol } = this.app.client.contracts.getSuperTokenInstance(superTokenAddress);
        }
        const resolvedSuperTokenAddress = await this.app.client.contracts.resolver.methods.get(`supertokens.${this.app.version}.${tokenSymbol}`).call();
        return resolvedSuperTokenAddress === superTokenAddress;
    }

    /**
     * Checks if a SuperToken is already registered and managed by this instance
     * @param {string} token The address of the SuperToken to check
     * @returns {boolean} True if the SuperToken is registered, false otherwise
     */
    isSuperTokenRegistered (token) {
        return this.superTokens[token.toLowerCase()] !== undefined;
    }

    /**
     * Loads SuperTokens from the database into memory at startup
     * @private
     */
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
}

module.exports = SuperTokenManager;