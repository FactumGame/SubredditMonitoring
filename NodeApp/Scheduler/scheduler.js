const scheduleWebScraper = (eventEmitter, db) => {

    const scraperModule     = require('./../WebScraper/webscraper'),
          schedule          = require("node-schedule"),
          rmScraper         = scraperModule.getScraper("redditmetrics"),
          halfHourlyRule    = new schedule.RecurrenceRule();

    halfHourlyRule.minute = 20; //run at the 30 minute mark on each hour

    //SCRIPT SCHEDULED TO RUN AT 11:00 PM each day to update with new data
    const hourlyWebScraping = schedule.scheduleJob(halfHourlyRule, function() {
        rmScraper.run();
    });

    //GMT is 5 hours ahead of EST. So if we want a job to run at 11pm EST it should run at 4am GMT
    const sendTextAlertDaily = schedule.scheduleJob('* 4 * * * *', function() {
        var promiseResolveCount = 0,
            numPromises         = -1,
            allData             = [];
        db.all(`SELECT * FROM Subreddits`, [], (err, rows) => {
            numPromises = rows.length;
            var tableNames = rows.map(row => row.tableName);
            tableNames.forEach((tableName) => {
                var dataRetrievalPromise = new Promise((resolve, reject) => {
                    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
                        if (err) {
                            reject();
                            throw err;
                        }
                        allData.push(rows);
                        resolve();
                    });
                });
                dataRetrievalPromise.then(() => {
                    promiseResolveCount++;
                    if (promiseResolveCount === numPromises) {
                        console.log("we have all of our data from the database");
                        console.log(allData);
                    }
                });
            });
        });
    });

};

module.exports.scheduleWebScraper = scheduleWebScraper;




