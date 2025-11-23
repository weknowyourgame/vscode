/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import './media/processExplorer.css';
import { localize } from '../../../../nls.js';
import { $, append, getDocument } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { isRemoteDiagnosticError } from '../../../../platform/diagnostics/common/diagnostics.js';
import { ByteSize } from '../../../../platform/files/common/files.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { WorkbenchDataTree } from '../../../../platform/list/browser/listService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { Separator, toAction } from '../../../../base/common/actions.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { Delayer } from '../../../../base/common/async.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IRemoteAgentService } from '../../../services/remote/common/remoteAgentService.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { Schemas } from '../../../../base/common/network.js';
import { isWeb } from '../../../../base/common/platform.js';
const DEBUG_FLAGS_PATTERN = /\s--inspect(?:-brk|port)?=(?<port>\d+)?/;
const DEBUG_PORT_PATTERN = /\s--inspect-port=(?<port>\d+)/;
function isMachineProcessInformation(item) {
    const candidate = item;
    return !!candidate?.name && !!candidate?.rootProcess;
}
function isProcessInformation(item) {
    const candidate = item;
    return !!candidate?.processRoots;
}
function isProcessItem(item) {
    const candidate = item;
    return typeof candidate?.pid === 'number';
}
class ProcessListDelegate {
    getHeight() {
        return 22;
    }
    getTemplateId(element) {
        if (isProcessItem(element)) {
            return 'process';
        }
        if (isMachineProcessInformation(element)) {
            return 'machine';
        }
        if (isRemoteDiagnosticError(element)) {
            return 'error';
        }
        if (isProcessInformation(element)) {
            return 'header';
        }
        return '';
    }
}
class ProcessTreeDataSource {
    hasChildren(element) {
        if (isRemoteDiagnosticError(element)) {
            return false;
        }
        if (isProcessItem(element)) {
            return !!element.children?.length;
        }
        return true;
    }
    getChildren(element) {
        if (isProcessItem(element)) {
            return element.children ?? [];
        }
        if (isRemoteDiagnosticError(element)) {
            return [];
        }
        if (isProcessInformation(element)) {
            if (element.processRoots.length > 1) {
                return element.processRoots; // If there are multiple process roots, return these, otherwise go directly to the root process
            }
            if (element.processRoots.length > 0) {
                return [element.processRoots[0].rootProcess];
            }
            return [];
        }
        if (isMachineProcessInformation(element)) {
            return [element.rootProcess];
        }
        return element.processes ? [element.processes] : [];
    }
}
function createRow(container, extraClass) {
    const row = append(container, $('.row'));
    if (extraClass) {
        row.classList.add(extraClass);
    }
    const name = append(row, $('.cell.name'));
    const cpu = append(row, $('.cell.cpu'));
    const memory = append(row, $('.cell.memory'));
    const pid = append(row, $('.cell.pid'));
    return { name, cpu, memory, pid };
}
class ProcessHeaderTreeRenderer {
    constructor() {
        this.templateId = 'header';
    }
    renderTemplate(container) {
        container.previousElementSibling?.classList.add('force-no-twistie'); // hack, but no API for hiding twistie on tree
        return createRow(container, 'header');
    }
    renderElement(node, index, templateData) {
        templateData.name.textContent = localize('processName', "Process Name");
        templateData.cpu.textContent = localize('processCpu', "CPU (%)");
        templateData.pid.textContent = localize('processPid', "PID");
        templateData.memory.textContent = localize('processMemory', "Memory (MB)");
    }
    disposeTemplate(templateData) {
        // Nothing to do
    }
}
class MachineRenderer {
    constructor() {
        this.templateId = 'machine';
    }
    renderTemplate(container) {
        return createRow(container);
    }
    renderElement(node, index, templateData) {
        templateData.name.textContent = node.element.name;
    }
    disposeTemplate(templateData) {
        // Nothing to do
    }
}
class ErrorRenderer {
    constructor() {
        this.templateId = 'error';
    }
    renderTemplate(container) {
        return createRow(container);
    }
    renderElement(node, index, templateData) {
        templateData.name.textContent = node.element.errorMessage;
    }
    disposeTemplate(templateData) {
        // Nothing to do
    }
}
let ProcessItemHover = class ProcessItemHover extends Disposable {
    constructor(container, hoverService) {
        super();
        this.content = '';
        this.hover = this._register(hoverService.setupManagedHover(getDefaultHoverDelegate('mouse'), container, this.content));
    }
    update(content) {
        if (this.content !== content) {
            this.content = content;
            this.hover.update(content);
        }
    }
};
ProcessItemHover = __decorate([
    __param(1, IHoverService)
], ProcessItemHover);
let ProcessRenderer = class ProcessRenderer {
    constructor(model, hoverService) {
        this.model = model;
        this.hoverService = hoverService;
        this.templateId = 'process';
    }
    renderTemplate(container) {
        const row = createRow(container);
        return {
            name: row.name,
            cpu: row.cpu,
            memory: row.memory,
            pid: row.pid,
            hover: new ProcessItemHover(row.name, this.hoverService)
        };
    }
    renderElement(node, index, templateData) {
        const { element } = node;
        const pid = element.pid.toFixed(0);
        templateData.name.textContent = this.model.getName(element.pid, element.name);
        templateData.cpu.textContent = element.load.toFixed(0);
        templateData.memory.textContent = (element.mem / ByteSize.MB).toFixed(0);
        templateData.pid.textContent = pid;
        templateData.pid.parentElement.id = `pid-${pid}`;
        templateData.hover?.update(element.cmd);
    }
    disposeTemplate(templateData) {
        templateData.hover?.dispose();
    }
};
ProcessRenderer = __decorate([
    __param(1, IHoverService)
], ProcessRenderer);
class ProcessAccessibilityProvider {
    getWidgetAriaLabel() {
        return localize('processExplorer', "Process Explorer");
    }
    getAriaLabel(element) {
        if (isProcessItem(element) || isMachineProcessInformation(element)) {
            return element.name;
        }
        if (isRemoteDiagnosticError(element)) {
            return element.hostName;
        }
        return null;
    }
}
class ProcessIdentityProvider {
    getId(element) {
        if (isProcessItem(element)) {
            return element.pid.toString();
        }
        if (isRemoteDiagnosticError(element)) {
            return element.hostName;
        }
        if (isProcessInformation(element)) {
            return 'processes';
        }
        if (isMachineProcessInformation(element)) {
            return element.name;
        }
        return 'header';
    }
}
//#endregion
let ProcessExplorerControl = class ProcessExplorerControl extends Disposable {
    constructor(instantiationService, productService, contextMenuService, commandService, clipboardService) {
        super();
        this.instantiationService = instantiationService;
        this.productService = productService;
        this.contextMenuService = contextMenuService;
        this.commandService = commandService;
        this.clipboardService = clipboardService;
        this.dimensions = undefined;
        this.delayer = this._register(new Delayer(1000));
        this.model = new ProcessExplorerModel(this.productService);
    }
    create(container) {
        this.createProcessTree(container);
        this.update();
    }
    createProcessTree(container) {
        container.classList.add('process-explorer');
        container.id = 'process-explorer';
        const renderers = [
            this.instantiationService.createInstance(ProcessRenderer, this.model),
            new ProcessHeaderTreeRenderer(),
            new MachineRenderer(),
            new ErrorRenderer()
        ];
        this.tree = this._register(this.instantiationService.createInstance((WorkbenchDataTree), 'processExplorer', container, new ProcessListDelegate(), renderers, new ProcessTreeDataSource(), {
            accessibilityProvider: new ProcessAccessibilityProvider(),
            identityProvider: new ProcessIdentityProvider(),
            expandOnlyOnTwistieClick: true,
            renderIndentGuides: RenderIndentGuides.OnHover
        }));
        this._register(this.tree.onKeyDown(e => this.onTreeKeyDown(e)));
        this._register(this.tree.onContextMenu(e => this.onTreeContextMenu(container, e)));
        this.tree.setInput(this.model);
        this.layoutTree();
    }
    async onTreeKeyDown(e) {
        const event = new StandardKeyboardEvent(e);
        if (event.keyCode === 35 /* KeyCode.KeyE */ && event.altKey) {
            const selectionPids = this.getSelectedPids();
            await Promise.all(selectionPids.map(pid => this.killProcess?.(pid, 'SIGTERM')));
        }
    }
    onTreeContextMenu(container, e) {
        if (!isProcessItem(e.element)) {
            return;
        }
        const item = e.element;
        const pid = Number(item.pid);
        const actions = [];
        if (typeof this.killProcess === 'function') {
            actions.push(toAction({ id: 'killProcess', label: localize('killProcess', "Kill Process"), run: () => this.killProcess?.(pid, 'SIGTERM') }));
            actions.push(toAction({ id: 'forceKillProcess', label: localize('forceKillProcess', "Force Kill Process"), run: () => this.killProcess?.(pid, 'SIGKILL') }));
            actions.push(new Separator());
        }
        actions.push(toAction({
            id: 'copy',
            label: localize('copy', "Copy"),
            run: () => {
                const selectionPids = this.getSelectedPids();
                if (!selectionPids?.includes(pid)) {
                    selectionPids.length = 0; // If the selection does not contain the right clicked item, copy the right clicked item only.
                    selectionPids.push(pid);
                }
                // eslint-disable-next-line no-restricted-syntax
                const rows = selectionPids?.map(e => getDocument(container).getElementById(`pid-${e}`)).filter(e => !!e);
                if (rows) {
                    const text = rows.map(e => e.innerText).filter(e => !!e);
                    this.clipboardService.writeText(text.join('\n'));
                }
            }
        }));
        actions.push(toAction({
            id: 'copyAll',
            label: localize('copyAll', "Copy All"),
            run: () => {
                // eslint-disable-next-line no-restricted-syntax
                const processList = getDocument(container).getElementById('process-explorer');
                if (processList) {
                    this.clipboardService.writeText(processList.innerText);
                }
            }
        }));
        if (this.isDebuggable(item.cmd)) {
            actions.push(new Separator());
            actions.push(toAction({ id: 'debug', label: localize('debug', "Debug"), run: () => this.attachTo(item) }));
        }
        this.contextMenuService.showContextMenu({
            getAnchor: () => e.anchor,
            getActions: () => actions
        });
    }
    isDebuggable(cmd) {
        if (isWeb) {
            return false;
        }
        const matches = DEBUG_FLAGS_PATTERN.exec(cmd);
        return (matches && matches.groups.port !== '0') || cmd.indexOf('node ') >= 0 || cmd.indexOf('node.exe') >= 0;
    }
    attachTo(item) {
        const config = {
            type: 'node',
            request: 'attach',
            name: `process ${item.pid}`
        };
        let matches = DEBUG_FLAGS_PATTERN.exec(item.cmd);
        if (matches) {
            config.port = Number(matches.groups.port);
        }
        else {
            config.processId = String(item.pid); // no port -> try to attach via pid (send SIGUSR1)
        }
        // a debug-port=n or inspect-port=n overrides the port
        matches = DEBUG_PORT_PATTERN.exec(item.cmd);
        if (matches) {
            config.port = Number(matches.groups.port); // override port
        }
        this.commandService.executeCommand('debug.startFromConfig', config);
    }
    getSelectedPids() {
        return coalesce(this.tree?.getSelection()?.map(e => {
            if (!isProcessItem(e)) {
                return undefined;
            }
            return e.pid;
        }) ?? []);
    }
    async update() {
        const { processes, pidToNames } = await this.resolveProcesses();
        this.model.update(processes, pidToNames);
        this.tree?.updateChildren();
        this.layoutTree();
        this.delayer.trigger(() => this.update());
    }
    focus() {
        this.tree?.domFocus();
    }
    layout(dimension) {
        this.dimensions = dimension;
        this.layoutTree();
    }
    layoutTree() {
        if (this.dimensions && this.tree) {
            this.tree.layout(this.dimensions.height, this.dimensions.width);
        }
    }
};
ProcessExplorerControl = __decorate([
    __param(0, IInstantiationService),
    __param(1, IProductService),
    __param(2, IContextMenuService),
    __param(3, ICommandService),
    __param(4, IClipboardService)
], ProcessExplorerControl);
export { ProcessExplorerControl };
let ProcessExplorerModel = class ProcessExplorerModel {
    constructor(productService) {
        this.productService = productService;
        this.processes = { processRoots: [] };
        this.mapPidToName = new Map();
    }
    update(processRoots, pidToNames) {
        // PID to Names
        this.mapPidToName.clear();
        for (const [pid, name] of pidToNames) {
            this.mapPidToName.set(pid, name);
        }
        // Processes
        processRoots.forEach((info, index) => {
            if (isProcessItem(info.rootProcess)) {
                info.rootProcess.name = index === 0 ? this.productService.applicationName : 'remote-server';
            }
        });
        this.processes = { processRoots };
    }
    getName(pid, fallback) {
        return this.mapPidToName.get(pid) ?? fallback;
    }
};
ProcessExplorerModel = __decorate([
    __param(0, IProductService)
], ProcessExplorerModel);
let BrowserProcessExplorerControl = class BrowserProcessExplorerControl extends ProcessExplorerControl {
    constructor(container, instantiationService, productService, contextMenuService, commandService, clipboardService, remoteAgentService, labelService) {
        super(instantiationService, productService, contextMenuService, commandService, clipboardService);
        this.remoteAgentService = remoteAgentService;
        this.labelService = labelService;
        this.create(container);
    }
    async resolveProcesses() {
        const connection = this.remoteAgentService.getConnection();
        if (!connection) {
            return { pidToNames: [], processes: [] };
        }
        const processes = [];
        const hostName = this.labelService.getHostLabel(Schemas.vscodeRemote, connection.remoteAuthority);
        const result = await this.remoteAgentService.getDiagnosticInfo({ includeProcesses: true });
        if (result) {
            if (isRemoteDiagnosticError(result)) {
                processes.push({ name: result.hostName, rootProcess: result });
            }
            else if (result.processes) {
                processes.push({ name: hostName, rootProcess: result.processes });
            }
        }
        return { pidToNames: [], processes };
    }
};
BrowserProcessExplorerControl = __decorate([
    __param(1, IInstantiationService),
    __param(2, IProductService),
    __param(3, IContextMenuService),
    __param(4, ICommandService),
    __param(5, IClipboardService),
    __param(6, IRemoteAgentService),
    __param(7, ILabelService)
], BrowserProcessExplorerControl);
export { BrowserProcessExplorerControl };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvY2Vzc0V4cGxvcmVyQ29udHJvbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9wcm9jZXNzRXhwbG9yZXIvYnJvd3Nlci9wcm9jZXNzRXhwbG9yZXJDb250cm9sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sNkJBQTZCLENBQUM7QUFDckMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFhLFdBQVcsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3BGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBSWxGLE9BQU8sRUFBMEIsdUJBQXVCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUN6SCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFdEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRW5HLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN4RixPQUFPLEVBQVcsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzlGLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbkYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDdEYs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