#!/usr/bin/env node
'use stirct';

const net = require('net');
const assert = require('assert');
const yargs = require('yargs');
const isValidPort = require('is-valid-port');
const parseIpPort = require("parse-ip-port");
const {ServerTunnel, ClientTunnel} = require('./tunnel');
const ForwardingServer = require('./fwd-server');
const DefaultTunnelPort = 8991;

yargs
  .command(['$0', 'connect'], 'connect to server', {
    'host': {
      type: 'string',
      demandOption: true,
    },
    'port': {
      type: 'number',
      default: DefaultTunnelPort,
    },
    'password': {
      type: 'string',
      alias: 'pwd',
    },
    'forward-ports': {
      array: true,
      type: 'string',
      demandOption: true,
    }
  }, argv => {
    assert(net.isIP(argv.host), 'invalid --host');
    assert(isValidPort(argv.port), 'invalid --port');

    const forwardPorts = new Map();
    argv["forward-ports"].forEach(item => {
      const port = Number(item);
      if (!isNaN(port)) {
        assert(isValidPort(port), 'invalid port');
        forwardPorts.set(port, ['127.0.0.1', port]);
      } else {
        const items = item.split('@');
        assert(items.length == 2);
        const [port, localport] = items.map(p => Number(p));
        assert(isValidPort(port), 'invalid port');
        if (!isNaN(localport)) {
          assert(isValidPort(localport), 'invalid port');
          forwardPorts.set(port, ['127.0.0.1', localport]);
        } else {
          forwardPorts.set(port, parseIpPort(items[1]));
        }
      }
    });

    new ClientTunnel(forwardPorts)
      .connect(argv.host, argv.port, argv.password);
  })
  .command('listen', 'start server', {
    'host': {
      type: 'string',
      default: '0.0.0.0',
    },
    'port': {
      type: 'number',
      default: DefaultTunnelPort,
    },
    'password': {
      type: 'string',
      alias: 'pwd',
    },
    'forward-ports': {
      array: true,
      type: 'string',
      demandOption: true,
    }
  }, argv => {
    assert(net.isIP(argv.host), 'invalid host');
    assert(isValidPort(argv.port), 'invalid port');

    const forwardPorts = argv["forward-ports"].map(item => {
      const port = Number(item);
      if (!isNaN(port)) {
        assert(isValidPort(port), 'invalid port');
        return [port, 0];
      } else {
        const items = item.split('@');
        assert(items.length == 2);
        const [fwdport, proxyport] = items.map(p => Number(p));
        assert(isValidPort(fwdport) && isValidPort(proxyport), 'invalid port');
        return [fwdport, proxyport];
      }
    });

    const tunnel = new ServerTunnel({ password: argv.password })
      .listen(argv.host, argv.port);

    forwardPorts.forEach(p =>
      new ForwardingServer(tunnel).listen(p[0], p[1])
    );
  })
  .alias('h', 'help')
  .alias('v', 'version')
  .argv;