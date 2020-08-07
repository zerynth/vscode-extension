/* eslint-disable eqeqeq */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';
import * as z from './z';
import { Console } from 'console';
import { promises } from 'dns';
import { match } from 'assert';
import * as rl from 'readline';

let root: string;
let matches: TreeNode[]=[]; 

export function Init() {
  
    z.Version().then(async (v) => {
        let example: ZerynthExampleProvider = new ZerynthExampleProvider();
        var tag1:string[]=[];
        var tag2:string[]=[];
        var tag3:string[]=[];
        matches=[];

        await z.ZTC(["-J","info","--examples"]).then(examples => {
            for (let e of examples.json[0]) {
                let tags:string[]=String(e.tag).split(",");
                if(tags.length===2){
                    let tmp:TreeNode=new TreeNode(tags[1],String(e.name),String(e.path));
                    matches.push(tmp);
                    tag1.push(tags[0]);
                    tag2.push(tags[0]+"$"+tags[1]);
                }else{
                    if(tags.length===1){
                        let tmp:TreeNode=new TreeNode(tags[0],String(e.name),String(e.path));
                        matches.push(tmp);
                        tag1.push(tags[0]);
                    }else{
                        if(tags.length===3){
                          let tmp:TreeNode=new TreeNode(tags[2],String(e.name),String(e.path));
                          matches.push(tmp);
                          tag1.push(tags[0]);
                          tag2.push(tags[0]+"$"+tags[1]);
                          tag3.push(tags[1]+"$"+tags[2]);
                        }
                    }
                }
            }
        });

        let _tag1=tag1.filter((v,i)=>tag1.indexOf(v)===i);
        let _tag2=tag2.filter((v,i)=>tag2.indexOf(v)===i);
        let _tag3=tag3.filter((v,i)=>tag3.indexOf(v)===i);
        _tag1.forEach(element => {
            let tmp:TreeNode=new TreeNode("None",element,"");
            matches.push(tmp);
        });
        _tag2.forEach(element => {
            let tag:string[]=element.split("$");
            let tmp:TreeNode=new TreeNode(tag[0],tag[1],"");
            matches.push(tmp);
        });
        _tag3.forEach(element => {
            let tag:string[]=element.split("$");
            let tmp:TreeNode=new TreeNode(tag[0],tag[1],"");
            matches.push(tmp);
        });

        vscode.window.registerTreeDataProvider(
            'explorer.panels.example',
            example
        );

        vscode.commands.registerCommand('explorer.panels.example.clone', (e) => {
            example.cloneExample(e);
        });

        vscode.commands.registerCommand('explorer.panels.example.search', async () => {
            let wordText = await vscode.window.showInputBox({ placeHolder: "Search for example ...", ignoreFocusOut: true });
            if (wordText != undefined && wordText.toLowerCase()!=="escape") {
				let exampleAvailable:TreeNode[] = example.searchExample(wordText);
                let fileNameExample:string[]=[];
                exampleAvailable.forEach((element)=>{
                    if(!fileNameExample.includes(element.getName())){
                        fileNameExample.push(element.getName());
                    }
                });
                if(exampleAvailable.length!=0){
                    vscode.window.showQuickPick(fileNameExample,{placeHolder:"Select the example to clone"}).then((example)=>{
                        if(example!=undefined){
                            let i=fileNameExample.indexOf(example);
                            let e :ExampleFile = new ExampleFile(fileNameExample[i],exampleAvailable[i].getPath(),"",vscode.TreeItemCollapsibleState.None);
                            vscode.commands.executeCommand('explorer.panels.example.clone',e);
                        }
                    });
                }else{
                    if(wordText.toLowerCase()!=="escape"){
                        vscode.window.showInformationMessage("There are no examples that match your search.");
                    }
                }
            }
        });
    });
}

export class ZerynthExampleProvider implements vscode.TreeDataProvider<ExampleFile> {
    constructor() { }

    getTreeItem(element: ExampleFile): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ExampleFile): Thenable<ExampleFile[]> {
        if (element) {
            let examples:ExampleFile[]=[];
            matches.forEach((m)=>{
                if(m.getFather()===element.filename){
                    if(m.getPath()===""){
                        let example:ExampleFile=new ExampleFile(m.getName(),m.getPath(),m.getFather(),vscode.TreeItemCollapsibleState.Collapsed);
                        example.iconPath={
                            light: path.join(__filename, '..', '..', 'resources', 'light', 'folder.svg'),
                            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'folder.svg')
                        };
                        examples.push(example);
                    }else{
                        let example:ExampleFile=new ExampleFile(m.getName(),m.getPath(),m.getFather(),vscode.TreeItemCollapsibleState.None);
						example.iconPath={
                            light: path.join(__filename, '..', '..', 'resources', 'light', 'file-1.svg'),
                            dark: path.join(__filename, '..', '..', 'resources', 'dark', 'file-1.svg')
                        };
						examples.push(example);
                    }
                } 
            });
            return Promise.resolve(examples);
        } else {
            return Promise.resolve(this.getFileFromExample());
        }
    }

    private getFileFromExample(): ExampleFile[] {
        let examples:ExampleFile[]=[];
        matches.forEach((m)=>{
            if(m.getFather()==="None"){
                let example:ExampleFile=new ExampleFile(m.getName(),m.getPath(),m.getFather(),vscode.TreeItemCollapsibleState.Collapsed);
				example.iconPath={
					light: path.join(__filename, '..', '..', 'resources', 'light', 'folder.svg'),
					dark: path.join(__filename, '..', '..', 'resources', 'dark', 'folder.svg')
				};
				examples.push(example);
            }
        });
        return examples;
    }

    async cloneExample(e: ExampleFile) {
        let newPath = await vscode.window.showSaveDialog({saveLabel:"Clone Zerynth example"});
        if (newPath != undefined) {
            let p="";
            if(newPath.fsPath.includes(" ")){
                p="\""+newPath.fsPath+"\"";
            }else{
                p=newPath.fsPath;
            }
            let splitPath:string[]=[];
            if(process.platform.includes("win")){
                splitPath = newPath.fsPath.split(/\\/);
            }else{
                splitPath = newPath.fsPath.split(/\//);
            }
            let title = splitPath[splitPath.length - 1];
            if(title.includes(" ")){
                title="\""+title+"\"";
            }
            await z.ZTC(["project", "create", "--from", e._path, title, p]);
            await z.ZTC(["project","prepare",p]);
            vscode.commands.executeCommand('vscode.openFolder', newPath);
        }
    }

    searchExample(wordText: string): TreeNode[] {
		let result: TreeNode[] = [];
        matches.forEach((element:TreeNode)=>{
			if(element.getPath()!=="" && fs.existsSync(element.getPath())){
                fs.readdirSync(element.getPath()).forEach((file) => {
					let p:string=path.join(element.getPath(),file);
					if(fs.statSync(p).isFile() && fs.existsSync(p)){
						let b:boolean=fs.readFileSync(p).toString().toLowerCase().includes(wordText.toLowerCase());
						if(b){
							result.push(element);
						}
					}
                });
			}
		});
        return result;
    }
}

class ExampleFile extends vscode.TreeItem {
    constructor(
        public readonly filename: string,
        public readonly _path: string,
        public readonly father: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(filename, collapsibleState);
        if (_path) {
            this.contextValue = "exampleitem";
        }
        if(father==="None"){
            this.contextValue = "tag1";
        }
    }
}

class TreeNode {
    private father: string;
    private name: string;
    private _path: string;

    constructor(father:string,name:string,path:string){
        this.father=father;
        this.name=name;
        this._path=path;
    }

    public getName():string{
        return this.name;
    }

    public getPath():string{
        return this._path;
    }

    public getFather():string {
        return this.father;
    }
}

let _example_settings: { [id: string]: any; } = {
	linux64: {
	    'examplePath':'${env:HOME}/.zerynth2/dist/###'
	},
	windows64: {
    	'examplePath':'${env:USERPROFILE}/zerynth2/dist/###'
	},
	mac: {
        'examplePath':'${env:HOME}/.zerynth2/dist/###'
	}
};

