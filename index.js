'use strict';

const yargs = require('yargs');
const connect = require('./connect');

yargs
  .command('$0', '', {
    host: {
      type: 'string',
      demandOption: true,
    },
    port: {
      type: 'number',
      default: 8991,
    },
  }, argv => {
    connect(argv.host, argv.port);
  })
  .alias('h', 'help')
  .alias('v', 'version')
  .argv;