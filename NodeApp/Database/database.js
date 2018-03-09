var
pool, eventEmitter;

const
async               = require('async'),
dbKeyMapper         = require('./dbKeyMapper');
rmFields            = ['Date', 'Count'],
subredditsSchema    = '(pkey VARCHAR(30), tablename VARCHAR(30), UNIQUE(pkey))',
rmSchema            = '(Date NUMERIC(15), Count Numeric(10), UNIQUE(Date))',
runLogSchema        = '(Epoch NUMERIC(15), Date  VARCHAR(40))';

const enterData = (data, dataSource) => {
    /*
    Each object in the parameter data, an array, has the following structure:
    {
        "pkey": "some unique id like the name of a coin or a subreddit link",
        "data": "array of objects, each of which contains data about the pkey element on some given Date (represented by epoch of Date object)
    }
    This mapping module (represented as variable dbMapper) does the following:
    1. Creates and populates a table for mapping pkey values to their (generated) table id's in the database
    2. for each element in data: stores element['data'] as the rows of the table mapped to by pkey (from table generated in step 1)
    The reason for this is that the pkey values are things like urls, coin names, etc. and are not always valid tables names for
    an postgreSQL database. This provides a reliable way to consistently generate identifiable tables for storing unpredictable data.
    */
    dbKeyMapper.run(data, dataSource);
};

const min = (a,b) => {return a < b ? a : b; }

const cleanDatabase = () => {
    console.log("CLEANING THE DATABASE");
    let numDaysForRelevantData = 3;
    pool.query(`SELECT * FROM Subreddits`, [], (err, response) => {
        if (err) { console.log(err); }
        let {rows} = response;
        let tablenames = rows.reduce((accumulator, curr) => {
            accumulator.push(curr.tablename);
            return accumulator;
        }, []);
        tablenames = tablenames.sort();
        tablenames.forEach((tablename) => {
            pool.query(`SELECT * FROM ${tablename}`, [], (err, response) => {
                let {rows} = response;
                let mostRecentTime = min(parseInt(rows[0].date), parseInt(rows[rows.length-1].date));
                console.log("Most recent time");
                console.log(mostRecentTime);
                let cutoffTime = mostRecentTime - numDaysForRelevantData * (24 * 60 * 60 * 1000 * 1.0);
                pool.query(`DELETE FROM ${tablename} WHERE date < ${cutoffTime}`, [], (err, response) => {
                    console.log(response);
                });
            });
        });
    });
};

const setup = (fromScratchModeEnabled, eventEmitterRef, LOCAL_RUN, CLEAN_DB_ON_STARTUP) => {

    eventEmitter = eventEmitterRef;
    //Opening the postgreSQL database
    const { Pool } = require('pg'),
            options = LOCAL_RUN ? {} : {"connectionString": process.env.DATABASE_URL, "ssl": true};
            pool = new Pool(options);

    //setup key mapping sub module
    dbKeyMapper.setup(pool);
    if (fromScratchModeEnabled) {
        console.log("From scratch mode enabled: clearing out the database");
        //Reset database run log
        pool.query(`DROP TABLE IF EXISTS RunLog`, () => {
            pool.query(`CREATE TABLE RunLog ${runLogSchema}`);
        });
        //Clear redditmetrics data from database
        pool.query(`SELECT * FROM Subreddits`, (err, res) => {
            if (err) {
                console.log(`There was an error because Subreddits table does not exist. Thus we have no drops to make`);
                pool.query(`CREATE TABLE Subreddits ${subredditsSchema}`);
            } else {
                let numResolvesCount    = 0,
                    targetNumResolves   = res.rows.length,
                    {rows}              = res;
                rows.forEach((row) => {
                    var tn = row.tablename,
                        tableDropPromise = new Promise((resolve, reject) => {
                            pool.query(`DROP TABLE IF EXISTS ${tn}`, (err, res) => {
                                if (err) { reject(err); }
                                console.log(`Dropped table ${tn}`);
                                resolve();
                            });
                        });
                    tableDropPromise.then(
                        () => {
                            //resolved
                            numResolvesCount++;
                            if (numResolvesCount === targetNumResolves) {
                                console.log("we have dropped all tables from subreddits");
                                pool.query("DROP TABLE IF EXISTS subreddits", (err, res) => {
                                    if (err) { throw err; }
                                    pool.query(`CREATE TABLE IF NOT EXISTS subreddits ${subredditsSchema}`, (err, res) => {
                                        if (err) { throw err; }
                                    });
                                });
                            }
                        },
                        (err) => {
                            //rejected
                            throw err;
                        }
                    );
                });
            }
        });
    } else {
        console.log("From scratch mode disabled. Database contents (including RunTable) left unaltered");
        pool.query(`CREATE TABLE IF NOT EXISTS RunLog ${runLogSchema}`);
        pool.query(`CREATE TABLE IF NOT EXISTS Subreddits ${subredditsSchema}`);
    }

    if (CLEAN_DB_ON_STARTUP) {
        cleanDatabase();
    }

    return pool;
};

module.exports = {
    "setup": setup,
    "enterData": enterData,
    "cleanDatabase": cleanDatabase
};
