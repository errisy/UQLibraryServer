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
const url = require('url');
const cgi = require('errisy-cgi');
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
class Proxy {
    download() {
        return __awaiter(this, void 0, void 0, function* () {
            let body = yield Utilities.receive(cgi.request);
            let proxy = JSON.parse(body);
            if (!body || body == '') {
                cgi.response.writeHead(200);
                cgi.response.end();
                return;
            }
            try {
                let callback = yield Client.DownloadString(proxy.link, proxy.method, proxy.data);
                if (callback) {
                    cgi.response.writeHead(callback.status, callback.headers);
                    cgi.response.end(callback.data);
                }
                else {
                    cgi.response.writeHead(500);
                    cgi.response.end('The request link can not be reached by node proxy.');
                }
            }
            catch (ex) {
                cgi.response.writeHead(500);
                cgi.response.end(ex);
                console.log('Promise Rejected:', ex);
            }
        });
    }
}
(new Proxy()).download();
//# sourceMappingURL=proxy.cgi.js.map