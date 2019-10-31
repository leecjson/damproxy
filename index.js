'use strict';

const net = require('net');
const assert = require('assert');
const yargs = require('yargs');
const isValidPort = require('is-valid-port');
const connect = require('./connect');
const DEFAULT_PORT = 8991;

yargs
  .command('$0', '', {
    host: {
      type: 'string',
      demandOption: true,
    },
    port: {
      type: 'number',
      default: DEFAULT_PORT,
    },
  }, argv => {
    assert(net.isIP(argv.host), 'invalid --host');
    assert(isValidPort(argv.port), 'invalid --port');

    connect(argv.host, argv.port);
    setTimeout(() => {
      connect(argv.host, argv.port);
    }, 1000);
  })
  .alias('h', 'help')
  .alias('v', 'version')
  .argv;