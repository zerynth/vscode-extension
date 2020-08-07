import * as vscode from 'vscode';
import * as path from 'path';
import * as dns from 'dns';
import * as commands from './commands';
import * as t  from './tasks/tasks';
import * as status from './status/status';
import * as z from './z';
import * as d from './panels/discovered';
import * as zm from './panels/zm';
import * as cm from './panels/consoleManager';
import { Z_MEM_ERROR } from 'zlib';

let dev:z.Device;

export function Init(context: vscode.ExtensionContext,status: z.ZStatus) {
	context.subscriptions.push(
		vscode.commands.registerCommand('zerynth.install', (item) => {
            if(z.GetProject().target!==null){
                dev=item.dev;      
                dns.resolve('www.google.com', function(err) {
                    if (err) {
                        vscode.window.showErrorMessage("You're offline, check your internet connection.");
                    } else {
                        VMPanel.createOrShow(context.extensionPath);
                    }
                });
            }else{
                vscode.window.showErrorMessage("Please, set target device.");
            }
		})
	);

	if (vscode.window.registerWebviewPanelSerializer) {
		vscode.window.registerWebviewPanelSerializer(VMPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				VMPanel.revive(webviewPanel, context.extensionPath);
			}
		});
	}
}

export function Close(){
    VMPanel.currentPanel?.dispose();
}

class VMPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: VMPanel | undefined;

	public static readonly viewType = 'VMPanel';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
    private _disposables: vscode.Disposable[] = [];
    private device: z.Device;

	public static createOrShow(extensionPath: string) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (VMPanel.currentPanel) {
			VMPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			VMPanel.viewType,
			'Install OS',
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,
			}
        );
		VMPanel.currentPanel = new VMPanel(panel,extensionPath,dev);
	}

	public static revive(panel: vscode.WebviewPanel, extensionPath: string) {
		VMPanel.currentPanel = new VMPanel(panel, extensionPath,dev);
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, device: z.Device) {
		this._panel = panel;
        this._extensionPath = extensionPath;
        this.device=device;

		// Set the webview's initial html content
        this._update(true);
        this._update(false);
        
		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update(false);
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
                    case 'setVM':
                        this.setVirtualMachine(message.text);
                        return;
				}
			},
			null,
			this._disposables
		);
	}

	public doRefactor() {
		// Send a message to the webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' });
	}

	public dispose() {
		VMPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private _update(b:boolean) {
		const webview = this._panel.webview;
		this._updateForVM(b);
	}

	private async _updateForVM(b:boolean) {
        this._panel.title = "Install OS";
        if(!b){
            this._panel.webview.html=await this._getHtmlForWebview();
        }else{
            this._panel.webview.html= this.loading();
        }
	}

	private loading() {

		return `<!DOCTYPE html>
		<html>
        <head>
        <style>
            .container {
                height: 200px;
                position: relative;
                font-size: 200%;
                color: var(--vscode-descriptionForeground);
            }
          
            .center {
                margin: 0;
                position: absolute;
                top: 50%;
                left: 50%;
                -ms-transform: translate(-50%, -50%);
                transform: translate(-50%, -50%);
            }

            .loading:after {
                content: ' .';
                color: var(--vscode-descriptionForeground);
                animation: dots 1s steps(5, end) infinite;
            }
              
            @keyframes dots {
                0%, 20% {
                    color: rgba(0,0,0,0);
                    text-shadow:
                        .25em 0 0 rgba(0,0,0,0),
                        .5em 0 0 rgba(0,0,0,0);
                }
                40% {
                    color: white;
                    text-shadow:
                        .25em 0 0 rgba(0,0,0,0),
                        .5em 0 0 rgba(0,0,0,0);
                }
                60% {
                    text-shadow:
                        .25em 0 0 white,
                        .5em 0 0 rgba(0,0,0,0);
                }
                80%, 100% {
                    text-shadow:
                        .25em 0 0 var(--vscode-descriptionForeground),
                        .5em 0 0 var(--vscode-descriptionForeground);
                }
            }
              
        </style>
		</head>
		<body>
            <div class="container">
                <div class="center">
                    <p class="loading"> Loading</p>
                </div>
        	</div>
		</body>
		</html>`;
    }

	private async _getHtmlForWebview() {
        let vms:z.VM[]=await z.AvailableVMS(this.device.target);
        const v:string=this.selectOptions(vms);
        const vmCreated:z.VM[]=await this.VMCreated();
        const t:string=await this.table(vms,vmCreated);

		return `<!DOCTYPE html>
		<html>
		<head>
        <style>
            .select{
                border: none;
                background-color: var(--vscode-settings-dropdownBackground);
                color: var(--vscode--button-foreground);
                padding: 5px 10px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 16px;
                margin: 4px 2px;
            }

            select.selector{
                background: var(--vscode-button-background);
                color: var(--vscode--button-foreground);
            }

            .information{
                display: flex;
                vertical-align: middle;
                justify-content: space-between;
            }

            table {
                border-collapse: collapse;
                width: 100%;
                color: var(--vscode-descriptionForeground);
            }
          
            th {
                padding: 8px;
                text-align: center;
                border-top: 2px solid var(--vscode-descriptionForeground);
                border-bottom: 2px solid var(--vscode-descriptionForeground);
            }

            td {
                padding: 8px;
                text-align: center;
                border-bottom: 1px solid var(--vscode-descriptionForeground);
            }

            .button {
                border: none;
                padding: 16px 32px;
                margin 10px;
                text-align: center;
                text-decoration: none;
                display: inline-block;
                font-size: 16px;
                margin: 4px 2px;
                transition-duration: 0.4s;
                cursor: pointer;
            }

            .disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .primaryButton {
                background-color: var(--vscode-button-background);
                color: var(--vscode--button-foreground);
            }

            .primaryButton:hover {
                background-color: var(--vscode-button-hoverBackground);
            }

            .secondaryButton {
                background-color: var(--vscode-input-background);
                color: var(--vscode--button-foreground);
            }
            
        </style>
		</head>
		<body onload="filterFunction()" onchange="disabledFunction()">
		
		<h2>Install Zerynth OS on device</h2>
		
        <div class="information">
            <div>
		        Available versions:        
                <select class="select" name="versions" id="versions" onchange="filterFunction()">
                    ${v}
                </select>
            </div>
            <div>
                <p>Selected device: ${this.device.target}</p>
            </div>
        </div>
        <button type="button" class="button primaryButton" onclick="install_os()" id="install_os">Install OS</button>

		<table id="vm">
		  	<tr>
            	<th>Select</th>
            	<th>Configuration</th>
				<th>Version</th>
            	<th>Rtos</th>
            	<th>Features</th>
            	<th>License</th>
            	<th>Created</th>
		  	</tr>
          	${t}
		</table>
		 
        <script>
        function disabledFunction(){
            var r = document.getElementsByName('vm');
            var value=null;
            for(var i = 0; i < r.length; i++){
                if(r[i].checked){
                    value = r[i].value;
                }
            }
            if(value===null){
                document.getElementById("install_os").classList.add("disabled");
            }else{
                document.getElementById("install_os").classList.remove("disabled");
            }
        }

        function filterFunction() {
            var input, filter, table, tr, td, i;
            input = document.getElementById("versions");
            filter = input.value.toUpperCase();
            table = document.getElementById("vm");
            tr = table.getElementsByTagName("tr");
            var id=false;
            for (i = 0; i < tr.length; i++) {
                td = tr[i].getElementsByTagName("td")[2];
                if (td) {
                    if (td.innerHTML.toUpperCase().indexOf(filter) > -1) {
                        if(id===false){
                            var r = document.getElementsByName('vm');
                            r[i-1].checked=true;
                            id=true;
                        }
                        tr[i].style.display = "";
                    } else {
                        tr[i].style.display = "none";
                    }
                }       
            }
        }
        
        const vscode = acquireVsCodeApi();
        
        function install_os(){
            if(!document.getElementById("install_os").classList.contains("disabled")){
                var r = document.getElementsByName('vm');
                var value=null;
                for(var i = 0; i < r.length; i++){
                    if(r[i].checked){
                        value = r[i].value;
                    }
                }
                if(value!=null){
                    (function() {
                        vscode.postMessage({
                            command: 'setVM',
                            text: value
                        })
                    }());
                }
            }
        }

        </script>
		</body>
		</html>`;
    }
    
    availableVersions(vms:z.VM[]):string[]{
        let versions:string[]=[];
        vms.forEach((vm)=>{
            if(!versions.includes(vm.version)){
                versions.push(vm.version);
            }
        });
        return versions;
    }

    selectOptions(vms:z.VM[]):string{
        let result:string="";
        let versions=this.availableVersions(vms);
        versions.forEach((el)=>{
            if(versions.indexOf(el)===0){
                result=result.concat(`<option value="${el}" selected>${el}</option>`);  
            }else{
                result=result.concat(`<option value="${el}">${el}</option>`); 
            }
        });
        return result;
    }

    async VMCreated():Promise<z.VM[]>{
        let vms: z.VM[] = [];
        await z.ZTC(["-J", "vm", "list"]).then(r => {
			for (let l of r.json) {
                for (let v of l.list) {
			    	let vm: z.VM = {
		    			target: String(v.dev_type),
	    				version: String(v.version),
    					rtos: String(v.rtos),
                        features: String(v.features),//.split(",").join(", "),
                        date: String(v.create_date),
                        device_uid:String(v.uid)
                    };
                    vms.push(vm);
                }
			}
        });
        return vms;
    }

    async table(vms:z.VM[],vmCreated:z.VM[]):Promise<string>{
        let result:string="";
        let created:z.VM[]=await this.VMCreated();
        vms.forEach((vm)=>{
            let date=this.alreadyCreated(vm,created).split("$");
            if(date[0]!==""){
                result=result.concat(`
                    <tr>
						<td><input type="radio" id="${vm.target+"$"+vm.title+"$"+vm.version+"$"+vm.rtos+"$"+vm.features+"$"+vm.type+"$true$"+date[1]}" name="vm" value="${vm.target+"$"+vm.title+"$"+vm.version+"$"+vm.rtos+"$"+vm.features+"$"+vm.type+"$true$"+date[1]}"></td>
						<td>${vm.title}</td>
						<td>${vm.version}</td>
						<td>${vm.rtos}</td>
						<td>${vm.features}</td>
						<td>${vm.type}</td>
						<td>${date[0]}</td>
                    </tr>`
                );
            }else{
                result=result.concat(`
                    <tr>
						<td><input type="radio" id="${vm.target+"$"+vm.title+"$"+vm.version+"$"+vm.rtos+"$"+vm.features+"$"+vm.type+"$false"}" name="vm" value="${vm.target+"$"+vm.title+"$"+vm.version+"$"+vm.rtos+"$"+vm.features+"$"+vm.type+"$false"}"></td>
						<td>${vm.title}</td>
						<td>${vm.version}</td>
						<td>${vm.rtos}</td>
						<td>${vm.features}</td>
						<td>${vm.type}</td>
						<td>Never</td>
                    </tr>`
                );
            }
        });
        return result;
    }

    alreadyCreated(vm:z.VM,created:z.VM[]):string{
        let date:string="";
        created.forEach((el)=>{
            if(el.features===vm.features && el.rtos===vm.rtos && el.target===vm.target && el.version===vm.version && el.date){
                date=el.date+"$"+el.device_uid;
            }
        });
        return date;
    }

    async setVirtualMachine(message:string){
        let msg:string[]=message.split("$");
        let vm:z.VM={
            target: msg[0],
            title: msg[1],
            version: msg[2],
            rtos: msg[3],
            features: msg[4].trim(),
            type: msg[5]
        };
        let d=z.GetStatus().device;
        if(msg[6]==="true"){
            z.SetVM(vm);
            if(dev.flash_erasable){
                await z.eraseFlash(dev.alias);
            }
            commands.RunTask("install_os");
            vscode.tasks.onDidEndTask((e)=>{
                if(e.execution.task.name==='Install OS'){
                    zm.refresh();
                    status.Update();
                    vscode.window.showInformationMessage("Zerynth OS installation completed.\n",...['Ok']).then((selection)=>{
                        if(selection==="Ok"){
                            this._panel.dispose();
                        }
                    });
                }
            });
        }else{
            vscode.window.showWarningMessage('Warning! This virtual machine has not yet been created, do you want to create it now?\n', ...['Yes'],...['No']).then(async (selection) => {
                if(selection==="Yes"){
                    z.SetVM(vm);
                    if(dev.flash_erasable){
                        await z.eraseFlash(dev.alias);
                    }
                    commands.RunTask("install_os");
                    vscode.tasks.onDidEndTask((e)=>{
                        if(e.execution.task.name==='Install OS'){
                            zm.refresh();
                            status.Update();
                            vscode.window.showInformationMessage("Zerynth OS installation completed.\n",...['Ok']).then((selection)=>{
                                if(selection==="Ok"){
                                    this._panel.dispose();
                                }
                            });
                        }
                    });
                }
            });
        }
        if(cm.sdc!==undefined){
            cm.updateConsoleManager();
        }
    }
}