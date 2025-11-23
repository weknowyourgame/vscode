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
import { BrowserType } from '../common/browserElements.js';
import { webContents } from 'electron';
import { IAuxiliaryWindowsMainService } from '../../auxiliaryWindow/electron-main/auxiliaryWindows.js';
import { IWindowsMainService } from '../../windows/electron-main/windows.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { Disposable } from '../../../base/common/lifecycle.js';
export const INativeBrowserElementsMainService = createDecorator('browserElementsMainService');
let NativeBrowserElementsMainService = class NativeBrowserElementsMainService extends Disposable {
    constructor(windowsMainService, auxiliaryWindowsMainService) {
        super();
        this.windowsMainService = windowsMainService;
        this.auxiliaryWindowsMainService = auxiliaryWindowsMainService;
    }
    get windowId() { throw new Error('Not implemented in electron-main'); }
    async findWebviewTarget(debuggers, windowId, browserType) {
        const { targetInfos } = await debuggers.sendCommand('Target.getTargets');
        let target = undefined;
        const matchingTarget = targetInfos.find((targetInfo) => {
            try {
                const url = new URL(targetInfo.url);
                if (browserType === BrowserType.LiveServer) {
                    return url.searchParams.get('id') && url.searchParams.get('extensionId') === 'ms-vscode.live-server';
                }
                else if (browserType === BrowserType.SimpleBrowser) {
                    return url.searchParams.get('parentId') === windowId.toString() && url.searchParams.get('extensionId') === 'vscode.simple-browser';
                }
                return false;
            }
            catch (err) {
                return false;
            }
        });
        // search for webview via search parameters
        if (matchingTarget) {
            let resultId;
            let url;
            try {
                url = new URL(matchingTarget.url);
                resultId = url.searchParams.get('id');
            }
            catch (e) {
                return undefined;
            }
            target = targetInfos.find((targetInfo) => {
                try {
                    const url = new URL(targetInfo.url);
                    const isLiveServer = browserType === BrowserType.LiveServer && url.searchParams.get('serverWindowId') === resultId;
                    const isSimpleBrowser = browserType === BrowserType.SimpleBrowser && url.searchParams.get('id') === resultId && url.searchParams.has('vscodeBrowserReqId');
                    if (isLiveServer || isSimpleBrowser) {
                        this.currentLocalAddress = url.origin;
                        return true;
                    }
                    return false;
                }
                catch (e) {
                    return false;
                }
            });
            if (target) {
                return target.targetId;
            }
        }
        // fallback: search for webview without parameters based on current origin
        target = targetInfos.find((targetInfo) => {
            try {
                const url = new URL(targetInfo.url);
                return (this.currentLocalAddress === url.origin);
            }
            catch (e) {
                return false;
            }
        });
        if (!target) {
            return undefined;
        }
        return target.targetId;
    }
    async waitForWebviewTargets(debuggers, windowId, browserType) {
        const start = Date.now();
        const timeout = 10000;
        while (Date.now() - start < timeout) {
            const targetId = await this.findWebviewTarget(debuggers, windowId, browserType);
            if (targetId) {
                return targetId;
            }
            // Wait for a short period before checking again
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        debuggers.detach();
        return undefined;
    }
    async startDebugSession(windowId, token, browserType, cancelAndDetachId) {
        const window = this.windowById(windowId);
        if (!window?.win) {
            return undefined;
        }
        // Find the simple browser webview
        const allWebContents = webContents.getAllWebContents();
        const simpleBrowserWebview = allWebContents.find(webContent => webContent.id === window.id);
        if (!simpleBrowserWebview) {
            return undefined;
        }
        const debuggers = simpleBrowserWebview.debugger;
        if (!debuggers.isAttached()) {
            debuggers.attach();
        }
        try {
            const matchingTargetId = await this.waitForWebviewTargets(debuggers, windowId, browserType);
            if (!matchingTargetId) {
                if (debuggers.isAttached()) {
                    debuggers.detach();
                }
                throw new Error('No target found');
            }
        }
        catch (e) {
            if (debuggers.isAttached()) {
                debuggers.detach();
            }
            throw new Error('No target found');
        }
        window.win.webContents.on('ipc-message', async (event, channel, closedCancelAndDetachId) => {
            if (channel === `vscode:cancelCurrentSession${cancelAndDetachId}`) {
                if (cancelAndDetachId !== closedCancelAndDetachId) {
                    return;
                }
                if (debuggers.isAttached()) {
                    debuggers.detach();
                }
                if (window.win) {
                    window.win.webContents.removeAllListeners('ipc-message');
                }
            }
        });
    }
    async finishOverlay(debuggers, sessionId) {
        if (debuggers.isAttached() && sessionId) {
            await debuggers.sendCommand('Overlay.setInspectMode', {
                mode: 'none',
                highlightConfig: {
                    showInfo: false,
                    showStyles: false
                }
            }, sessionId);
            await debuggers.sendCommand('Overlay.hideHighlight', {}, sessionId);
            await debuggers.sendCommand('Overlay.disable', {}, sessionId);
            debuggers.detach();
        }
    }
    async getElementData(windowId, rect, token, browserType, cancellationId) {
        const window = this.windowById(windowId);
        if (!window?.win) {
            return undefined;
        }
        // Find the simple browser webview
        const allWebContents = webContents.getAllWebContents();
        const simpleBrowserWebview = allWebContents.find(webContent => webContent.id === window.id);
        if (!simpleBrowserWebview) {
            return undefined;
        }
        const debuggers = simpleBrowserWebview.debugger;
        if (!debuggers.isAttached()) {
            debuggers.attach();
        }
        let targetSessionId = undefined;
        try {
            const targetId = await this.findWebviewTarget(debuggers, windowId, browserType);
            const { sessionId } = await debuggers.sendCommand('Target.attachToTarget', {
                targetId: targetId,
                flatten: true,
            });
            targetSessionId = sessionId;
            await debuggers.sendCommand('DOM.enable', {}, sessionId);
            await debuggers.sendCommand('CSS.enable', {}, sessionId);
            await debuggers.sendCommand('Overlay.enable', {}, sessionId);
            await debuggers.sendCommand('Debugger.enable', {}, sessionId);
            await debuggers.sendCommand('Runtime.enable', {}, sessionId);
            await debuggers.sendCommand('Runtime.evaluate', {
                expression: `(function() {
							const style = document.createElement('style');
							style.id = '__pseudoBlocker__';
							style.textContent = '*::before, *::after { pointer-events: none !important; }';
							document.head.appendChild(style);
						})();`,
            }, sessionId);
            // slightly changed default CDP debugger inspect colors
            await debuggers.sendCommand('Overlay.setInspectMode', {
                mode: 'searchForNode',
                highlightConfig: {
                    showInfo: true,
                    showRulers: false,
                    showStyles: true,
                    showAccessibilityInfo: true,
                    showExtensionLines: false,
                    contrastAlgorithm: 'aa',
                    contentColor: { r: 173, g: 216, b: 255, a: 0.8 },
                    paddingColor: { r: 150, g: 200, b: 255, a: 0.5 },
                    borderColor: { r: 120, g: 180, b: 255, a: 0.7 },
                    marginColor: { r: 200, g: 220, b: 255, a: 0.4 },
                    eventTargetColor: { r: 130, g: 160, b: 255, a: 0.8 },
                    shapeColor: { r: 130, g: 160, b: 255, a: 0.8 },
                    shapeMarginColor: { r: 130, g: 160, b: 255, a: 0.5 },
                    gridHighlightConfig: {
                        rowGapColor: { r: 140, g: 190, b: 255, a: 0.3 },
                        rowHatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
                        columnGapColor: { r: 140, g: 190, b: 255, a: 0.3 },
                        columnHatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
                        rowLineColor: { r: 120, g: 180, b: 255 },
                        columnLineColor: { r: 120, g: 180, b: 255 },
                        rowLineDash: true,
                        columnLineDash: true
                    },
                    flexContainerHighlightConfig: {
                        containerBorder: {
                            color: { r: 120, g: 180, b: 255 },
                            pattern: 'solid'
                        },
                        itemSeparator: {
                            color: { r: 140, g: 190, b: 255 },
                            pattern: 'solid'
                        },
                        lineSeparator: {
                            color: { r: 140, g: 190, b: 255 },
                            pattern: 'solid'
                        },
                        mainDistributedSpace: {
                            hatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
                            fillColor: { r: 140, g: 190, b: 255, a: 0.4 }
                        },
                        crossDistributedSpace: {
                            hatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
                            fillColor: { r: 140, g: 190, b: 255, a: 0.4 }
                        },
                        rowGapSpace: {
                            hatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
                            fillColor: { r: 140, g: 190, b: 255, a: 0.4 }
                        },
                        columnGapSpace: {
                            hatchColor: { r: 140, g: 190, b: 255, a: 0.7 },
                            fillColor: { r: 140, g: 190, b: 255, a: 0.4 }
                        }
                    },
                    flexItemHighlightConfig: {
                        baseSizeBox: {
                            hatchColor: { r: 130, g: 170, b: 255, a: 0.6 }
                        },
                        baseSizeBorder: {
                            color: { r: 120, g: 180, b: 255 },
                            pattern: 'solid'
                        },
                        flexibilityArrow: {
                            color: { r: 130, g: 190, b: 255 }
                        }
                    },
                },
            }, sessionId);
        }
        catch (e) {
            debuggers.detach();
            throw new Error('No target found', e);
        }
        if (!targetSessionId) {
            debuggers.detach();
            throw new Error('No target session id found');
        }
        const nodeData = await this.getNodeData(targetSessionId, debuggers, window.win, cancellationId);
        await this.finishOverlay(debuggers, targetSessionId);
        const zoomFactor = simpleBrowserWebview.getZoomFactor();
        const absoluteBounds = {
            x: rect.x + nodeData.bounds.x,
            y: rect.y + nodeData.bounds.y,
            width: nodeData.bounds.width,
            height: nodeData.bounds.height
        };
        const clippedBounds = {
            x: Math.max(absoluteBounds.x, rect.x),
            y: Math.max(absoluteBounds.y, rect.y),
            width: Math.max(0, Math.min(absoluteBounds.x + absoluteBounds.width, rect.x + rect.width) - Math.max(absoluteBounds.x, rect.x)),
            height: Math.max(0, Math.min(absoluteBounds.y + absoluteBounds.height, rect.y + rect.height) - Math.max(absoluteBounds.y, rect.y))
        };
        const scaledBounds = {
            x: clippedBounds.x * zoomFactor,
            y: clippedBounds.y * zoomFactor,
            width: clippedBounds.width * zoomFactor,
            height: clippedBounds.height * zoomFactor
        };
        return { outerHTML: nodeData.outerHTML, computedStyle: nodeData.computedStyle, bounds: scaledBounds };
    }
    async getNodeData(sessionId, debuggers, window, cancellationId) {
        return new Promise((resolve, reject) => {
            const onMessage = async (event, method, params) => {
                if (method === 'Overlay.inspectNodeRequested') {
                    debuggers.off('message', onMessage);
                    await debuggers.sendCommand('Runtime.evaluate', {
                        expression: `(() => {
										const style = document.getElementById('__pseudoBlocker__');
										if (style) style.remove();
									})();`,
                    }, sessionId);
                    const backendNodeId = params?.backendNodeId;
                    if (!backendNodeId) {
                        throw new Error('Missing backendNodeId in inspectNodeRequested event');
                    }
                    try {
                        await debuggers.sendCommand('DOM.getDocument', {}, sessionId);
                        const { nodeIds } = await debuggers.sendCommand('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [backendNodeId] }, sessionId);
                        if (!nodeIds || nodeIds.length === 0) {
                            throw new Error('Failed to get node IDs.');
                        }
                        const nodeId = nodeIds[0];
                        const { model } = await debuggers.sendCommand('DOM.getBoxModel', { nodeId }, sessionId);
                        if (!model) {
                            throw new Error('Failed to get box model.');
                        }
                        const content = model.content;
                        const margin = model.margin;
                        const x = Math.min(margin[0], content[0]);
                        const y = Math.min(margin[1], content[1]) + 32.4; // 32.4 is height of the title bar
                        const width = Math.max(margin[2] - margin[0], content[2] - content[0]);
                        const height = Math.max(margin[5] - margin[1], content[5] - content[1]);
                        const matched = await debuggers.sendCommand('CSS.getMatchedStylesForNode', { nodeId }, sessionId);
                        if (!matched) {
                            throw new Error('Failed to get matched css.');
                        }
                        const formatted = this.formatMatchedStyles(matched);
                        const { outerHTML } = await debuggers.sendCommand('DOM.getOuterHTML', { nodeId }, sessionId);
                        if (!outerHTML) {
                            throw new Error('Failed to get outerHTML.');
                        }
                        resolve({
                            outerHTML,
                            computedStyle: formatted,
                            bounds: { x, y, width, height }
                        });
                    }
                    catch (err) {
                        debuggers.off('message', onMessage);
                        debuggers.detach();
                        reject(err);
                    }
                }
            };
            window.webContents.on('ipc-message', async (event, channel, closedCancellationId) => {
                if (channel === `vscode:cancelElementSelection${cancellationId}`) {
                    if (cancellationId !== closedCancellationId) {
                        return;
                    }
                    debuggers.off('message', onMessage);
                    await this.finishOverlay(debuggers, sessionId);
                    window.webContents.removeAllListeners('ipc-message');
                }
            });
            debuggers.on('message', onMessage);
        });
    }
    formatMatchedStyles(matched) {
        const lines = [];
        // inline
        if (matched.inlineStyle?.cssProperties?.length) {
            lines.push('/* Inline style */');
            lines.push('element {');
            for (const prop of matched.inlineStyle.cssProperties) {
                if (prop.name && prop.value) {
                    lines.push(`  ${prop.name}: ${prop.value};`);
                }
            }
            lines.push('}\n');
        }
        // matched
        if (matched.matchedCSSRules?.length) {
            for (const ruleEntry of matched.matchedCSSRules) {
                const rule = ruleEntry.rule;
                const selectors = rule.selectorList.selectors.map((s) => s.text).join(', ');
                lines.push(`/* Matched Rule from ${rule.origin} */`);
                lines.push(`${selectors} {`);
                for (const prop of rule.style.cssProperties) {
                    if (prop.name && prop.value) {
                        lines.push(`  ${prop.name}: ${prop.value};`);
                    }
                }
                lines.push('}\n');
            }
        }
        // inherited rules
        if (matched.inherited?.length) {
            let level = 1;
            for (const inherited of matched.inherited) {
                const rules = inherited.matchedCSSRules || [];
                for (const ruleEntry of rules) {
                    const rule = ruleEntry.rule;
                    const selectors = rule.selectorList.selectors.map((s) => s.text).join(', ');
                    lines.push(`/* Inherited from ancestor level ${level} (${rule.origin}) */`);
                    lines.push(`${selectors} {`);
                    for (const prop of rule.style.cssProperties) {
                        if (prop.name && prop.value) {
                            lines.push(`  ${prop.name}: ${prop.value};`);
                        }
                    }
                    lines.push('}\n');
                }
                level++;
            }
        }
        return '\n' + lines.join('\n');
    }
    windowById(windowId, fallbackCodeWindowId) {
        return this.codeWindowById(windowId) ?? this.auxiliaryWindowById(windowId) ?? this.codeWindowById(fallbackCodeWindowId);
    }
    codeWindowById(windowId) {
        if (typeof windowId !== 'number') {
            return undefined;
        }
        return this.windowsMainService.getWindowById(windowId);
    }
    auxiliaryWindowById(windowId) {
        if (typeof windowId !== 'number') {
            return undefined;
        }
        const contents = webContents.fromId(windowId);
        if (!contents) {
            return undefined;
        }
        return this.auxiliaryWindowsMainService.getWindowByWebContents(contents);
    }
};
NativeBrowserElementsMainService = __decorate([
    __param(0, IWindowsMainService),
    __param(1, IAuxiliaryWindowsMainService)
], NativeBrowserElementsMainService);
export { NativeBrowserElementsMainService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmF0aXZlQnJvd3NlckVsZW1lbnRzTWFpblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vYnJvd3NlckVsZW1lbnRzL2VsZWN0cm9uLW1haW4vbmF0aXZlQnJvd3NlckVsZW1lbnRzTWFpblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBK0MsTUFBTSw4QkFBOEIsQ0FBQztBQUd4RyxPQUFPLEVBQWlCLFdBQVcsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUd0RCxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN2RyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDOUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRy9ELE1BQU0sQ0FBQyxNQUFNLGlDQUFpQyxHQUFHLGVBQWUsQ0FBb0MsNEJBQTRCLENBQUMsQ0FBQztBQVMzSCxJQUFNLGdDQUFnQyxHQUF0QyxNQUFNLGdDQUFpQyxTQUFRLFVBQVU7SUFLL0QsWUFDdUMsa0JBQXVDLEVBQzlCLDJCQUF5RDtRQUd4RyxLQUFLLEVBQUUsQ0FBQztRQUo4Qix1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXFCO1FBQzlCLGdDQUEyQixHQUEzQiwyQkFBMkIsQ0FBOEI7SUFJekcsQ0FBQztJQUVELElBQUksUUFBUSxLQUFZLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFOUUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFNBQWMsRUFBRSxRQUFnQixFQUFFLFdBQXdCO1FBQ2pGLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxNQUFNLFNB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