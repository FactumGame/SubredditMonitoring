const async = require('async');
const _ = require('lodash');

const setup = (app, pool) => {

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
                    let {rows} = innerRows;
                    if (err) {
                        res.send({
                            "error": err
                        });
                    } else {
                        res.send({
                            "subreddit": req.params.name,
                            "data": rows
                        })
                    }
                });
            }
        });

    });

    console.log("API has been setup");
};

module.exports.setup = setup;


