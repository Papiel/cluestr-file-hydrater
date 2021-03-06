'use strict';

require('should');
var request = require('supertest');
var fs = require("fs");
var async = require("async");
var anyfetchFileHydrater = require('../lib/');
var createFakeApi = require('./helpers/fake-api.js');

describe('/hydrate webhooks', function() {
  it('should be pinged with hydrater result', function(done) {
    var config = {
      hydrater_function: __dirname + '/hydraters/useful-hydrater.js',
      concurrency: 1,
    };

    var hydrationServer = anyfetchFileHydrater.createServer(config);
    var fakeApi = createFakeApi();
    fakeApi.patch('/result', function(req, res, next) {
      try {
        req.params.should.have.property('metadata');
        req.params.metadata.should.not.have.property('foo');
        req.params.metadata.should.have.property('path');
        req.params.metadata.should.have.property('text', fs.readFileSync(__dirname + '/helpers/fake-api.js').toString());
        res.send(204);

        next();

        async.waterfall([
          function cleanYaqs(cb) {
            hydrationServer.queue.remove(cb);
          },
          function cleanApi(cb) {
            fakeApi.close(cb);
          },
        ], function(err) {
          done(err);
        });

      } catch(e) {
        // We need a try catch cause mocha is try-catching on main event loop, and the server create a new stack.
        async.waterfall([
          function cleanYaqs(cb) {
            hydrationServer.queue.remove(cb);
          },
          function cleanApi(cb) {
            fakeApi.close(cb);
          },
        ], function(err) {
          done(e || err);
        });
      }
    });

    fakeApi.listen(4243);

    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://127.0.0.1:4243/afile',
        callback: 'http://127.0.0.1:4243/result',
        document: {
          metadata: {
            "foo": "bar"
          }
        }
      })
      .expect(204)
      .end(function() {});
  });

  it('should not be pinged on skipped task', function(done) {
    var config = {
      hydrater_function: __dirname + '/hydraters/skipper-hydrater.js',
    };
    var hydrationServer = anyfetchFileHydrater.createServer(config);

    hydrationServer.queue.on('job.completed', function() {
      async.waterfall([
        function cleanYaqs(cb) {
          hydrationServer.queue.remove(cb);
        },
        function cleanApi(cb) {
          fakeApi.close(cb);
        },
      ], function(err) {
        done(err);
      });
    });

    var fakeApi = createFakeApi();
    fakeApi.patch('/result', function(req, res, next) {

      async.waterfall([
        function cleanYaqs(cb) {
          hydrationServer.queue.remove(cb);
        },
        function cleanApi(cb) {
          fakeApi.close(cb);
        },
      ], function(err) {
        done(err || new Error("should not be called"));
        next();
      });
    });

    fakeApi.listen(4243);

    request(hydrationServer).post('/hydrate')
      .send({
        file_path: 'http://127.0.0.1:4243/afile',
        callback: 'http://127.0.0.1:4243/result',
        document: {
          metadata: {
            "foo": "bar"
          }
        }
      })
      .expect(204)
      .end(function() {});

  });
});
