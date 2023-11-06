const sinon = require('sinon');
const { expect } = require('chai');
const SQLRepository = require('../../../src/database/SQLRepository');
const {QueryTypes} = require("sequelize");

describe('SQLRepository', () => {
    let appMock;
    let baseRepo;

    beforeEach(() => {
        appMock = {
            db: {
                query: sinon.stub()
            }
        };
        baseRepo = SQLRepository.getInstance(appMock);
    });

    afterEach(() => {
        sinon.restore();
        SQLRepository._instance = null;
    });

    it("#1 - should get instance", () => {
        const instance = SQLRepository.getInstance(appMock);
        expect(instance).to.be.instanceOf(SQLRepository);
    });

    it("#2 - should throw an error if app is not defined", () => {
        expect(() => new SQLRepository()).to.throw("SQLRepository: app is not defined");
    });

    it('#3 - should execute SQL with replacements', async () => {
        const query = `SELECT * FROM users WHERE id = ?`;
        const replacements = [1];

        await baseRepo.executeSQLSelect(query, replacements);

        expect(appMock.db.query.calledWith(query, {
            replacements: replacements,
            type: QueryTypes.SELECT
        })).to.be.true;
    });

    it('#4 - should execute SQL without replacements', async () => {
        const query = `SELECT * FROM users`;
        await baseRepo.executeSQLSelect(query);

        expect(appMock.db.query.calledWith(query, {
            replacements: {},
            type: QueryTypes.SELECT
        })).to.be.true;
    });

    it("#5 - should throw an error if replacements is not an object", async () => {
        const query = `SELECT * FROM users`;
        const replacements = "test";
        try {
            await baseRepo.executeSQLSelect(query, replacements);
        } catch (e) {
            expect(e.message).to.equal("SQLRepository: replacements must be an object");
        }
    });
});
