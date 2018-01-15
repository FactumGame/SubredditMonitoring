var
db, eventEmitter;

const
async               = require('async'),
cmFields            = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Market Cap'],
rmFields            = ['Date', 'Count'],
appSettingsSchema   = '(property TEXT, value TEXT, UNIQUE(property, value))',
subredditsSchema    = '(pKey TEXT, tableName TEXT, UNIQUE(pKey))',
coinsSchema         = '(pKey TEXT, tableName TEXT, UNIQUE(pKey))',
cmSchema            = '(Date REAL, Open REAL, High REAL, Low REAL, Close REAL, Volume REAL, MarketCap REAL, UNIQUE(Date, Open, High, Low, Close, Volume, MarketCap))',
rmSchema            = '(Date REAL, Count REAL, UNIQUE(Date, Count)',
runLogSchema        = '(Date Text, Epoch REAL)';

/*
Each object in the parameter data, an array, has the following structure:
{
    "pKey": "some unique id like the name of a coin or a subreddit link",
    "data": "array of objects, each of which contains data about the pKey element on some given Date (represented by epoch of Date object)
}
This mapping module (represented as variable dbMapper) does the following:
1. Creates and populates a table for mapping pKey values to their (generated) table id's in the database
2. for each element in data: stores element['data'] as the rows of the table mapped to by pKey (from table generated in step 1)
The reason for this is that the pKey values are things like urls, coin names, etc. and are not always valid tables names for
an sqlite3 database. This provides a reliable way to consistently generate identifiable tables for storing unpredictable data.
*/
const dbKeyMapper = require('./dbKeyMapper'); //Module for handling data to be input to database. Data specifications in module
const enterData = (data, dataSource) => {
    dbKeyMapper.run(data, dataSource);
};

const setup = (fromScratchModeEnabled, eventEmitterRef) => {

    eventEmitter = eventEmitterRef;
    const sqlite3 = require('sqlite3').verbose(); //verbose provides longer stacktraces
    //ALWAYS Open the database on setup()
    db = new sqlite3.Database('cryptodata.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        //error callback to ensure that we successfully create/open the database
        (error) => {
            if (error === null) {
                console.log("Successfully created/opened the database");
            } else {
                console.log("Encountered an error while attempting to create the database");
                console.log(error);
            }
        }
    );

    //setup key mapping sub module
    dbKeyMapper.setup(db, eventEmitter);

    if (fromScratchModeEnabled) {
        console.log("From scratch mode enabled: clearing out the database");
        //Reset database run log
        db.run(`DROP TABLE IF EXISTS RunLog`, [], (err) => {
            db.run(`CREATE TABLE RunLog ${runLogSchema}`, [], (err) => {});
        });
        //Clear redditmetrics data
        db.each(`SELECT * FROM Subreddits`, [],
            (err, row) => {
                if (err) {
                    console.log("There was an error selecting all from Subreddits table");
                    console.log(err);
                }
                var tn = row.tableName;
                console.log(`Dropping table ${tn}`);
                db.run(`DROP TABLE IF EXISTS ${tn}`);
            },
            () => {
                db.run("DROP TABLE IF EXISTS Subreddits", [], () => {
                    db.run(`CREATE TABLE IF NOT EXISTS Subreddits ${subredditsSchema}`);
                });
            }
        );
    } else {
        console.log("From scratch mode disabled. Database contents (including RunTable) left unaltered");
        db.run(`CREATE TABLE IF NOT EXISTS RunLog ${runLogSchema}`);
        db.run(`CREATE TABLE IF NOT EXISTS Subreddits ${subredditsSchema}`);
    }

    return db;
};

module.exports = {
    "setup": setup,
    "enterData": enterData
};
