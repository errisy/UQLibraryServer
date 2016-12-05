"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const cgi = require('errisy-cgi');
const fs = require('fs');
console.log('create lib');
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
class SaveObject {
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            let data = yield Utilities.receive(cgi.request);
            let index = 1;
            while (fs.existsSync('newlib' + index.toString() + '.json')) {
                index += 1;
            }
            fs.writeFileSync('newlib' + index.toString() + '.json', data);
            cgi.response.writeHead(200);
            cgi.response.end('true');
        });
    }
}
(new SaveObject()).save();
//# sourceMappingURL=createlib.cgi.js.map