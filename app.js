var bodyParser = require('body-parser');
var morgan = require('morgan');
var express = require('express');
var app = express();
var documentClient = require("documentdb").DocumentClient;
var config = require("./config");

var client = new documentClient(config.endpoint, {
    masterKey: config.primaryKey
},
    {
        DisableSSLVerification: true,
        EnableEndpointDiscovery: false,
        MediaReadMode: "Buffered",
        RequestTimeout: 10000,
        MediaRequestTimeout: 10000,
        PreferredLocations: [],
        RetryOptions: {}
    });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Avoids DEPTH_ZERO_SELF_SIGNED_CERT error for self-signed certs -- Related to using the local comsosdb emulator
var HttpStatusCodes = { NOTFOUND: 404 };
var databaseUrl = `dbs/${config.database.id}`;
var collectionUrl = `${databaseUrl}/colls/${config.collection.id}`;

app.use(bodyParser.json());
app.use(morgan('dev'));
app.use(express.static('public'));

// Method to grab database information from the config keys -- create if it doesn't exist
function getDatabase() {
    console.log(`Getting database:\n${config.database.id}\n`);

    return new Promise((resolve, reject) => {
        client.readDatabase(databaseUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createDatabase(config.database, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve(result);
            }
        });
    });
}

// Method to grab collection information from the config keys -- create if it doesn't exist
function getCollection() {
    console.log(`Getting collection:\n${config.collection.id}\n`);

    return new Promise((resolve, reject) => {
        client.readCollection(collectionUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createCollection(databaseUrl, config.collection, { offerThroughput: 400 }, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve(result);
            }
        });
    });
}

// Add a document if it doesn't exist.  If it does return an error code 409 if it already exists.
function addBowler(document) {
    let documentUrl = `${collectionUrl}/docs/${document.id}`;
    return new Promise((resolve, reject) => {
        client.readDocument(documentUrl, (err, result) => {
            if (err) {
                if (err.code == HttpStatusCodes.NOTFOUND) {
                    client.createDocument(collectionUrl, document, (err, created) => {
                        if (err) reject(err)
                        else resolve(created);
                    });
                } else {
                    reject(err);
                }
            } else {
                resolve(result);
            }
        });
    });
};

// query method for pulling queries and returning
function queryCollection(query){
    return new Promise((resolve, reject) => {
        client.queryDocuments(
            collectionUrl,
            query
        ).toArray((err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
         });
    });
};

// 
function replaceBowler(document) {
    let documentUrl = `${collectionUrl}/docs/${document.id}`;
    return new Promise((resolve, reject) => {
        client.replaceDocument(documentUrl, document, (err, result) => {
            if (err) reject(err);
            else {
                resolve(result);
            }
        });
    });
};

// 
function deleteBowler(document) {
    let documentUrl = `${collectionUrl}/docs/${document.id}`;
    return new Promise((resolve, reject) => {
        client.deleteDocument(documentUrl, (err, result) => {
            if (err) reject(err);
            else {
                resolve(result);
            }
        });
    });
};

function cleanup() {
    console.log(`Cleaning up by deleting database ${config.database.id}`);

    return new Promise((resolve, reject) => {
        client.deleteDatabase(databaseUrl, (err) => {
            if (err) reject(err)
            else resolve(null);
        });
    });
}

function startServer() {
    var server = app.listen(9000, function () {
        var host = server.address().address
        var port = server.address().port
        console.log("Example app listening at http://%s:%s", host, port)
    })
}

// TODO set the exit codes correctly based off err/non-error -- pass in error
// TODO router /api/1/BOWLER --
// GET
// get all bowlers
app.get('/api/1/bowler', function (req,res,next) {
    queryCollection('SELECT * FROM root r')
        .then(function (results) {
            res.send(results);
        });
});

// get a specific bowler ID
app.get('/api/1/bowler/:bowlerId', function (req, res, next) {
    var query = `SELECT * FROM root r WHERE r.id="${req.params.bowlerId}"`
    console.log(query);
    queryCollection(query)
        .then(function (results) {
            res.send(results);
        });
});

// POST
// TODO add a validate data function prior to POSTs for verifying the data meets minimum requirements/constraints.
app.post('/api/1/bowler', function (req, res, next) {
    addBowler(req.body)
        .then(function (results) {
            res.send(results);
        });
});

// PUT
// TODO run through previous validate function above to make sure data updates are accepted
app.put('/api/1/bowler', function (req, res, next) {
    replaceBowler(req.body)
        .then(function (results) {
            res.send(results);
        });
});

// DELETE
app.delete('/api/1/bowler', function (req, res, next) {
    deleteBowler(req.body)
        .then(function (results) {
            res.status.send(results);
        });
});

// PROD setup and launching of the backend -- query the database and collection to make sure they exist -- otherwise create them.
getDatabase()
    .then(() => getCollection())
    .then(() => startServer());

// REMOVE cleanup() FOR PROD -- Deletes the DB so i can run through testing/dev cycles quickly
// query the database and collection to make sure they exist -- otherwise create them.
//cleanup()
//    .then(() => getDatabase())
//    .then(() => getCollection())
//    .then(() => startServer());