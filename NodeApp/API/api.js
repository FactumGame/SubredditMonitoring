const async = require('async');
const _ = require('lodash');

const setup = (app, pool) => {

    app.get('/top_15_subreddits_by_growth/', (req, res) => {

        var subredditGrowthData = [];

        const rankData = (data) => {
            dataChangeRateMap = {};
            //Calculate percentage value of today's value relative to yesterday's value
            data.forEach((elem) => {
                const d = elem.data,
                    dLen = d.length,
                    final = d[dLen-1],
                    penult = d[dLen-2];
                subredditGrowthData.push({
                    "subreddit": elem.subreddit,
                    "growthRate": final.count * penult.count === 0 ? 0: final.count / penult.count,
                    "data": d
                });
            });
            //push coins to top15GrowthSubreddits as long as they are greater than single element in the array
            subredditGrowthData = _.sortBy(subredditGrowthData, elem => elem.growthRate).reverse().splice(0,15);
            subredditGrowthData = subredditGrowthData.map((elem) => {
                return {
                    "name": elem.subreddit,
                    "data": elem.data
                };
            })
            res.send({
                "subredditData": subredditGrowthData
            });
        };

        pool.query('SELECT * FROM Subreddits', [], (err, response) => {
            if (err) {
                res.send({
                    "error": err
                });
            } else {
                let {rows} = response; 
                var subredditTableNames = rows.map((elem) => { return elem.tablename; }), 
                    tnSubredditMap = rows.reduce((accumulator, curr) => {
                        accumulator[curr.tablename] = curr.pkey; 
                        return accumulator; 
                    }, {}); 
                async.map(subredditTableNames,
                    (tableName, done) => {
                        pool.query(`SELECT * FROM ${tableName}`, [], (err, response) => {
                            if (err) {
                                console.log("error when extracting one of the top 15 subreddits from the database");
                                throw err;
                            } else {
                                let {rows} = response; 
                                done(null, {
                                    'subreddit': tnSubredditMap[tableName],
                                    'data': rows
                                });
                            }
                        });
                    },
                    (err, results) => {
                        if (err) {
                            console.log("error when extracting top 15 subreddits from their respective databases");
                            throw err;
                        } else {
                            rankData(results);
                        }
                    }
            );

            }
        });

    });

    app.get('/add_two_day_old_data_filler/', (req, res) => {
        pool.query('SELECT * FROM subreddits', (err, response) => {
            let {rows}      = response,
                tableNames  = rows.map((elem) => { return elem.tablename; }),
                mostRecentDate;
            pool.query(`SELECT * FROM ${tableNames[0]}`, (err, r) => {
                let {rows} = r,
                    mostRecentDate = parseInt(rows[rows.length - 1].date),
                    firstIns = mostRecentDate + 86400000, //num milliseconds in a day 
                    secondIns = mostRecentDate + 2 * 86400000;
                tableNames.forEach((tn) => {
                    pool.query(`INSERT INTO ${tn} VALUES ($1,$2),($3,$4)`, [firstIns, 1, secondIns, 2], (err, response) => {
                        if (err) {
                            console.log(err);
                            throw err;
                        }
                    })
                });
            });
        })
    });

    //GET all subreddit names
    app.get('/subreddit_names/', (req, res) => {

        pool.query('SELECT * FROM subreddits', (err, response) => {
            let { rows } = response;
            if (err) {
                res.send({
                    "error": err
                });
            } else {
                res.send({
                    "subreddit_names": rows.map((elem) => { return elem.pkey; })
                });
            }
        });
    });

    //GET data for specific subreddit
    app.get('/subreddits/:name', (req, res) => {
        pool.query(`SELECT S.tablename FROM subreddits AS S WHERE S.pkey = $1`, [req.params.name], (err, response) => {
            if (err) { throw err; }
            let { rows } = response;
            if (err) {
                res.send({
                    "error": err
                });
            } else if (rows.length === 0) {
                res.send({
                    "error": "the requested subreddit does not exist in the database"
                });
            } else if (rows.length > 1) {
                res.send({
                    "error": "server side error with mapping of pkeys to database tables"
                });
            } else {
                pool.query(`SELECT * FROM ${rows[0].tablename}`, (err, innerRows) => {
                    if (err) {
                        res.send({
                            "error": err
                        });
                    } else {
                        res.send({
                            "subreddit": req.params.name,
                            "data": innerRows.rows
                        })
                    }
                });
            }
        });

    });

    console.log("API has been setup");
};

module.exports.setup = setup;


