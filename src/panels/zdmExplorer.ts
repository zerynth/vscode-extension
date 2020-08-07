import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as z from '../z';
import { isWorker } from 'cluster';

let zdm: ZDMProvider;

export function Init() {
    zdm = new ZDMProvider();

    vscode.window.registerTreeDataProvider(
        'explorer.panels.device_manager',
        zdm
    );

    vscode.commands.registerCommand('explorer.panels.device_manager.addWorkspace', () => {
        z.addWorkspaceZDM();
    });

    vscode.commands.registerCommand('explorer.panels.device_manager.addFleet', (item?) => {
        if(item!==undefined){
            z.addFleetZDM(item.Workspace);
        }else{
            z.addFleetZDM();
        } 
    });

    vscode.commands.registerCommand('explorer.panels.device_manager.lookDevice', async (item) => {
        
        let wks: z.Workspace[]=await z.discoverWorkspaces();
	    let result:string="";
        wks.forEach((w)=>{
            w.fleets.forEach((f)=>{
                f.devices.forEach((d)=>{
                    if(d.id===item.Dev.id){
                        result=w.id;
                    }
                });
            });
        });

    	let url:string="https://zdm.zerynth.com/"+result+"/"+String(item.Dev.id);
		vscode.env.openExternal(vscode.Uri.parse(url));
  	});

}

export function refresh(){
    zdm.refresh();
}

export class ZDMProvider implements vscode.TreeDataProvider<ZDMItem> {
    constructor() {
        console.log('ZDM Provider starting...');
    }

    private _onDidChangeTreeData: vscode.EventEmitter<ZDMItem | undefined> = new vscode.EventEmitter<ZDMItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<ZDMItem | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ZDMItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ZDMItem): Thenable<ZDMItem[]> {
        if (element) {
            if(element.Workspace!==undefined){
                let fleets: ZDMItem[]=[];
                element.Workspace.fleets.forEach(f=>{
                    if(f.devices.length>0){
                       fleets.push(new ZDMItem("Fleet: "+f.name,vscode.TreeItemCollapsibleState.Collapsed,undefined,f,undefined)); 
                    }else{
                        fleets.push(new ZDMItem("Fleet: "+f.name,vscode.TreeItemCollapsibleState.None,undefined,f,undefined)); 
                    }
                });
                return Promise.resolve(fleets);
            }
            if(element.Fleet!==undefined){
                let devices: ZDMItem[]=[];
                element.Fleet.devices.forEach(d=>{
                    devices.push(new ZDMItem("Device: "+d.name,vscode.TreeItemCollapsibleState.None,undefined,undefined,d));
                });
                return Promise.resolve(devices);
            }
            return Promise.resolve([]);
        } else {
            return new Promise<ZDMItem[]>((c, e) => {
                z.discoverWorkspaces().then(w => {
                    let workspaces: ZDMItem[] = [];
                    for (let wks of w) {
                        let  devs: z.Dev[]=[];
                        for(let fleet of wks.fleets){
                            devs.concat(fleet.devices);
                        }
                        if(wks.fleets.length>0){
                            workspaces.push(new ZDMItem("Workspace: "+wks.name,vscode.TreeItemCollapsibleState.Collapsed,wks,undefined,undefined));
                        }else{
                            workspaces.push(new ZDMItem("Workspace: "+wks.name,vscode.TreeItemCollapsibleState.None,wks,undefined,undefined));
                        }
                    }
                    c(workspaces);
                }).catch(devs => { e([]); });
            });
        }
    }
}

class ZDMItem extends vscode.TreeItem {
    constructor(
        public readonly name:string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly Workspace?: z.Workspace,
        public readonly Fleet?: z.Fleet,
        public readonly Dev?: z.Dev,
        public readonly device?: z.Device
    ) {
        super(name, collapsibleState);
        if (Workspace!==undefined) {
            this.contextValue = "workspaceItem";
        }
        if (Fleet!==undefined) {
            this.contextValue = "fleetItem";
        }
        if (Dev!==undefined) {
            this.contextValue = "devItem";
        }
    };
}