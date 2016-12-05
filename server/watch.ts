import * as fs from 'fs';
import * as child_process from 'child_process';
import * as url from 'url';

if (!process.argv[0]) process.exit();

let filename: string = process.argv[2];
let port: string = process.argv[3];
let cors: string = process.argv[4];

console.log('filename: ', filename, 'port: ', port);

let currentChild: child_process.ChildProcess;

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
    if (fs.existsSync(filename)) executeFile();
});
executeFile();

process.on('exit', () => {
    killChild();
});