import * as babel from 'babel-core';
import * as fs from 'fs'; 
import * as CleanCss from 'clean-css';
import * as html from 'html-minifier';


//babel, html-minifier, clean-css for minify and pack codes 
let clean = new CleanCss();

interface IBabelOption {
    jsOut: string;
    cssOut: string;
    files: IFileOption[];
}
interface IFileOption {
    name: string;
    /**
     * in: only insert the file into the output;
     * babel: babel to ES6 file to ES5
     * babili: ES6 file to minified ES5
     * css: css to minified css
     * html: html to minified html
     * bang: ES6 Angular to ES5 with replacing angular resource templates with js string
     */
    action: 'in' | 'babel' | 'babili' | 'css' | 'html' | 'bang';
    /**output for html file*/
    out: string;
}

 

if (!process.argv[0]) process.exit();
let filename: string = process.argv[2];

console.log('config file name: ', filename);


let packerRegex = /\.\s*templateUrl\s*=\s*ngstd\s*\.\s*AngluarJSTemplateUrlPacker\s*\(\s*['"]([\\\/\w\.]+)['"]\s*\)/ig;


class BabelTask {

    constructor(){

    }

    private configfile: string;
    private option: IBabelOption;
    public Start(configFilename: string) {
        console.log('start: ', configFilename);
        if (!this.Load(configFilename)) {
            console.log('Failed to load config file. Quit.');
            return;
        }
        this.Compile();
        this.WatchConfig();
        this.Watch();
    }
    public WatchList: string[] = []; 
    public Load(configFilename: string) {
        try {
            console.log('file exists:', fs.existsSync(configFilename));
            if (fs.existsSync(configFilename) && fs.statSync(configFilename).isFile()) {
                //try load
                this.option = JSON.parse(fs.readFileSync(configFilename).toString());
                
            }
            this.configfile = configFilename;
            return true;
        }
        catch (ex) {
            console.error('failed in loading config file: ', ex);
            return false;
        }
    }
    private ConfigWatchListener = (curr: fs.Stats, prev: fs.Stats)=>{
        if (!this.Load(this.configfile)) {
            console.log('Failed to load config file. Quit.');
            return;
        }
        console.log('filed changed:', this);
        task.Compile();
    }
    private WatchConfig() {
        fs.watch(this.configfile, this.ConfigWatchListener);
    }
    public FileWatchListener(curr: fs.Stats, prev: fs.Stats) {
        console.log('file change detected. start compiling...');
        task.Compile(); 
    }
    public ReplaceAngular1TemplateUrl(code: string): string {
        packerRegex.lastIndex = undefined;
        return code.replace(packerRegex, (substring: string, ...args: any[]) => {
            let filename: string = __dirname + args[0];
            //load the html file from disk
            if (fs.existsSync(filename) && fs.statSync(filename).isFile()) {
                console.log('file:', filename, 'ng2-template', fs.existsSync(filename));
                if (this.WatchList.indexOf(filename) < 0) this.WatchList.push(filename);
                let template = JSON.stringify(html.minify(fs.readFileSync(filename).toString(), { caseSensitive: true, collapseWhitespace: true, conservativeCollapse: true, removeComments: true }));
                //console.log('replacing with file ', template);
                return '.template = ' + template;
            }
            else {
                return substring;
            }
        });
    }
    public Compile() {
        let jsBuilder: string[] = [];
        let cssBuilder: string[] = [];
        console.log('Start Compile: ' + (new Date(Date.now()).toString()));
        this.option.files.forEach(item => {
            console.log('file:', item.name, item.action, fs.existsSync(item.name));
            //add to watch list
            if (this.WatchList.indexOf(item.name) < 0) this.WatchList.push(item.name);
            if (fs.existsSync(item.name) && fs.statSync(item.name).isFile()) {
                try {
                    let code = fs.readFileSync(item.name).toString();
                    switch (item.action) {
                        case 'bang':
                            {
                                code = this.ReplaceAngular1TemplateUrl(code);
                                jsBuilder.push(babel.transform(code, {
                                    comments: false,
                                    presets: ["es2015"],
                                    env: {
                                        "production": {
                                            "presets": ["babili"]
                                        }
                                    }
                                }).code);
                            }
                            break;
                        case 'babel':
                            code = this.ReplaceAngular1TemplateUrl(code);
                            jsBuilder.push(babel.transform(code, {
                                comments: false,
                                presets: ["es2015"]
                            }).code);
                            break;
                        case 'babili':
                            jsBuilder.push(babel.transform(code, {
                                comments: false,
                                presets: ["es2015"],
                                env: {
                                    "production": {
                                        "presets": ["babili"]
                                    }
                                }
                            }).code);
                            break;
                        case 'css':
                            cssBuilder.push(clean.minify(code).styles);
                            break;
                        case 'html':
                            fs.writeFileSync(item.out, html.minify(code, { collapseWhitespace: true, conservativeCollapse: true, caseSensitive: true }));
                            break;
                        case 'in':
                        default:
                            jsBuilder.push(code);
                            break;
                    }
                }
                catch (ex) {
                    console.error('Error when compiling file: ', item.name);
                    console.trace('Error Exception Message: ');
                }
            }
        });
        if (this.option.jsOut) fs.writeFileSync(this.option.jsOut, jsBuilder.join('\n'));
        if (this.option.cssOut) fs.writeFileSync(this.option.cssOut, cssBuilder.join('\n'));
        console.log('End Compile: ' + (new Date(Date.now()).toString()));
    }
    private watchers: string[];
    public Watch() {
        if (this.watchers) {
            this.watchers.forEach(file => fs.unwatchFile(file));
        }
        this.watchers = [];
        this.WatchList.forEach(filename => {
            if (fs.existsSync(filename) && fs.statSync(filename).isFile()) {
                this.watchers.push(filename); 
                fs.watchFile(filename, this.FileWatchListener);
            }
        })
    }
}


let task = new BabelTask();
task.Start(filename);