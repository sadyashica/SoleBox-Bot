// # Command Line Interface
// sets up the Command Line Interface
'use strict';

// import dependencies
const program = require('commander');
const debug = require('debug')('cli');
const SoleboxClient = require('../solebox-client');

const versionNumber = '0.0.0';

// # Commander Initialization
// specify CLI options and version
program
  .version(versionNumber)
  .option('-c, --config <config>', 'name of the config file (without file type)')
  .parse(process.argv);

// # validate input parameters
// make sure all input parameters are allowed and properly validate them
if (!program.config) {
  console.log('you have not specified any config file. use --help for usage information.');
  process.exit();
}

// # load config file
// make sure the application does not throw an error
try {
  var config = require(`../../config/${program.config}.js`);
} catch (err) {
  console.log('sorry. the file you specified is not existing or not a valid JSON file.');
  process.exit();
}

// initialize solebox client
const client = new SoleboxClient(config);
client.buyProduct();



