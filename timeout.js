'use strict';

const net = require('net');

/**
 * 
 * @param {net.Socket} socket 
 * @param {string} name 
 * @param {number} delay 
 * @param {() => void} cb 
 */
module.exports = function (socket, name, delay, cb) {
  const handlerId = '_timeout_id_' + name,
    clearFuncId = 'clear_' + name;
  const handleClose = () => {
    socket[clearFuncId]();
  };
  socket[handlerId] = setTimeout(() => {
    delete socket[handlerId];
    delete socket[clearFuncId];
    socket.removeListener('close', handleClose);
    cb();
  }, delay);
  socket[clearFuncId] = () => {
    if (socket[handlerId]) {
      clearTimeout(socket[handlerId]);
      delete socket[handlerId];
      delete socket[clearFuncId];
      socket.removeListener('close', handleClose);
    }
  };
  socket
    .once('close', handleClose);
};