import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as rl from 'readline';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as z from '../z';

export let sdc: ConsoleDevicesProvider;

export async function Init() {

    sdc=new ConsoleDevicesProvider();
    vscode.window.registerTreeDataProvider(
        'zerynth.panels.console_manager',
        sdc
    );

    vscode.commands.registerCommand('zerynth.console', (item?) => {
		if(item!==undefined){
			let task = new vscode.Task({ type: "zerynth", task: "console" }, "Device Console", 'zerynth', new vscode.ShellExecution(`ztc device open_raw ${item.port}`));
			task.group = vscode.TaskGroup.Build;
			task.presentationOptions = {
				panel: vscode.TaskPanelKind.Dedicated,
				showReuseMessage: false
			};
			vscode.tasks.executeTask(task);
      	}else{
			if(z.GetProject().specs.port!==null){
				let task = new vscode.Task({ type: "zerynth", task: "console" }, "Device Console", 'zerynth', new vscode.ShellExecution(`ztc device open_raw ${z.GetProject().specs.port}`));
				task.group = vscode.TaskGroup.Build;
				task.presentationOptions = {
					panel: vscode.TaskPanelKind.Dedicated,
					showReuseMessage: false
				};
				vscode.tasks.executeTask(task);
			}else{
				vscode.window.showErrorMessage("Please, specify device port.");
			}
      	}
    });
}

export function updateConsoleManager(){
    sdc.refresh();
}

export class ConsoleDevicesProvider implements vscode.TreeDataProvider<ConsoleDevice> {
	constructor() {
		console.log('Device Provider starting...');
	}

	private _onDidChangeTreeData: vscode.EventEmitter<ConsoleDevice | undefined> = new vscode.EventEmitter<ConsoleDevice | undefined>();
	readonly onDidChangeTreeData: vscode.Event<ConsoleDevice | undefined> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: ConsoleDevice): vscode.TreeItem {
		return element;
	}

	getChildren(element?: ConsoleDevice): Thenable<ConsoleDevice[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			return Promise.resolve(this.discoverDevice());
		}
	}

  	async discoverDevice(){
    	let console:ConsoleDevice[]=[];
		let idevs:z.Device[]=await z.DiscoverDevices();
		let ports:string[]=[];
		idevs.forEach((d)=>{
			if(!ports.includes(d.port)){
				ports.push(d.port);
			}
		});

		for(let p in ports){
			let d:z.Device[]=idevs.filter((i)=>{return i.port===ports[p];});
			if(d.length>1){
				let cd:ConsoleDevice=new ConsoleDevice(d[0].port+": "+d[0].family,d[0],false,vscode.TreeItemCollapsibleState.None);
				cd.command={
					command: "zerynth.console",
					title: "Open Device Console",
					arguments: [d[0]]
				};  
				cd.iconPath={
					light: path.join(__filename,'..','..','..','resources', 'light', 'console.svg'),
					dark: path.join(__filename,'..','..','..','resources', 'dark', 'console.svg')
				};
				console.push(cd);
			}else{
				let cd:ConsoleDevice=new ConsoleDevice(d[0].port+": "+d[0].target,d[0],true,vscode.TreeItemCollapsibleState.None);
				cd.command={
					command: "zerynth.console",
					title: "Open Device Console",
					arguments: [d[0]]
				};  
				cd.iconPath={
					light: path.join(__filename,'..','..','..','resources', 'light', 'console.svg'),
					dark: path.join(__filename,'..','..','..','resources', 'dark', 'console.svg')
				};
				console.push(cd);
			} 
		};
		return console;
  	}
}

class ConsoleDevice extends vscode.TreeItem {
	constructor(
		public readonly name: string,
		public readonly dev: z.Device,
		public readonly disambiguated: boolean,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(name, collapsibleState);
	}
} 
