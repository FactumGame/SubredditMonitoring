const Combinatorics = require('js-combinatorics');
var pool;

var alphabet = 'abcdefghijklmnopqrstuvwxyz'.split(''),
    mappingTableSchema = "(pkey TEXT, tablename TEXT, UNIQUE(pkey))"
    usedLetterPointer = -1, //array pointer for alphabet. elem pointed to and all previous elements have been "used"
    //At some point move the declaration of this data elsewhere to avoid duplication of information
    dataSourcesInfo = [
        {
            "source": "redditmetrics",
            "mappingTableName": "subreddits",
            "orderedKeys": ['Date', 'Count'],
            "dataTableSchema": '(Date REAL, Count REAL, UNIQUE(Date, Count))',
            "numIdentifiers": 135, //we are currently scraping from 135 subreddits
            "alphabet": [],
            "mappings": {}
        }
    ];

const setup = (poolRef) => {

    pool = poolRef;

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
        throw new Error(`ERROR: When attempting to run dbKeyMapper module on data object, unrecognized data source ${dataSource}`);
    }
    //Generate mappings from pkeys to our randomly generated valid table names
    const   alphabet                = dataInfo['alphabet'],
            identifyingPermutations = Combinatorics.baseN(alphabet, alphabet.length).toArray().sort().slice(0, dataInfo['numIdentifiers']),
            identifyingStrPerms     = identifyingPermutations.map((elem) => { return elem.join(''); }) //char arrays to strings
            mappingTableName        = dataInfo.mappingTableName,
            rows                    = data.map((elem, ind) => { return [elem['pkey'], identifyingStrPerms[ind]]; }),
            pkeyToDataMap           = data.reduce((accumulator, curr) => {
                accumulator[curr.pkey] = curr.data;
                return accumulator;
            }, {});

    //insert data into tables (triggered as a callback)
    const insertData = () => {
        var promiseResolveCount = 0;
        pool.query(`SELECT * FROM ${mappingTableName}`, (err, res) => {
            if (err) { throw err; }
            let {rows} = res;
            rows.forEach((row) => {
                var pkey = row.pkey,
                    tablename = row.tablename,
                    data = pkeyToDataMap[pkey],
                    dataEntryPromise = new Promise((resolve, reject) => {
                        pool.query(`CREATE TABLE IF NOT EXISTS ${tablename} ${dataInfo.dataTableSchema}`, (err) => {
                            if (err) { throw err; }
                            //Now that we have created table, generate bulk load query in string form and execute
                            var argInd = 1,
                            query = data.reduce((accumulator, currRow) => {
                                return accumulator + `(${"$"}${argInd++},${"$"}${argInd++}),`;
                            }, `INSERT INTO ${tablename} VALUES `).slice(0,-1), //remove trailing comma
                            unpackedRows = data.reduce((accumulator, currRow) => {
                                dataInfo.orderedKeys.forEach((key) => {
                                    accumulator.push(key === 'Date' ? (new Date(currRow[key])).valueOf() : currRow[key]);
                                });
                                return accumulator;
                            }, []);
                            pool.query(query, unpackedRows, (err, res) => {
                                if (err) { throw err; }
                                var epoch = data[0].Date;
                                console.log(`We have entered data for ${pkey} in mapped table ${tablename} AT: ${(new Date(epoch)).toString()}`);
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
                        pool.query(`INSERT INTO RunLog VALUES ($1, $2)`, [epoch, new Date(epoch).toString()], (err) => {
                            if (err) { throw err; }
                        });
                    }
                });
            });
        });
    };

    //Input rows into mapping table (triggered as a callback)
    const insertMappingData = () => {
        let argInd = 1,
            query = rows.reduce((accumulator, current) => {
                return accumulator +  `(${"$"}${argInd++},${"$"}${argInd++}),`;
            }, `INSERT INTO ${mappingTableName} VALUES `).slice(0,-1), //remove trailing comma
            unpackedRows = rows.reduce((accumulator, currRow) => {
                accumulator.push(currRow[0]);
                accumulator.push(currRow[1]);
                return accumulator;
            }, []);
        pool.query(query, unpackedRows, (err, res) => {
            if (err) {
                console.log(err);
                throw err;
            }
            console.log(`We have created and populated our mapping table for data source ${dataInfo.source}`);
            insertData();
        });
    };

    //Create mapping table
    pool.query(`CREATE TABLE IF NOT EXISTS ${mappingTableName} ${mappingTableSchema}`, (err) => {
        if (err) { throw err; }
        //check to see if this is first run of scraper
        pool.query(`SELECT * FROM RunLog`, (err, res) => {
            let {rows} = res;
            if (err) { throw err; }
            if (rows.length > 0) {
                //if this is not our first run, we do not insert mapping data. Go straight to data insert
                insertData();
            } else {
                //if this is the first run, we want to insert mapping data, which triggers callback to data insert at finish
                insertMappingData();
            }
        });
    });

};

module.exports = {
    "setup": setup,
    "run": run
}