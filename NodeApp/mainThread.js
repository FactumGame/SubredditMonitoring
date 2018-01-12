const run = () => {

    var fromScratchModeEnabled = false;

    //Run Server Setup bind to port
    const server = require('./ExpressServer/server'); //IMPORTANT: check this module to comment our module path for deployment
    const app    = server.initialize();

    //Setup EventEmitter
    const events = require('events');
    const eventEmitter = new events.EventEmitter();
    //Setup Database
    const dbModule = require('./Database/database');
    const db = dbModule.setup(fromScratchModeEnabled, eventEmitter);

    //Setup and Run Data Scrapers
    const scraperModule = require('./WebScraper/webscraper');
    const redditMetricsScraper = scraperModule.getScraper('redditmetrics');
    redditMetricsScraper.run();

    //Setup API query handlers
    //const api = require('./API/api');
    //api.setup(app, db);

    //Schedule web scraping task
    const schedule = require("node-schedule");
    const scheduleModule = require('./Scheduler/scheduler');
    scheduleModule.scheduleWebScraper(eventEmitter, db);

};

module.exports.run = run;


