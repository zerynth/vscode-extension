import * as vscode from 'vscode';
import * as z from './z';
import * as statusbar from'./status/status';
import * as t  from './tasks/tasks';

export function Init() {
    vscode.commands.registerCommand('zerynth.compile', () => {
        if(z.GetProject().target!==null){
            RunTask("compile");
        }else{
            vscode.window.showErrorMessage("Please, set target device.");
        }
    });
    vscode.commands.registerCommand('zerynth.uplink', () => {
        if(z.GetProject().target!==null){
            RunTask("compile_uplink");
            vscode.tasks.onDidEndTask((e)=>{
                if(e.execution.task.definition.task==="compile_uplink"){
                    RunTask("uplink");
                }   
            });
        }else{
            vscode.window.showErrorMessage("Please, set target device.");
        }    
    });
    vscode.commands.registerCommand('zerynth.register', () => {
        RunTask("register");
    });
    vscode.commands.registerCommand('zerynth.virtualize', (dev:z.Device,uid:string) => {
        RunTask("virtualize");
    });
    vscode.commands.registerCommand('zerynth.panels.device_manager.open_zdm', ()=> {
        z.open_zdm();
    });
    vscode.commands.registerCommand('zerynth.panels.device_manager.info_zdm', ()=> {
        z.info_zdm();
    });
}

export function InitAccess(){
    vscode.commands.registerCommand('zerynth.panels.login_credential.login', () => {
        z.login();
    });
    vscode.commands.registerCommand('zerynth.panels.login_credential.register', () => {
        z.register();
    });
    vscode.commands.registerCommand('zpanel.logout', () => {
        z.logout();
    });
    vscode.commands.registerCommand('zpanel.newProject', () => {
        z.newProject();
    });
}

export async function RunTask(task: string) {
    const tasks = await vscode.tasks.fetchTasks({ type: "zerynth" });
    for (let t of tasks) {
        if (t.definition.task === task) {
            vscode.tasks.executeTask(t);
            break;
        }
    }
}