const jsonic        = require('jsonic'),
      async         = require('async'),
      cheerio       = require('cheerio'),
      db            = require('../Database/database');

const parseData = (dataArr, dataSource) => {

    console.log("Begin the parsing of our inbound html from redditmetrics");

    let subredditGrowthData = [],
        dateStamp = (new Date()).valueOf(); //time we get data at, same for all data points in single scraping run

    dataArr.forEach((responseObj) => {
        var {url, html}  = responseObj,
            $           = cheerio.load(html),
            spans       = $('span.subscribers').toArray()[0].children, //spans in which we search for subscriber count
            numSubs     = -1;

        for (var i = 0; i < spans.length; i++) {
            try {
                var exp = spans[i].attribs.class === 'number';
                if (exp) {
                    numSubs = parseInt(spans[i].children[0].data.replace(/,/g, ''));
                    break;
                }
            } catch (err) {
                //happens when span containing subscriber count is not the current span, continue looping
            }
        }

        subredditGrowthData.push({
            "pkey": url.substring(url.indexOf("/r/") + 3), //subreddit property is name of subreddit and NO other part of url
            "data": [
                {
                    "Date": dateStamp,
                    "Count": numSubs
                }
            ]
        });
    });

    db.enterData(subredditGrowthData, dataSource);
};

module.exports.parseData = parseData;