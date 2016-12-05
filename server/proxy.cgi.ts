import * as http from 'http'; 
import * as url from 'url';
import * as cgi from 'errisy-cgi';

interface IClientCallback {
    status: number;
    data: string;
    headers: any;
}

interface IHttpRequestConfigHeaders {
    [requestType: string]: string | (() => string);
    common?: string | (() => string);
    get?: string | (() => string);
    post?: string | (() => string);
    put?: string | (() => string);
    patch?: string | (() => string);
}

interface IProxy {
    method: 'POST' | 'GET';
    link: string;
    data: string;
    config?: IHttpRequestConfigHeaders;
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
                        resolve({ status: res.statusCode, data: await Utilities.receive(res), headers: res.headers });
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

class Proxy {

    public async download() {
        let body = await Utilities.receive(cgi.request); 
        let proxy: IProxy = JSON.parse(body);
        if (!body || body == '') {
            cgi.response.writeHead(200);
            cgi.response.end();
            return;
        }
        try {
            let callback = await Client.DownloadString(proxy.link, proxy.method, proxy.data);
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
    }
}
(new Proxy()).download();