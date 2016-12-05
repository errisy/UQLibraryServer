"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const http = require('http');
const net = require('net');
const url = require('url');
var NodeServer;
(function (NodeServer) {
    class Utilities {
        static receive(request) {
            return __awaiter(this, void 0, void 0, function* () {
                return new Promise(resolve => {
                    let body = "";
                    request.on('data', function (chunk) {
                        body += chunk;
                    });
                    request.on('end', function () {
                        resolve(body);
                    });
                });
            });
        }
    }
    class Server {
        constructor(port) {
            this.port = port;
            console.log('Initializing Server...');
            if (!(this.port) || typeof (this.port) != 'number')
                this.port = 2016;
        }
        start(handler) {
            this.server = http.createServer(handler.handler);
            this.server.listen(this.port);
            console.log('Server listening Port: ' + this.port);
        }
        static isPortAvailable(port) {
            return new Promise(resolve => {
                let tester = net.createServer();
                console.log('Checking port ' + port + ' availability...');
                tester.once('error', (err) => {
                    if (err.code == 'EADDRINUSE') {
                        console.warn('Port ' + port + ' is not free. Please change port number or check if there is already a server instance running.');
                        resolve(false);
                    }
                });
                tester.once('listening', () => {
                    console.log('Port ' + port + ' is Free. Starting HTTP Server...');
                    tester.close();
                    resolve(true);
                });
                tester.listen(port);
            });
        }
    }
    class Client {
        static DownloadString(link, method, data) {
            return __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => {
                    try {
                        if (!method)
                            method = 'GET';
                        let parsed = url.parse(link);
                        let options = {
                            method: method,
                            host: parsed.host,
                            port: Number(parsed.port),
                            path: parsed.path
                        };
                        let request = http.request(options, function (res) {
                            return __awaiter(this, void 0, void 0, function* () {
                                resolve({ status: res.statusCode, data: yield Utilities.receive(res), headers: res.headers });
                            });
                        });
                        if (data)
                            request.write(data);
                        request.end();
                    }
                    catch (ex) {
                        reject(ex);
                    }
                });
            });
        }
    }
    function StartProxy(port) {
        return __awaiter(this, void 0, void 0, function* () {
            let avaiable = yield Server.isPortAvailable(port);
            if (avaiable) {
                let server = new Server(port);
                let handler = new ProxyHandler(true);
                server.start(handler);
            }
            else {
                console.log('Port ' + port + ' is not free. Exit server.');
            }
        });
    }
    NodeServer.StartProxy = StartProxy;
    class ProxyHandler {
        constructor(cors) {
            this.cors = cors;
            console.log('Initializing proxy handler...');
        }
        handler(request, response) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.cors) {
                    response.setHeader('Access-Control-Allow-Origin', '*');
                    response.setHeader('Access-Control-Allow-Methods', 'GET,POST');
                    response.setHeader('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Cookie, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
                }
                switch (request.method.toUpperCase()) {
                    case 'OPTIONS':
                        //for preflighted requests
                        response.writeHead(200);
                        response.end();
                        break;
                    case 'POST':
                        let body = yield Utilities.receive(request);
                        let proxy = JSON.parse(body);
                        try {
                            let callback = yield Client.DownloadString(proxy.link, proxy.method, proxy.data);
                            if (callback) {
                                response.writeHead(callback.status, callback.headers);
                                response.end(callback.data);
                            }
                            else {
                                response.writeHead(500);
                                response.end('The request link can not be reached by node proxy.');
                            }
                        }
                        catch (ex) {
                            response.writeHead(500);
                            response.end(ex);
                        }
                        break;
                }
            });
        }
    }
    NodeServer.ProxyHandler = ProxyHandler;
})(NodeServer || (NodeServer = {}));
NodeServer.StartProxy(2016);
//# sourceMappingURL=proxy.js.map