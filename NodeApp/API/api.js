const async = require('async');
const _ = require('lodash');

const setup = (app, pool) => {

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


