import * as vscode from 'vscode';
import * as path from 'path';
import * as z from '../z';

let devices:z.Device[]=[];
let selected:string;

export function Init() {
  let dsc: DiscoveredDevicesProvider = new DiscoveredDevicesProvider();
  vscode.window.registerTreeDataProvider(
    'zerynth.panels.discovered_devices',
    dsc
  );
  vscode.commands.registerCommand('zerynth.panels.discovered_devices.refreshEntry', () => {
     dsc.refresh();
  });
  vscode.commands.registerCommand('zerynth.panels.discovered_devices.setEntry', (item?) => {
    if(item!==undefined){
      z.ProjectPrepare(item.dev);
      selected=item.dev.device_uid;
    }else{
      let nameDevices: string[]=[];
      let devices: z.Device[]=getDevices();
      let dev:z.Device;
      if(devices.length>0){
          devices.forEach((dev)=>{
          nameDevices.push(dev.name);
        });
        vscode.window.showQuickPick(nameDevices,{placeHolder:"Select a device"}).then((d)=>{
          if(d!==undefined){
            let i=nameDevices.indexOf(d);
            dev=devices[i];
            z.ProjectPrepare(dev);
            selected=dev.device_uid;
          }
        });
      }else{
        vscode.window.showWarningMessage("No devices have been discovered yet.");
      }
    }
    dsc.refresh();
  });
  
  vscode.commands.registerCommand('zerynth.panels.discovered_devices.devicePinMap', (item?) => {
    if(item!==undefined){
      dsc.openDevicePinMap(item.dev);
    }else{
      dsc.openDevicePinMap();
    }
  });

  vscode.commands.registerCommand('zerynth.panels.discovered_devices.addZDM', () => {
    //z.addDeviceZDM();
  });





}

export function Update() {
  console.log("Devices Updated");
}

export function getDevices():z.Device[]{
  return devices;
}

export class DiscoveredDevicesProvider implements vscode.TreeDataProvider<DeviceItem> {
  constructor() {
    console.log('Device Provider starting...');
  }

  private _onDidChangeTreeData: vscode.EventEmitter<DeviceItem | undefined> = new vscode.EventEmitter<DeviceItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<DeviceItem | undefined> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: DeviceItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DeviceItem): Thenable<DeviceItem[]> {

    if (element) {
      if (element.leaf) {
        return Promise.resolve([]);
      } else {
        let idevs: DeviceItem[] = [];
        if(element.name!=="Information"){
          let idev=new DeviceItem("Select device", false, vscode.TreeItemCollapsibleState.None,element.dev);
          idev.command={
            command: "zerynth.panels.discovered_devices.setEntry",
            title: "Select",
            arguments: [idev]
          };
          idev.iconPath={
            light: path.join(__filename,'..','..','..','resources', 'light', 'star-empty.svg'),
            dark: path.join(__filename,'..','..','..','resources', 'dark', 'star-empty.svg')
          };
          idevs.push(idev);
          idev=new DeviceItem("Install Zerynth OS on Device", false, vscode.TreeItemCollapsibleState.None,element.dev);
          idev.command={
            command: "zerynth.install",
            title: "Install Zerynth OS on Device",
            arguments: [idev]
          };
          idev.iconPath={
            light: path.join(__filename,'..','..','..','resources', 'light', 'gear.svg'),
            dark: path.join(__filename,'..','..','..','resources', 'dark', 'gear.svg')
          };
          idevs.push(idev);
          idev=new DeviceItem("Device Pinmap", false, vscode.TreeItemCollapsibleState.None,element.dev);
          idev.command={
            command: "zerynth.panels.discovered_devices.devicePinMap",
            title: "Device Pinmap",
            arguments: [idev]
          };
          idev.iconPath={
            light: path.join(__filename,'..','..','..','resources', 'light', 'circuit-board.svg'),
            dark: path.join(__filename,'..','..','..','resources', 'dark', 'circuit-board.svg')
          };
          idevs.push(idev);
          if(selected===element.dev?.device_uid){
            idev=new DeviceItem("Uplink", false, vscode.TreeItemCollapsibleState.None,element.dev);
            idev.command={
              command: "zerynth.uplink",
              title: "Uplink",
              arguments: [idev]
            };
            idev.iconPath={
              light: path.join(__filename,'..','..','..','resources', 'light', 'arrow-up.svg'),
              dark: path.join(__filename,'..','..','..','resources', 'dark', 'arrow-up.svg')
            };
            idevs.push(idev);
          
            idev=new DeviceItem("Open device console", false, vscode.TreeItemCollapsibleState.None);
            idev.command={
              command: "zerynth.console",
              title: "Open Device Console",
              arguments: [element.dev]
            };  
            idev.iconPath={
              light: path.join(__filename,'..','..','..','resources', 'light', 'console.svg'),
              dark: path.join(__filename,'..','..','..','resources', 'dark', 'console.svg')
            };
            idevs.push(idev);
          }
          idev=new DeviceItem("Add device to ZDM", false, vscode.TreeItemCollapsibleState.None);
          idev.command={
            command: "zerynth.panels.discovered_devices.addZDM",
            title: "add device to ZDM",
            arguments: [idev]
          };
          idev.iconPath={
            light: path.join(__filename,'..','..','..','resources', 'light', 'add.svg'),
            dark: path.join(__filename,'..','..','..','resources', 'dark', 'add.svg')
          };
          idevs.push(idev);
          if(selected===element.dev?.device_uid){
            idev=new DeviceItem("Fota", false, vscode.TreeItemCollapsibleState.None,element.dev);
            idev.command={
              command: "zerynth.panels.discovered_devices.Fota",
              title: "FOTA",
              arguments: [idev]
            };
            idev.iconPath={
              light: path.join(__filename,'..','..','..','resources', 'light', 'cloud-upload.svg'),
              dark: path.join(__filename,'..','..','..','resources', 'dark', 'cloud-upload.svg')
            };
            idevs.push(idev);
          }
          //erase flash
          if(element.dev!==undefined && element.dev.flash_erasable){
            idev=new DeviceItem("Erase flash", false, vscode.TreeItemCollapsibleState.None,element.dev);
            idev.command={
              command: "zerynth.panels.discovered_devices.eraseFlash",
              title: "Erase Flash",
              arguments: [idev]
            };
          idevs.push(idev);
          }

          idev=new DeviceItem("Information", false, vscode.TreeItemCollapsibleState.Collapsed,element.dev);
          idev.iconPath={
            light: path.join(__filename,'..','..','..','resources', 'light', 'info.svg'),
            dark: path.join(__filename,'..','..','..','resources', 'dark', 'info.svg')
          };
          idevs.push(idev);
        }else{
          if(element.dev!==undefined){
            if (element.dev.architecture){
              idevs.push(new DeviceItem("architecture: "+element.dev.architecture, true, vscode.TreeItemCollapsibleState.None));
            }
            if (element.dev.model){
              idevs.push(new DeviceItem("model: "+element.dev.model, true, vscode.TreeItemCollapsibleState.None));
            }
            if (element.dev.flash){
              idevs.push(new DeviceItem("flash: "+element.dev.flash, true, vscode.TreeItemCollapsibleState.None));
            }
            if (element.dev.ram){
              idevs.push(new DeviceItem("ram: "+element.dev.ram, true, vscode.TreeItemCollapsibleState.None));
            }
            if (element.dev.port){
              idevs.push(new DeviceItem("port: "+element.dev.port, true, vscode.TreeItemCollapsibleState.None));
            }
            if (element.dev.probe){
              idevs.push(new DeviceItem("probe: "+ element.dev.probe, true, vscode.TreeItemCollapsibleState.None));
            }
            if (element.dev.disk){
              idevs.push(new DeviceItem("disk: "+ element.dev.disk, true, vscode.TreeItemCollapsibleState.None));
            }
          }
        }
        return Promise.resolve(idevs);
      }
    } else {
      return new Promise<DeviceItem[]>((c, e) => {
        z.DiscoverDevices().then(devs => {
          let idevs: DeviceItem[] = [];
          devices=[];
          for (let dev of devs) {
            let idev = new DeviceItem(dev.name,false,vscode.TreeItemCollapsibleState.Collapsed,dev);
            if(idev.dev?.device_uid===selected){
              idev.iconPath={
                light: path.join(__filename,'..','..','..','resources', 'light', 'star-full.svg'),
                dark: path.join(__filename,'..','..','..','resources', 'dark', 'star-full.svg')
              };
            }
            idevs.push(idev);
            if(!devices.includes(dev)){
              devices.push(dev);
            }
          }
          c(idevs);
        }).catch(() => { e([]); });
      });
    }
  }

  openDevicePinMap(item?:DeviceItem):void{
    if(item!==undefined && item.dev!==undefined){
      let url:string="https://docs.zerynth.com/latest/official/"+item.dev.fullname+"/docs/index.html";
      vscode.env.openExternal(vscode.Uri.parse(url));
    }else{
      let fullname=z.GetStatus().device.target;
      let url:string="https://docs.zerynth.com/latest/official/board.zerynth."+fullname+"/docs/index.html";
      vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }
}

class DeviceItem extends vscode.TreeItem {
  constructor(
    public name: string,
    public readonly leaf: boolean,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly dev?: z.Device
  ) {
    super(name, collapsibleState);
    if (leaf) {
      this.contextValue = "deviceitem_leaf";
    } else {
      this.contextValue = "deviceitem";
    }
  }
  
  
  

}
