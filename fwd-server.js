'use strict';

const assert = require("assert");
const net = require('net');
const Tunnel = require('./tunnel').ServerTunnel;
const decode = require('./decode');
const timeout = require('./timeout');

class ForwardingServer {
  /**
   * @param {Tunnel} tunnel 
   */
  constructor(opts = {}) {
    assert(opts.tunnel && (opts.tunnel instanceof Tunnel), 'invalid tunnel');
    this._tunnel = opts.tunnel;
    this._debug = opts.debug;

    /** @type {Set<net.Socket>} */
    this._fwdsocks = new Set();
    /** @type {Map<number, net.Socket>} */
    this._pairingMap = new Map();
    this._pairid = 0;
    
    this._server = net.createServer(socket => {
      const serverName = 'fwd=' + this._server.address().port;
      if (!this._tunnel || !this._tunnel.connected) {
        socket.destroy();
        if (this._debug) {
          console.log(`ForwardingServer(${serverName}):_reject_user(tunnel disconnected)`);
        }
        return;
      }
      const socketName = `${socket.remoteAddress}:${socket.remotePort}`;
      socket
        .setTimeout(60000, () => {
          if (this._debug) {
            console.log(`UserSocket(${socketName}):_timeout`);
          }
          socket.destroy();
        })
        .once('error', e => {
          if (this._debug) {
            console.log(`UserSocket(${socketName}):_error    ${e.toString()}`);
          }
        })
        .once('end', () => {
          if (this._debug) {
            console.log(`UserSocket(${socketName}):_end`);
          }
        })
        .once('close', had_error => {
          if (socket._pairid == undefined) {
            const ret = this._fwdsocks.delete(socket);
            if (this._debug) {
              console.log(`UserSocket(${socketName}):_close_connected  had_error=${had_error},  ret=${ret}`);
            }
          } else {
            assert(this._pairingMap.delete(socket._pairid), `UserSocket(${socketName}):_close_pairing  [Not In _pairingMap]  had_error=${had_error}`);
            // 进入这里说明被clear过
            if (this._debug) {
              console.log(`UserSocket(${socketName}):_close_pairing  had_error=${had_error}`);
            }
          }
        });
      
      const pairid = this._pairid++;
      if (this._debug) {
        console.log(`UserSocket(${socketName}):_connect  pairid=${pairid}`);
      }
      if (pairid === 65535) {
        this._pairid = 0;
      }
      socket._pairid = pairid;
      this._pairingMap.set(pairid, socket);
      this._tunnel.pair(
        this._server.address().port, this._proxyServer.address().port, pairid);
    });

    this._proxyServer = net.createServer(proxysock => {
      const socketName = `${proxysock.remoteAddress}:${proxysock.remotePort}`;
      if (this._pairingMap.size > 0) {
        timeout(proxysock, 'WaitTokenTimeout', 5000, () => { // N秒内必须接受到Token的timeout处理
          proxysock.destroy();
          if (this._debug) {
            console.log(`ProxySocket(${socketName}):_WaitTokenTimeout`);
          }
        });
        proxysock
          .setTimeout(60000, () => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_timeout`);
            }
            proxysock.destroy();
          })
          .once('error', (e) => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_connect    ${e.toString()}`);
            }
          })
          .once('end', () => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_end`);
            }
          })
          .once('close', had_error => {
            if (this._debug) {
              console.log(`ProxySocket(${socketName}):_close  had_error=${had_error}`);
            }
          });
        decode(proxysock, 18, chunk => {
          proxysock.clear_WaitTokenTimeout();
          if (!chunk) {
            if (this._debug) {
              console.error(`ProxySocket(${socketName}): decode if (!chunk) {`);
            }
            return;
          }
          if (this._tunnel.checkToken(chunk)) {
            const pairid = chunk.readUInt16LE(16);
            const socket = this._pairingMap.get(pairid);
            if (!socket) {
              proxysock.destroy();
              if (this._debug) {
                console.error(`ProxySocket(${socketName}): invalid pair   pairid=${pairid}, this._pairingMap.size=${this._pairingMap.size()}`);
              }
              return;
            }
            this._pairingMap.delete(pairid);
            delete socket._pairid;
            socket.pipe(proxysock).pipe(socket);
            this._fwdsocks.add(socket);
            if (this._debug) {
              console.log(`ProxySocket(${socketName}): pair success   pairid=${pairid}`);
            }
          } else {
            proxysock.destroy(); // socket with invalid token
            if (this._debug) {
              console.error(`ProxySocket(${socketName}): invalid token  ${chunk.toString('hex', 0, 16)}`);
            }
          }
        });
      } else {
        proxysock.destroy(); // 匹配失衡，直接关掉, 有可能是来方链接提前关闭
        if (this._debug) {
          console.error('Unbalanced Pair: redundant proxy socket');
        }
      }
    });

    this._tunnel.on('close', () => {
      for (const socket of this._pairingMap.values()) {
        if (!socket.destroyed) {
          socket.destroy(); // 隧道断线，正在匹配的链接当做意外断线处理
        }
      }
      // this._pairingMap.clear(); 
      if (this._debug) {
        console.log(`ForwardingServer(${this._server.address().port}):_tunnel_close_clear_all`);
      }
    });
  }

  listen(port, proxyport = 0) {
    this._proxyServer.listen(proxyport);
    this._server.listen(port);
    return this;
  }

  close() {
    this._server.close();
    this._proxyServer.close();
    return this;
  }
}


module.exports = ForwardingServer;