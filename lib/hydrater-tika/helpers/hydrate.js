'use strict';

/**
 * @file Hydrate the file from scratch.
 * Download it from Cluestr, save it to local storage, run tika and returns the result.
 *
 * This helper is used in the server queue.
 */


var async = require('async');
var request = require('request');
var crypto = require('crypto');
var fs = require('fs');

var tikaShell = require('./tika-shell.js');


/**
 * Take a Cluestr document and returns metadatas
 * 
 * @param {Object} task Task object, keys must be file_path (file URL) and callback (URL)
 * @param {Function} cb Callback, first parameter is the error.
 */
module.exports = function(task, done) {
  var serverUrl = require('../../../app.js').url;

  // Download the file
  async.waterfall([
    function(cb) {
      request.get(task.file_path, cb);
    },
    function(res, body, cb) {
      var path = '/tmp/' + crypto.randomBytes(20).toString('hex');
      fs.writeFile(path, body, function(err) {
        cb(err, path);
      });
    },
    function(path, cb) {
      tikaShell(path , cb);
    },
    function(data, cb) {
      // Upload to server
      var params = {
        url: task.callback,
        json: {
          hydrater: serverUrl + '/hydrate',
          metadatas: data,
        }
      };

      request.patch(params, cb);
    }
  ], done);
};