// System Objects
var path = require('path');
var exec = require('child_process').exec;
var fs;

// Third Party Dependencies
var Promise = require('bluebird');
var PZ = require('promzard').PromZard;
var NPM = require('npm');

// Internal
logs = require('./logs');


fs = Promise.promisifyAll(require('fs'));

var packageJson = path.resolve('./package.json');

var pkg, ctx, options;

// Options to pass into --lang option
var keywordsJs = ['javascript', 'js'];
var keywordsRs = ['rust', 'rs'];
var keywordsPy = ['python', 'py'];

// Populates the ctx information
function populateCTX() {
  return new Promise(function(resolve) {
    fs.readFileAsync(packageJson, 'utf8')
      .then(function(data) {
        try {
          ctx = JSON.parse(data);
          pkg = JSON.parse(data);
        } catch (e) {
          ctx = {};
        }
        ctx.dirname = path.dirname(packageJson);
        ctx.basename = path.basename(ctx.dirname);
        if (!ctx.version) {
          ctx.version = undefined;
        }
        return resolve();
      })
      // If package.json does not exist already
      .catch(function() {
        ctx = {};
        ctx.dirname = path.dirname(packageJson);
        ctx.basename = path.basename(ctx.dirname);
        ctx.version = undefined;
        return resolve();
      });
  });
}

function loadNpm() {
  // You have to load npm in order to use it programatically
  return new Promise(function(resolve, reject) {
    NPM.load(function(error, npm) {
      // It then returns a npm object with functions or an error
      return error ? reject(error) : resolve(npm);
    });
  });
}

// Resolve an npm cofig list, or nothing (existance is not needed)
function getNpmConfig(npm) {
  // Always resolve, we don't care if there isn't an npm config.
  return new Promise(function(resolve) {
    resolve(npm.config.list || {});
  });
}

// Builds the package.json file and writes it to the directory
function buildJSON(npmConfig) {
  return new Promise(function(resolve, reject) {
    // Path to promzard config file
    var promzardConfig;
    ctx.config = npmConfig;
    // Default to auto config
    promzardConfig = path.resolve(__dirname + '/../', 'resources/javascript/init-default.js');
    if (options.interactive) {
      promzardConfig = path.resolve(__dirname + '/../', 'resources/javascript/init-config.js');
    }

    // Init promozard with appropriate config.
    var pz = new PZ(promzardConfig, ctx);

    // On data resolve the promise with data
    pz.on('data', function(data) {
      if (!pkg) {
        pkg = {};
      }
      Object.keys(data).forEach(function(k) {
        if (data[k] !== undefined && data[k] !== null) {
          pkg[k] = data[k];
        }
      });

      fs.writeFileAsync(packageJson, JSON.stringify(data, null, 2));
      logs.info('Created package.json.');
      return resolve(data);
    });

    // On error, reject with error
    pz.on('error', function(err) {
      return reject(err);
    });
  });
}

// Returns the dependencies of the package.json file
function getDependencies() {
  return new Promise(function(resolve) {
    var pkg = fs.readFileAsync(packageJson);
    var dependencies = [];
    for (var mod in pkg.dependencies) {
      dependencies.push(mod + '@' + pkg.dependencies[mod]);
    }
    return resolve(dependencies);
  });
}

// Installs npm and dependencies
function npmInstall(dependencies) {
  return new Promise(function(resolve, reject) {

    // If there are no depencencies resolve
    if (!dependencies.length) {
      return resolve();
    }

    // load npm to get the npm object
    loadNpm()
      .then(function(npm) {
        npm.commands.install(dependencies, function(error) {
          return (error) ? reject(error) : resolve();
        });
      });

  });
}

// Generates blinky for the various supported languages
function generateSample() {
  return new Promise(function(resolve, reject) {

    // Error functions (just to reduce copied text everywhere)
    function exists_err(filepath) {
      return new Error('Looks like this is already a Cargo project! (' + filepath + ' already exists)');
    }

    function mkdir_err(dir) {
      return new Error('Could not create ' + dir);
    }

    // Javascript
    if (!options.lang || (options.lang && keywordsJs.indexOf(options.lang.toLowerCase()) > -1)) {

      // File and path to js file
      var filename = 'index.js';
      var filepath = path.resolve(options.directory, filename);

      // Create blinky program in js file if file does not already exist
      fs.exists(filepath, function(exists) {
        if (exists) {
          return;
        }
        fs.createReadStream(path.resolve(__dirname, './../resources/javascript/', filename)).pipe(fs.createWriteStream(filepath));
        logs.info('Wrote \"Blinky\" example to ' + filepath);
        return resolve();
      });

    }

    // Rust
    else if (options.lang && keywordsRs.indexOf(options.lang.toLowerCase()) > -1) {

      // Files, directories, and paths
      var file_toml = 'Cargo.toml';
      var file_config = 'config';
      var file_src = 'main.rs';
      var dir_config = path.resolve(options.directory, '.cargo/');
      var dir_src = path.resolve(options.directory, 'src/');
      var path_toml = path.resolve(options.directory, file_toml);
      var path_config = path.resolve(dir_config, file_config);
      var path_src = path.resolve(dir_src, file_src);

      // Generate the config file, the toml, and the src file
      fs.exists(dir_config, function(exists) {
        if (exists) {
          return reject(exists_err(dir_config));
        }
        fs.exists(dir_src, function(exists) {
          if (exists) {
            return reject(exists_err(dir_src));
          }
          fs.exists(path_toml, function(exists) {
            if (exists) {
              return reject(exists_err(path_toml));
            }
            fs.mkdir(dir_config, function(err) {
              if (err) {
                return reject(new Error(mkdir_err(dir_config)));
              }
              fs.mkdir(dir_src, function(err) {
                if (err) {
                  return reject(new Error(mkdir_err(dir_src)));
                }
                // Copy over config file, the blinky main, and the toml file
                fs.createReadStream(path.resolve(__dirname, './../resources/rust/', file_config)).pipe(fs.createWriteStream(path_config));
                fs.createReadStream(path.resolve(__dirname, './../resources/rust/', file_toml)).pipe(fs.createWriteStream(path_toml));
                logs.info('Initialized Cargo project...');
                fs.createReadStream(path.resolve(__dirname, './../resources/rust/', file_src)).pipe(fs.createWriteStream(path_src));
                logs.info('Wrote \"Blinky\" example to ' + path_src);
              });
            });
          });
        });
      });

    }

    // Python
    else if (options.lang && keywordsPy.indexOf(options.lang.toLowerCase()) > -1) {
      return reject(new Error('Python currently not supported... but soon!'));
    }

  });
}

// Verify the user has Cargo, reject if they do not
function verifyCargoInstalled() {
  return new Promise(function(resolve, reject) {
    exec('cargo', function(err, stdout, stderr) {
      if (err || stderr) {
        return reject(new Error('You need to install rust: "curl -sf -L https://static.rust-lang.org/rustup.sh | sh"'));
      }
      return resolve();
    });
  });
}


// Initialize the directory given the various options
module.exports = function(opts) {
  return new Promise(function(resolve, reject) {

    // Inform the user initialization has begun
    options = opts;
    logs.info('Initializing tessel repository...');

    // Validate the directory if the user provided one
    if (options.directory) {
      fs.exists(options.directory, function(exists) {
        // Reject if the provided directory does not exist
        if (!exists) {
          return reject(new Error('The provided directory does not exist'));
        }
        // Reject if the provided directory is not a directory
        if (!fs.lstatSync(options.directory).isDirectory()) {
          return reject(new Error('The provided path is not a directory'));
        }
        // Resolve the paths
        options.directory = path.resolve(options.directory);
        packageJson = path.resolve(options.directory, './package.json');
      });
    } else {
      options.directory = path.resolve('.');
    }

    // Javascript
    if (!options.lang || (options.lang && keywordsJs.indexOf(options.lang.toLowerCase()) > -1)) {
      populateCTX()
        .then(loadNpm)
        .then(getNpmConfig)
        .then(buildJSON)
        .then(getDependencies)
        .then(npmInstall)
        .then(generateSample)
        .catch(function(error) {
          return reject(error);
        });
    }

    // Rust
    else if (options.lang && keywordsRs.indexOf(options.lang.toLowerCase()) > -1) {
      logs.info('Initializing new Cargo project...');
      verifyCargoInstalled()
        .then(generateSample)
        .then(resolve)
        .catch(function(err) {
          return reject(err);
        });
    }

    // Python
    else if (options.lang && keywordsPy.indexOf(options.lang.toLowerCase()) > -1) {
      return reject(new Error('Python currently not supported... but soon!'));
    }

    // Unrecognized language
    else {
      return reject(new Error('Unrecognized language selection. Choose from <javascript|rust|python|js|rs|py>'));
    }

  });
};
