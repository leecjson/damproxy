'use strict';

const assert = require("assert");
const net = require('net');
const Tunnel = require('./tunnel').ServerTunnel;
const decode = require('./decode');


class ForwardingServer {
  /**
   * @param {Tunnel} tunnel 
   */
  constructor(tunnel) {
    assert(tunnel, 'invalid tunnel');
    this._tunnel = tunnel;

    /** @type {Set<net.Socket>} */
    this._fwdsocks = new Set();
    /** @type {Map<number, net.Socket>} */
    this._pairingMap = new Map();
    this._pairid = 0;
    
    this._server = net.createServer(socket => {
      if (!this._tunnel || !this._tunnel.connected) {
        socket.destroy();
        return;
      }
      const tiemout = setTimeout(() => {
        this._pairingMap.delete(socket._pairid);
        socket.destroy();
      }, 10000); // 10s to timeout
      socket.clearTimeout = () => clearTimeout(tiemout);
      socket
        .once('error', e => {
          console.log('fwdsocket:error');
          console.log(e);
        })
        .once('end', () => {
          console.log('fwdsocket:end')
        })
        .once('close', had_error => {
          if (socket._pairid == undefined) {
            this._fwdsocks.delete(socket);
          } else {
            if (this._pairingMap.has(socket._pairid)) {
              this._pairingMap.delete(socket._pairid);
              socket.clearTimeout();
            }
          }
        });
      
      const pairid = this._pairid++;
      console.log('new fwdsocket pairid:' + pairid);
      if (pairid === 65535) {
        this._pairid = 0;
      }
      socket._pairid = pairid;
      this._pairingMap.set(pairid, socket);
      this._tunnel.pair(
        this._server.address().port, this._proxyServer.address().port, pairid);
    });

    this._proxyServer = net.createServer(proxysock => {
      if (this._pairingMap.size > 0) {
        proxysock
          .once('error', (e) => {
            console.log('proxysock:error');
            console.log(e);
          })
          .once('end', () => {
            console.log('proxysock:end')
          })
          .once('close', had_error => {
            console.log('proxysock:close had_error:'+ had_error);
          });
        decode(proxysock, 18, chunk => {
          if (!chunk) {
            if (!proxysock.destroyed) {
              proxysock.destroy();
            }
            return;
          }
          if (this._tunnel.checkToken(chunk)) {
            const pairid = chunk.readUInt16LE(16);
            const socket = this._pairingMap.get(pairid);
            if (!socket) {
              return;
            }
            this._pairingMap.delete(pairid);
            socket.clearTimeout();
            delete socket._pairid;
            delete socket.clearTimeout;
            socket.pipe(proxysock).pipe(socket);
            this._fwdsocks.add(socket);
          } else {
            proxysock.destroy(); // socket with invalid token
          }
        });
      } else {
        proxysock.end(); // 匹配失衡，直接关掉, 有可能是来方链接提前关闭
      }
    });

    this._tunnel.on('close', () => {
      for (const socket of this._pairingMap.values()) {
        if (!socket._closed) {
          socket.destroy(); // 隧道断线，正在匹配的链接当做意外断线处理
        }
      }
      this._pairingMap.clear();
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