可以将公网（WAN）主机流量转到内网（LAN）主机的反向代理工具库，实现了内网穿透。采用多链接+配对的方式实现，支持TCP、HTTP、SSH协议等。

A reverse proxy tool which can let WAN server's data flows to LAN server. support TCP, HTTP, SSH or others protocol based on TCP.

# Getting started
Prepare a WAN server and a LAN server. Follow the steps on both of servers.
1. Download and install <code>Node.js(>=12.0.0)</code>.
2. Install <code>damproxy</code>
```bash
$ npm i damproxy -g
```
<br />

# WAN Server
Simple usage, forward data from port 80 and 443 to LAN server:
```bash
$ damproxy listen --forward-ports 80 443
```
Full options:
```bash
$ damproxy listen --host 0.0.0.0 --port 8991 --pwd mypassword --forward-ports 80@17080 443@17443
```
### Options
#### <code>--host</code>
Host for LAN server connection, default <code>0.0.0.0</code>.
#### <code>--port</code>
Port for LAN server connection, default <code>8991</code>.
#### <code>--pwd</code>
Set the password to identify LAN server. Should less than 32 characters.
#### <code>--forward-ports</code>
Specify the port that will receive data from real client, then it will forward to the LAN server via the secondary port as outbound port. 80@17080 means receive data from 80 and forward to LAN server that output via 17080. Defaults the secondary port will automatically provided. May specify it in whitelist situation.

<br />

# LAN Server
Simple usage, connect to WAN server
```bash
$ damproxy connect --host x.x.x.x --forward-ports 80
```
Full options:
```bash
$ damproxy connect --host x.x.x.x --port 8991 --pwd mypassword --forward-ports 80 443@20443 22@192.168.0.102:22
```
### Options
#### <code>--host</code>
WAN server's host to connect.
#### <code>--port</code>
WAN server's port to connect, default <code>8991</code>.
#### <code>--pwd</code>
Send the password to WAN server. Should less than 32 characters.
#### <code>--forward-ports</code>
Whitelist of forwarding port and specify a redirect address. It formed by A@B:C which means allowing data from WAN server's port A and send it to B:C. <code>80</code> equivalent to <code>80@127.0.0.1:80</code> and <code>80:8080</code> equivalent to <code>80@127.0.0.1:8080</code>.
