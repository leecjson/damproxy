'use strict';

const assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const net = require('net');
const uuid = require('uuid/v1');
const ByteBuffer = require('./buffer');
const decode = require('./decode');
const timeout = require('./timeout');

const protocol = {
  heartbeat: 0,
  pair: 1,
};

const heartbeatBuffer =
  new ByteBuffer(2)
    .writeUInt16LE(protocol.heartbeat)
    .buffer;

class ServerTunnel extends EventEmitter {
  constructor(opts = {}) {
    super();
    this._debug = opts.debug;
    assert(opts.password == undefined || (typeof opts.password == 'string' && opts.password.length <= 32), 'invalid or password too long');
    this._pwd = opts.password;
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
    return this;
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
    if (this._debug) {
      console.log('ServerTunnel:_established');
    }
    timeout(socket, 'WaitClientTimeout', 10000, () => {
      socket.destroy();
      if (this._debug) {
        console.log('ServerTunnel:_wait_client_timeout');
      }
    });
    socket
      .setKeepAlive(true)
      .setNoDelay(true)
      .setTimeout(10000, () => {
        if (this._debug) {
          console.log('ServerTunnel:_timeout 10000');
        }
        socket.destroy();
      })
      .once('error', e => {
        if (this._debug) {
          console.log('ServerTunnel:_error    ' + e.toString());
        }
      })
      .once('end', () => {
        if (this._debug) {
          console.log('ServerTunnel:_end');
        }
      })
      .once('close', had_error => {
        if (this._debug) {
          console.log('ServerTunnel:_close    had_error=' + had_error);
        }
        if (socket._heartbeatInterval) {
          clearInterval(socket._heartbeatInterval);
        }
        this._socket = undefined;
        this.emit('close');
      });

    decode(socket, 32, chunk => {
      socket.clear_WaitClientTimeout();
      if (!chunk) {
        if (this._debug) {
          console.error('ServerTunnel:_first_pack_not_recv')
        }
        return;
      }
      let pwd;
      let eos = chunk.indexOf(0);
      if (eos !== 0) {
        eos = (eos === -1 ? chunk.length : eos);
        pwd = chunk.toString('utf-8', 0, eos);
        if (this._debug) {
          console.log('ServerTunnel:_recv_password  ' + pwd);
        }
      } else {
        if (this._debug) {
          console.log('ServerTunnel:_recv_empty_password');
        }
      }
      if (this._pwd != undefined && this._pwd !== pwd) {
        socket.destroy(); // 密码错误
        if (this._debug) {
          console.log('ServerTunnel:_incorrect_password');
        }
        return;
      }
      socket.write(this._token);
      this._decode();
      if (this._debug) {
        console.log('ServerTunnel:_accept_client' +
          (socket._waitClientTimeout ? '' : '  [clear wait client timeout]'));
      }
    });

    //socket._heartbeatInterval = setInterval(() => socket.write(heartbeatBuffer), 5000);
    this._socket = socket;
    this._token = uuid(null, Buffer.alloc(16), 0);
    if (this._debug) {
      console.log('ServerTunnel:token    ' + this._token.toString('hex'));
    }
  }

  async _decode() {
    try {
      while (true) {
        switch ((await decode(this._socket, 2)).readUInt16LE()) {
          case protocol.heartbeat:
            break;
          default:
            throw new Error('invalid path');
        }
      }
    } catch {
      if (this._debug) {
        console.log('ServerTunnel:_decode exit' );
      }
    }
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
    const ret = this._socket.write(
      new ByteBuffer(8)
        .writeUInt16LE(protocol.pair).writeUInt16LE(fwdport)
        .writeUInt16LE(proxyport).writeUInt16LE(pairid)
        .buffer,
      err => {
        if (err) {
          console.error('ServerTunnel:write error    ' + err.toString());
        } else {
          console.error('ServerTunnel:write without_error');
        }
      });
    console.error('ServerTunnel:write     ret='+ ret);
  }
}


class ClientTunnel extends EventEmitter {
  constructor(opts) {
    super();
    this._forwardPorts = opts.forwardPorts;
    this._debug = opts.debug;
    this._socket = new net.Socket()
      .setKeepAlive(true)
      .setNoDelay(true)
      .on('connect', () => {
        if (this._debug) {
          console.log('ClientTunnel:_connect');
        }
        this._socket._connected = true;
        const pwdBuffer = Buffer.alloc(32);
        if (typeof this._pwd == 'string' && this._pwd.length > 0) {
          pwdBuffer.write(this._pwd, 0, 'utf-8');
        }
        this._socket.write(pwdBuffer);
        if (this._debug) {
          console.log('ClientTunnel:_write_password  ' +
            ((typeof (this._pwd) == 'string' && this._pwd.length > 0) ? this._pwd : '[empty]'));
        }
        this._socket._heartbeatInterval = setInterval(() => this._socket.write(heartbeatBuffer), 5000);
        this._socket.setTimeout(10000, () => {
          if (this._debug) {
            console.log('ClientTunnel:_timeout');
          }
          this._socket.destroy();
        });
        this._decode();
      })
      .on('error', e => {
        if (this._debug) {
          console.log('ClientTunnel:_error    ' + e.toString());
        }
      })
      .on('end', () => {
        if (this._debug) {
          console.log('ClientTunnel:_end');
        }
      })
      .on('close', (had_error) => {
        if (this._debug) {
          console.log('ClientTunnel:_close_and_reconnect  had_error=' + had_error);
        }
        if (this._socket._heartbeatInterval) {
          clearInterval(this._socket._heartbeatInterval);
        }
        this._socket._connected = false;
        this._reconnect(1000);
      });
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
          case protocol.heartbeat:
            break;
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
    } catch {
      if (this._debug) {
        console.log('ClientTunnel:_decode exit');
      }
    }
  }

  get connected() {
    return this._socket._connected;
  }

  _pair(fwdport, proxyport, pairid) {
    const addr = this._forwardPorts.get(fwdport);
    if (addr == undefined) {
      if (this._debug) {
        console.log(`ClientTunnel:_pair  [Not Allowed]  fwdport:${fwdport}, proxyport=${proxyport}, pairid=${pairid}`);
      }
      return; // client not allow to forward the port
    }
    const socketName = `${fwdport}@${proxyport}->${addr[0]}@${addr[1]}__${pairid}`;
    if (this._debug) {
      console.log(`ClientTunnel:_pair  fwdport:${fwdport}, proxyport=${proxyport}, pairid=${pairid}`);
    }
    const socket = net.createConnection(addr[1], addr[0])
      .on('connect', () => {
        if (this._debug) {
          console.log(`LocalSocket(${socketName}):_connect`);
        }
        const proxysock = net.createConnection(proxyport, this._socket.remoteAddress)
          .on('connect', () => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_connect`);
            }
            proxysock
              .write(new ByteBuffer(18)
                .write(this._token)
                .writeUInt16LE(pairid)
                .buffer);
            socket
              .pipe(proxysock)
              .pipe(socket);
          })
          .on('error', e => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_error    ${e.toString()}`);
            }
          })
          .on('end', () => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_end`);
            }
          })
          .on('close', had_error => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_close  had_error=${had_error}`);
            }
          })
          .setTimeout(10000, () => {
            proxysock.destroy();
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_timeout`);
            }
          });
      })
      .on('error', e => {
        if (this._debug) {
          console.log(`LocalSocket(${socketName}):_error    ${e.toString()}`);
        }
      })
      .on('end', () => {
        if (this._debug) {
          console.log(`LocalSocket(${socketName}):_end`);
        }
      })
      .on('close', had_error => {
        if (this._debug) {
          console.log(`LocalSocket(${socketName}):_close  had_error=${had_error}`);
        }
      })
      .setTimeout(10000, () => {
        socket.destroy();
        if (this._debug) {
          console.log(`LocalSocket(${socketName}):_timeout`);
        }
      });
  }
}

module.exports = {
  ServerTunnel, 
  ClientTunnel,
};