//this file is not used

import * as http from 'http';
import * as net from 'net';
import * as url from 'url'


module NodeServer {
    export interface IServerHandler {
        handler: (request: http.ServerRequest, response: http.ServerResponse) => any;
    }
    class Utilities {
        public static async receive(request: http.ServerRequest): Promise<string> {
            return new Promise<string>(resolve => {
                let body = "";
                request.on('data', function (chunk: string) {
                    body += chunk;
                });
                request.on('end', function () {
                    resolve(body);
                });
            });
        }
    }
    class Server {
        public server: http.Server;
        constructor(public port?: number) {
            console.log('Initializing Server...');
            if (!(this.port) || typeof (this.port) != 'number') this.port = 2016;
        }
        public start(handler: IServerHandler) {
            this.server = http.createServer(handler.handler);
            this.server.listen(this.port);
            console.log('Server listening Port: ' + this.port);
        }
        public static isPortAvailable(port: number): Promise<boolean> {
            return new Promise<boolean>(resolve => {
                let tester = net.createServer();
                console.log('Checking port ' + port + ' availability...');
                tester.once('error', (err: NodeJS.ErrnoException) => {
                    if (err.code == 'EADDRINUSE') {
                        console.warn('Port ' + port + ' is not free. Please change port number or check if there is already a server instance running.')
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

    interface IClientCallback {
        status: number;
        data: string;
        headers: any;
    }
    class Client {
        static async DownloadString(link: string, method?: 'POST' | 'GET', data?: string): Promise<IClientCallback> {
            return new Promise<IClientCallback>((resolve, reject) => {
                try {
                    if (!method) method = 'GET';
                    let parsed = url.parse(link);
                    let options: http.RequestOptions = {
                        method: method,
                        host: parsed.host,
                        port: Number(parsed.port),
                        path: parsed.path
                    }
                    let request = http.request(options,
                        async function (res: http.IncomingMessage) {
                            resolve({status: res.statusCode, data: await Utilities.receive(res), headers: res.headers });
                        }
                    );
                    if (data) request.write(data);
                    request.end();
                }
                catch (ex) {
                    reject(ex);
                }
            });
        }
    }
    export async function StartProxy(port: number) {
        let avaiable = await Server.isPortAvailable(port);
        if (avaiable) {
            let server = new Server(port);
            let handler = new ProxyHandler(true);
            server.start(handler);
        }
        else {
            console.log('Port ' + port + ' is not free. Exit server.');
        }
    }

    export class ProxyHandler implements IServerHandler{
        constructor(public cors?: boolean) {
            console.log('Initializing proxy handler...')
        }
        public async handler (request: http.ServerRequest, response: http.ServerResponse) {
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
                    let body = await Utilities.receive(request);
                    let proxy: IProxy = JSON.parse(body);
                    try {
                        let callback = await Client.DownloadString(proxy.link, proxy.method, proxy.data);
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
                        response.end(ex)
                    }
                    break;
            }
        }
    }
}

interface IProxy {
    method: 'POST' | 'GET';
    link: string;
    data: string;
}

NodeServer.StartProxy(2016);