import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as z from '../z';

export let matches: DeviceNode[]; 

export async function deviceNodeInit(){
	matches=[];
  	await z.ZTC(["-J","device","supported"]).then(r => {
    	for (let d of r.json) {
			let dev:DeviceNode=new DeviceNode(String(d.target),String(d.path));
			if(!contain(dev)){
				matches.push(dev);
			}  	
    	}
  	});
}

function contain(dev:DeviceNode):Boolean{
	let result:Boolean=false;
	matches.forEach((d)=>{
		if(d.getPath()===dev.getPath() && d.getDevicename()===dev.getDevicename()){
			result=true;
		}
	});
	return result;
}

export async function Init() {
  	let sdc: SupportedDevicesProvider = new SupportedDevicesProvider();

	vscode.window.registerTreeDataProvider(
    	'z_supported_devices',
    	sdc
  	);

  	vscode.commands.registerCommand('z_supported_devices.devicePinMap', (item) => {
    	sdc.devicePinMap(item);
  	});
}

export function Update(status: z.ZStatus) {
  	console.log("Devices Updated");
}


export class SupportedDevicesProvider implements vscode.TreeDataProvider<SupportedDevice> {
  	constructor() {
    	console.log('Device Provider starting...');
  	}

  	private _onDidChangeTreeData: vscode.EventEmitter<SupportedDevice | undefined> = new vscode.EventEmitter<SupportedDevice | undefined>();
  	readonly onDidChangeTreeData: vscode.Event<SupportedDevice | undefined> = this._onDidChangeTreeData.event;

  	refresh(): void {
    	this._onDidChangeTreeData.fire();
  	}

  	getTreeItem(element: SupportedDevice): vscode.TreeItem {
    	return element;
  	}

  	getChildren(element?: SupportedDevice): Thenable<SupportedDevice[]> {
    	if (element) {
      		if (element.leaf) {
        		return Promise.resolve([]);
      		} else {
		        let idevs: SupportedDevice[] = [];
        		if (element.dev.architecture){
          			idevs.push(new SupportedDevice({ name: "architecture",architecture:"",model:"",flash:"",ram:"",alias:"", port: "", disk: "", probe: "", fullname: "", target: element.dev.architecture,signature:"",device_uid:"",flash_erasable:false,family:""}, true, vscode.TreeItemCollapsibleState.None));
        		}
        		if (element.dev.model){
          			idevs.push(new SupportedDevice({ name: "model",architecture:"",model:"",flash:"",ram:"",alias:"", port: "", disk: "", probe: "", fullname: "", target: element.dev.model,signature:"" ,device_uid:"" ,flash_erasable:false,family:""}, true, vscode.TreeItemCollapsibleState.None));
        		}
        		if (element.dev.flash){
          			idevs.push(new SupportedDevice({ name: "flash",architecture:"",model:"",flash:"",ram:"",alias:"", port: "", disk: "", probe: "", fullname: "", target: element.dev.flash,signature:"" ,device_uid:"" ,flash_erasable:false,family:""}, true, vscode.TreeItemCollapsibleState.None));
        		}
        		if (element.dev.ram){
          			idevs.push(new SupportedDevice({ name: "ram",architecture:"",model:"",flash:"",ram:"",alias:"", port: "", disk: "", probe: "", fullname: "", target: element.dev.ram,signature:"" ,device_uid:"" ,flash_erasable:false,family:""}, true, vscode.TreeItemCollapsibleState.None));
        		}
        		if (element.dev.port){
          			idevs.push(new SupportedDevice({ name: "port",architecture:"",model:"",flash:"",ram:"",alias:"", port: "", disk: "", probe: "", fullname: "", target: element.dev.port,signature:"" ,device_uid:"" ,flash_erasable:false,family:""}, true, vscode.TreeItemCollapsibleState.None));
        		}
        		if (element.dev.probe){
          			idevs.push(new SupportedDevice({ name: "probe",architecture:"",model:"",flash:"",ram:"",alias:"", port: "", disk: "", probe: "", fullname: "", target: element.dev.probe,signature:"" ,device_uid:"" ,flash_erasable:false,family:""}, true, vscode.TreeItemCollapsibleState.None));
        		}
        		if (element.dev.disk){
          			idevs.push(new SupportedDevice({ name: "disk",architecture:"",model:"",flash:"",ram:"",alias:"", port: "", disk: "", probe: "", fullname: "", target: element.dev.disk,signature:"" ,device_uid:"" ,flash_erasable:false,family:""}, true, vscode.TreeItemCollapsibleState.None));
       	 		}
        		return Promise.resolve(idevs);
      		}
    	} else {
      		return Promise.resolve(this.discoverSupportedDevice());
    	}
	}

  	discoverSupportedDevice(){
    	let idev:SupportedDevice[]=[];
    	z.SupportedDevices().forEach((dev)=>{
      		idev.push(new SupportedDevice(dev, false, vscode.TreeItemCollapsibleState.Collapsed));  
    	});
    	return idev;
  	}

  	devicePinMap(item:SupportedDevice):void{
    	let url:string="https://pinmaps.demo.zerynth.com/"+item.dev.target;
    	vscode.env.openExternal(vscode.Uri.parse(url));
  	}
}

class SupportedDevice extends vscode.TreeItem {
  	constructor(
   	 	public readonly dev: z.Device,
    	public readonly leaf: boolean,
    	public readonly collapsibleState: vscode.TreeItemCollapsibleState
  	) {
    	super(dev.name, collapsibleState);
    	if (leaf) {
      		this.contextValue = "deviceitem_leaf";
    	} else {
      		this.contextValue = "supporteditem";
    	}
  	}

  	get tooltip(): string {
    	if (this.leaf) {
      		return "";
    	} else {
      		return `target: ${this.dev.target}`;
    	}
  	}

  	get description(): string {
      	return this.dev.target;
  	}
}

class DeviceNode {

    private devicename: string;
    private _path: string;
  
    constructor(f:string,p:string){
    	this.devicename=f;
      	this._path=p;
    }
  
    public getDevicename():string{
      	return this.devicename;
    }
  
    public getPath():string{
      	return this._path;
    }
}
