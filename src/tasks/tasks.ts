import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as z from '../z';
import { title } from 'process';
import { SupportedDevicesProvider } from '../panels/supported';
import { Tracing } from 'trace_events';

let ztaskp: vscode.Disposable | undefined;
let ztp: ZerynthTaskProvider;

export function Init(wks: string) {
	ztp = new ZerynthTaskProvider(wks);
	ztaskp = vscode.tasks.registerTaskProvider(ZerynthTaskProvider.ZerynthType, ztp);
}

export function Done() {
	if (ztaskp) {
		ztaskp.dispose();
		ztaskp = undefined;
	}
}

export function Update(status: z.ZStatus) {
	console.log("Tasks Updated");
	if (ztp) {
		ztp.zPromise = undefined;
	}
}

export class ZerynthTaskProvider implements vscode.TaskProvider {
	static ZerynthType: string = 'zerynth';
	public zPromise: Thenable<vscode.Task[]> | undefined = undefined;

	constructor(workspaceRoot: string) {
	}

	public provideTasks(): Thenable<vscode.Task[]> | undefined {
		if (!this.zPromise) {
			this.zPromise = getZTasks();
		}
		return this.zPromise;
	}

	public resolveTask(_task: vscode.Task): vscode.Task | undefined {
		const task = _task.definition.task;	
		if (task) {
			// resolveTask requires that the same definition object be used.
			const definition: ZerynthTaskDefinition = <any>_task.definition;
			return new vscode.Task(definition, definition.task, 'zerynth', new vscode.ShellExecution(`ztc project ${definition.task}`),["ztc"]);
		}
		return undefined;
	}
}

function exists(file: string): Promise<boolean> {
	return new Promise<boolean>((resolve, _reject) => {
		fs.exists(file, (value) => {
			resolve(value);
		});
	});
}

interface ZerynthTaskDefinition extends vscode.TaskDefinition {
	/**
	 * The task name
	 */
	task: string;
}

async function getZTasks(): Promise<vscode.Task[]> {
	let workspaceRoot = vscode.workspace.rootPath;
	let emptyTasks: vscode.Task[] = [];
	if (!workspaceRoot) {
		return emptyTasks;
	}
	let project = path.join(workspaceRoot, 'project.yml');
	let pdir = z.ProjectDir();

	if (!await exists(project)) {
		let task = new vscode.Task({ type: "zerynth", task: "create" }, "Create Project", 'zerynth', new vscode.ShellExecution(`ztc project prepare ${pdir}`));
		task.group = vscode.TaskGroup.Build;
		emptyTasks.push(task);
		return emptyTasks;
	}
	//TODO: select tasks based on contents of project.yml
	//TODO: add custom problem matcher
	let prj:z.ZStatus=z.GetStatus();
	
	let result: vscode.Task[] = [];
	
	let task = new vscode.Task({ type: "zerynth", task: "compile" }, "Compile", 'zerynth', new vscode.ShellExecution(`ztc project compile ${pdir}`));
	task.group = vscode.TaskGroup.Build;
	task.presentationOptions = {
		panel: vscode.TaskPanelKind.Dedicated,
		showReuseMessage: false
	};
	result.push(task);
	
	task = new vscode.Task({ type: "zerynth", task: "compile_uplink" }, "Compile", 'zerynth', new vscode.ShellExecution(`ztc project compile ${pdir}`));
	task.group = vscode.TaskGroup.Build;
	task.presentationOptions = {
		panel: vscode.TaskPanelKind.Dedicated,
		showReuseMessage: false
	};
	result.push(task);

	task = new vscode.Task({ type: "zerynth", task: "uplink" }, "Uplink", 'zerynth', new vscode.ShellExecution(`ztc project uplink ${pdir}`));
	task.group = vscode.TaskGroup.Build;
	task.presentationOptions = {
		panel: vscode.TaskPanelKind.Dedicated,
		showReuseMessage: false
	};
	result.push(task);
	
	task = new vscode.Task({ type: "zerynth", task: "console" }, "Device Console", 'zerynth', new vscode.ShellExecution(`ztc project console ${pdir}`));
	task.group = vscode.TaskGroup.Build;
	task.presentationOptions = {
		panel: vscode.TaskPanelKind.Dedicated,
		showReuseMessage: false
	};
	result.push(task);

	task = new vscode.Task({ type: "zerynth", task: "register" }, "Register Device", 'zerynth', new vscode.ShellExecution(`ztc project register ${pdir}`));
	task.group = vscode.TaskGroup.Build;
	task.presentationOptions = {
		panel: vscode.TaskPanelKind.Dedicated,
		showReuseMessage: false
	};
	result.push(task);

	task = new vscode.Task({ type: "zerynth", task: "install_os" }, "Install OS", 'zerynth', new vscode.ShellExecution(`ztc project install ${pdir}`));
	task.group = vscode.TaskGroup.Build;
	task.presentationOptions = {
		panel: vscode.TaskPanelKind.Dedicated,
		showReuseMessage: false
	};
	result.push(task);

	return result;
}