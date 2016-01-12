//load variables
require('shelljs/global');
require('dotenv').load({silent: true});

var app              = require('koa')(),
    router           = require('koa-router')(),
    staticCache      = require('koa-static-cache'),
    webpack          = require("webpack"),
    co               = require('co'),
    path             = require("path"),
    regFs            = require('fs'),
    intersection     = require("lodash.intersection"),
    union            = require('lodash.union'),
    fs               = require('co-fs'),
    mongoose         = require('mongoose'),
    fileUtils        = require("./file_utils"),
    npmUtils         = require("./npm_utils"),
    webpackTransform = require('./webpack_transform'),
    views            = require('koa-views');

//ensure we have a generated folder
var generatedFolder = path.join(__dirname, 'public/generated');
regFs.stat(generatedFolder, function( err, stats ) {
    if ( err ) {
        console.log("making generated folder");
        regFs.mkdirSync(generatedFolder);
    }
});

//store our models
var models;

//babel transformer
var babel = require("babel-core");
const detective = require('babel-plugin-detective');

//id generator
var shortid = require('shortid');

app.use(staticCache(path.join(__dirname, 'public'), {
    maxAge: 365 * 24 * 60 * 60,
    gzip: true,
    dynamic: true
}));

// Use html
app.use(views("./views", {map: {html: 'swig'}}));

router.get('/', function *() {

    //generate guid
    var id = shortid.generate();
    var newBin = new models.bin({id: id});

    var result = yield newBin.save();
    var newRevision = new models.binRevision({
        createdAt: new Date(),
        hash: "r_" + shortid.generate(),
        text: "",
        "_bin": result._id
    });

    yield newRevision.save();

    //temporary redirect
    this.redirect('/' + id + "/" + newRevision.hash);
    this.status = 302;

});

router.get('/:bin', function *() {

    var result = yield models.bin
        .findOne({'id': this.params.bin});

    //redirect to 404 if no bin
    if ( !result ) {
        this.status = 404;
        yield this.render('not_found', {});
        return;
    }

    var latestRevision = yield models.binRevision.findOne({"_bin": result._id});

    if ( !latestRevision ) {
        latestRevision = new models.binRevision({
            createdAt: new Date(),
            hash: "r_" + shortid.generate(),
            text: "",
            "_bin": result._id
        });
        yield latestRevision.save();
    }

    //temporary redirect
    this.redirect('/' + result.id + "/" + latestRevision.hash);
    this.status = 302;

});

router.get('/:bin/:revision', function *() {

    var bin = yield models.bin
        .findOne({'id': this.params.bin});

    //redirect to 404 if no bin
    if ( !bin ) {
        this.status = 404;
        yield this.render('not_found', {});
        return;
    }

    var binRevision = yield models.binRevision
        .findOne({'hash': this.params.revision});

    var otherRevisions = yield models.binRevision
        .find({'_bin': bin._id}).select({'hash': 1, 'createdAt': 1});

    //redirect to 404 if no bin
    if ( !binRevision ) {
        this.status = 404;
        yield this.render('not_found', {});
        return;
    }




    yield this.render('index', {code: binRevision.text, otherRevisions: otherRevisions});
});

//router
app
    .use(router.routes())
    .use(router.allowedMethods());

// This must come after last app.use()
var server = require('http').Server(app.callback()),
    io     = require('socket.io')(server);

io.on('connection', co.wrap(function *( socket ) {

    socket.on('code save', co.wrap(function *( data ) {
        try {
            if ( data.revision && data.bin && data.code ) {
                //saving
                var bin = yield models.bin.findOne({'id': data.bin});

                //find the code to the current revision
                var binRevision = yield models.binRevision
                    .findOne({'hash': data.revision});

                //don't resave the same code
                if ( binRevision.text === data.code ) {
                    return;
                }

                //create a new revision
                var newRevision = new models.binRevision({
                    hash: "r_" + shortid.generate(),
                    text: data.code,
                    createdAt: new Date(),
                    "_bin": bin._id
                });
                var newResult = yield newRevision.save();

                //save the result
                if ( newResult ) {
                    socket.emit("code saved", {
                        bin: data.bin,
                        revision: newResult.hash,
                        createdAt: newResult.createdAt
                    });
                }

            }
        } catch ( e ) {
            socket.emit("error saving", {bin: data.bin, revision: data.revision});
        }
    }));

    socket.on('code change', co.wrap(function* ( data ) {
        try {
            //TODO Since this is a pure function, we could memoize it for performance
            var result = babel.transform(data.code, {
                presets: ['react', 'es2015', 'stage-1'],
                plugins: ['detective', {}]
            });

            const metadata = detective.metadata(result);

            if ( metadata && metadata.strings.length ) {
                //inform the client that npm is installing
                var preCheckResult = yield npmUtils.preCheck(models.bin, data.bin, metadata.strings);
                var webpackCompiledCode;
                if ( preCheckResult.type === "Install" ) {
                    socket.emit("npm installing", {modules: preCheckResult.packagesToInstall});
                    var npmResult = yield npmUtils.installPackagesToBin(preCheckResult.bin, data.bin, preCheckResult.packagesToInstall);
                    //inform the client that npm completed
                    socket.emit("npm complete", {modules: preCheckResult.packagesToInstall});
                    //return the webpack compiled version
                    webpackCompiledCode = yield webpackTransform.compileWithWebpack(models.bin, data.bin, data.revision, data.code, true);
                    //return the webpack build
                    socket.emit("webpack transform", webpackCompiledCode);
                } else {
                    console.log("Precheck said no new modules, just transforming");
                    webpackCompiledCode = yield webpackTransform.compileWithWebpack(models.bin, data.bin, data.revision, data.code);
                    socket.emit("webpack transform", webpackCompiledCode);
                }
            } else {
                //no imports, just use babel
                socket.emit("code transformed", result.code);
            }

        } catch ( e ) {
            socket.emit("code error", e.message);
        }
    }));

}));

mongoose.connect(process.env.MONGOLAB_URI);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {

    //load our models
    models = require("./models")(mongoose);

    // we're connected!
    console.log('Application Started');

    //start the server
    var port = process.env.PORT || 3000;
    server.listen(port);
});


