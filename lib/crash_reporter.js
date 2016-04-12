// System Objects
var os = require('os');
var path = require('path');
var StringDecoder = require('string_decoder').StringDecoder;
var zlib = require('zlib');

// Third Party Dependencies
var request = require('request');
var tags = require('common-tags');

// Internal
var logs = require('./logs');
var packageJson = require('../package.json');
var Preferences = require('./preferences');

// the value of the crash reporter preference
// the value has to be one of 'on' or 'off'
var CRASH_REPORTER_PREFERENCE = 'crash.reporter.preference';
var SUBMIT_CRASH_URL = 'http://tessel-error-reporter.appspot.com/crashes/submit';

// override for testing
if (process.env.DEV_MODE === 'true') {
  SUBMIT_CRASH_URL = 'http://localhost:8080/crashes/submit';
}

var CrashReporter = {};

CrashReporter.off = function() {
  return Preferences.write(CRASH_REPORTER_PREFERENCE, 'off')
    .catch(error => {
      // do nothing
      // do not crash the crash reporter :)
      logs.err('Error turning off crash reporter preferences', error);
    });
};

CrashReporter.on = function() {
  return Preferences.write(CRASH_REPORTER_PREFERENCE, 'on')
    .catch(error => {
      // do nothing
      // do not crash the crash reporter :)
      logs.err('Error turning on crash reporter preferences', error);
    });
};

CrashReporter.submit = function(report) {
  return Preferences.read(CRASH_REPORTER_PREFERENCE, 'on')
    .then(value => {
      if (value === 'on') {
        var labels = tags.stripIndent `
          ${packageJson.name},
          CLI version: ${packageJson.version},
          Node version: ${process.version},
          OS platform: ${os.platform()},
          OS release: ${os.release()}
        `;

        CrashReporter.post(labels, report)
          .then(() => {
            logs.info('Done !');
          })
          .catch(error => {
            logs.err('Error submitting crash report', error);
          });
      }
    })
    .catch(error => {
      // do nothing
      // do not crash the crash reporter :)
      logs.err('Error submitting crash report', error);
    });
};

CrashReporter.post = function(labels, report) {
  return new Promise((resolve, reject) => {
    request.post({
      url: SUBMIT_CRASH_URL,
      form: {
        crash: report,
        labels: labels,
        f: 'json'
      }
    }, (error, httpResponse, body) => {
      try {
        if (error) {
          reject(error);
        } else {
          var json = JSON.parse(body);
          if (json.error) {
            reject(json.error);
          } else {
            resolve();
          }
        }
      } catch (exception) {
        reject(exception);
      }
    });
  });
};

CrashReporter.test = () => {
  return Promise.reject(new Error('Testing the crash reporter'));
};

var onError = error => {
  return CrashReporter.submit(error.stack);
};

process.on('unhandledRejection', onError);
process.on('uncaughtException', onError);

module.exports = CrashReporter;
