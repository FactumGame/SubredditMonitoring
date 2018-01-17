var
pool, eventEmitter;

const
async               = require('async'),
dbKeyMapper         = require('./dbKeyMapper');
rmFields            = ['Date', 'Count'],
subredditsSchema    = '(pkey TEXT, tableName TEXT, UNIQUE(pkey))',
rmSchema            = '(Date REAL, Count REAL, UNIQUE(Date, Count)',
runLogSchema        = '(Epoch REAL, Date Text)';

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

const setup = (fromScratchModeEnabled, eventEmitterRef) => {
    eventEmitter = eventEmitterRef;
    //Opening the postgreSQL database
    const { Pool } = require('pg'),
            pool = new Pool();
    //setup key mapping sub module
    dbKeyMapper.setup(pool);
    if (fromScratchModeEnabled) {
        console.log("From scratch mode enabled: clearing out the database");
        //Reset database run log
        pool.query(`DROP TABLE IF EXISTS RunLog`, (err) => {
            if (err) { console.log(err); throw err; }
            pool.query(`CREATE TABLE RunLog ${runLogSchema}`, (err) => {
                if (err) { throw err; }
            })
        });
        //Clear redditmetrics data from database
        pool.query(`DROP TABLE IF EXISTS Subreddits`, (err) => {
            if (err) { throw err; }
            pool.query(`CREATE TABLE IF NOT EXISTS subreddits ${subredditsSchema}`, (err) => {
                if (err) { throw err;  }
                pool.query(`SELECT * FROM subreddits`, (err, res) => {
                    if (err) { throw err; }
                    let numResolvesCount    = 0,
                        targetNumResolves   = res.length,
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
                });
            });
        });

    } else {
        console.log("From scratch mode disabled. Database contents (including RunTable) left unaltered");
        pool.query(`CREATE TABLE IF NOT EXISTS RunLog ${runLogSchema}`);
        pool.query(`CREATE TABLE IF NOT EXISTS Subreddits ${subredditsSchema}`);
    }

    return pool;
};

module.exports = {
    "setup": setup,
    "enterData": enterData
};
