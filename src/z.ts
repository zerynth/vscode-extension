/* eslint-disable eqeqeq */
import * as cp from 'child_process';
import * as vscode from 'vscode';
import * as rl from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import { exportedContext } from './extension';
import * as zm from './panels/zm';
import * as zdm from './panels/zdmZerynth';
import * as zdmExp from './panels/zdmExplorer';
import * as cm from './panels/consoleManager';
import { getDevices } from './panels/discovered';
import { deviceNodeInit, matches } from './panels/supported';
import{ BuildNative } from "./__buildnative__";
import { basename } from 'path';
import { match } from 'assert';


/* INTERFACES */
export interface ZResponse {
	code: number | null;
	err: string[];
	out: string[];
	json: any[];
	exc: any;
}

export interface Device {
	target: string,
	name: string,
	architecture: string,
	model: string,
	flash: string,
	ram: string,
	alias: string,
	port: string,
	disk: string,
	probe: string,
	fullname: string,
	signature: string,
	device_uid: string,
	flash_erasable: boolean,
	family: string
}

export interface VM {
	target: string,
	title?: string,
	description?: string,
	version: string,
	rtos: string,
	type?: string,
	features: string,
	date?: string,
	device_uid?: string
}

export interface Workspace {
	id: string,
	name: string,
    description: string,
    fleets:Fleet[]
}

export interface Fleet {
	id: string,
    name: string,
    devices: Dev[]
}

export interface Dev {
	id: string,
	name: string
}

export interface ZStatus {
	device: Device,
	vm: VM
}

let status: ZStatus = {
	device: {
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
	},
	vm: {
		target: "",
		title: "",
		description: "",
		version: "",
		rtos: "",
		type: "",
		features: ""
	}
};

let log: vscode.OutputChannel = vscode.window.createOutputChannel("Zerynth");

let prjWatcher: vscode.FileSystemWatcher;

let ignoreStatusUpdate = false;

export function GetStatus(): ZStatus {
	return status;
}

export function ProjectDir(): string {
	return vscode.workspace.rootPath || "";
}

export function GetProject(): any {
	let prj = path.join(vscode.workspace.rootPath || ".", 'project.yml');
	const file = fs.readFileSync(prj, 'utf8');
	try {
		return yaml.parse(file);
	} catch(err){
		console.log(err);
		return {};
	}
}

export function SetProject(pj: any) {
	let prj = path.join(vscode.workspace.rootPath || ".", 'project.yml');
	const file = fs.writeFileSync(prj, yaml.stringify(pj));
}

function UpdateStatus(updatecb: (s: ZStatus)=>void): void {
	if (ignoreStatusUpdate) {
		console.log("Ignored status update");
		ignoreStatusUpdate=false;
		return;
	}
	let pj = GetProject();
	if (pj.target) {
		status.device.target = pj.target;
		if (pj.specs !== undefined) {
			status.device.port = pj.specs.port;
			status.device.disk = pj.specs.disk;
			status.device.probe = pj.specs.probe;
		}
	}
	if (pj.vm !== undefined && pj.target){
		status.vm.target=pj.target;
		status.vm.device_uid=pj.vm.device_uid || "";
		status.vm.rtos = pj.vm.rtos || "";
		status.vm.features = pj.vm.features || [];
		status.vm.version = pj.vm.version || "";
	}
	updatecb(status);
}

export function Init(updatecb: (s: ZStatus)=>void) {
	if (log != null) {
		//log = vscode.window.createOutputChannel("Zerynth");

		//Write to output.
		log.appendLine("Hello from Zerynth");
		log.show(true);
		Version().then(v => {
			if(!fs.existsSync(path.join(ProjectDir(), ".vscode"))){
				fs.mkdirSync(path.join(ProjectDir(), ".vscode"));
			}

			let sf = path.join(ProjectDir(), ".vscode", 'settings.json');
			let rawdata = "{}";
			try {
				rawdata = fs.readFileSync(sf).toString('utf8');
			} catch (err) {

			}
			let ss = JSON.parse(rawdata) || {};
			let plt = Platform();
			ss["python.terminal.activateEnvironment"]=Boolean(false);
			ss["python.pythonPath"] = _isense_settings[plt]["python.pythonPath"].replace("###", v);
			ss["python.autoComplete.extraPaths"] = _isense_settings[plt]["python.autoComplete.extraPaths"];
			for (let i in ss["python.autoComplete.extraPaths"]) {
				ss["python.autoComplete.extraPaths"][i] = ss["python.autoComplete.extraPaths"][i].replace("###", v);
			}
			ss["python.linting.pylintArgs"]=["--rcfile",linter(plt)];
			Log(`Adding Python intellisense support in ${sf}`);
			fs.writeFileSync(sf, JSON.stringify(ss,null,4));

			/* SETUP project.yml watcher */
			let pattern = path.join(vscode.workspace.rootPath || ".", 'project.yml');
			prjWatcher = vscode.workspace.createFileSystemWatcher(pattern);
			prjWatcher.onDidChange(()=>UpdateStatus(updatecb));
			prjWatcher.onDidCreate(()=>UpdateStatus(updatecb));
			prjWatcher.onDidDelete(()=>UpdateStatus(updatecb));
		}).catch(() => {
			Log("Error, can't find zerynth version!");
		});
		continuousDiscover();
	}
}

export function Log(msg: string) {
	log.appendLine(msg);
}

/**************** EXECUTE ZTC */
let _executing: { [id: string]: boolean; } = {};

export function Run(exe: string, args: string[]): Promise<ZResponse> {
	return new Promise<ZResponse>((c, e) => {
		const cmd = cp.spawn(exe, args);
		let outline = rl.createInterface({ input: cmd.stdout });
		let errline = rl.createInterface({ input: cmd.stderr });
		let zr: ZResponse = {
			code: 0,
			out: [],
			err: [],
			json: [],
			exc: null
		};
		outline.on("line", (data) => {
			zr.out.push(data);
			try {
				zr.json.push(JSON.parse(data));
			} catch (err) {
				Log(data);
			}

		});
		errline.on("line", (data) => {
			zr.err.push(data);
			Log(data);
		});

		cmd.on("error", (err) => {
			Log("[ztc]> Not run!");
			zr.exc = err;
			e(zr);
		});
		cmd.on("exit", code => {
			if (zr.exc != null) {
				//error event has already been fired, do not call c
			} else {
				zr.code = code;
				if (zr.code) {
					e(zr);
				} else {
					c(zr);
				}
			}
		});
	});
}

export function ZTC(args: string[]): Promise<ZResponse> {
	return Run("ztc", args);
}

export function ZDM(args: string[]): Promise<ZResponse> {
	return Run("zdm", args);
}

export function Executing(cmd: string, running?: boolean): boolean {
	if (running === undefined) {
		return _executing[cmd] === undefined ? false : _executing[cmd];
	} else {
		_executing[cmd] = running;
		return running;
	}
}

function continuousDiscover():void{
	cp.spawn("ztc", ["device", "discover", "--loop"]).stdout.on('data',()=>{
		cm.updateConsoleManager();
	});
}

export function DiscoverDevices(): Promise<Device[]> {
	return new Promise<Device[]>((c, e) => {
		ZTC(["-J", "device", "discover", "--matchdb"]).then(async r => {
			let devs: Device[] = [];
			for (let d of r.json) {
				let dev: Device = {
					target: String(d.target),
					name: String(d.name),
					architecture: String(d.architecture),
					model: String(d.chip_manifacturer + " " + d.chip_model),
					flash: String(d.flash),
					ram: String(d.ram),
					alias: String(d.alias),
					port: String(d.port || ""),
					disk: String(d.disk || ""),
					probe: String(d.probe || ""),
					fullname: String(d.fullname || ""),
					signature: String(d.vid+":"+d.pid+":"+d.sid),
					device_uid: String(d.uid),
					flash_erasable: Boolean(d.flash_erasable),
					family: String(d.family_name)
				};
				if (dev.target && dev.fullname) {devs.push(dev);}
			}
			devs.sort((l, r): number => { return l.name.toLocaleLowerCase().localeCompare(r.name.toLocaleLowerCase()); });
			c(devs);
		}).catch(r => {
			Log("Error discovering devices! " + String(r.exc));
			e([]);
			vscode.window.showErrorMessage('Check Zerynth documentation for more information.\n', ...['Documentation']).then((selection) => {
				if(selection=="Documentation"){
					vscode.env.openExternal(vscode.Uri.parse("https://docs.zerynth.com/latest/supported_boards.html"));		
				}
			});
		});
	});
}

export function SupportedDevices(): Device[]{
	let idev:Device[]=[];	
	matches.forEach((element)=>{
		fs.readdirSync(element.getPath()).forEach((file)=>{
			if(file==="device.json"){
				let r=JSON.parse(fs.readFileSync(path.join(element.getPath(),file)).toString());
				let dev:Device = {
					target: String(r.target),
					name: String(r.name),
					architecture: String(r.architecture),
					model: String(r.chip_manifacturer + " " + r.chip_model),
					flash: String(r.flash),
					ram: String(r.ram),
					alias: String(r.alias),
					port: String(r.port || ""),
					disk: String(r.disk || ""),
					probe: String(r.probe || ""),
					fullname: String(r.fullname || ""),
					signature: String(r.vid+":"+r.pid+":"+r.sid),
					device_uid: String(r.device_uid),
					flash_erasable: Boolean(r.flash_erasable),
					family: String(r.family_name)
				};
				idev.push(dev);
			}            
        });
	});
	return idev;
}
/*
export function AvailableVMS(target: string): Promise<VM[]> {
	return new Promise<VM[]>((c, e) => {
		Log("Getting Zerynth OS instances...");
		ZTC(["vm", "available",target, "--oneperline"]).then(r => {
			let vms: VM[] = [];
			for (let v of r.json) {
				let vm: VM = {
					target: String(v.target),
					version: String(v.version),
					rtos: String(v.rtos),
					features: v.features,
				};
				vms.push(vm);
			}
			Log("Done");
			c(vms);
		}).catch(r => {
			Log("Error getting Zerynth OS instances! " + String(r.exc));
			e([]);
		});
	});
}
*/
export async function AvailableVMS(target: string): Promise<VM[]> {
	let result:string=await execCommand(target);
	var re= /((.*)(\[.*\])(.*)*(r.*))/;
	var regex=new RegExp(re,"g");
	var match = regex.exec(result);
    let matches:VM[]=[];
    while (match != null) { 
		let vm:string[]=match[2].split(/\s{2,}/);
    	let tmp:VM= {
			target: target,
			title: vm[0].trim(),
			description: vm[1].trim(),
			version: match[5].trim(),
			rtos: vm[2].trim(),
			type: match[4].trim(),
			features: match[3].trim().replace("[","").replace("]","").split("'").join("").split(", ").join(","),
		};
		matches.push(tmp);
      	match = regex.exec(result);
	}
	return matches;
}

function execCommand(target:string):Promise<string>{
	return new Promise((resolve,reject)=>{
	  	cp.exec("ztc vm available "+target, (err,stdout,stderr)=>{
			if(err){
		  		reject();
		  		return "";
			}
			if(stderr){
		  		reject(stderr);
		  		return "";
			}
			resolve(stdout);
	  	});
	});
}

export function Version(): Promise<string> {
	return new Promise<string>((c, e) => {
		let vv: string = "";
		ZTC(["info", "--version"]).then(r => {
			console.log("Looking into", r.out);
			for (let v of r.out) {
				if (v.startsWith("r")) {
					vv = v;
					break;
				}
			}
			c(vv);
		}).catch(() => e(""));
	});
}

export function Platform(): string {
	return (os.platform().startsWith("win")) ? ("windows64") : ((os.platform().startsWith("linux")) ? ("linux64") : ("mac"));
}


export async function ProjectPrepare(dev: Device){
	if (Executing('project prepare')) {
		return;
	}
	resetSpecs();
	Executing('project prepare',true);

	let pdir="";
	if(ProjectDir().includes(" ")){
		pdir="\""+ProjectDir()+"\"";
	}else{
		pdir=ProjectDir();
	}

	let args: string[] = ["project", "prepare", pdir, "--target", dev.target];
	if (dev.port) {
		args.push("--port");
		args.push(dev.port);
	}
	if (dev.disk) {
		args.push("--disk");
		args.push(dev.disk);
	}
	if (dev.probe) {
		args.push("--probe");
		args.push(dev.probe);
	}
	await ZTC(args).then(() => {
		Log(`Project configured for ${dev.target}`);
		console.log(args);
		ZTC(["project","deps",pdir]).finally(()=>{
			Executing('project prepare',false);
		});
	}).catch(() => {
		Log(`Project NOT configured for ${dev.target}`);
		Executing('project prepare',false);
	});
	status.device.alias=dev.alias;
}

export async function virtualize(alias:string,vmuid:string){
	await ZTC(["device","virtualize",alias,vmuid]);
}

export async function createVM(alias:string,vm:VM):Promise<string>{
	//await ZTC(["device","register",alias]);
	let features:string;
	let out:string[]=[];
	if(vm.features.length>0){
		features="--feat "+vm.features.split(", ").join(" --feat ");
		out=(await ZTC(["vm","create",features,alias,vm.version,vm.rtos])).out;
	}else{
		out=(await ZTC(["vm","create",alias,vm.version,vm.rtos])).out;
	}
	let uid:string="";
	let i=0;
	while(i<out.length && uid===""){
		var regex=new RegExp(/(.*)uid:(.*)/,"g");
		var match = regex.exec(out[i]);
		if(match != null) { 
			uid=match[2].trim();
		}
		i++;
	};
	return uid;
}

function resetSpecs(){
	ignoreStatusUpdate=true;
	let pj = GetProject();
	pj.specs ={
		disk:null,
		port:null,
		probe:null
	};
	SetProject(pj);
}

export function SetVM(vm: VM) {
	ignoreStatusUpdate=true;
	let pj = GetProject();
	let tmp:string[]=[];
	if(vm.features!==""){
		tmp=vm.features.split(",");
	}
	pj.vm ={
		rtos: vm.rtos,
		version: vm.version,
		features: tmp,
		target: vm.target,
		device_uid: vm.device_uid || null
	};
	SetProject(pj);
}


export async function login(){
	let user = await vscode.window.showInputBox({placeHolder:"Insert here your email",ignoreFocusOut:true});
	let pswd = await vscode.window.showInputBox({placeHolder:"Insert here your password",ignoreFocusOut:true,password:true});
	
	if(user && pswd){
		await ZTC(['login','--user',user,'--passwd',pswd]).then((r)=>{
			if(r.err.length==0){
				Log("Login successful");
				exportedContext.globalState.update("login",true);
				vscode.commands.executeCommand('setContext', 'test.key', true);
			}
		});
	}
}

export async function register(){
	let name = await vscode.window.showInputBox({placeHolder:"Insert here your name",ignoreFocusOut:true});
	let email = await vscode.window.showInputBox({placeHolder:"Insert here your email",ignoreFocusOut:true});
	let pswd = await vscode.window.showInputBox({placeHolder:"Insert here your password",ignoreFocusOut:true,password:true});
	
	if(email && pswd && name){
		await ZTC(["register", email, pswd, name]).then((r)=>{
			if(r.err.length==0){
				Log("Registration completed successfully");
				exportedContext.globalState.update("login",true);
				vscode.commands.executeCommand('setContext', 'test.key', true);
			}
		});
	}	
}

export async function logout(){
	await ZTC(["logout"]).then((r)=>{
		if(r.err.length==0){
			exportedContext.globalState.update("login",false);
			vscode.commands.executeCommand('setContext', 'test.key', false);	
		}
	});
}

export async function newProject(){
	let path=await vscode.window.showSaveDialog({saveLabel:"Create new Zerynth project"});
    if(path!=undefined){
		let splitPath:string[]=[];
        if(process.platform.includes("win")){
            splitPath = path.fsPath.split(/\\/);
        }else{
            splitPath = path.fsPath.split('\/');
        }
		let title=splitPath[splitPath.length-1];
		if(title.includes(" ")){
			title="\""+title+"\"";
		}
		let p="";
		if(path.fsPath.includes(" ")){
			p="\""+path.fsPath+"\"";
		}else{
			p=path.fsPath;
		}
		await ZTC(["project","create",title,p]);
    	vscode.commands.executeCommand('vscode.openFolder',path);   
	}
}

export function open_zdm(){
	vscode.env.openExternal(vscode.Uri.parse("https://zdm.zerynth.com/"));
}

export function info_zdm(){
	vscode.env.openExternal(vscode.Uri.parse("https://docs.zerynth.com/latest/reference/libs/zerynth/zdm/docs/zdm/"));
}

export function discoverWorkspaces(): Promise<Workspace[]>{
	return new Promise<Workspace[]>((c, e) => {
		ZDM(["-J", "workspace", "all"]).then(r => {
			let workspaces: Workspace[] = [];
			for (let w of r.json) {
				for (let _w of w) {
					let fleets: Fleet[]=[];
					if(_w.fleets!==null){
						for(let fleet of _w.fleets){
							let devs: Dev[]=[];
							if(fleet.devices!==null){
								for(let d of fleet.devices){
									let device: Dev={
										id: String(d.id),
										name: String(d.name)
									};
									if(String(d.deleted_at)==="0001-01-01T00:00:00Z"){
										devs.push(device);
									}
								}
							}
							let flt: Fleet = {
								id: String(fleet.id),
								name: String(fleet.name),
								devices: devs
							};
							fleets.push(flt);
						}
					}
					let wks: Workspace = {
						id: String(_w.id),
						name: String(_w.name),
						description: String(_w.description),
						fleets: fleets
					};
					workspaces.push(wks);
				}
			}    
			c(workspaces);
		}).catch(r => {
			Log("Error discovering workspaces! " + String(r.exc));
			e([]);
		});
	});
}


export async function addWorkspaceZDM(){
	let workspaceName = await vscode.window.showInputBox({ placeHolder: "Insert workspace name"});
	if(workspaceName!=undefined){
		ZDM(["workspace","create",workspaceName]).then(()=>{
			zdm.refresh(); 
			zdmExp.refresh(); 
		});
	}
}

export async function addFleetZDM(wks?:Workspace){
	let fleetName = await vscode.window.showInputBox({ placeHolder: "Insert fleet name"});
	if(wks!==undefined){	
		if(fleetName!=undefined){
			ZDM(["fleet","create",fleetName,wks.id]).then(()=>{
				zdm.refresh(); 
				zdmExp.refresh();
			});
		}
	}else{
		if(fleetName!==undefined){
			let workspaces: Workspace[]=await discoverWorkspaces();
			let nameWorkspaces: string[]=[];
			workspaces.forEach((w)=>{
				workspaces.push(w);
				nameWorkspaces.push(w.name);
			});
			vscode.window.showQuickPick(nameWorkspaces,{placeHolder:"Select workspace"}).then((w)=>{
				if(w!==undefined && fleetName!==undefined){
					let i=nameWorkspaces.indexOf(w);
					ZDM(["fleet","create",fleetName,workspaces[i].id]).then(()=>{
						zdm.refresh(); 
						zdmExp.refresh();
					});
				}
			});
		}	
	}
}

export async function discoverDeviceWorkspace():Promise<string>{
	let wks: Workspace[]=await discoverWorkspaces();
	let result:string="";
	wks.forEach((w)=>{
		w.fleets.forEach((f)=>{
			f.devices.forEach((d)=>{
				if(d.id===GetProject().zdm.device_id){
					result=w.id;
				}
			});
		});
	});
	return result;
}

export function addDeviceZDM(fleet:Fleet):void{
	let credential:string="";
	let token:vscode.QuickPickItem[]=[{label:'Device token',description:'Medium security',detail:'The device will generate its own token knowing a ZDM generated symmetric key.'},{label:'Cloud token',description:'Low security',detail:'The device will connect with a token generated by the ZDM based on a symmetric key.'}];

	vscode.window.showQuickPick(token,{placeHolder: "Credentials type"}).then(async (data)=>{
		if(data!==undefined && data.label==='Device token'){
			credential="device_token";
		}
		if(data!==undefined && data.label==='Cloud token'){
			credential="cloud_token";
		}
		let deviceName = await vscode.window.showInputBox({placeHolder: "Insert device name"});
		if(deviceName!=undefined){
			let out:string[]=(await ZDM(["device","create","--fleet-id",fleet.id,deviceName])).out;
			let dev_id:string=out[2].split(/\s{2,}/)[0].trim();
			if(vscode.workspace.rootPath!==undefined){
				await ZDM(["device","credentials","--endpoint_mode","secure","--credentials",credential,"--output",vscode.workspace.rootPath,dev_id]);
			}
			let prj=GetProject();
            prj.zdm ={
            	device_id: dev_id
            };
			SetProject(prj);
			zm.refresh();
			zdm.refresh(); 
			zdmExp.refresh();
		}
	});
}

export function credentials(dev_id:string){
	let credential:string="";
	let token:vscode.QuickPickItem[]=[{label:'Device token',description:'Medium security',detail:'The device will generate its own token knowing a ZDM generated symmetric key.'},{label:'Cloud token',description:'Low security',detail:'The device will connect with a token generated by the ZDM based on a symmetric key.'}];

	vscode.window.showQuickPick(token,{placeHolder: "Credentials type"}).then(async (data)=>{
		if(data!==undefined && data.label==='Device token'){
			credential="device_token";
		}
		if(data!==undefined && data.label==='Cloud token'){
			credential="cloud_token";
		}
		if(vscode.workspace.rootPath!==undefined){
			await ZDM(["device","credentials","--endpoint_mode","secure","--credentials",credential,"--output",vscode.workspace.rootPath,dev_id]);
		}
	});
}

export async function fota(dev:Device){
	let prj=GetProject();
	let vm=prj.vm;
	let f=vm.features;
	if(f===null || !f.includes("ota")){
		vscode.window.showErrorMessage("The vm of th device doesn't support FOTA. Please use a VM with feature OTA enabled.");
	}else{
		let path:string=vscode.workspace.rootPath+"/zdevice.json";
		if(fs.existsSync(path)){
			let data=yaml.parse(fs.readFileSync(path,'utf8'));
			let deviceid=data.devinfo;
			let version = await vscode.window.showInputBox({ placeHolder: "Insert version"}).then(async (v)=>{
				prj.zdm ={
					device_id: deviceid.device_id,
					fota: {version: Number(v)}
				};
				SetProject(prj);
				await ZDM(["fota","prepare",vscode.workspace.rootPath,deviceid.device_id,v]);
				await ZDM(["fota","schedule",v,deviceid.device_id]);
			});
		}else{
			vscode.window.showErrorMessage("Fota cannot be prepared. Please connect the device to the ZDM at least one time.");		
		}
	}
}

export async function eraseFlash(alias:string){
	log.show();
	Log("Starting erasing flash ...");
	await ZTC(["device","erase_flash",alias]).then(()=>{
		Log("Done");
	});
}

export function forget(alias:string){
	vscode.window.showWarningMessage('Do you want to delete a device from the known device list?\n', ...['Yes'],...['No']).then((selection) => {
		if(selection=="Yes"){
			Log("Starting forget device ...");
			ZTC(["device","alias","del",alias]).then(()=>{
				Log("Done");
			});
		}
	});
}

function linter(plt:string):string{
	if(plt==="linux64"){
		return '${env:HOME}/.zerynth2/sys/cli/linter/zlintrc';
	}else{
		if(plt==="windows64"){
			return process.env['USERPROFILE']+"/zerynth2/sys/cli/linter/zlintrc";
		}else{
			return '${env:HOME}/.zerynth2/sys/cli/linter/zlintrc';
		}
	}
}

/**************** SETTINGS ****************/
let _isense_settings: { [id: string]: any; } = {
	linux64: {
		'python.pythonPath': '${env:HOME}/.zerynth2/sys/python/bin/python3',
		'python.autoComplete.extraPaths': [
			'${env:HOME}/.zerynth2/dist/###/stdlib/__builtins__.py',
			'${env:HOME}/.zerynth2/dist/###/stdlib/wireless',
			'${env:HOME}/.zerynth2/dist/###/stdlib/crypto',
			'${env:HOME}/.zerynth2/dist/###/stdlib/bignum',
			'${env:HOME}/.zerynth2/dist/###/stdlib',

			'${env:HOME}/.zerynth2/dist/###/libs/official/zerynth',
			'${env:HOME}/.zerynth2/dist/###/libs/official'
		]
	},
	windows64: {
		"python.pythonPath": process.env['USERPROFILE']+"/zerynth2/sys/python/python.exe",
		'python.autoComplete.extraPaths': [
			process.env['USERPROFILE']+"/zerynth2/dist/###/stdlib/__builtins__.py",
			process.env['USERPROFILE']+"/zerynth2/dist/###/stdlib/wireless",
			process.env['USERPROFILE']+"/zerynth2/dist/###/stdlib/crypto",
			process.env['USERPROFILE']+"/zerynth2/dist/###/stdlib/bignum",
			process.env['USERPROFILE']+"/zerynth2/dist/###/stdlib",
			
			process.env['USERPROFILE']+"/zerynth2/dist/###/libs/official/zerynth",
			process.env['USERPROFILE']+"/zerynth2/dist/###/libs/official",
		]
	},
	mac: {
		'python.pythonPath': '${env:HOME}/.zerynth2/sys/python/bin/python',
		'python.autoComplete.extraPaths': [
			'${env:HOME}/.zerynth2/dist/###/stdlib/__builtins__.py',
			'${env:HOME}/.zerynth2/dist/###/stdlib/wireless',
			'${env:HOME}/.zerynth2/dist/###/stdlib/crypto',
			'${env:HOME}/.zerynth2/dist/###/stdlib/bignum',
			'${env:HOME}/.zerynth2/dist/###/stdlib',

			'${env:HOME}/.zerynth2/dist/###/libs/official/zerynth',
			'${env:HOME}/.zerynth2/dist/###/libs/official'
		]
	}
};
