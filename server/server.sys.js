"use strict";
//a simple node server
const http = require('http');
const url = require('url');
const fs = require('fs');
const vm = require('vm');
const net = require('net');
const child_process = require('child_process');
const process = require('process');
const mime_sys_1 = require('./mime.sys');
var NodeServer;
(function (NodeServer) {
    class HttpService {
        constructor(port, cors) {
            this.port = port;
            this.cors = cors;
            this.middleWares = [];
            this.handler = (request, response) => {
                let middleWareIndex = 0;
                let link = url.parse(request.url);
                //console.log(link);
                let tryNext = () => {
                    let route = this.middleWares[middleWareIndex].route;
                    if (route) {
                        route.lastIndex = -1;
                        if (route.test(link.pathname)) {
                            this.middleWares[middleWareIndex].handler(request, response, next);
                        }
                        else {
                            next();
                        }
                    }
                    else {
                        this.middleWares[middleWareIndex].handler(request, response, next);
                    }
                };
                let next = () => {
                    middleWareIndex += 1;
                    if (middleWareIndex < this.middleWares.length) {
                        tryNext();
                    }
                    else {
                        console.log('all middleware tried', response.statusCode);
                        //if (!response.statusCode) {
                        Response404(response, link.pathname);
                    }
                };
                if (this.cors) {
                    //if (request.method.toUpperCase() == 'OPTIONS') {
                    response.setHeader('Access-Control-Allow-Origin', '*');
                    response.setHeader('Access-Control-Allow-Methods', 'GET,POST');
                    response.setHeader('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Cookie, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
                }
                tryNext();
            };
            //private handlers: HttpHandler[] = [];
            //public addHandler = (handler: HttpHandler) => {
            //    if (!handler.route) {
            //        handler.route = '\/';
            //    }
            //    if (handler.route.indexOf('\/') != 0) {
            //        handler.route = '\/' + handler.route;
            //    }
            //    if (!handler.method) {
            //        handler.method = 'GET';
            //    }
            //    if (handler.action) {
            //        this.handlers.push(handler);
            //    }
            //}
            this.checkPort = (callback) => {
                let tester = net.createServer();
                let that = this;
                tester.once('error', (err) => {
                    if (err.code == 'EADDRINUSE') {
                        //try later 
                        console.log('Port ' + this.port + ' is not Free. Server will try again in 0.5 sec ...');
                        setTimeout(() => that.checkPort(callback), 500);
                    }
                });
                tester.once('listening', () => {
                    console.log('Port ' + this.port + ' is Free. Starting HTTP Server...');
                    tester.close();
                    callback();
                });
                tester.listen(this.port);
            };
            this.start = () => {
                this.checkPort(this.startServer);
            };
            this.startServer = () => {
                this.server = http.createServer(this.handler);
                this.server.listen(this.port);
            };
            this.stop = () => {
                this.server.close();
            };
            if (!(this.port) || typeof (this.port) != 'number')
                this.port = 48524;
        }
    }
    function Response404(response, path) {
        response.writeHead(404, {
            "Content-Type": "text/plain"
        });
        response.end('File ' + path + ' can not be found on the server.');
    }
    class RouteMiddleware {
        constructor(route, handler) {
            this.route = route;
            this.handler = handler;
        }
    }
    class FileMiddleware {
        constructor() {
            /** This provides a default index for the file middleware.*/
            this.default = 'index.html';
            this.handler = (request, response, next) => {
                //console.log('trying file middleware');
                let link = url.parse(request.url);
                let filename = __dirname + decodeURI(link.pathname);
                if (/\/$/.test(filename))
                    filename += this.default;
                fs.exists(filename, exists => {
                    if (exists) {
                        fs.stat(filename, (err, stats) => {
                            if (err) {
                                next();
                            }
                            else {
                                if (stats.isFile()) {
                                    let mimes = mime_sys_1.mime.lookup(filename);
                                    let maxSize = (mimes[0] && mimes[0].isDefaultStream) ? 204800 : stats.size;
                                    if (stats.size <= 204800) {
                                        if (mimes.length > 0) {
                                            response.writeHead(200, {
                                                "Content-Type": mimes[0].MIME,
                                                "Content-Length": stats.size
                                            });
                                        }
                                        else {
                                            response.writeHead(200, {
                                                "Content-Type": "application/octet-stream",
                                                "Content-Length": stats.size
                                            });
                                        }
                                        let readStream = fs.createReadStream(filename);
                                        readStream.pipe(response);
                                    }
                                    else {
                                        //too big (> 200K) that could be stream, we need to send as 200KB block stream
                                        let range = request.headers['range'];
                                        let start, end;
                                        let total = stats.size;
                                        let chunksize;
                                        if (range) {
                                            let positions = range.replace(/bytes=/, "").split("-");
                                            start = parseInt(positions[0], 10);
                                            end = positions[1] ? parseInt(positions[1], 10) : start + 204799;
                                        }
                                        else {
                                            start = 0;
                                            end = start + maxSize - 1;
                                        }
                                        if (start > total - 1)
                                            start = total - 1;
                                        if (end > total - 1)
                                            end = total - 1;
                                        chunksize = (end - start) + 1;
                                        let statusCode = (chunksize == stats.size) ? 200 : 206;
                                        if (mimes.length > 0) {
                                            response.writeHead(statusCode, {
                                                "Content-Range": "bytes " + start + "-" + end + "/" + total,
                                                "Accept-Ranges": "bytes",
                                                "Content-Length": chunksize,
                                                "Content-Type": mimes[0].MIME
                                            });
                                        }
                                        else {
                                            response.writeHead(statusCode, {
                                                "Content-Range": "bytes " + start + "-" + end + "/" + total,
                                                "Accept-Ranges": "bytes",
                                                "Content-Length": chunksize,
                                                "Content-Type": "application/octet-stream"
                                            });
                                        }
                                        console.log({ start: start, end: end });
                                        let readStream = fs.createReadStream(filename, { start: start, end: end });
                                        readStream.pipe(response);
                                        console.log(request.url, maxSize, statusCode);
                                    }
                                }
                                else {
                                    console.log('not file');
                                    next();
                                }
                            }
                        });
                    }
                    else {
                        next();
                    }
                });
            };
        }
    }
    class DirectoryMiddleware {
        constructor() {
            this.handler = (request, response, next) => {
                //console.log('trying directory middleware');
                let link = url.parse(request.url);
                let filename = __dirname + decodeURI(link.path);
                //console.log('filename', filename);
                fs.exists(filename, exists => {
                    if (exists) {
                        fs.stat(filename, (err, stats) => {
                            if (err) {
                                next();
                            }
                            else {
                                if (stats.isDirectory()) {
                                    response.writeHead(200, {
                                        "Content-Type": "text/html"
                                    });
                                    fs.readdir(filename, (err, files) => {
                                        let pathname = pathreducer.toPathname(decodeURI(link.path));
                                        let result = '<html>\n\
 <head>\n\
  <title>Index of /</title>\n\
  <meta charset="UTF-8">\
 </head>\n\
 <body>\n\
<h1>Index of ' + pathname + '</h1>\n\
<ul>\n' +
                                            files.map(file => '\t<li><a href="' + (pathname + file).replace(/\\/ig, '\\\\') + '">' + file + '</a></li>\n').join('') +
                                            '</ul>\n\
<div>Simple Node Service</div>\
</body></html>';
                                        response.end(result);
                                    });
                                }
                                else {
                                    next();
                                }
                            }
                        });
                    }
                    else {
                        next();
                    }
                });
            };
        }
    }
    class pathreducer {
        static reduce(path) {
            return path.replace(/[^\\^\/^\:]+[\\\/]+\.\.[\\\/]+/ig, '').replace(/([^\:])[\\\/]{2,}/ig, (capture, ...args) => {
                return args[0] + '\/';
            }).replace(/\.[\\\/]+/ig, '');
        }
        static filename(path) {
            let index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('\/'));
            if (index > -1)
                return path.substr(index + 1);
            return path;
        }
        static pathname(path) {
            let index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('\/'));
            //console.log('[pathreducer]->pathaname: ', path, index, path.length);
            if (index == path.length - 1)
                return path.substr(0, index + 1);
            return path;
        }
        static file2pathname(path) {
            let index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('\/'));
            //console.log('[pathreducer]->pathaname: ', path, index, path.length);
            if (index > -1)
                return path.substr(0, index + 1);
            return path;
        }
        static toPathname(path) {
            let index = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('\/'));
            if (index < path.length - 1)
                return path + '/';
            return path;
        }
    }
    let __relativeRoot = __dirname;
    /**
     * Dynamically load and run a script in a try-catch block. This is great for debugging.
     * @param fileName The script file name with relative path. e.g. "../app/testModule". '.js' will be added to the end of the file name.
     * @param directoryName The directory where the script file is located. By default it is the root directory.
     */
    function DynamicRequire(fileName, directoryName) {
        try {
            if (!directoryName)
                directoryName = __relativeRoot;
            //console.log('DynamicRequire: ', fileName, ' Base Path: ' + directoryName);
            let required = {};
            let requiredIndex = 0;
            let fullFilename = pathreducer.reduce(directoryName + '//' + fileName);
            if (fs.existsSync(fullFilename)) {
                if (fs.statSync(fullFilename).isFile()) {
                    let code = '(function (){\ntry{\n\tvar exports = {};\n' +
                        fs.readFileSync(fullFilename).toString()
                            .replace(/require\s*\(\s*[\'"](\.+[\/a-z_\-\s0-9\.]+)[\'"]\s*\)/ig, (capture, ...args) => {
                            //let $file = pathreducer.reduce(directoryName + '//' + args[0] + '.js');
                            let $modulePath = args[0];
                            let $file;
                            if ($modulePath.charAt[0] == '.') {
                                $file = pathreducer.reduce(directoryName + '//' + args[0] + '.js');
                            }
                            else {
                                $file = pathreducer.reduce(directoryName + '/node_modules/' + args[0] + '/index.js');
                            }
                            required[requiredIndex] = DynamicRequire(pathreducer.filename($file), pathreducer.file2pathname($file));
                            let replacement = '$__required[' + requiredIndex + ']';
                            requiredIndex += 1;
                            return replacement;
                        }) +
                        '\n\treturn exports;\n}\ncatch(ex){\n\tconsole.log("Error:", ex, "@' + fullFilename.replace(/\\/ig, '\\\\') + '");\n}\n})';
                    let context = vm.createContext({
                        console: console,
                        require: require,
                        __dirname: directoryName,
                        __filename: __filename,
                        process: process,
                        $__required: required
                    });
                    let _script = vm.createScript(code);
                    let fn = _script.runInContext(context);
                    let exported = fn();
                    if (!exported)
                        console.log('Exported is undefined: ', fullFilename);
                    if (exported['__relativeRoot'])
                        exported['__relativeRoot'] = __relativeRoot;
                    return exported;
                }
                else {
                    console.log('dynamicRequire Error: File not found - ' + fullFilename);
                }
            }
            else {
                console.log('dynamicRequire Error: File not found - ' + fullFilename);
            }
        }
        catch (ex) {
            console.log('dynamicRequire Error: ', ex);
        }
    }
    NodeServer.DynamicRequire = DynamicRequire;
    /**
     * This is a task stack that accepts task request from request for high performance tasks running in child process.
     * You shall use task when *.cgi.js or *.rpc.js can not handle the request in synchronized manner (e.g. taking to long time to complete);
     */
    class TaskHost {
        constructor() {
            this.creationCount = 0;
            this.tasksToRun = [];
            this.tasksRunning = [];
            this.tasksCompleted = [];
            /** Create a task and return the task id.*/
            this.createTask = (job, args, obj) => {
                //console.log('create task.');
                this.creationCount += 1;
                let info = {
                    id: this.creationCount.toString(),
                    filename: job,
                    args: args,
                    status: 'Scheduled',
                    obj: obj
                };
                this.tasksToRun.push(info);
                return info.id;
            };
            /** Cancel the task is scheduled or started*/
            this.cancelTask = (id) => {
                let available = [];
                this.tasksToRun.forEach(task => available.push(task));
                this.tasksRunning.forEach(task => available.push(task));
                available.filter(task => task.id == id).forEach(task => {
                    try {
                        task.process.pid && task.process.kill && task.process.kill();
                    }
                    catch (ex) {
                    }
                });
            };
            this.start = () => {
                //console.log('task start.');
                while (this.tasksToRun.length > 0) {
                    let task = this.tasksToRun.shift();
                    task.starttime = Number(new Date());
                    task.status = 'Running';
                    this.tasksRunning.push(task);
                    let that = this;
                    //console.log('starting task');
                    task.process = child_process.fork(task.filename + '.sys.js', task.args);
                    task.process.on('message', (data) => {
                        //console.log('Task ' + task.id + ' - progress :', data);
                        task.progress = data;
                    });
                    //task.process.emit('message', task.obj);
                    task.process.send(task.obj);
                    task.process.on('error', () => {
                        let errorTask = that.tasksRunning.splice(that.tasksRunning.indexOf(task), 1)[0];
                        errorTask.status = 'Error';
                        that.tasksCompleted.push(errorTask);
                    });
                    task.process.on('exit', () => {
                        //console.log('Task ' + task.id + ' has completed.');
                        let completedTask = that.tasksRunning.splice(that.tasksRunning.indexOf(task), 1)[0];
                        completedTask.status = 'Completed';
                        completedTask.endtime = Number(Date.now());
                        that.tasksCompleted.push(completedTask);
                    });
                }
            };
            this.onStatusUpdate = () => {
            };
            this.checkStatus = (id) => {
                let target;
                if (this.tasksToRun.some(task => {
                    if (task.id == id) {
                        target = task;
                        return true;
                    }
                }) ||
                    this.tasksRunning.some(task => {
                        if (task.id == id) {
                            target = task;
                            return true;
                        }
                    }) ||
                    this.tasksCompleted.some(task => {
                        if (task.id == id) {
                            target = task;
                            return true;
                        }
                    })) {
                    //only return part of the information;
                    //process will not be exposed to the cgi;
                    return {
                        id: target.id,
                        filename: target.filename,
                        status: target.status,
                        progress: target.progress,
                        starttime: target.starttime,
                        endtime: target.endtime
                    };
                }
                else {
                    return undefined;
                }
            };
        }
    }
    let ServerTaskHost = new TaskHost();
    /**
     * CGI Middleware will process pathname with *.cgi.js
     * By using vm and DynamicRequire, CGIMiddleware reads the js file from disk for each request.
     * It can be optimized by load them with require, well the files must be modified anyway;
     */
    class CGIMiddleware {
        constructor() {
            this.route = /\.cgi\.js$/;
            this.handler = (request, response, next) => {
                let _url = url.parse(decodeURI(request.url));
                //console.log(_url);
                if (request.url.indexOf('.cgi.js') > -1) {
                    let scriptFile = pathreducer.reduce(__relativeRoot + '\/' + _url.pathname);
                    //console.log('CGI Script:', scriptFile);
                    let $directory = pathreducer.file2pathname(scriptFile);
                    if (fs.existsSync(scriptFile)) {
                        if (fs.statSync(scriptFile).isFile()) {
                            switch (request.method.toUpperCase()) {
                                case 'OPTIONS':
                                    response.writeHead(200);
                                    response.end();
                                    break;
                                default:
                                    fs.readFile(scriptFile, (err, data) => {
                                        let required = {};
                                        let argumentlist = {};
                                        let requiredIndex = 0;
                                        try {
                                            argumentlist['request'] = request;
                                            argumentlist['response'] = response;
                                            argumentlist['next'] = next;
                                            argumentlist['tasks'] = ServerTaskHost;
                                            //var something = require('cgi');
                                            let precode = data.toString();
                                            let varCGI;
                                            precode = precode.replace(/(^|;)(\s*(let|var|const)\s+(\w+)\s*=\s*require\s*\(\s*\'errisy-cgi\'\)\s*;)/, (capture, ...args) => {
                                                varCGI = args[3];
                                                return args[0];
                                            });
                                            let code = '(function (){\ntry{\n'
                                                + precode.replace(/require\s*\(\s*[\'"]\s*\[\s*(\w+)\s*\]\s*[\'"]\s*\)/ig, (capture, ...args) => {
                                                    return '$__arguments["' + args[0] + '"]';
                                                }).replace(/require\s*\(\s*[\'"](\.+[\/a-z_\-\s0-9\.]+)[\'"]\s*\)/ig, (capture, ...args) => {
                                                    //console.log('Replacing: ', capture);
                                                    let $file = pathreducer.reduce($directory + '\/' + args[0] + '.js');
                                                    //console.log('dynamic require directory: ', $file);
                                                    required[requiredIndex] = DynamicRequire(pathreducer.filename($file), pathreducer.file2pathname($file));
                                                    let replacement = '$__required[' + requiredIndex + ']';
                                                    requiredIndex += 1;
                                                    return replacement;
                                                }) +
                                                '\n}\ncatch(ex){\n\tconsole.log("Error:", ex, "@' + scriptFile + '");\n\tresponse.statusCode = 500;\n\tresponse.end(ex.toString()); \n}\n})';
                                            //console.log(code);
                                            let context = vm.createContext({
                                                console: console,
                                                require: require,
                                                __dirname: $directory,
                                                __filename: scriptFile,
                                                process: process,
                                                $__arguments: argumentlist,
                                                $__required: required
                                            });
                                            //an alternative way to use cgi to obtain the request response and session entries;
                                            if (varCGI)
                                                context[varCGI] = {
                                                    session: request['session'],
                                                    request: request,
                                                    response: response
                                                };
                                            let _script = vm.createScript(code);
                                            let fn = _script.runInContext(context);
                                            fn();
                                            //handle tasks. start tasks if there are any;
                                            ServerTaskHost.start();
                                        }
                                        catch (ex) {
                                            console.log(ex);
                                            response.writeHead(500, {
                                                "Content-Type": "text/plain"
                                            });
                                            response.end(ex);
                                        }
                                    });
                                    break;
                            }
                        }
                        else {
                            response.writeHead(500, {
                                "Content-Type": "text/plain"
                            });
                            response.end('Error: The file does not exist in the server.');
                        }
                    }
                    else {
                        response.writeHead(500, {
                            "Content-Type": "text/plain"
                        });
                        response.end('Error: The file does not exist in the server.');
                    }
                }
                else {
                    next();
                }
            };
        }
    }
    let ptnRPCMethod = /([\w\.]+)([&@\-]?)(\w+)/; //[@: get &: set null:method]
    function Receive(request, callback) {
        switch (request.method.toUpperCase()) {
            case 'POST':
                let body = "";
                request.on('data', function (chunk) {
                    body += chunk;
                });
                request.on('end', function () {
                    if (callback)
                        callback(JSON.parse(body));
                });
                break;
            case 'OPTIONS':
                //Preflighted requests in CORS system. need send back CORS headers:
                break;
            default:
                callback(JSON.parse('{}'));
                break;
        }
        //if (request.method.toUpperCase() == 'POST') {
        //}
        //else {
        //}
    }
    NodeServer.Receive = Receive;
    // References is the dictionary that hold all loaded library;
    let References = {};
    function Deserialize(jsonObject) {
        if (typeof jsonObject != 'object')
            return jsonObject;
        if (jsonObject == null)
            return null;
        if (jsonObject == undefined)
            return undefined;
        if (Array.isArray(jsonObject)) {
            //console.log('Deserialize Array: ', JSON.stringify(jsonObject));
            for (let i = 0; i < jsonObject.length; i++) {
                jsonObject[i] = Deserialize(jsonObject[i]);
            }
        }
        if (jsonObject['@Serializable.ModuleName'] && jsonObject['@Serializable.TypeName']) {
            //console.log('Deserialize Object: ', JSON.stringify(jsonObject));
            let moduleName = jsonObject['@Serializable.ModuleName'];
            let typeName = jsonObject['@Serializable.TypeName'];
            //load module to References
            if (moduleName.charAt(0) == '/') {
                //this is a relative file;
                // if the module was not loaded, load it from the module file;
                //console.log('__relativeRoot: ', __relativeRoot);
                if (!References[moduleName]) {
                    let $file = pathreducer.reduce(__relativeRoot + moduleName + '.js');
                    //console.log('Deserialize->Load Type Def from: ', $file);
                    References[moduleName] = DynamicRequire(pathreducer.filename($file), pathreducer.file2pathname($file));
                }
            }
            else {
                //this is a type from module
                References[moduleName] = require(moduleName);
            }
            //how to obtain the module and type from it?
            let obj = new References[moduleName][typeName]();
            //console.log('obj built: ', moduleName, typeName, obj);
            for (let key in jsonObject) {
                if (key != '$$hashKey')
                    obj[key] = Deserialize(jsonObject[key]);
            }
            return obj;
        }
        return jsonObject;
    }
    NodeServer.Deserialize = Deserialize;
    /**
     * RPC middleware will capture pathname with *.rpc.js, and wrap *.rpc.js with a function so as to obtain the service $Object.
     * Then we will call $Object[memberName].apply($Object, parameters) to invoke the method to produce response objects for the request.
     * vm is used to invoke the code dynamically, any modification will be read by the server. The drawback is its relatively lower performance.
     * If the service is considered stable, the *.rpc.js should be converted to js file and loaded by 'require' for reuse;
     */
    class RPCMiddleware {
        constructor() {
            this.route = /\.rpc\.js$/;
            this.handler = (request, response, next) => {
                //console.log('RPC middleware URL: ', request);
                let link = url.parse(decodeURI(request.url));
                //console.log('RPC middleware ', link.path);
                let filename = __dirname + link.pathname;
                //console.log('RPC: ', filename);
                fs.exists(filename, exists => {
                    if (exists) {
                        fs.stat(filename, (err, stats) => {
                            if (err) {
                                Response404(response, link.path);
                            }
                            else {
                                if (stats.isFile()) {
                                    switch (request.method.toUpperCase()) {
                                        case 'OPTIONS':
                                            //for Preflighted requests in CORS;
                                            response.writeHead(200);
                                            response.end();
                                            //console.log('Preflighted requests ', link.path);
                                            break;
                                        case 'POST':
                                            Receive(request, (data) => {
                                                ptnRPCMethod.lastIndex = -1;
                                                let matches = ptnRPCMethod.exec(link.search);
                                                let className = matches[1];
                                                let memberType = matches[2];
                                                //console.log('rpc deserialize.');
                                                let paramaters = Deserialize(data);
                                                let memberName = matches[3];
                                                let scriptFile = pathreducer.reduce(__relativeRoot + '\/' + link.pathname);
                                                //console.log('RPC Script:', scriptFile);
                                                let $directory = pathreducer.file2pathname(scriptFile);
                                                fs.readFile(scriptFile, (err, data) => {
                                                    let required = {};
                                                    let requiredIndex = 0;
                                                    let argumentlist = {};
                                                    try {
                                                        argumentlist['request'] = request;
                                                        argumentlist['response'] = response;
                                                        argumentlist['next'] = next;
                                                        argumentlist['tasks'] = ServerTaskHost;
                                                        let precode = data.toString();
                                                        let varCGI;
                                                        precode = precode.replace(/(^|;)(\s*(let|var|const)\s+(\w+)\s*=\s*require\s*\(\s*\'errisy-cgi\'\)\s*;)/, (capture, ...args) => {
                                                            varCGI = args[3];
                                                            return args[0];
                                                        });
                                                        let code = '(function (){\ntry{\n\tvar exports = {};\n'
                                                            + precode.replace(/require\s*\(\s*[\'"]\s*\[\s*(\w+)\s*\]\s*[\'"]\s*\)/ig, (capture, ...args) => {
                                                                return '$__arguments["' + args[0] + '"]';
                                                            }).replace(/require\s*\(\s*[\'"](\.+[\/a-z_\-\s0-9\.]+)[\'"]\s*\)/ig, (capture, ...args) => {
                                                                //console.log('Replacing: ', capture);
                                                                let $file = pathreducer.reduce($directory + '//' + args[0] + '.js');
                                                                required[requiredIndex] = DynamicRequire(pathreducer.filename($file), pathreducer.file2pathname($file));
                                                                let replacement = '$__required[' + requiredIndex + ']';
                                                                requiredIndex += 1;
                                                                return replacement;
                                                            }) +
                                                            '\nreturn new ' + className + '();\n' +
                                                            '\n}\ncatch(ex){\n\tconsole.log("Error:", ex, "@' + scriptFile.replace(/\\/ig, '\\\\') + '");\n\t$__arguments[\'response\'].statusCode = 500;\n\t$__arguments[\'response\'].end(ex.toString()); \n}\n})';
                                                        //console.log(code);
                                                        let context = vm.createContext({
                                                            console: console,
                                                            require: require,
                                                            __dirname: $directory,
                                                            __filename: scriptFile,
                                                            process: process,
                                                            $__arguments: argumentlist,
                                                            $__required: required
                                                        });
                                                        //an alternative way to use cgi to obtain the request response and session entries;
                                                        if (varCGI)
                                                            context[varCGI] = {
                                                                session: request['session'],
                                                                request: request,
                                                                response: response
                                                            };
                                                        let _script = vm.createScript(code);
                                                        let fn = _script.runInContext(context);
                                                        let $Object = fn();
                                                        //console.log('Service-Method: ', className, memberName);
                                                        //console.log('Object: ', $Object);
                                                        let iAsyncService = $Object;
                                                        iAsyncService.$$isAsync = false;
                                                        //this will allow access to session;
                                                        switch (memberType) {
                                                            case '@':
                                                                //here is how we can handle the async call
                                                                iAsyncService.$$callback = (result) => {
                                                                    console.log('async rpc result: ', result);
                                                                    response.end(JSON.stringify(result));
                                                                };
                                                                if (!iAsyncService.$$isAsync) {
                                                                    response.end(JSON.stringify($Object[memberName]));
                                                                }
                                                                break;
                                                            case '&':
                                                                $Object[memberName] = paramaters[0];
                                                                response.end('true');
                                                                break;
                                                            case '-':
                                                                //here is how we can handle the async call
                                                                //console.log('before promise call: ', paramaters);
                                                                let invokePromise = $Object[memberName].apply($Object, paramaters);
                                                                console.log('running promise call: ', invokePromise);
                                                                invokePromise.then(result => {
                                                                    console.log('promise called back: ', result);
                                                                    response.end(JSON.stringify({
                                                                        value: result,
                                                                        success: true
                                                                    }));
                                                                })
                                                                    .catch(reason => {
                                                                    console.log('promise rejected: \n' + link.pathname + ':' + className + '.' + memberName, reason);
                                                                    response.end(JSON.stringify({
                                                                        error: reason,
                                                                        success: false
                                                                    }));
                                                                });
                                                                break;
                                                        }
                                                        //handle tasks. start tasks if there are any;
                                                        ServerTaskHost.start();
                                                    }
                                                    catch (ex) {
                                                        console.log(ex);
                                                        response.writeHead(500, {
                                                            "Content-Type": "text/plain"
                                                        });
                                                        response.end(ex);
                                                    }
                                                });
                                            });
                                            break;
                                    }
                                }
                                else {
                                    Response404(response, link.path);
                                }
                            }
                        });
                    }
                    else {
                        Response404(response, link.path);
                    }
                });
            };
        }
    }
    /**
     * This middleware blocks the user from accessing system files on the server;
     * *.sys.js files are server core scripts. they must be kept away from the user;
     */
    class SYSMiddleware {
        constructor() {
            this.route = /\.sys\.js$/;
            this.handler = (request, response, next) => {
                let link = url.parse(request.url);
                Response404(response, link.path);
            };
        }
    }
    if (process.send) {
        //from fork();
        process.on('message', (data) => {
            let options = JSON.parse(data);
            let assignedPort = options.Port;
            let parsedPort = 1018;
            if (assignedPort)
                parsedPort = Number(assignedPort);
            console.log('forked: ', options, 'parsedPort: ', parsedPort);
            let server = new HttpService(parsedPort, options.CORS);
            server.middleWares.push(new SYSMiddleware());
            server.middleWares.push(new CGIMiddleware());
            server.middleWares.push(new RPCMiddleware());
            server.middleWares.push(new FileMiddleware());
            server.middleWares.push(new DirectoryMiddleware());
            server.start();
        });
    }
    else {
        //directly:
        let assignedPort = process.argv[2];
        let parsedPort = 1018;
        if (assignedPort)
            parsedPort = Number(assignedPort);
        //console.log('assignedPort: ', assignedPort, 'parsedPort: ', parsedPort);
        let server = new HttpService(parsedPort);
        server.middleWares.push(new SYSMiddleware());
        server.middleWares.push(new CGIMiddleware());
        server.middleWares.push(new RPCMiddleware());
        server.middleWares.push(new FileMiddleware());
        server.middleWares.push(new DirectoryMiddleware());
        server.start();
    }
})(NodeServer || (NodeServer = {}));
//# sourceMappingURL=server.sys.js.map