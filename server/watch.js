"use strict";
const fs = require('fs');
const child_process = require('child_process');
if (!process.argv[0])
    process.exit();
let filename = process.argv[2];
let port = process.argv[3];
let cors = process.argv[4];
console.log('filename: ', filename, 'port: ', port);
let currentChild;
function killChild() {
    if (currentChild) {
        console.log('File changed => Kill process: ', currentChild.pid);
        currentChild.send('exit');
        //currentChild.kill();
        //currentChild.emit('exit');
        //currentChild.stderr.removeAllListeners();
        //currentChild.stdout.removeAllListeners();
        //currentChild.removeAllListeners();
        process.kill(currentChild.pid);
        currentChild = undefined;
    }
}
function executeFile() {
    console.log('Executing file: ', filename);
    currentChild = child_process.fork(filename); //'node ' + 
    currentChild.send(JSON.stringify({ Port: port, CORS: cors }));
}
fs.watchFile(filename, (curr, prev) => {
    killChild();
    if (fs.existsSync(filename))
        executeFile();
});
executeFile();
process.on('exit', () => {
    killChild();
});
//# sourceMappingURL=watch.js.map