'use strict';

const assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const net = require('net');
const uuid = require('uuid/v1');
const ByteBuffer = require('./buffer');
const decode = require('./decode');

const protocol = {
  pair: 1,
};

class ServerTunnel extends EventEmitter {
  constructor(opt = {}) {
    super();
    assert(opt.password == undefined || (typeof opt.password == 'string' && opt.password.length <= 32), 'invalid or password too long');
    this._pwd = opt.password;
    this._server = net.createServer(socket => {
      this._established(socket);
    });
    this._server.maxConnections = 1;
  }

  listen(host, port) {
    this._server.listen(port, host, 0);
    return this;
  }

  close() {
    if (this.connected) {
      this._socket.end();
    }
    this._server.close();
  }

  checkToken(token) {
    return this._token.compare(token, 0, 16, 0, 16) === 0;
  }

  /**
   * @param {net.Socket} socket 
   */
  _established(socket) {
    assert(!this.connected, 'already connected');
    assert(socket, 'invalid socket');

    const timeout = setTimeout(() => {
      socket._hasTimeout = true;
      socket.end();
    }, 10000);

    socket
      .setKeepAlive(true)
      .setNoDelay(true)
      .once('error', e => {
        console.log('server-tunnel:error');
        console.log(e);
      })
      .once('end', () => {
        console.log('server-tunnel:end');
      })
      .once('close', had_error => {
        if (!socket._hasTimeout) {
          clearTimeout(timeout);
        }
        this._socket = undefined;
        this.emit('close');
      });
      
    this._socket = socket;
    this._token = uuid(null, Buffer.alloc(16), 0);
    decode(socket, 32, chunk => {
      if (!chunk)
        return;

      let pwd;
      let eos = chunk.indexOf(0);
      if (eos !== 0) {
        eos = (eos === -1 ? chunk.length : eos);
        pwd = chunk.toString('utf-8', 0, eos);
      }
      if (this._pwd != undefined && this._pwd !== pwd) {
        socket.destroy(); // 密码错误
        return;
      }
      clearTimeout(timeout);
      socket.write(this._token);
    });
  }

  /**
   * @returns {boolean}
   */
  get connected() {
    return !!this._socket;
  }

  /**
   * 
   * @param {number} fwdport 
   * @param {number} proxyport 
   * @param {number} pairid 
   */
  pair(fwdport, proxyport, pairid) {
    this._socket.write(new ByteBuffer(8)
      .writeUInt16LE(protocol.pair).writeUInt16LE(fwdport)
      .writeUInt16LE(proxyport).writeUInt16LE(pairid)
      .buffer);
  }
}


class ClientTunnel {
  constructor(forwardPorts) {
    this._forwardPorts = forwardPorts;
    const socket = new net.Socket()
      .on('connect', () => {
        console.log('client-tunnel:connect');
        socket._connected = true;
        const pwdBuffer = Buffer.alloc(32);
        if (this._pwd != undefined) {
          pwdBuffer.write(this._pwd, 0, 'utf-8');
        }
        socket.write(pwdBuffer);
        this._decode();
      })
      .on('error', e => {
        console.log('client-tunnel:error:');
        console.log(e);
        //ECONNREFUSED
        //this._reconnect(5000);
      })
      .on('end', () => {
        console.log('client-tunnel:end');
      })
      .on('close', () => {
        console.log('client-tunnel:close');
        socket._connected = false;
        this._reconnect(1000);
      })
      .on('timeout', () => {
        console.log('client-tunnel:timeout');
        //this._reconnect(1000);
      })
      .setKeepAlive(true)
      .setNoDelay(true);

    this._socket = socket;
  }

  _reconnect(delay) {
    if (typeof delay == 'number') {
      setTimeout(() => {
        this._socket.connect(this._port, this._host);
      }, delay);
    } else {
      this._socket.connect(this._port, this._host);
    }
  }

  /**
   * 
   * @param {string} password 
   */
  connect(host, port, password) {
    assert(password == undefined || (typeof password == 'string' && password.length <= 32), 'invalid password or too long');
    assert(!this.connected, 'already connected');

    this._host = host;
    this._port = port;
    this._pwd = password;
    this._socket.connect(port, host);
    return this;
  }

  async _decode() {
    try {
      this._token = await decode(this._socket, 16);
      while (true) {
        switch ((await decode(this._socket, 2)).readUInt16LE()) {
          case protocol.pair:
            const chunk = await decode(this._socket, 6);
            const fwdport = chunk.readUInt16LE(0);
            const proxyport = chunk.readUInt16LE(2);
            const pairid = chunk.readUInt16LE(4);
            this._pair(fwdport, proxyport, pairid);
            break;
          default:
            throw new Error('invalid path');
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  get connected() {
    return this._socket._connected;
  }

  _pair(fwdport, proxyport, pairid) {
    console.log(`client-tunnel:pair  fwdport:${fwdport}, proxyport=${proxyport}, pairid=${pairid}`);
    let addr = this._forwardPorts.get(fwdport);
    if (addr == undefined) {
      return; // client not allow to forward the port
    } else if (addr === true) {
      addr = ['127.0.0.1', fwdport];
    }
    const socket = net.createConnection(addr[1], addr[0])
      .on('connect', () => {
        const proxysock = net.createConnection(proxyport, this._socket.remoteAddress)
          .on('connect', () => {
            proxysock.write(new ByteBuffer(18)
              .write(this._token)
              .writeUInt16LE(pairid)
              .buffer);
            socket.pipe(proxysock).pipe(socket);
          })
          .on('error', e => {
            console.log('proxysock:error');
            console.log(e);
          });
      })
      .on('error', e => {
        console.log('localsocket:error');
        console.log(e);
      });
  }
}

module.exports = {
  ServerTunnel, 
  ClientTunnel,
};