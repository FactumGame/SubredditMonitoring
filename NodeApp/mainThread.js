/*
THINGS TO FIX

//Todo
1. Right now, if any of our urls "breaks" i.e. fails on 3 separate request attempts, our data pipeline will break as
   we are currently reliant on a hard coded number of values to expect. Need to create some reliable way to fix this
   error, even though it is unlikely to be encountered.

*/

const run = () => {

    //PROGRAM SETTINGS
    //Set all to false on deployment
    let FROM_SCRATCH_MODE_ENABLED  = false,
        LOCAL_RUN                  = false,
        RUN_SCRAPER_ON_STARTUP     = false;

    //Run Server Setup bind to port
    const server = require('./ExpressServer/server');
    const app    = server.initialize();

    //Setup EventEmitter
    const events = require('events');
    const eventEmitter = new events.EventEmitter();

    //Setup Database
    const dbModule = require('./Database/database');
    const pool = dbModule.setup(FROM_SCRATCH_MODE_ENABLED, eventEmitter, LOCAL_RUN);

    //Setup and Run Data Scrapers
    const scraperModule = require('./WebScraper/webscraper');
    const redditMetricsScraper = scraperModule.getScraper('redditmetrics');
    redditMetricsScraper.setup(eventEmitter);

    if (RUN_SCRAPER_ON_STARTUP) {
        redditMetricsScraper.run();
    }

    //Setup API query handlers
    const api = require('./API/api');
    api.setup(app, pool);

    //Schedule web scraping task
    const schedule = require("node-schedule");
    const scheduleModule = require('./Scheduler/scheduler');
    scheduleModule.scheduleWebScraper(eventEmitter, pool);

};

module.exports.run = run;


