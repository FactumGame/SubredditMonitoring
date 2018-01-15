const Combinatorics = require('js-combinatorics');
var db, eventEmitter;

var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split(''),
    mappingTableSchema = "(pKey TEXT, tableName TEXT, UNIQUE(pKey))"
    usedLetterPointer = -1, //array pointer for alphabet. elem pointed to and all previous elements have been "used"
    //At some point move the declaration of this data elsewhere to avoid duplication of information
    dataSourcesInfo = [
        {
            "source": "redditmetrics",
            "mappingTableName": "Subreddits",
            "orderedKeys": ['Date', 'Count'],
            "dataTableSchema": '(Date REAL, Count REAL, UNIQUE(Date, Count))',
            "dataTableInsertString": '(?,?)',
            "numIdentifiers": 135, //we are currently scraping from 135 subreddits
            "alphabet": [],
            "mappings": {}
        }
    ];

const setup = (dbRef, eventEmitterRef) => {

    db = dbRef;
    eventEmitter = eventEmitterRef;

    //Generate alphabets for each of our data sources
    for (var i = 0; i < dataSourcesInfo.length; i++) {
        var elem = dataSourcesInfo[i],
            numIdentifiers = elem.numIdentifiers,
            numLettersNeeded,
            n = 2;
        for ( ; true; n++) {
            var possibleStringsFromSubsetOfSizeN = Math.pow(n, n);
            if (possibleStringsFromSubsetOfSizeN > numIdentifiers) {
                numLettersNeeded = n;
                break;
            }
        }
        if (numLettersNeeded > alphabet.length - (usedLetterPointer + 1)) {
            throw new Error("Error in dbKeyMapper module. Alphabet is too small to generate unique identifier for all elems from data sources");
        } else {
            //add the number of needed letters for our element's alphabet
            dataSourcesInfo[i]['alphabet'] = alphabet.slice().slice(usedLetterPointer + 1, usedLetterPointer + numLettersNeeded + 1);
            usedLetterPointer += numLettersNeeded;
            console.log(`Need to represent ${elem.numIdentifiers} distinct entities for data source ${elem.source} which we can accomplish with the following alphabet ${dataSourcesInfo[i].alphabet}`);
        }
    }
};

const run = (data, dataSource) => {

    //find relevant info object
    var dataInfo = undefined;
    for (var i = 0; i < dataSourcesInfo.length; i++) {
        if (dataSourcesInfo[i]['source'] === dataSource) {
            dataInfo = dataSourcesInfo[i];
            break;
        }
    }
    if (dataInfo === undefined) {
        console.log(dataSource);
        throw new Error("ERROR: When attempting to run dbKeyMapper module on data object, unrecognized data source");
    }
    //Generate mappings from pKeys to our randomly generated valid table names
    const   alphabet                = dataInfo['alphabet'],
            identifyingPermutations = Combinatorics.baseN(alphabet, alphabet.length).toArray().sort().slice(0, dataInfo['numIdentifiers']),
            identifyingStrPerms     = identifyingPermutations.map((elem) => { return elem.join(''); }) //char arrays to strings
            mappingTableName        = dataInfo.mappingTableName,
            rows                    = data.map((elem, ind) => { return [elem['pKey'], identifyingStrPerms[ind]]; }),
            pKeyToDataMap           = data.reduce((accumulator, curr) => {
                accumulator[curr.pKey] = curr.data;
                return accumulator;
            }, {});

    //insert data into tables (triggered as a callback)
    const insertData = () => {
        var promiseResolveCount = 0;
        db.each(`SELECT * FROM ${mappingTableName}`, [],
            (err, row) => {
                if (err) {
                    throw new Error(`ERROR: Unable to select all from table ${mappingTableName}`);
                }
                var pKey = row.pKey,
                    tableName = row.tableName,
                    data = pKeyToDataMap[pKey],
                    dataEntryPromise = new Promise((resolve, reject) => {
                        db.run(`CREATE TABLE IF NOT EXISTS ${tableName} ${dataInfo.dataTableSchema}`, [], () => {
                            var bulkLoadRows = db.prepare(`INSERT INTO ${tableName} VALUES ${dataInfo.dataTableInsertString}`),
                                runFunc = bulkLoadRows.run;
                            //We are entering data this way since we have the number of parameters to call bulkLoadRows.run with varies by dataSource
                            data.forEach((row) => {
                                var newRow = [];
                                dataInfo.orderedKeys.forEach((key) => {
                                    newRow.push(row[key]);
                                });
                                runFunc.apply(bulkLoadRows, newRow);
                            });
                            //After we complete our bulk loading, we call the finish callback.
                            bulkLoadRows.finalize(() => {
                                var epoch = data[0].Date;
                                console.log(`We have entered data for ${pKey} in mapped table ${tableName} AT: ${(new Date(epoch)).toString()}`);
                                resolve(data); //will either resolve or error will be thrown so no explicit call to reject
                            });
                        });
                    });
                dataEntryPromise.then((data) => {

                    promiseResolveCount++;
                    if (promiseResolveCount === dataInfo.numIdentifiers) {
                        var epoch = data[0].Date;
                        console.log(`WE HAVE FINISHED ENTERING DATA FOR DATA SOURCE: ${dataSource} AT DATE STAMP: ${[epoch, new Date(epoch).toString()]}`);

                        //now we log our run in the database
                        db.run(`INSERT INTO RunLog VALUES (?, ?)`, [epoch, new Date(epoch).toString()], () => {

                        });
                    }
                });
            },
            () => {

            }
        );
    };
    //Input rows into mapping table (triggered as a callback)
    const insertMappingData = () => {
        var bulkLoadRows = db.prepare(`INSERT INTO ${mappingTableName} VALUES (?,?)`);
        rows.forEach((row) => { bulkLoadRows.run(row[0], row[1]); });
        //After we complete our bulk loading, we call the finish callback.
        bulkLoadRows.finalize(() => {
            console.log(`We have created and populated our mapping table for data source ${dataInfo.source}`);
            insertData();
        });
    };

    //Create mapping table
    db.run(`CREATE TABLE IF NOT EXISTS ${mappingTableName} ${mappingTableSchema}`, [], () => {
        //check to see if this is first run of scraper
        db.all(`SELECT * FROM RunLog`, [], (err, rows) => {
            if (err) {
                console.log("Error selecting all from RunLog in dbMapper module");
                console.log(err);
            } else {
                if (rows.length > 0) {
                    //if this is not our first run, we do not insert mapping data. Go straight to data insert
                    insertData();
                } else {
                    //if this is the first run, we want to insert mapping data, which triggers callback to data insert at finish
                    insertMappingData();
                }
            }
        });
    });

};

module.exports = {
    "setup": setup,
    "run": run
}