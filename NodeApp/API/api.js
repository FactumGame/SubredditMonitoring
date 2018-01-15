const async = require('async');
const _ = require('lodash');

const setup = (app, db) => {

    //GET all subreddit names
    app.get('/subreddit_names/', (req, res) => {

        db.all('SELECT * FROM Subreddits', [], (err, rows) => {
            if (err) {
                res.send({
                    "error": err
                });
            } else {
                res.send({
                    "subreddit_names": rows.map((elem) => { return elem.pKey; })
                });
            }
        });
    });

    //GET data for specific subreddit
    app.get('/subreddits/:name', (req, res) => {

        db.all(`SELECT S.tableName FROM Subreddits AS S WHERE S.pkey = \"${req.params.name}\"`, [], (err, rows) => {
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
                    "error": "server side error with mapping of pKeys to database tables"
                });
            } else {
                db.all(`SELECT * FROM ${rows[0].tableName}`, [], (err, innerRows) => {
                    if (err) {
                        res.send({
                            "error": err
                        });
                    } else {
                        res.send({
                            "subreddit": req.params.name,
                            "data": innerRows
                        })
                    }
                });
            }
        });

    });

    console.log("API has been setup");
};

module.exports.setup = setup;


