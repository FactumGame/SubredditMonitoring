const jsonic        = require('jsonic'),
      async         = require('async'),
      cheerio       = require('cheerio'),
      db            = require('../Database/database');

const parseData = (dataArr, dataSource) => {

    console.log("Begin the parsing of our inbound html from redditmetrics");

    var subredditGrowthData = [],
        dateStamp = (new Date()).valueOf(); //time we get data at, same for all data points in single scraping run

    dataArr.forEach((responseObj) => {
        var url     = responseObj.url,
            html    = responseObj.html,
            $       = cheerio.load(html),
            spans   = $('span.subscribers').toArray()[0].children,
            numSubs = -1;
        for (var i = 0; i < spans.length; i++) {
            try {
                var exp = spans[i].attribs.class === 'number'
                if (exp) {
                    numSubs = parseInt(spans[i].children[0].data.replace(/,/g, ''));
                    break;
                }
            } catch (err) {
                //happens when target element is not selected, simply continue
            }
        }

        var subredditInd = url.indexOf("/r/") + 3;
        subredditGrowthData.push({
            "pKey": url.substring(subredditInd), //subreddit property is name of subreddit and NO other part of url
            "data": [
                {"Date": dateStamp,
                 "Count": numSubs}
            ]
        });
    });
    typifyAndStore(subredditGrowthData, dataSource);
};

/*
data is an array where every object follows this structure: { y: '2012-10-30', a: 0 }
where key y maps to a string object representing the date. a maps to the growth (num of subscribers)
that occurred on that day.
*/
const typifyAndStore = (data, dataSource) => {

    console.log("Typifying redditmetrics data");
    db.enterData(data, dataSource);
};

module.exports.parseData = parseData;