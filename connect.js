'use strict';

const net = require('net');
const proxySocket = new net.Socket();

/**
 * @param {string} host 
 * @param {number} port 
 */
module.exports = function (host, port) {
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