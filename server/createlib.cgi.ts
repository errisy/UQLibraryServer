import * as http from 'http';
import * as url from 'url';
import * as cgi from 'errisy-cgi';
import * as fs from 'fs';

console.log('create lib');
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

class SaveObject {
    public async save() {
        let data = await Utilities.receive(cgi.request);
        let index = 1;
        while (fs.existsSync('newlib' + index.toString() + '.json')) {
            index += 1; 
        }
        fs.writeFileSync('newlib' + index.toString() + '.json', data);
        cgi.response.writeHead(200);
        cgi.response.end('true');
    }
}

(new SaveObject()).save();