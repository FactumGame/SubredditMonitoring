const async = require('async');
const _ = require('lodash');

const setup = (app, pool) => {

    const reduceDataOverGrowthInterval = (d, fractionOfDayInterval) => {
        if (fractionOfDayInterval <= 0 || fractionOfDayInterval > 1) {
            throw new Error("fraction of day interval must be GT 0 and LTE 1"); 
        }
        /*
        Data in form of [
            {'count': integer, 'date': integer}, 
            {'count': integer, 'date': integer}, 
            etc. 
        ]
        where the 'date' integer is the epoch 
        */ 
        let intervalLen = (24 * 60 * 60 * 1000 * 1.0) * fractionOfDayInterval, 
            newData = []; 
        //Start from end of data and work backwards. Find as many data points as 
        //possible in a greedy fashion 
        let ep = d.length - 1; 
        for (let p = d.length - 2; p >= 0; p--) {
            if (d[ep].date - d[p].date >= intervalLen) {
                //found interval of valid len so make new data point and push to newData
                newData.push({
                    'date': d[ep].date, 
                    'count': d[ep].count - d[p].count
                }); 
                ep = p;  
            }
        }
        return newData.reverse(); 
    };

    

    app.get('/top_15_subreddits_by_growth/', (req, res) => {
        /*
        We select subreddits based on top rate of growth over the course of the last day. 
        The data that we return to the user will be growth over intervals of 12 hours. 
        */ 

        var subredditGrowthData = [];

        const rankData = (data) => {

            let dataChangeRateMap = {};
            data.forEach((elem) => {
                var subreddit   = elem.subreddit,
                    d           = elem.data,
                    dLen        = d.length,
                    ep          = dLen - 1,
                    mp          = dLen - 2,
                    sp          = dLen - 3;
    
                //For each element's data we want to check if there are two day long intervals (two most recent days) that
                //we can calculate a change in rate of subscriber growth over
                if (dLen < 3) { //We need at least 3 data points to possibly have a valid intervals for analysis. return on less
                    subredditGrowthData.push({
                        "subreddit": subreddit,
                        "growthRate": false //we check for this value later to signal a failure of sufficient analysis interval
                    });
                    return;
                };
                var mostRecentDayGrowth = false,
                    secondMostRecentDayGrowth = false;
                //first we probe for most recent day growth
                while (mp > 0) {
                    if ((d[ep].date - d[mp].date) / (24 * 60 * 60 * 1000 * 1.0) >= 1.0) {
                        mostRecentDayGrowth = d[ep].count - d[mp].count;
                        //set sp to new value. we start decrementing from this point, mp is minimally
                        //1 if this if statement is triggered so sp always in range
                        sp = mp - 1;
                        break;
                    }
                    mp--;
                }
                //ensure we got our first data point
                if (mostRecentDayGrowth === false) {
                    //we failed to get our first data point so insufficient time interval
                    subredditGrowthData.push({
                        "subreddit": subreddit,
                        "growthRate": false //we check for this value later to signal a failure of sufficient analysis interval
                    });
                    return;
                }
                //now we probe for the second most recent day growth
                while (sp >= 0) {
                    if ((d[mp].date - d[sp].date) / (24 * 60 * 60 * 1000 * 1.0) >= 1.0) {
                        secondMostRecentDayGrowth = d[mp].count - d[sp].count;
                        break;
                    }
                    sp--;
                }
                //ensure we got our second data point
                if (secondMostRecentDayGrowth === false) {
                    //we failed to get our second data point so insufficient time interval
                    subredditGrowthData.push({
                        "subreddit": subreddit,
                        "growthRate": false //we check for this value later to signal a failure of sufficient analysis interval
                    });
                    return;
                }
                //If we have not yet returned at this point then we have valid intevals to calculate growth rate change
                var growthRate = mostRecentDayGrowth / (1.0 * secondMostRecentDayGrowth);
    
                /* Only include data if growth yesterday wasn't zero and today's growth was greater than 10 */
                if ((d[mp].count - d[sp].count) !== 0 && (d[ep].count - d[mp].count) > 30) {
                    subredditGrowthData.push({
                        "subreddit": subreddit,
                        "growthRate": growthRate.toFixed(2), //round to 2 decimal places 
                        "data": d
                    });
                }
            }); 

            //push coins to top15GrowthSubreddits as long as they are greater than single element in the array
            subredditGrowthData = _.sortBy(subredditGrowthData, elem => elem.growthRate).reverse().splice(0,15);
            
            //reduce data over interval
            for (let i = 0; i < subredditGrowthData.length; i++) {
                let currData = subredditGrowthData[i].data;
                subredditGrowthData[i].data = reduceDataOverGrowthInterval(currData, 1); 
            }
            
            subredditGrowthData = subredditGrowthData.map((elem) => {
                return {
                    "name": elem.subreddit,
                    "data": elem.data
                };
            }); 
            //We have determined the top growing subreddits
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
                            "data": reduceDataOverGrowthInterval(innerRows.rows, 1)
                        }); 
                    }
                });
            }
        });

    });

    console.log("API has been setup");
};

module.exports.setup = setup;


