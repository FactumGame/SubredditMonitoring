const rmScraper = require('./redditMetricsScraper');

const getScraper = (scraperName) => {

    //Channel incoming data to correct scraping sub-module
    if      (scraperName === 'redditmetrics') { return rmScraper; }
    else    { throw new Error("ERROR: Unrecognized scraper type requested from WebScraper module"); }

};

module.exports.getScraper = getScraper;