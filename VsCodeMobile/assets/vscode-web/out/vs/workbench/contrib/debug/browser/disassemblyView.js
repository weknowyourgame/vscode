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
var DisassemblyView_1, BreakpointRenderer_1, InstructionRenderer_1;
import { PixelRatio } from '../../../../base/browser/pixelRatio.js';
import { $, addStandardDisposableListener, append } from '../../../../base/browser/dom.js';
import { binarySearch2 } from '../../../../base/common/arrays.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, dispose } from '../../../../base/common/lifecycle.js';
import { isAbsolute } from '../../../../base/common/path.js';
import { URI } from '../../../../base/common/uri.js';
import { applyFontInfo } from '../../../../editor/browser/config/domFontInfo.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { createBareFontInfoFromRawSettings } from '../../../../editor/common/config/fontInfoFromSettings.js';
import { Range } from '../../../../editor/common/core/range.js';
import { StringBuilder } from '../../../../editor/common/core/stringBuilder.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchTable } from '../../../../platform/list/browser/listService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { editorBackground } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { focusedStackFrameColor, topStackFrameColor } from './callStackEditorContribution.js';
import * as icons from './debugIcons.js';
import { CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST, DISASSEMBLY_VIEW_ID, IDebugService } from '../common/debug.js';
import { InstructionBreakpoint } from '../common/debugModel.js';
import { getUriFromSource } from '../common/debugSource.js';
import { isUriString, sourcesEqual } from '../common/debugUtils.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IMenuService, MenuId } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { COPY_ADDRESS_ID, COPY_ADDRESS_LABEL } from '../../../../workbench/contrib/debug/browser/debugCommands.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { getFlatContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
// Special entry as a placeholer when disassembly is not available
const disassemblyNotAvailable = {
    allowBreakpoint: false,
    isBreakpointSet: false,
    isBreakpointEnabled: false,
    instructionReference: '',
    instructionOffset: 0,
    instructionReferenceOffset: 0,
    address: 0n,
    instruction: {
        address: '-1',
        instruction: localize('instructionNotAvailable', "Disassembly not available.")
    },
};
let DisassemblyView = class DisassemblyView extends EditorPane {
    static { DisassemblyView_1 = this; }
    static { this.NUM_INSTRUCTIONS_TO_LOAD = 50; }
    constructor(group, telemetryService, themeService, storageService, _configurationService, _instantiationService, _debugService, _contextMenuService, menuService, contextKeyService) {
        super(DISASSEMBLY_VIEW_ID, group, telemetryService, themeService, storageService);
        this._configurationService = _configurationService;
        this._instantiationService = _instantiationService;
        this._debugService = _debugService;
        this._contextMenuService = _contextMenuService;
        this._instructionBpList = [];
        this._enableSourceCodeRender = true;
        this._loadingLock = false;
        this._referenceToMemoryAddress = new Map();
        this.menu = menuService.createMenu(MenuId.DebugDisassemblyContext, contextKeyService);
        this._register(this.menu);
        this._disassembledInstructions = undefined;
        this._onDidChangeStackFrame = this._register(new Emitter({ leakWarningThreshold: 1000 }));
        this._previousDebuggingState = _debugService.state;
        this._register(_configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('debug')) {
                // show/hide source code requires changing height which WorkbenchTable doesn't support dynamic height, thus force a total reload.
                const newValue = this._configurationService.getValue('debug').disassemblyView.showSourceCode;
                if (this._enableSourceCodeRender !== newValue) {
                    this._enableSourceCodeRender = newValue;
                    // todo: trigger rerender
                }
                else {
                    this._disassembledInstructions?.rerender();
                }
            }
        }));
    }
    get fontInfo() {
        if (!this._fontInfo) {
            this._fontInfo = this.createFontInfo();
            this._register(this._configurationService.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('editor')) {
                    this._fontInfo = this.createFontInfo();
                }
            }));
        }
        return this._fontInfo;
    }
    createFontInfo() {
        return createBareFontInfoFromRawSettings(this._configurationService.getValue('editor'), PixelRatio.getInstance(this.window).value);
    }
    get currentInstructionAddresses() {
        return this._debugService.getModel().getSessions(false).
            map(session => session.getAllThreads()).
            reduce((prev, curr) => prev.concat(curr), []).
            map(thread => thread.getTopStackFrame()).
            map(frame => frame?.instructionPointerReference).
            map(ref => ref ? this.getReferenceAddress(ref) : undefined);
    }
    // Instruction reference of the top stack frame of the focused stack
    get focusedCurrentInstructionReference() {
        return this._debugService.getViewModel().focusedStackFrame?.thread.getTopStackFrame()?.instructionPointerReference;
    }
    get focusedCurrentInstructionAddress() {
        const ref = this.focusedCurrentInstructionReference;
        return ref ? this.getReferenceAddress(ref) : undefined;
    }
    get focusedInstructionReference() {
        return this._debugService.getViewModel().focusedStackFrame?.instructionPointerReference;
    }
    get focusedInstructionAddress() {
        const ref = this.focusedInstructionReference;
        return ref ? this.getReferenceAddress(ref) : undefined;
    }
    get isSourceCodeRender() { return this._enableSourceCodeRender; }
    get debugSession() {
        return this._debugService.getViewModel().focusedSession;
    }
    get onDidChangeStackFrame() { return this._onDidChangeStackFrame.event; }
    get focusedAddressAndOffset() {
        const element = this._disassembledInstructions?.getFocusedElements()[0];
        if (!element) {
            return undefined;
        }
        return this.getAddressAndOffset(element);
    }
    getAddressAndOffset(element) {
        const reference = element.instructionReference;
        const offset = Number(element.address - this.getReferenceAddress(reference));
        return { reference, offset, address: element.address };
    }
    createEditor(parent) {
        this._enableSourceCodeRender = this._configurationService.getValue('debug').disassemblyView.showSourceCode;
        const lineHeight = this.fontInfo.lineHeight;
        const thisOM = this;
        const delegate = new class {
            constructor() {
                this.headerRowHeight = 0; // No header
            }
            getHeight(row) {
                if (thisOM.isSourceCodeRender && row.showSourceLocation && row.instruction.location?.path && row.instruction.line) {
                    // instruction line + source lines
                    if (row.instruction.endLine) {
                        return lineHeight * Math.max(2, (row.instruction.endLine - row.instruction.line + 2));
                    }
                    else {
                        // source is only a single line.
                        return lineHeight * 2;
                    }
                }
                // just instruction line
                return lineHeight;
            }
        };
        const instructionRenderer = this._register(this._instantiationService.createInstance(InstructionRenderer, this));
        this._disassembledInstructions = this._register(this._instantiationService.createInstance(WorkbenchTable, 'DisassemblyView', parent, delegate, [
            {
                label: '',
                tooltip: '',
                weight: 0,
                minimumWidth: this.fontInfo.lineHeight,
                maximumWidth: this.fontInfo.lineHeight,
                templateId: BreakpointRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
            {
                label: localize('disassemblyTableColumnLabel', "instructions"),
                tooltip: '',
                weight: 0.3,
                templateId: InstructionRenderer.TEMPLATE_ID,
                project(row) { return row; }
            },
        ], [
            this._instantiationService.createInstance(BreakpointRenderer, this),
            instructionRenderer,
        ], {
            identityProvider: { getId: (e) => e.instruction.address },
            horizontalScrolling: false,
            overrideStyles: {
                listBackground: editorBackground
            },
            multipleSelectionSupport: false,
            setRowLineHeight: false,
            openOnSingleClick: false,
            accessibilityProvider: new AccessibilityProvider(),
            mouseSupport: false
        }));
        this._disassembledInstructions.domNode.classList.add('disassembly-view');
        if (this.focusedInstructionReference) {
            this.reloadDisassembly(this.focusedInstructionReference, 0);
        }
        this._register(this._disassembledInstructions.onDidScroll(e => {
            if (this._disassembledInstructions?.row(0) === disassemblyNotAvailable) {
                return;
            }
            if (this._loadingLock) {
                return;
            }
            if (e.oldScrollTop > e.scrollTop && e.scrollTop < e.height) {
                this._loadingLock = true;
                const prevTop = Math.floor(e.scrollTop / this.fontInfo.lineHeight);
                this.scrollUp_LoadDisassembledInstructions(DisassemblyView_1.NUM_INSTRUCTIONS_TO_LOAD).then((loaded) => {
                    if (loaded > 0) {
                        this._disassembledInstructions.reveal(prevTop + loaded, 0);
                    }
                }).finally(() => { this._loadingLock = false; });
            }
            else if (e.oldScrollTop < e.scrollTop && e.scrollTop + e.height > e.scrollHeight - e.height) {
                this._loadingLock = true;
                this.scrollDown_LoadDisassembledInstructions(DisassemblyView_1.NUM_INSTRUCTIONS_TO_LOAD).finally(() => { this._loadingLock = false; });
            }
        }));
        this._register(this._disassembledInstructions.onContextMenu(e => this.onContextMenu(e)));
        this._register(this._debugService.getViewModel().onDidFocusStackFrame(({ stackFrame }) => {
            if (this._disassembledInstructions && stackFrame?.instructionPointerReference) {
                this.goToInstructionAndOffset(stackFrame.instructionPointerReference, 0);
            }
            this._onDidChangeStackFrame.fire();
        }));
        // refresh breakpoints view
        this._register(this._debugService.getModel().onDidChangeBreakpoints(bpEvent => {
            if (bpEvent && this._disassembledInstructions) {
                // draw viewable BP
                let changed = false;
                bpEvent.added?.forEach((bp) => {
                    if (bp instanceof InstructionBreakpoint) {
                        const index = this.getIndexFromReferenceAndOffset(bp.instructionReference, bp.offset);
                        if (index >= 0) {
                            this._disassembledInstructions.row(index).isBreakpointSet = true;
                            this._disassembledInstructions.row(index).isBreakpointEnabled = bp.enabled;
                            changed = true;
                        }
                    }
                });
                bpEvent.removed?.forEach((bp) => {
                    if (bp instanceof InstructionBreakpoint) {
                        const index = this.getIndexFromReferenceAndOffset(bp.instructionReference, bp.offset);
                        if (index >= 0) {
                            this._disassembledInstructions.row(index).isBreakpointSet = false;
                            changed = true;
                        }
                    }
                });
                bpEvent.changed?.forEach((bp) => {
                    if (bp instanceof InstructionBreakpoint) {
                        const index = this.getIndexFromReferenceAndOffset(bp.instructionReference, bp.offset);
                        if (index >= 0) {
                            if (this._disassembledInstructions.row(index).isBreakpointEnabled !== bp.enabled) {
                                this._disassembledInstructions.row(index).isBreakpointEnabled = bp.enabled;
                                changed = true;
                            }
                        }
                    }
                });
                // get an updated list so that items beyond the current range would render when reached.
                this._instructionBpList = this._debugService.getModel().getInstructionBreakpoints();
                // breakpoints restored from a previous session can be based on memory
                // references that may no longer exist in the current session. Request
                // those instructions to be loaded so the BP can be displayed.
                for (const bp of this._instructionBpList) {
                    this.primeMemoryReference(bp.instructionReference);
                }
                if (changed) {
                    this._onDidChangeStackFrame.fire();
                }
            }
        }));
        this._register(this._debugService.onDidChangeState(e => {
            if ((e === 3 /* State.Running */ || e === 2 /* State.Stopped */) &&
                (this._previousDebuggingState !== 3 /* State.Running */ && this._previousDebuggingState !== 2 /* State.Stopped */)) {
                // Just started debugging, clear the view
                this.clear();
                this._enableSourceCodeRender = this._configurationService.getValue('debug').disassemblyView.showSourceCode;
            }
            this._previousDebuggingState = e;
            this._onDidChangeStackFrame.fire();
        }));
    }
    layout(dimension) {
        this._disassembledInstructions?.layout(dimension.height);
    }
    async goToInstructionAndOffset(instructionReference, offset, focus) {
        let addr = this._referenceToMemoryAddress.get(instructionReference);
        if (addr === undefined) {
            await this.loadDisassembledInstructions(instructionReference, 0, -DisassemblyView_1.NUM_INSTRUCTIONS_TO_LOAD, DisassemblyView_1.NUM_INSTRUCTIONS_TO_LOAD * 2);
            addr = this._referenceToMemoryAddress.get(instructionReference);
        }
        if (addr) {
            this.goToAddress(addr + BigInt(offset), focus);
        }
    }
    /** Gets the address associated with the instruction reference. */
    getReferenceAddress(instructionReference) {
        return this._referenceToMemoryAddress.get(instructionReference);
    }
    /**
     * Go to the address provided. If no address is provided, reveal the address of the currently focused stack frame. Returns false if that address is not available.
     */
    goToAddress(address, focus) {
        if (!this._disassembledInstructions) {
            return false;
        }
        if (!address) {
            return false;
        }
        const index = this.getIndexFromAddress(address);
        if (index >= 0) {
            this._disassembledInstructions.reveal(index);
            if (focus) {
                this._disassembledInstructions.domFocus();
                this._disassembledInstructions.setFocus([index]);
            }
            return true;
        }
        return false;
    }
    async scrollUp_LoadDisassembledInstructions(instructionCount) {
        const first = this._disassembledInstructions?.row(0);
        if (first) {
            return this.loadDisassembledInstructions(first.instructionReference, first.instructionReferenceOffset, first.instructionOffset - instructionCount, instructionCount);
        }
        return 0;
    }
    async scrollDown_LoadDisassembledInstructions(instructionCount) {
        const last = this._disassembledInstructions?.row(this._disassembledInstructions?.length - 1);
        if (last) {
            return this.loadDisassembledInstructions(last.instructionReference, last.instructionReferenceOffset, last.instructionOffset + 1, instructionCount);
        }
        return 0;
    }
    /**
     * Sets the memory reference address. We don't just loadDisassembledInstructions
     * for this, since we can't really deal with discontiguous ranges (we can't
     * detect _if_ a range is discontiguous since we don't know how much memory
     * comes between instructions.)
     */
    async primeMemoryReference(instructionReference) {
        if (this._referenceToMemoryAddress.has(instructionReference)) {
            return true;
        }
        const s = await this.debugSession?.disassemble(instructionReference, 0, 0, 1);
        if (s && s.length > 0) {
            try {
                this._referenceToMemoryAddress.set(instructionReference, BigInt(s[0].address));
                return true;
            }
            catch {
                return false;
            }
        }
        return false;
    }
    /** Loads disasembled instructions. Returns the number of instructions that were loaded. */
    async loadDisassembledInstructions(instructionReference, offset, instructionOffset, instructionCount) {
        const session = this.debugSession;
        const resultEntries = await session?.disassemble(instructionReference, offset, instructionOffset, instructionCount);
        // Ensure we always load the baseline instructions so we know what address the instructionReference refers to.
        if (!this._referenceToMemoryAddress.has(instructionReference) && instructionOffset !== 0) {
            await this.loadDisassembledInstructions(instructionReference, 0, 0, DisassemblyView_1.NUM_INSTRUCTIONS_TO_LOAD);
        }
        if (session && resultEntries && this._disassembledInstructions) {
            const newEntries = [];
            let lastLocation;
            let lastLine;
            for (let i = 0; i < resultEntries.length; i++) {
                const instruction = resultEntries[i];
                const thisInstructionOffset = instructionOffset + i;
                // Forward fill the missing location as detailed in the DAP spec.
                if (instruction.location) {
                    lastLocation = instruction.location;
                    lastLine = undefined;
                }
                if (instruction.line) {
                    const currentLine = {
                        startLineNumber: instruction.line,
                        startColumn: instruction.column ?? 0,
                        endLineNumber: instruction.endLine ?? instruction.line,
                        endColumn: instruction.endColumn ?? 0,
                    };
                    // Add location only to the first unique range. This will give the appearance of grouping of instructions.
                    if (!Range.equalsRange(currentLine, lastLine ?? null)) {
                        lastLine = currentLine;
                        instruction.location = lastLocation;
                    }
                }
                let address;
                try {
                    address = BigInt(instruction.address);
                }
                catch {
                    console.error(`Could not parse disassembly address ${instruction.address} (in ${JSON.stringify(instruction)})`);
                    continue;
                }
                if (address === -1n) {
                    // Ignore invalid instructions returned by the adapter.
                    continue;
                }
                const entry = {
                    allowBreakpoint: true,
                    isBreakpointSet: false,
                    isBreakpointEnabled: false,
                    instructionReference,
                    instructionReferenceOffset: offset,
                    instructionOffset: thisInstructionOffset,
                    instruction,
                    address,
                };
                newEntries.push(entry);
                // if we just loaded the first instruction for this reference, mark its address.
                if (offset === 0 && thisInstructionOffset === 0) {
                    this._referenceToMemoryAddress.set(instructionReference, address);
                }
            }
            if (newEntries.length === 0) {
                return 0;
            }
            const refBaseAddress = this._referenceToMemoryAddress.get(instructionReference);
            const bps = this._instructionBpList.map(p => {
                const base = this._referenceToMemoryAddress.get(p.instructionReference);
                if (!base) {
                    return undefined;
                }
                return {
                    enabled: p.enabled,
                    address: base + BigInt(p.offset || 0),
                };
            });
            if (refBaseAddress !== undefined) {
                for (const entry of newEntries) {
                    const bp = bps.find(p => p?.address === entry.address);
                    if (bp) {
                        entry.isBreakpointSet = true;
                        entry.isBreakpointEnabled = bp.enabled;
                    }
                }
            }
            const da = this._disassembledInstructions;
            if (da.length === 1 && this._disassembledInstructions.row(0) === disassemblyNotAvailable) {
                da.splice(0, 1);
            }
            const firstAddr = newEntries[0].address;
            const lastAddr = newEntries[newEntries.length - 1].address;
            const startN = binarySearch2(da.length, i => Number(da.row(i).address - firstAddr));
            const start = startN < 0 ? ~startN : startN;
            const endN = binarySearch2(da.length, i => Number(da.row(i).address - lastAddr));
            const end = endN < 0 ? ~endN : endN + 1;
            const toDelete = end - start;
            // Go through everything we're about to add, and only show the source
            // location if it's different from the previous one, "grouping" instructions by line
            let lastLocated;
            for (let i = start - 1; i >= 0; i--) {
                const { instruction } = da.row(i);
                if (instruction.location && instruction.line !== undefined) {
                    lastLocated = instruction;
                    break;
                }
            }
            const shouldShowLocation = (instruction) => instruction.line !== undefined && instruction.location !== undefined &&
                (!lastLocated || !sourcesEqual(instruction.location, lastLocated.location) || instruction.line !== lastLocated.line);
            for (const entry of newEntries) {
                if (shouldShowLocation(entry.instruction)) {
                    entry.showSourceLocation = true;
                    lastLocated = entry.instruction;
                }
            }
            da.splice(start, toDelete, newEntries);
            return newEntries.length - toDelete;
        }
        return 0;
    }
    getIndexFromReferenceAndOffset(instructionReference, offset) {
        const addr = this._referenceToMemoryAddress.get(instructionReference);
        if (addr === undefined) {
            return -1;
        }
        return this.getIndexFromAddress(addr + BigInt(offset));
    }
    getIndexFromAddress(address) {
        const disassembledInstructions = this._disassembledInstructions;
        if (disassembledInstructions && disassembledInstructions.length > 0) {
            return binarySearch2(disassembledInstructions.length, index => {
                const row = disassembledInstructions.row(index);
                return Number(row.address - address);
            });
        }
        return -1;
    }
    /**
     * Clears the table and reload instructions near the target address
     */
    reloadDisassembly(instructionReference, offset) {
        if (!this._disassembledInstructions) {
            return;
        }
        this._loadingLock = true; // stop scrolling during the load.
        this.clear();
        this._instructionBpList = this._debugService.getModel().getInstructionBreakpoints();
        this.loadDisassembledInstructions(instructionReference, offset, -DisassemblyView_1.NUM_INSTRUCTIONS_TO_LOAD * 4, DisassemblyView_1.NUM_INSTRUCTIONS_TO_LOAD * 8).then(() => {
            // on load, set the target instruction in the middle of the page.
            if (this._disassembledInstructions.length > 0) {
                const targetIndex = Math.floor(this._disassembledInstructions.length / 2);
                this._disassembledInstructions.reveal(targetIndex, 0.5);
                // Always focus the target address on reload, or arrow key navigation would look terrible
                this._disassembledInstructions.domFocus();
                this._disassembledInstructions.setFocus([targetIndex]);
            }
            this._loadingLock = false;
        });
    }
    clear() {
        this._referenceToMemoryAddress.clear();
        this._disassembledInstructions?.splice(0, this._disassembledInstructions.length, [disassemblyNotAvailable]);
    }
    onContextMenu(e) {
        const actions = getFlatContextMenuActions(this.menu.getActions({ shouldForwardArgs: true }));
        this._contextMenuService.showContextMenu({
            getAnchor: () => e.anchor,
            getActions: () => actions,
            getActionsContext: () => e.element
        });
    }
};
DisassemblyView = DisassemblyView_1 = __decorate([
    __param(1, ITelemetryService),
    __param(2, IThemeService),
    __param(3, IStorageService),
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, IDebugService),
    __param(7, IContextMenuService),
    __param(8, IMenuService),
    __param(9, IContextKeyService)
], DisassemblyView);
export { DisassemblyView };
let BreakpointRenderer = class BreakpointRenderer {
    static { BreakpointRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'breakpoint'; }
    constructor(_disassemblyView, _debugService) {
        this._disassemblyView = _disassemblyView;
        this._debugService = _debugService;
        this.templateId = BreakpointRenderer_1.TEMPLATE_ID;
        this._breakpointIcon = 'codicon-' + icons.breakpoint.regular.id;
        this._breakpointDisabledIcon = 'codicon-' + icons.breakpoint.disabled.id;
        this._breakpointHintIcon = 'codicon-' + icons.debugBreakpointHint.id;
        this._debugStackframe = 'codicon-' + icons.debugStackframe.id;
        this._debugStackframeFocused = 'codicon-' + icons.debugStackframeFocused.id;
    }
    renderTemplate(container) {
        // align from the bottom so that it lines up with instruction when source code is present.
        container.style.alignSelf = 'flex-end';
        const icon = append(container, $('.codicon'));
        icon.style.display = 'flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.height = this._disassemblyView.fontInfo.lineHeight + 'px';
        const currentElement = { element: undefined };
        const disposables = [
            this._disassemblyView.onDidChangeStackFrame(() => this.rerenderDebugStackframe(icon, currentElement.element)),
            addStandardDisposableListener(container, 'mouseover', () => {
                if (currentElement.element?.allowBreakpoint) {
                    icon.classList.add(this._breakpointHintIcon);
                }
            }),
            addStandardDisposableListener(container, 'mouseout', () => {
                if (currentElement.element?.allowBreakpoint) {
                    icon.classList.remove(this._breakpointHintIcon);
                }
            }),
            addStandardDisposableListener(container, 'click', () => {
                if (currentElement.element?.allowBreakpoint) {
                    // click show hint while waiting for BP to resolve.
                    icon.classList.add(this._breakpointHintIcon);
                    const reference = currentElement.element.instructionReference;
                    const offset = Number(currentElement.element.address - this._disassemblyView.getReferenceAddress(reference));
                    if (currentElement.element.isBreakpointSet) {
                        this._debugService.removeInstructionBreakpoints(reference, offset);
                    }
                    else if (currentElement.element.allowBreakpoint && !currentElement.element.isBreakpointSet) {
                        this._debugService.addInstructionBreakpoint({ instructionReference: reference, offset, address: currentElement.element.address, canPersist: false });
                    }
                }
            })
        ];
        return { currentElement, icon, disposables };
    }
    renderElement(element, index, templateData) {
        templateData.currentElement.element = element;
        this.rerenderDebugStackframe(templateData.icon, element);
    }
    disposeTemplate(templateData) {
        dispose(templateData.disposables);
        templateData.disposables = [];
    }
    rerenderDebugStackframe(icon, element) {
        if (element?.address === this._disassemblyView.focusedCurrentInstructionAddress) {
            icon.classList.add(this._debugStackframe);
        }
        else if (element?.address === this._disassemblyView.focusedInstructionAddress) {
            icon.classList.add(this._debugStackframeFocused);
        }
        else {
            icon.classList.remove(this._debugStackframe);
            icon.classList.remove(this._debugStackframeFocused);
        }
        icon.classList.remove(this._breakpointHintIcon);
        if (element?.isBreakpointSet) {
            if (element.isBreakpointEnabled) {
                icon.classList.add(this._breakpointIcon);
                icon.classList.remove(this._breakpointDisabledIcon);
            }
            else {
                icon.classList.remove(this._breakpointIcon);
                icon.classList.add(this._breakpointDisabledIcon);
            }
        }
        else {
            icon.classList.remove(this._breakpointIcon);
            icon.classList.remove(this._breakpointDisabledIcon);
        }
    }
};
BreakpointRenderer = BreakpointRenderer_1 = __decorate([
    __param(1, IDebugService)
], BreakpointRenderer);
let InstructionRenderer = class InstructionRenderer extends Disposable {
    static { InstructionRenderer_1 = this; }
    static { this.TEMPLATE_ID = 'instruction'; }
    static { this.INSTRUCTION_ADDR_MIN_LENGTH = 25; }
    static { this.INSTRUCTION_BYTES_MIN_LENGTH = 30; }
    constructor(_disassemblyView, themeService, editorService, textModelService, uriService, logService) {
        super();
        this._disassemblyView = _disassemblyView;
        this.editorService = editorService;
        this.textModelService = textModelService;
        this.uriService = uriService;
        this.logService = logService;
        this.templateId = InstructionRenderer_1.TEMPLATE_ID;
        this._topStackFrameColor = themeService.getColorTheme().getColor(topStackFrameColor);
        this._focusedStackFrameColor = themeService.getColorTheme().getColor(focusedStackFrameColor);
        this._register(themeService.onDidColorThemeChange(e => {
            this._topStackFrameColor = e.getColor(topStackFrameColor);
            this._focusedStackFrameColor = e.getColor(focusedStackFrameColor);
        }));
    }
    renderTemplate(container) {
        const sourcecode = append(container, $('.sourcecode'));
        const instruction = append(container, $('.instruction'));
        this.applyFontInfo(sourcecode);
        this.applyFontInfo(instruction);
        const currentElement = { element: undefined };
        const cellDisposable = [];
        const disposables = [
            this._disassemblyView.onDidChangeStackFrame(() => this.rerenderBackground(instruction, sourcecode, currentElement.element)),
            addStandardDisposableListener(sourcecode, 'dblclick', () => this.openSourceCode(currentElement.element?.instruction)),
        ];
        return { currentElement, instruction, sourcecode, cellDisposable, disposables };
    }
    renderElement(element, index, templateData) {
        this.renderElementInner(element, index, templateData);
    }
    async renderElementInner(element, index, templateData) {
        templateData.currentElement.element = element;
        const instruction = element.instruction;
        templateData.sourcecode.innerText = '';
        const sb = new StringBuilder(1000);
        if (this._disassemblyView.isSourceCodeRender && element.showSourceLocation && instruction.location?.path && instruction.line !== undefined) {
            const sourceURI = this.getUriFromSource(instruction);
            if (sourceURI) {
                let textModel = undefined;
                const sourceSB = new StringBuilder(10000);
                const ref = await this.textModelService.createModelReference(sourceURI);
                if (templateData.currentElement.element !== element) {
                    return; // avoid a race, #192831
                }
                textModel = ref.object.textEditorModel;
                templateData.cellDisposable.push(ref);
                // templateData could have moved on during async.  Double check if it is still the same source.
                if (textModel && templateData.currentElement.element === element) {
                    let lineNumber = instruction.line;
                    while (lineNumber && lineNumber >= 1 && lineNumber <= textModel.getLineCount()) {
                        const lineContent = textModel.getLineContent(lineNumber);
                        sourceSB.appendString(`  ${lineNumber}: `);
                        sourceSB.appendString(lineContent + '\n');
                        if (instruction.endLine && lineNumber < instruction.endLine) {
                            lineNumber++;
                            continue;
                        }
                        break;
                    }
                    templateData.sourcecode.innerText = sourceSB.build();
                }
            }
        }
        let spacesToAppend = 10;
        if (instruction.address !== '-1') {
            sb.appendString(instruction.address);
            if (instruction.address.length < InstructionRenderer_1.INSTRUCTION_ADDR_MIN_LENGTH) {
                spacesToAppend = InstructionRenderer_1.INSTRUCTION_ADDR_MIN_LENGTH - instruction.address.length;
            }
            for (let i = 0; i < spacesToAppend; i++) {
                sb.appendString(' ');
            }
        }
        if (instruction.instructionBytes) {
            sb.appendString(instruction.instructionBytes);
            spacesToAppend = 10;
            if (instruction.instructionBytes.length < InstructionRenderer_1.INSTRUCTION_BYTES_MIN_LENGTH) {
                spacesToAppend = InstructionRenderer_1.INSTRUCTION_BYTES_MIN_LENGTH - instruction.instructionBytes.length;
            }
            for (let i = 0; i < spacesToAppend; i++) {
                sb.appendString(' ');
            }
        }
        sb.appendString(instruction.instruction);
        templateData.instruction.innerText = sb.build();
        this.rerenderBackground(templateData.instruction, templateData.sourcecode, element);
    }
    disposeElement(element, index, templateData) {
        dispose(templateData.cellDisposable);
        templateData.cellDisposable = [];
    }
    disposeTemplate(templateData) {
        dispose(templateData.disposables);
        templateData.disposables = [];
    }
    rerenderBackground(instruction, sourceCode, element) {
        if (element && this._disassemblyView.currentInstructionAddresses.includes(element.address)) {
            instruction.style.background = this._topStackFrameColor?.toString() || 'transparent';
        }
        else if (element?.address === this._disassemblyView.focusedInstructionAddress) {
            instruction.style.background = this._focusedStackFrameColor?.toString() || 'transparent';
        }
        else {
            instruction.style.background = 'transparent';
        }
    }
    openSourceCode(instruction) {
        if (instruction) {
            const sourceURI = this.getUriFromSource(instruction);
            const selection = instruction.endLine ? {
                startLineNumber: instruction.line,
                endLineNumber: instruction.endLine,
                startColumn: instruction.column || 1,
                endColumn: instruction.endColumn || 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */,
            } : {
                startLineNumber: instruction.line,
                endLineNumber: instruction.line,
                startColumn: instruction.column || 1,
                endColumn: instruction.endColumn || 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */,
            };
            this.editorService.openEditor({
                resource: sourceURI,
                description: localize('editorOpenedFromDisassemblyDescription', "from disassembly"),
                options: {
                    preserveFocus: false,
                    selection: selection,
                    revealIfOpened: true,
                    selectionRevealType: 1 /* TextEditorSelectionRevealType.CenterIfOutsideViewport */,
                    pinned: false,
                }
            });
        }
    }
    getUriFromSource(instruction) {
        // Try to resolve path before consulting the debugSession.
        const path = instruction.location.path;
        if (path && isUriString(path)) { // path looks like a uri
            return this.uriService.asCanonicalUri(URI.parse(path));
        }
        // assume a filesystem path
        if (path && isAbsolute(path)) {
            return this.uriService.asCanonicalUri(URI.file(path));
        }
        return getUriFromSource(instruction.location, instruction.location.path, this._disassemblyView.debugSession.getId(), this.uriService, this.logService);
    }
    applyFontInfo(element) {
        applyFontInfo(element, this._disassemblyView.fontInfo);
        element.style.whiteSpace = 'pre';
    }
};
InstructionRenderer = InstructionRenderer_1 = __decorate([
    __param(1, IThemeService),
    __param(2, IEditorService),
    __param(3, ITextModelService),
    __param(4, IUriIdentityService),
    __param(5, ILogService)
], InstructionRenderer);
class AccessibilityProvider {
    getWidgetAriaLabel() {
        return localize('disassemblyView', "Disassembly View");
    }
    getAriaLabel(element) {
        let label = '';
        const instruction = element.instruction;
        if (instruction.address !== '-1') {
            label += `${localize('instructionAddress', "Address")}: ${instruction.address}`;
        }
        if (instruction.instructionBytes) {
            label += `, ${localize('instructionBytes', "Bytes")}: ${instruction.instructionBytes}`;
        }
        label += `, ${localize(`instructionText`, "Instruction")}: ${instruction.instruction}`;
        return label;
    }
}
let DisassemblyViewContribution = class DisassemblyViewContribution {
    constructor(editorService, debugService, contextKeyService) {
        contextKeyService.bufferChangeEvents(() => {
            this._languageSupportsDisassembleRequest = CONTEXT_LANGUAGE_SUPPORTS_DISASSEMBLE_REQUEST.bindTo(contextKeyService);
        });
        const onDidActiveEditorChangeListener = () => {
            if (this._onDidChangeModelLanguage) {
                this._onDidChangeModelLanguage.dispose();
                this._onDidChangeModelLanguage = undefined;
            }
            const activeTextEditorControl = editorService.activeTextEditorControl;
            if (isCodeEditor(activeTextEditorControl)) {
                const language = activeTextEditorControl.getModel()?.getLanguageId();
                // TODO: instead of using idDebuggerInterestedInLanguage, have a specific ext point for languages
                // support disassembly
                this._languageSupportsDisassembleRequest?.set(!!language && debugService.getAdapterManager().someDebuggerInterestedInLanguage(language));
                this._onDidChangeModelLanguage = activeTextEditorControl.onDidChangeModelLanguage(e => {
                    this._languageSupportsDisassembleRequest?.set(debugService.getAdapterManager().someDebuggerInterestedInLanguage(e.newLanguage));
                });
            }
            else {
                this._languageSupportsDisassembleRequest?.set(false);
            }
        };
        onDidActiveEditorChangeListener();
        this._onDidActiveEditorChangeListener = editorService.onDidActiveEditorChange(onDidActiveEditorChangeListener);
    }
    dispose() {
        this._onDidActiveEditorChangeListener.dispose();
        this._onDidChangeModelLanguage?.dispose();
    }
};
DisassemblyViewContribution = __decorate([
    __param(0, IEditorService),
    __param(1, IDebugService),
    __param(2, IContextKeyService)
], DisassemblyViewContribution);
export { DisassemblyViewContribution };
CommandsRegistry.registerCommand({
    metadata: {
        description: COPY_ADDRESS_LABEL,
    },
    id: COPY_ADDRESS_ID,
    handler: async (accessor, entry) => {
        if (entry?.instruction?.address) {
            const clipboardService = accessor.get(IClipboardService);
            clipboardService.writeText(entry.instruction.address);
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlzYXNzZW1ibHlWaWV3LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2RlYnVnL2Jyb3dzZXIvZGlzYXNzZW1ibHlWaWV3LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDcEUsT0FBTyxFQUFFLENBQUMsRUFBYSw2QkFBNkIsRUFBRSxNQUFNLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUd0RyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxVQUFVLEVBQWUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDeEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRTdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNyRCxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDakYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxpQ0FBaUMsRUFBRSxNQUFNLDBEQUEwRCxDQUFDO0FBQzdHLE9BQU8sRUFBVSxLQUFLLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0saURBQWlELENBQUM7QUFFaEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDMUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFB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