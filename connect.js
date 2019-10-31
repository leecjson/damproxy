'use strict';

const net = require('net');

/**
 * @param {string} host 
 * @param {number} port 
 */
module.exports = function (host, port) {
  const proxySocket = new net.Socket();

  proxySocket
    .connect(port, host, () => {
      console.log('Connected');
    })
    .on('data', data => {
      console.log('Received: ' + data);
    })
    .on('close', () => {
      console.log('Connection closed');
    });
}