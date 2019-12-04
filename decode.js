'use strict';

/**
 * 
 * @param {ReadableStream} stream 
 * @param {number} length 
 * @param {(chunk: Buffer) => {}} cb
 * @returns {Promise<Buffer>} 
 */
module.exports = function (stream, length, cb) {
  const read = () => {
    /** @type {Buffer} */
    const chunk = stream.read(length);
    if (null != chunk) {
      stream.removeListener('readable', read);
      stream.removeListener('close', close);
      cb(chunk);
    }
  };
  function close() {
    stream.removeListener('readable', read);
    cb();
  }
  const start = () => {
    if (stream.readableEnded) {
      cb();
      return;
    }
    stream
      .once('close', close)
      .on('readable', read);

    if (stream.readable)
      read();
  };
  if (cb == undefined) {
    return new Promise((resolve, reject) => {
      cb = chunk => {
        chunk ? resolve(chunk) : reject()
      };
      start()
    });
  } else {
    start();
  }
}