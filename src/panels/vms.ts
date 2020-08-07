import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as z from '../z';

export function Init() {
    wsc = vscode.window.createTreeView('zerynth.panels.virtualmachines', {
        treeDataProvider: dsc
      });

    vscode.window.registerTreeDataProvider(
        'zerynth.panels.virtualmachines',
        dsc
    );
    vscode.commands.registerCommand('zerynth.panels.virtualmachines.refreshEntry', () =>
        dsc.refresh()
    );
    vscode.commands.registerCommand('zerynth.panels.virtualmachines.setEntry', (item) => {
        z.SetVM(item.vm);
    });
}

export function Update(status: z.ZStatus) {
    console.log("VMS Updated");
    dsc.refresh();
    wsc.title = "Zerynth OS for "+status.device.target;
}


export class VMSProvider implements vscode.TreeDataProvider<VMItem> {
    constructor() {
        console.log('VM Provider starting...');
    }

    private _onDidChangeTreeData: vscode.EventEmitter<VMItem | undefined> = new vscode.EventEmitter<VMItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<VMItem | undefined> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: VMItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: VMItem): Thenable<VMItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            return new Promise<VMItem[]>((c, e) => {
                let target = z.GetStatus().device.target;
                let ivms: VMItem[] = [];
                if (!target) {
                    c(ivms);
                } else {
                    z.AvailableVMS(z.GetStatus().device.target).then(vms => {
                        for (let vm of vms) {
                            let ivm = new VMItem(vm, vscode.TreeItemCollapsibleState.None);
                            ivms.push(ivm);
                        }
                        c(ivms);
                    }).catch(devs => { e([]); });
                }
            });
        }
    }
}

let dsc: VMSProvider = new VMSProvider();
let wsc: vscode.TreeView<VMItem>;


class VMItem extends vscode.TreeItem {
    constructor(
        public readonly vm: z.VM,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(vm.version, collapsibleState);
    };

    get tooltip(): string {
        return `target: ${this.vm.features}`;
    };

    get description(): string {
        return this.vm.features.concat(", ") || "Standard";
    };

    iconPath = {
        light: path.join(__filename,'..','..','..','resources', 'light', 'dependency.svg'),
        dark: path.join(__filename,'..','..','..','resources', 'dark', 'dependency.svg')
    };

    contextValue = 'vmitem';
}