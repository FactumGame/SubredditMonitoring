const scheduleWebScraper = (eventEmitter, pool) => {

    const scraperModule     = require('./../WebScraper/webscraper'),
          databaseModule    = require('./../Database/database');
          schedule          = require('node-schedule'),
          _                 = require('lodash'),
          Nexmo             = require('nexmo'),
          rmScraper         = scraperModule.getScraper("redditmetrics"),
          nexmo             = new Nexmo({
            /* apiKey: process.env.NEXMO_API_KEY,
            apiSecret: process.env.NEXMO_API_SECRET */
            apiKey: "a0ad32ba",
            apiSecret: "ca088a5344124a7K"
          }),
          halfHourlyRule    = new schedule.RecurrenceRule();
          atMidnightRule    = new schedule.RecurrenceRule();

    halfHourlyRule.minute = 30; //run at the 30 minute mark on each hour
    atMidnightRule.hour = 0;

    //SCRIPT SCHEDULED TO RUN AT 11:00 PM each day to update with new data
    schedule.scheduleJob(halfHourlyRule, () => {
        console.log(`Starting scheduled webscraper at ${(new Date()).toString()}`);
        rmScraper.run();
    });

    schedule.scheduleJob(atMidnightRule, () => {
        databaseModule.cleanDatabase();
    });

    const generateTextMessage = (data) => {
        var index   = 1;
        return `Message sent at ${(new Date()).toString()}${'\n\n'}` +
                data.reduce((accumulator, curr) => {
                    return accumulator +
                    `${index++}. ${curr.subreddit}:${'\n'}` +
                    `Growth Rate: ${curr.growthRate}${'\n'}` +
                    `Growth Today: ${curr.growthToday}${'\n'}` +
                    `Growth Yesterday: ${curr.growthYesterday}${'\n\n'}`;
                }, "").toString();
    };

    //callback function when we have extracted all data from the database
    const analyzeData = (data) => {

        var subredditGrowthData = [],
            numCoinsReported    = 15; //we report the top numCoinsReportedDate coins and their growth data

        dataChangeRateMap = {};
        //Calculate percentage value of today's value relative to yesterday's value
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
                    "growthToday": (d[ep].count - d[mp].count),
                    "growthYesterday": (d[mp].count - d[sp].count)
                });
            }
        });
        var viableGrowthData = [];
        for (var i = 0; i < subredditGrowthData.length; i++) {
            var curr = subredditGrowthData[i];
            if (curr.growthRate !== false) {
                //We have collected viable data for this element so we push to an array of relevant objects
                viableGrowthData.push(curr);
            } else {
                //We did not have a valid data interval over which to collect data so we do not keep track of this object
            }
        }
        viableGrowthData = _.sortBy(viableGrowthData, elem => elem.growthRate).reverse().splice(0, numCoinsReported);

        var txtMsg = '';
        var sendToNums = ['12392334556', '17173294188'];

        if (viableGrowthData.length > 0) {
            //If we have data to report on, send messages to subscribers
            //Generate and send text msgs to subscribed users
            txtMsg = generateTextMessage(viableGrowthData);
        } else {
            txtMsg = "Sorry. We do not have enough data to analyze growth trends. We will continue sending messages at 11:00 pm every night until we do!";
        }

        console.log(txtMsg); 

        var timeoutMultiplier = 0; //for api call time limits
        sendToNums.forEach((toNum) => {
            setTimeout(() => {
                nexmo.message.sendSms(
                    '12132055816', toNum, txtMsg,
                    (err, responseData) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.dir(responseData);
                        }
                    }
                );
            }, timeoutMultiplier++ * 1000 * 2);
        });

    };

    const sendTextAlert = () => {
        var promiseResolveCount = 0,
            numPromises         = -1,
            allData             = [];

        pool.query(`SELECT * FROM subreddits`, (err, res) => {
            if (err) { throw err; }
            let {rows}      = res,
                numPromises = rows.length,
                pkeys       = rows.map(row => row.pkey);
                tableNames  = rows.map(row => row.tablename);
            tableNames.forEach((tablename, index) => {
                let dataRetrievalPromise = new Promise((resolve, reject) => {
                    pool.query(`SELECT * FROM ${tablename}`, (err, res) => {
                        let {rows} = res;
                        if (err) {
                            reject();
                            throw err;
                        }
                        allData.push({
                            "subreddit": pkeys[index],
                            'data': rows
                        });
                        resolve();
                    });
                });
                dataRetrievalPromise.then(
                    //success callback 
                    () => {
                        promiseResolveCount++; 
                        if (promiseResolveCount === numPromises) {
                            analyzeData(allData);
                        }
                    }, 
                    //error callback 
                    (err) => {
                        throw err; 
                    }
                );
            });
        });
    }; 

    textAlertTimes = ['0 0 11 * * *', '0 0 23 * * *']; 
    textAlertTimes.forEach((time) => {
        //Scheduled for 11am and 11pm EST
        const sendTextAlertDaily = schedule.scheduleJob(time, () => {
            sendTextAlert(); 
        });
    }); 

};

module.exports.scheduleWebScraper = scheduleWebScraper;




