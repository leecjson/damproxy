'use strict';

/**
 * 
 * @param {ReadableStream} stream 
 * @param {number} length 
 * @param {(chunk: Buffer) => {}} cb
 * @returns {Promise<Buffer>} 
 */
module.exports = function (stream, length, cb) {
  let close;
  const read = () => {
    /** @type {Buffer} */
    const chunk = stream.read(length);
    if (null != chunk) {
      stream.removeListener('readable', read);
      stream.removeListener('close', close);
      cb(chunk);
    }
  };
  close = () => stream.removeListener('readable', read);
  const startRead = () => {
    if (stream.readableEnded) {
      cb();
      return;
    }
    if (stream.readable) {
      const chunk = stream.read(length);
      if (chunk != null) {
        cb(chunk);
        return;
      }
    }
    stream.once('close', close);
    stream.on('readable', read);
  };
  if (cb == undefined) {
    return new Promise((resolve, reject) => {
      cb = chunk => {
        chunk ? resolve(chunk) : reject()
      };
      startRead()
    });
  } else {
    startRead();
  }
}