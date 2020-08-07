// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as discovered_devices from './panels/discovered';
import * as supported_devices from './panels/supported';
import * as zm from './panels/zm';
import * as zdm from './panels/zdmZerynth';
import * as zdmExp from './panels/zdmExplorer';
import * as cm from './panels/consoleManager';
import * as vm from './vm';
import * as z from './z';
import * as tasks from './tasks/tasks';
import * as commands from './commands';
import * as statusbar from './status/status';
import * as example from './example';
import { countReset } from 'console';
import { fstat } from 'fs';

let activated: boolean = false;
export let exportedContext: vscode.ExtensionContext;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	exportedContext=context;
	if (!activated) {
		console.log('Zerynth extension loading...');
		if(exportedContext.globalState.get("login")){
			vscode.commands.executeCommand('setContext', 'test.key', true);
		}

		commands.InitAccess();	
		example.Init();
		vscode.commands.executeCommand('setContext', 'select.key', false);
		
		let workspaceRoot = vscode.workspace.rootPath;
		if (!workspaceRoot) {
			return;
		}
		if(fs.existsSync(workspaceRoot+"/.zproject")){
			vscode.commands.executeCommand('setContext', 'activation.key', true);
		}

		vscode.commands.executeCommand('setContext', 'select.key', false);

		z.Init((status: z.ZStatus) => {
			if (activated) {
				console.log("Status updated!");
				tasks.Update(status);
				supported_devices.Update(status);
				statusbar.Update();
			}
		});
		
		await supported_devices.deviceNodeInit();
		supported_devices.Init();
		vm.Init(exportedContext,z.GetStatus());
		vm.Close();
		tasks.Init(workspaceRoot);
		commands.Init();
		statusbar.Init();
		zm.Init();
		zdm.Init();
		zdmExp.Init();
		cm.Init();
		
		vscode.commands.executeCommand('explorer.panels.zerynth_manager.focus');

		activated = true;
	}
}

// this method is called when your extension is deactivated
export function deactivate() {
	tasks.Done();
	activated = false;
}