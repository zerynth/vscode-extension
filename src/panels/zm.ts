import * as vscode from 'vscode';
import * as path from 'path';
import * as z from '../z';
import * as status from '../status/status';
import { deviceNodeInit } from './supported';
import { stat } from 'fs';

export let dsc: DiscoveredDevicesProvider;

export function Init() {
  	dsc = new DiscoveredDevicesProvider();

  	vscode.window.registerTreeDataProvider(
    	'explorer.panels.zerynth_manager',
    	dsc
  	);

	vscode.commands.registerCommand('explorer.panels.zerynth_manager.deviceInformation',()=>{
		if(z.GetProject().target!==null){
			let url:string="https://docs.zerynth.com/latest/reference/boards/"+z.GetProject().target+"/docs";
			vscode.env.openExternal(vscode.Uri.parse(url));
	  	}else{
			vscode.window.showErrorMessage("Please, set target device.");
	  	}
	});

  	vscode.commands.registerCommand('explorer.panels.zerynth_manager.setEntry', async () => {
    	let discoveredDevices:z.Device[]=await z.DiscoverDevices();
    	let supportedDevices:z.Device[]=z.SupportedDevices();
    	let nameDiscoveredDevices:string[]=[];
    	let nameSupportedDevices:string[]=[];
    	nameDiscoveredDevices.push("------------------------------------------ DISCOVERED DEVICES ------------------------------------------");
    	if(discoveredDevices.length>0){
      		discoveredDevices.forEach((dev)=>{
        		nameDiscoveredDevices.push(dev.name);
    	  	});
    	}else{
      		nameDiscoveredDevices.push("None");
    	}
    	nameSupportedDevices.push("------------------------------------------ SUPPORTED DEVICES ------------------------------------------");
    	if(supportedDevices.length>0){
      		supportedDevices.forEach((dev)=>{
        		nameSupportedDevices.push(dev.name);
      		});
    	}
    	let nameDevices:string[]=nameDiscoveredDevices.concat(nameSupportedDevices);
    	vscode.window.showQuickPick(nameDevices,{placeHolder:"Select a device"}).then(async (d)=>{
      		if(d!==undefined && d!=="------------------------------------------ DISCOVERED DEVICES ------------------------------------------" && d!=="------------------------------------------ SUPPORTED DEVICES ------------------------------------------" && d!=="None"){
        		let i=nameDevices.indexOf(d);
        		if(i<nameDevices.indexOf("------------------------------------------ SUPPORTED DEVICES ------------------------------------------")){
          			let dev=getDeviceByName(d,discoveredDevices);
          			if(dev!==undefined){
            			await z.ProjectPrepare(dev);
            			dsc.refresh();
            			status.Update();
          			}
        		}else{
          			let dev=getDeviceByName(d,supportedDevices);
          			if(dev!==undefined){
            			await z.ProjectPrepare(dev);
            			dsc.refresh();
            			status.Update();
          			}
        		} 
      		}
    	});  
  	});

  	vscode.commands.registerCommand('explorer.panels.zerynth_manager.devicePinMap', () => {
    	if(z.GetProject().target!==null){
      		dsc.openDevicePinMap(z.GetProject().target);
    	}else{
      		vscode.window.showErrorMessage("Please, set target device.");
    	}
  	});

  	vscode.commands.registerCommand('explorer.panels.zerynth_manager.Fota', async (item?) => {
    	if(z.GetProject().zdm!==undefined){
      		if(z.GetProject().zdm.device_uid!==null){
        		if(item!==undefined){
          			await z.fota(item.dev);
          			dsc.refresh();
        		}else{
          			await z.fota(z.GetStatus().device);
          			dsc.refresh();
        		}
      		}else{
        		vscode.window.showErrorMessage("Please, set ZDM target device.");
      		}
    	}else{
      		vscode.window.showErrorMessage("Please, set ZDM target device.");
    	}
  	});

  	vscode.commands.registerCommand('explorer.panels.zerynth_manager.lookDevice', async (item?) => {
		if(z.GetProject().zdm!==undefined){
			if(z.GetProject().zdm.device_uid!==null){
		    	let wks:string=await z.discoverDeviceWorkspace();
    			let url:string="https://zdm.zerynth.com/"+wks+"/"+z.GetProject().zdm.device_id;
				vscode.env.openExternal(vscode.Uri.parse(url));
			}
		}else{
			vscode.window.showErrorMessage("Please, set ZDM target device.");
	  	}
  	});

  	vscode.commands.registerCommand('explorer.panels.zerynth_manager.setZDMEntry',async ()=>{
    	let wks: z.Workspace[]=await z.discoverWorkspaces();
    	let fleets:z.Fleet[]=[];
    	let nameFleets:string[]=[];
    	wks.forEach((w)=>{
      		w.fleets.forEach((f)=>{
        		nameFleets.push(w.name+": "+f.name);
        		fleets.push(f);
      		});
    	});
		  
		vscode.window.showQuickPick(nameFleets,{placeHolder:"Select fleet"}).then((fleet)=>{
	    	if(fleet!==undefined){
        		let i=nameFleets.indexOf(fleet);
		        let nameDevices:string[]=[];
        		let devs:z.Dev[]=fleets[i].devices;
        		devs.forEach((d)=>{
          			nameDevices.push(d.name);
        		});  
        		nameDevices.push("Add a new device");
        		vscode.window.showQuickPick(nameDevices,{placeHolder:"Select device"}).then(async (device)=>{
          			if(device!==undefined && device!=="Add a new device"){
            			let i=nameDevices.indexOf(device);
            			let prj=z.GetProject();
            			prj.zdm ={
              				device_id: devs[i].id,
            			};
            			z.SetProject(prj);
            			z.credentials(devs[i].id);
            			dsc.refresh();
          			}
          			if(device!==undefined && device==="Add a new device"){
            			z.addDeviceZDM(fleets[i]);
          			}
        		});
      		}
		});
  	});

  	vscode.commands.registerCommand('zerynth.panels.discovered_devices.eraseFlash', (item?) => {
    	if(z.GetProject().target!==null){
      		if(item!==undefined){
        		z.eraseFlash(item.dev.alias);
      		}else{
        		z.eraseFlash(z.GetStatus().device.alias);
      		}
    	}else{
      		vscode.window.showErrorMessage("Please, set target device.");
    	}
  	}); 
}

function getDeviceByName(name:string,devices:z.Device[]):z.Device|undefined{
  	let result:z.Device|undefined=undefined;
  	devices.forEach((dev)=>{
    	if(dev.name===name){
      		result=dev;
    	}
  	});
  	return result;
}

export function refresh(){
  	dsc.refresh();
}

export class DiscoveredDevicesProvider implements vscode.TreeDataProvider<ProjectItem> {
  	constructor() {
    	console.log('Device Provider starting...');
  	}

  	private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined> = new vscode.EventEmitter<ProjectItem | undefined>();
  	readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined> = this._onDidChangeTreeData.event;

  	refresh(): void {
    	this._onDidChangeTreeData.fire();
  	}

  	getTreeItem(element: ProjectItem): vscode.TreeItem {
    	return element;
  	}

  	getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
		if (element) {
        	if(element.leaf){
            	return Promise.resolve([]);
        	}else{
            	if(element.name.startsWith("Virtual machine: ")){
                	let vmInfo:ProjectItem[]=[];
                	if(z.GetProject().vm.features.toString()!==""){
                    	let features:ProjectItem=new ProjectItem("Features: "+z.GetProject().vm.features,true,vscode.TreeItemCollapsibleState.None);
                    	vmInfo.push(features);
                	}else{
                    	let features:ProjectItem=new ProjectItem("Features: None",true,vscode.TreeItemCollapsibleState.None);
                    	vmInfo.push(features);
                	}
                	return Promise.resolve(vmInfo);
				}
            	if(element.name.startsWith("Target device: ")){
                	if(element.dev!==undefined){
                  		let idevs: ProjectItem[] = [];
                  		if (element.dev.architecture){
                    		idevs.push(new ProjectItem("architecture: "+element.dev.architecture, true, vscode.TreeItemCollapsibleState.None));
                  		}
                  		if (element.dev.model){
                    		idevs.push(new ProjectItem("model: "+element.dev.model, true, vscode.TreeItemCollapsibleState.None));
                  		}
                  		if (element.dev.flash){
                    		idevs.push(new ProjectItem("flash: "+element.dev.flash, true, vscode.TreeItemCollapsibleState.None));
                  		}
                  		if (element.dev.ram){
                    		idevs.push(new ProjectItem("ram: "+element.dev.ram, true, vscode.TreeItemCollapsibleState.None));
                  		}
                  		if (z.GetProject().specs.port!==null){
                    		idevs.push(new ProjectItem("port: "+z.GetProject().specs.port, true, vscode.TreeItemCollapsibleState.None));
                 	 	}else{
                    		idevs.push(new ProjectItem("port: null", true, vscode.TreeItemCollapsibleState.None));
                  		}
                  		if (element.dev.probe){
                    		idevs.push(new ProjectItem("probe: "+ element.dev.probe, true, vscode.TreeItemCollapsibleState.None));
                  		}
                  		if (element.dev.disk){
                    		idevs.push(new ProjectItem("disk: "+ element.dev.disk, true, vscode.TreeItemCollapsibleState.None));
                  		}
                  		return Promise.resolve(idevs);
               		}
              	}
            }
            if(z.GetProject().zdm!==undefined && z.GetProject().zdm.fota!==undefined && z.GetProject().zdm.fota.version!==undefined){
              	return Promise.resolve([new ProjectItem("FOTA version: "+ z.GetProject().zdm.fota.version, true, vscode.TreeItemCollapsibleState.None)]);
            }
            return Promise.resolve([]);
    	} else {
        	return Promise.resolve(this.project());
    	}
  	}

  	async project(){
		let project=z.GetProject();
		let prj:ProjectItem[]=[];
		let target:ProjectItem|undefined;
		let dev:z.Device={
			target: "",
			name: "",
			architecture: "",
			model: "",
			flash:"",
			ram:"",
			alias:"",
			port:"",
			disk:"",
			probe:"",
			fullname:"",
			signature:"",
			device_uid:"",
			flash_erasable:false,
			family:""
		};

		if(project.target!==null){        
			let t=z.GetProject().target;
			let devs=await z.DiscoverDevices();  
			devs.forEach((d)=>{
				if(d.target===t){
					dev=d;
					target=new ProjectItem("Target device: "+project.target,false,vscode.TreeItemCollapsibleState.Collapsed,dev);
					prj.push(target);
				}
			});
			if(dev.target===""){
				devs=z.SupportedDevices();
				devs.forEach((d)=>{
					if(d.target===t){
						dev=d;
						target=new ProjectItem("Target device: "+project.target,false,vscode.TreeItemCollapsibleState.Collapsed,dev);
						prj.push(target);
					}
				});
			}

		}else{
			target=new ProjectItem("Target device: "+project.target,false,vscode.TreeItemCollapsibleState.None);
			prj.push(target);
		}

		if(project.vm!==undefined && project.vm.version!==null){
			let vm=new ProjectItem("Virtual machine: "+project.vm.version,false,vscode.TreeItemCollapsibleState.Collapsed);
			prj.push(vm);
		}else{
			let vm=new ProjectItem("Virtual machine: null",false,vscode.TreeItemCollapsibleState.None);
			prj.push(vm);
		}
      
		let idev=new ProjectItem("Install Zerynth OS", false, vscode.TreeItemCollapsibleState.None,dev);
		idev.command={
			command: "zerynth.install",
			title: "Install Zerynth OS on Device",
			arguments: [idev]
		};
		idev.iconPath={
			light: path.join(__filename,'..','..','..','resources', 'light', 'gear.svg'),
			dark: path.join(__filename,'..','..','..','resources', 'dark', 'gear.svg')
		};
		prj.push(idev);
	  
		idev=new ProjectItem("Device information", false, vscode.TreeItemCollapsibleState.None,dev);
		idev.command={
			command: "explorer.panels.zerynth_manager.deviceInformation",
			title: "Device information",
			arguments: [idev]
		};
		idev.iconPath={
			light: path.join(__filename,'..','..','..','resources', 'light', 'info.svg'),
			dark: path.join(__filename,'..','..','..','resources', 'dark', 'info.svg')
		};
		prj.push(idev);

		idev=new ProjectItem("Device Pinmap", false, vscode.TreeItemCollapsibleState.None,dev);
		idev.command={
			command: "explorer.panels.zerynth_manager.devicePinMap",
			title: "Device Pinmap",
			arguments: [idev]
		};
		idev.iconPath={
			light: path.join(__filename,'..','..','..','resources', 'light', 'circuit-board.svg'),
			dark: path.join(__filename,'..','..','..','resources', 'dark', 'circuit-board.svg')
		};
		prj.push(idev);

		idev=new ProjectItem("Compile", false, vscode.TreeItemCollapsibleState.None,dev);
		idev.command={
			command: "zerynth.compile",
			title: "Compile",
			arguments: [idev]
		};
		idev.iconPath={
			light: path.join(__filename,'..','..','..','resources', 'light', 'pass.svg'),
			dark: path.join(__filename,'..','..','..','resources', 'dark', 'pass.svg')
		};
		prj.push(idev);

		idev=new ProjectItem("Uplink", false, vscode.TreeItemCollapsibleState.None,dev);
		idev.command={
			command: "zerynth.uplink",
			title: "Uplink",
			arguments: [idev]
		};
		idev.iconPath={
			light: path.join(__filename,'..','..','..','resources', 'light', 'arrow-up.svg'),
			dark: path.join(__filename,'..','..','..','resources', 'dark', 'arrow-up.svg')
		};
		prj.push(idev);

		if(dev.flash_erasable){
			vscode.commands.executeCommand('setContext', 'erasable.key', true);
			idev=new ProjectItem("Erase flash", false, vscode.TreeItemCollapsibleState.None,dev);
			idev.command={
				command: "zerynth.panels.discovered_devices.eraseFlash",
				title: "Erase Flash",
				arguments: [idev]
			};
			prj.push(idev);
		}else{
			vscode.commands.executeCommand('setContext', 'erasable.key', false);
		}

		idev=new ProjectItem("Console", false, vscode.TreeItemCollapsibleState.None,dev);
		idev.command={
			command: "zerynth.console",
			title: "Console",
			arguments: []
		};
		idev.iconPath={
			light: path.join(__filename,'..','..','..','resources', 'light', 'console.svg'),
			dark: path.join(__filename,'..','..','..','resources', 'dark', 'console.svg')
		};
		prj.push(idev);

		if(project.zdm!==undefined && project.zdm.device_id!==null){
			if(project.zdm.fota!==undefined){
				let zdmDevice:ProjectItem=new ProjectItem("ZDM target device: "+project.zdm.device_id,false,vscode.TreeItemCollapsibleState.Collapsed);
				prj.push(zdmDevice);
			}else{
				let zdmDevice:ProjectItem=new ProjectItem("ZDM target device: "+project.zdm.device_id,false,vscode.TreeItemCollapsibleState.None);
				prj.push(zdmDevice);
			}
			vscode.commands.executeCommand('setContext', 'select.key', true);
		}else{
			let zdmDevice:ProjectItem=new ProjectItem("ZDM target device: null",false,vscode.TreeItemCollapsibleState.None);
			prj.push(zdmDevice);
			vscode.commands.executeCommand('setContext', 'select.key', false);
		}

		idev=new ProjectItem("Fota", false, vscode.TreeItemCollapsibleState.None,dev);
		idev.command={
			command: "explorer.panels.zerynth_manager.Fota",
			title: "FOTA",
			arguments: [idev]
		};
		idev.iconPath={
			light: path.join(__filename,'..','..','..','resources', 'light', 'cloud-upload.svg'),
			dark: path.join(__filename,'..','..','..','resources', 'dark', 'cloud-upload.svg')
		};
		prj.push(idev);

    	return prj;
  	}

	openDevicePinMap(target:string):void{
		let url:string="https://pinmaps.demo.zerynth.com/"+target;
		vscode.env.openExternal(vscode.Uri.parse(url));
	}
}

class ProjectItem extends vscode.TreeItem {
	constructor(
		public name: string,
		public readonly leaf: boolean,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public dev?: z.Device
	) {
		super(name, collapsibleState);
		if (leaf) {
			this.contextValue = "deviceitem_leaf";
		} else {
			if(name.startsWith("Target device:")){
				this.contextValue = "targetitem";
			}else{
				if(name.startsWith("ZDM target device: ")){
					this.contextValue = "zdmitem";
				}else{
					this.contextValue = "deviceitem";
				}
			}
		}
	}
}
