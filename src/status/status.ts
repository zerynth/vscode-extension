import * as vscode from 'vscode';
import { getVSCodeDownloadUrl } from 'vscode-test/out/util';
import * as z from '../z';

let zDeviceItem: vscode.StatusBarItem;
let zEndItem: vscode.StatusBarItem;
let zCompileItem: vscode.StatusBarItem;
let zUplinkItem: vscode.StatusBarItem;

export function Init(){
    zDeviceItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    zCompileItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 48);
    zCompileItem.command = "zerynth.compile";
    zUplinkItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 47);
    zUplinkItem.command = "zerynth.uplink";
    zEndItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 45); 
    updateStatusBarItems();
}

function updateStatusBarItems(): void {
    if(z.GetProject().target!==null) { 
        zCompileItem.text=`$(pass)`;
        zCompileItem.tooltip="Verify";
        zCompileItem.show();
        zUplinkItem.text=`$(arrow-up)`;
        zUplinkItem.tooltip="Uplink";
        zUplinkItem.show();
        zDeviceItem.text="| ";
        zEndItem.text=" |";
        
        zDeviceItem.text = zDeviceItem.text+z.GetProject().target;
        
        if(z.GetProject().vm.version!==null && z.GetProject().vm.features!==null){
            zDeviceItem.text = zDeviceItem.text+" "+z.GetProject().vm.version+" "+(z.GetProject().vm.features);
        }
        zDeviceItem.text = zDeviceItem.text;
        zDeviceItem.show();
        zEndItem.show();
    }
}

export function Update() {
    console.log("Status Updated");
    updateStatusBarItems();
}