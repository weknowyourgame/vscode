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
var VisualizedVariableRenderer_1, VariablesRenderer_1;
import * as dom from '../../../../base/browser/dom.js';
import { HighlightedLabel } from '../../../../base/browser/ui/highlightedlabel/highlightedLabel.js';
import { toAction } from '../../../../base/common/actions.js';
import { coalesce } from '../../../../base/common/arrays.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { createMatches } from '../../../../base/common/filters.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { getContextMenuActions } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { IMenuService, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService, IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchAsyncDataTree } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED, CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED, CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED, CONTEXT_VARIABLES_FOCUSED, IDebugService, VARIABLES_VIEW_ID, WATCH_VIEW_ID } from '../common/debug.js';
import { getContextForVariable } from '../common/debugContext.js';
import { ErrorScope, Expression, Scope, StackFrame, Variable, VisualizedExpression, getUriForDebugMemory } from '../common/debugModel.js';
import { IDebugVisualizerService } from '../common/debugVisualizers.js';
import { AbstractExpressionDataSource, AbstractExpressionsRenderer, expressionAndScopeLabelProvider, renderViewTree } from './baseDebugView.js';
import { ADD_TO_WATCH_ID, ADD_TO_WATCH_LABEL, COPY_EVALUATE_PATH_ID, COPY_EVALUATE_PATH_LABEL, COPY_VALUE_ID, COPY_VALUE_LABEL, setDataBreakpointInfoResponse } from './debugCommands.js';
import { DebugExpressionRenderer } from './debugExpressionRenderer.js';
const $ = dom.$;
let forgetScopes = true;
let variableInternalContext;
let VariablesView = class VariablesView extends ViewPane {
    get treeSelection() {
        return this.tree.getSelection();
    }
    constructor(options, contextMenuService, debugService, keybindingService, configurationService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, hoverService, menuService) {
        super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
        this.debugService = debugService;
        this.menuService = menuService;
        this.needsRefresh = false;
        this.savedViewState = new Map();
        this.autoExpandedScopes = new Set();
        // Use scheduler to prevent unnecessary flashing
        this.updateTreeScheduler = new RunOnceScheduler(async () => {
            const stackFrame = this.debugService.getViewModel().focusedStackFrame;
            this.needsRefresh = false;
            const input = this.tree.getInput();
            if (input) {
                this.savedViewState.set(input.getId(), this.tree.getViewState());
            }
            if (!stackFrame) {
                await this.tree.setInput(null);
                return;
            }
            const viewState = this.savedViewState.get(stackFrame.getId());
            await this.tree.setInput(stackFrame, viewState);
            // Automatically expand the first non-expensive scope
            const scopes = await stackFrame.getScopes();
            const toExpand = scopes.find(s => !s.expensive);
            // A race condition could be present causing the scopes here to be different from the scopes that the tree just retrieved.
            // If that happened, don't try to reveal anything, it will be straightened out on the next update
            if (toExpand && this.tree.hasNode(toExpand)) {
                this.autoExpandedScopes.add(toExpand.getId());
                await this.tree.expand(toExpand);
            }
        }, 400);
    }
    renderBody(container) {
        super.renderBody(container);
        this.element.classList.add('debug-pane');
        container.classList.add('debug-variables');
        const treeContainer = renderViewTree(container);
        const expressionRenderer = this.instantiationService.createInstance(DebugExpressionRenderer);
        this.tree = this.instantiationService.createInstance((WorkbenchAsyncDataTree), 'VariablesView', treeContainer, new VariablesDelegate(), [
            this.instantiationService.createInstance(VariablesRenderer, expressionRenderer),
            this.instantiationService.createInstance(VisualizedVariableRenderer, expressionRenderer),
            new ScopesRenderer(),
            new ScopeErrorRenderer(),
        ], this.instantiationService.createInstance(VariablesDataSource), {
            accessibilityProvider: new VariablesAccessibilityProvider(),
            identityProvider: { getId: (element) => element.getId() },
            keyboardNavigationLabelProvider: expressionAndScopeLabelProvider,
            overrideStyles: this.getLocationBasedColors().listOverrideStyles
        });
        this._register(VisualizedVariableRenderer.rendererOnVisualizationRange(this.debugService.getViewModel(), this.tree));
        this.tree.setInput(this.debugService.getViewModel().focusedStackFrame ?? null);
        CONTEXT_VARIABLES_FOCUSED.bindTo(this.tree.contextKeyService);
        this._register(this.debugService.getViewModel().onDidFocusStackFrame(sf => {
            if (!this.isBodyVisible()) {
                this.needsRefresh = true;
                return;
            }
            // Refresh the tree immediately if the user explictly changed stack frames.
            // Otherwise postpone the refresh until user stops stepping.
            const timeout = sf.explicit ? 0 : undefined;
            this.updateTreeScheduler.schedule(timeout);
        }));
        this._register(this.debugService.getViewModel().onWillUpdateViews(() => {
            const stackFrame = this.debugService.getViewModel().focusedStackFrame;
            if (stackFrame && forgetScopes) {
                stackFrame.forgetScopes();
            }
            forgetScopes = true;
            this.tree.updateChildren();
        }));
        this._register(this.tree);
        this._register(this.tree.onMouseDblClick(e => this.onMouseDblClick(e)));
        this._register(this.tree.onContextMenu(async (e) => await this.onContextMenu(e)));
        this._register(this.onDidChangeBodyVisibility(visible => {
            if (visible && this.needsRefresh) {
                this.updateTreeScheduler.schedule();
            }
        }));
        let horizontalScrolling;
        this._register(this.debugService.getViewModel().onDidSelectExpression(e => {
            const variable = e?.expression;
            if (variable && this.tree.hasNode(variable)) {
                horizontalScrolling = this.tree.options.horizontalScrolling;
                if (horizontalScrolling) {
                    this.tree.updateOptions({ horizontalScrolling: false });
                }
                this.tree.rerender(variable);
            }
            else if (!e && horizontalScrolling !== undefined) {
                this.tree.updateOptions({ horizontalScrolling: horizontalScrolling });
                horizontalScrolling = undefined;
            }
        }));
        this._register(this.debugService.getViewModel().onDidEvaluateLazyExpression(async (e) => {
            if (e instanceof Variable && this.tree.hasNode(e)) {
                await this.tree.updateChildren(e, false, true);
                await this.tree.expand(e);
            }
        }));
        this._register(this.debugService.onDidEndSession(() => {
            this.savedViewState.clear();
            this.autoExpandedScopes.clear();
        }));
    }
    layoutBody(width, height) {
        super.layoutBody(height, width);
        this.tree.layout(width, height);
    }
    focus() {
        super.focus();
        this.tree.domFocus();
    }
    collapseAll() {
        this.tree.collapseAll();
    }
    onMouseDblClick(e) {
        if (this.canSetExpressionValue(e.element)) {
            this.debugService.getViewModel().setSelectedExpression(e.element, false);
        }
    }
    canSetExpressionValue(e) {
        const session = this.debugService.getViewModel().focusedSession;
        if (!session) {
            return false;
        }
        if (e instanceof VisualizedExpression) {
            return !!e.treeItem.canEdit;
        }
        if (!session.capabilities?.supportsSetVariable && !session.capabilities?.supportsSetExpression) {
            return false;
        }
        return e instanceof Variable && !e.presentationHint?.attributes?.includes('readOnly') && !e.presentationHint?.lazy;
    }
    async onContextMenu(e) {
        const variable = e.element;
        if (!(variable instanceof Variable) || !variable.value) {
            return;
        }
        return openContextMenuForVariableTreeElement(this.contextKeyService, this.menuService, this.contextMenuService, MenuId.DebugVariablesContext, e);
    }
};
VariablesView = __decorate([
    __param(1, IContextMenuService),
    __param(2, IDebugService),
    __param(3, IKeybindingService),
    __param(4, IConfigurationService),
    __param(5, IInstantiationService),
    __param(6, IViewDescriptorService),
    __param(7, IContextKeyService),
    __param(8, IOpenerService),
    __param(9, IThemeService),
    __param(10, IHoverService),
    __param(11, IMenuService)
], VariablesView);
export { VariablesView };
export async function openContextMenuForVariableTreeElement(parentContextKeyService, menuService, contextMenuService, menuId, e) {
    const variable = e.element;
    if (!(variable instanceof Variable) || !variable.value) {
        return;
    }
    const contextKeyService = await getContextForVariableMenuWithDataAccess(parentContextKeyService, variable);
    const context = getVariablesContext(variable);
    const menu = menuService.getMenuActions(menuId, contextKeyService, { arg: context, shouldForwardArgs: false });
    const { secondary } = getContextMenuActions(menu, 'inline');
    contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => secondary
    });
}
const getVariablesContext = (variable) => ({
    sessionId: variable.getSession()?.getId(),
    container: variable.parent instanceof Expression
        ? { expression: variable.parent.name }
        : variable.parent.toDebugProtocolObject(),
    variable: variable.toDebugProtocolObject()
});
/**
 * Gets a context key overlay that has context for the given variable, including data access info.
 */
async function getContextForVariableMenuWithDataAccess(parentContext, variable) {
    const session = variable.getSession();
    if (!session || !session.capabilities.supportsDataBreakpoints) {
        return getContextForVariableMenuBase(parentContext, variable);
    }
    const contextKeys = [];
    const dataBreakpointInfoResponse = await session.dataBreakpointInfo(variable.name, variable.parent.reference);
    const dataBreakpointId = dataBreakpointInfoResponse?.dataId;
    const dataBreakpointAccessTypes = dataBreakpointInfoResponse?.accessTypes;
    setDataBreakpointInfoResponse(dataBreakpointInfoResponse);
    if (!dataBreakpointAccessTypes) {
        contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED.key, !!dataBreakpointId]);
    }
    else {
        for (const accessType of dataBreakpointAccessTypes) {
            switch (accessType) {
                case 'read':
                    contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_IS_READ_SUPPORTED.key, !!dataBreakpointId]);
                    break;
                case 'write':
                    contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_CHANGES_SUPPORTED.key, !!dataBreakpointId]);
                    break;
                case 'readWrite':
                    contextKeys.push([CONTEXT_BREAK_WHEN_VALUE_IS_ACCESSED_SUPPORTED.key, !!dataBreakpointId]);
                    break;
            }
        }
    }
    return getContextForVariableMenuBase(parentContext, variable, contextKeys);
}
/**
 * Gets a context key overlay that has context for the given variable.
 */
function getContextForVariableMenuBase(parentContext, variable, additionalContext = []) {
    variableInternalContext = variable;
    return getContextForVariable(parentContext, variable, additionalContext);
}
function isStackFrame(obj) {
    return obj instanceof StackFrame;
}
class VariablesDataSource extends AbstractExpressionDataSource {
    hasChildren(element) {
        if (!element) {
            return false;
        }
        if (isStackFrame(element)) {
            return true;
        }
        return element.hasChildren;
    }
    doGetChildren(element) {
        if (isStackFrame(element)) {
            return element.getScopes();
        }
        return element.getChildren();
    }
}
class VariablesDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        if (element instanceof ErrorScope) {
            return ScopeErrorRenderer.ID;
        }
        if (element instanceof Scope) {
            return ScopesRenderer.ID;
        }
        if (element instanceof VisualizedExpression) {
            return VisualizedVariableRenderer.ID;
        }
        return VariablesRenderer.ID;
    }
}
class ScopesRenderer {
    static { this.ID = 'scope'; }
    get templateId() {
        return ScopesRenderer.ID;
    }
    renderTemplate(container) {
        const name = dom.append(container, $('.scope'));
        const label = new HighlightedLabel(name);
        return { name, label };
    }
    renderElement(element, index, templateData) {
        templateData.label.set(element.element.name, createMatches(element.filterData));
    }
    disposeTemplate(templateData) {
        templateData.label.dispose();
    }
}
class ScopeErrorRenderer {
    static { this.ID = 'scopeError'; }
    get templateId() {
        return ScopeErrorRenderer.ID;
    }
    renderTemplate(container) {
        const wrapper = dom.append(container, $('.scope'));
        const error = dom.append(wrapper, $('.error'));
        return { error };
    }
    renderElement(element, index, templateData) {
        templateData.error.innerText = element.element.name;
    }
    disposeTemplate() {
        // noop
    }
}
let VisualizedVariableRenderer = class VisualizedVariableRenderer extends AbstractExpressionsRenderer {
    static { VisualizedVariableRenderer_1 = this; }
    static { this.ID = 'viz'; }
    /**
     * Registers a helper that rerenders the tree when visualization is requested
     * or cancelled./
     */
    static rendererOnVisualizationRange(model, tree) {
        return model.onDidChangeVisualization(({ original }) => {
            if (!tree.hasNode(original)) {
                return;
            }
            const parent = tree.getParentElement(original);
            tree.updateChildren(parent, false, false);
        });
    }
    constructor(expressionRenderer, debugService, contextViewService, hoverService, menuService, contextKeyService) {
        super(debugService, contextViewService, hoverService);
        this.expressionRenderer = expressionRenderer;
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
    }
    get templateId() {
        return VisualizedVariableRenderer_1.ID;
    }
    renderElement(node, index, data) {
        data.elementDisposable.clear();
        super.renderExpressionElement(node.element, node, data);
    }
    renderExpression(expression, data, highlights) {
        const viz = expression;
        let text = viz.name;
        if (viz.value && typeof viz.name === 'string') {
            text += ':';
        }
        data.label.set(text, highlights, viz.name);
        data.elementDisposable.add(this.expressionRenderer.renderValue(data.value, viz, {
            showChanged: false,
            maxValueLength: 1024,
            colorize: true,
            session: expression.getSession(),
        }));
    }
    getInputBoxOptions(expression) {
        const viz = expression;
        return {
            initialValue: expression.value,
            ariaLabel: localize('variableValueAriaLabel', "Type new variable value"),
            validationOptions: {
                validation: () => viz.errorMessage ? ({ content: viz.errorMessage }) : null
            },
            onFinish: (value, success) => {
                viz.errorMessage = undefined;
                if (success) {
                    viz.edit(value).then(() => {
                        // Do not refresh scopes due to a node limitation #15520
                        forgetScopes = false;
                        this.debugService.getViewModel().updateViews();
                    });
                }
            }
        };
    }
    renderActionBar(actionBar, expression, _data) {
        const viz = expression;
        const contextKeyService = viz.original ? getContextForVariableMenuBase(this.contextKeyService, viz.original) : this.contextKeyService;
        const context = viz.original ? getVariablesContext(viz.original) : undefined;
        const menu = this.menuService.getMenuActions(MenuId.DebugVariablesContext, contextKeyService, { arg: context, shouldForwardArgs: false });
        const { primary } = getContextMenuActions(menu, 'inline');
        if (viz.original) {
            const action = toAction({
                id: 'debugViz', label: localize('removeVisualizer', 'Remove Visualizer'), class: ThemeIcon.asClassName(Codicon.eye), run: () => this.debugService.getViewModel().setVisualizedExpression(viz.original, undefined)
            });
            action.checked = true;
            primary.push(action);
            actionBar.domNode.style.display = 'initial';
        }
        actionBar.clear();
        actionBar.context = context;
        actionBar.push(primary, { icon: true, label: false });
    }
};
VisualizedVariableRenderer = VisualizedVariableRenderer_1 = __decorate([
    __param(1, IDebugService),
    __param(2, IContextViewService),
    __param(3, IHoverService),
    __param(4, IMenuService),
    __param(5, IContextKeyService)
], VisualizedVariableRenderer);
export { VisualizedVariableRenderer };
let VariablesRenderer = class VariablesRenderer extends AbstractExpressionsRenderer {
    static { VariablesRenderer_1 = this; }
    static { this.ID = 'variable'; }
    constructor(expressionRenderer, menuService, contextKeyService, visualization, contextMenuService, debugService, contextViewService, hoverService) {
        super(debugService, contextViewService, hoverService);
        this.expressionRenderer = expressionRenderer;
        this.menuService = menuService;
        this.contextKeyService = contextKeyService;
        this.visualization = visualization;
        this.contextMenuService = contextMenuService;
    }
    get templateId() {
        return VariablesRenderer_1.ID;
    }
    renderExpression(expression, data, highlights) {
        data.elementDisposable.add(this.expressionRenderer.renderVariable(data, expression, {
            highlights,
            showChanged: true,
        }));
    }
    renderElement(node, index, data) {
        data.elementDisposable.clear();
        super.renderExpressionElement(node.element, node, data);
    }
    getInputBoxOptions(expression) {
        const variable = expression;
        return {
            initialValue: expression.value,
            ariaLabel: localize('variableValueAriaLabel', "Type new variable value"),
            validationOptions: {
                validation: () => variable.errorMessage ? ({ content: variable.errorMessage }) : null
            },
            onFinish: (value, success) => {
                variable.errorMessage = undefined;
                const focusedStackFrame = this.debugService.getViewModel().focusedStackFrame;
                if (success && variable.value !== value && focusedStackFrame) {
                    variable.setVariable(value, focusedStackFrame)
                        // Need to force watch expressions and variables to update since a variable change can have an effect on both
                        .then(() => {
                        // Do not refresh scopes due to a node limitation #15520
                        forgetScopes = false;
                        this.debugService.getViewModel().updateViews();
                    });
                }
            }
        };
    }
    renderActionBar(actionBar, expression, data) {
        const variable = expression;
        const contextKeyService = getContextForVariableMenuBase(this.contextKeyService, variable);
        const context = getVariablesContext(variable);
        const menu = this.menuService.getMenuActions(MenuId.DebugVariablesContext, contextKeyService, { arg: context, shouldForwardArgs: false });
        const { primary } = getContextMenuActions(menu, 'inline');
        actionBar.clear();
        actionBar.context = context;
        actionBar.push(primary, { icon: true, label: false });
        const cts = new CancellationTokenSource();
        data.elementDisposable.add(toDisposable(() => cts.dispose(true)));
        this.visualization.getApplicableFor(expression, cts.token).then(result => {
            data.elementDisposable.add(result);
            const originalExpression = (expression instanceof VisualizedExpression && expression.original) || expression;
            const actions = result.object.map(v => toAction({ id: 'debugViz', label: v.name, class: v.iconClass || 'debug-viz-icon', run: this.useVisualizer(v, originalExpression, cts.token) }));
            if (actions.length === 0) {
                // no-op
            }
            else if (actions.length === 1) {
                actionBar.push(actions[0], { icon: true, label: false });
            }
            else {
                actionBar.push(toAction({ id: 'debugViz', label: localize('useVisualizer', 'Visualize Variable...'), class: ThemeIcon.asClassName(Codicon.eye), run: () => this.pickVisualizer(actions, originalExpression, data) }), { icon: true, label: false });
            }
        });
    }
    pickVisualizer(actions, expression, data) {
        this.contextMenuService.showContextMenu({
            getAnchor: () => data.actionBar.getContainer(),
            getActions: () => actions,
        });
    }
    useVisualizer(viz, expression, token) {
        return async () => {
            const resolved = await viz.resolve(token);
            if (token.isCancellationRequested) {
                return;
            }
            if (resolved.type === 0 /* DebugVisualizationType.Command */) {
                viz.execute();
            }
            else {
                const replacement = await this.visualization.getVisualizedNodeFor(resolved.id, expression);
                if (replacement) {
                    this.debugService.getViewModel().setVisualizedExpression(expression, replacement);
                }
            }
        };
    }
};
VariablesRenderer = VariablesRenderer_1 = __decorate([
    __param(1, IMenuService),
    __param(2, IContextKeyService),
    __param(3, IDebugVisualizerService),
    __param(4, IContextMenuService),
    __param(5, IDebugService),
    __param(6, IContextViewService),
    __param(7, IHoverService)
], VariablesRenderer);
export { VariablesRenderer };
class VariablesAccessibilityProvider {
    getWidgetAriaLabel() {
        return localize('variablesAriaTreeLabel', "Debug Variables");
    }
    getAriaLabel(element) {
        if (element instanceof Scope) {
            return localize('variableScopeAriaLabel', "Scope {0}", element.name);
        }
        if (element instanceof Variable) {
            return localize({ key: 'variableAriaLabel', comment: ['Placeholders are variable name and variable value respectivly. They should not be translated.'] }, "{0}, value {1}", element.name, element.value);
        }
        return null;
    }
}
export const SET_VARIABLE_ID = 'debug.setVariable';
CommandsRegistry.registerCommand({
    id: SET_VARIABLE_ID,
    handler: (accessor) => {
        const debugService = accessor.get(IDebugService);
        debugService.getViewModel().setSelectedExpression(variableInternalContext, false);
    }
});
CommandsRegistry.registerCommand({
    metadata: {
        description: COPY_VALUE_LABEL,
    },
    id: COPY_VALUE_ID,
    handler: async (accessor, arg, ctx) => {
        const debugService = accessor.get(IDebugService);
        const clipboardService = accessor.get(IClipboardService);
        let elementContext = '';
        let elements;
        if (!arg) {
            const viewService = accessor.get(IViewsService);
            const focusedView = viewService.getFocusedView();
            let view;
            if (focusedView?.id === WATCH_VIEW_ID) {
                view = viewService.getActiveViewWithId(WATCH_VIEW_ID);
                elementContext = 'watch';
            }
            else if (focusedView?.id === VARIABLES_VIEW_ID) {
                view = viewService.getActiveViewWithId(VARIABLES_VIEW_ID);
                elementContext = 'variables';
            }
            if (!view) {
                return;
            }
            elements = view.treeSelection.filter(e => e instanceof Expression || e instanceof Variable);
        }
        else if (arg instanceof Variable || arg instanceof Expression) {
            elementContext = 'watch';
            elements = [arg];
        }
        else {
            elementContext = 'variables';
            elements = variableInternalContext ? [variableInternalContext] : [];
        }
        const stackFrame = debugService.getViewModel().focusedStackFrame;
        const session = debugService.getViewModel().focusedSession;
        if (!stackFrame || !session || elements.length === 0) {
            return;
        }
        const evalContext = session.capabilities.supportsClipboardContext ? 'clipboard' : elementContext;
        const toEvaluate = elements.map(element => element instanceof Variable ? (element.evaluateName || element.value) : element.name);
        try {
            const evaluations = await Promise.all(toEvaluate.map(expr => session.evaluate(expr, stackFrame.frameId, evalContext)));
            const result = coalesce(evaluations).map(evaluation => evaluation.body.result);
            if (result.length) {
                clipboardService.writeText(result.join('\n'));
            }
        }
        catch (e) {
            const result = elements.map(element => element.value);
            clipboardService.writeText(result.join('\n'));
        }
    }
});
export const VIEW_MEMORY_ID = 'workbench.debug.viewlet.action.viewMemory';
const HEX_EDITOR_EXTENSION_ID = 'ms-vscode.hexeditor';
const HEX_EDITOR_EDITOR_ID = 'hexEditor.hexedit';
CommandsRegistry.registerCommand({
    id: VIEW_MEMORY_ID,
    handler: async (accessor, arg, ctx) => {
        const debugService = accessor.get(IDebugService);
        let sessionId;
        let memoryReference;
        if ('sessionId' in arg) { // IVariablesContext
            if (!arg.sessionId || !arg.variable.memoryReference) {
                return;
            }
            sessionId = arg.sessionId;
            memoryReference = arg.variable.memoryReference;
        }
        else { // IExpression
            if (!arg.memoryReference) {
                return;
            }
            const focused = debugService.getViewModel().focusedSession;
            if (!focused) {
                return;
            }
            sessionId = focused.getId();
            memoryReference = arg.memoryReference;
        }
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const editorService = accessor.get(IEditorService);
        const notificationService = accessor.get(INotificationService);
        const extensionService = accessor.get(IExtensionService);
        const telemetryService = accessor.get(ITelemetryService);
        const ext = await extensionService.getExtension(HEX_EDITOR_EXTENSION_ID);
        if (ext || await tryInstallHexEditor(extensionsWorkbenchService, notificationService)) {
            /* __GDPR__
                "debug/didViewMemory" : {
                    "owner": "connor4312",
                    "debugType" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
                }
            */
            telemetryService.publicLog('debug/didViewMemory', {
                debugType: debugService.getModel().getSession(sessionId)?.configuration.type,
            });
            await editorService.openEditor({
                resource: getUriForDebugMemory(sessionId, memoryReference),
                options: {
                    revealIfOpened: true,
                    override: HEX_EDITOR_EDITOR_ID,
                },
            }, SIDE_GROUP);
        }
    }
});
async function tryInstallHexEditor(extensionsWorkbenchService, notificationService) {
    try {
        await extensionsWorkbenchService.install(HEX_EDITOR_EXTENSION_ID, {
            justification: localize("viewMemory.prompt", "Inspecting binary data requires this extension."),
            enable: true
        }, 15 /* ProgressLocation.Notification */);
        return true;
    }
    catch (error) {
        notificationService.error(error);
        return false;
    }
}
CommandsRegistry.registerCommand({
    metadata: {
        description: COPY_EVALUATE_PATH_LABEL,
    },
    id: COPY_EVALUATE_PATH_ID,
    handler: async (accessor, context) => {
        const clipboardService = accessor.get(IClipboardService);
        if (context instanceof Variable) {
            await clipboardService.writeText(context.evaluateName);
        }
        else {
            await clipboardService.writeText(context.variable.evaluateName);
        }
    }
});
CommandsRegistry.registerCommand({
    metadata: {
        description: ADD_TO_WATCH_LABEL,
    },
    id: ADD_TO_WATCH_ID,
    handler: async (accessor, context) => {
        const debugService = accessor.get(IDebugService);
        debugService.addWatchExpression(context.variable.evaluateName);
    }
});
registerAction2(class extends ViewAction {
    constructor() {
        super({
            id: 'variables.collapse',
            viewId: VARIABLES_VIEW_ID,
            title: localize('collapse', "Collapse All"),
            f1: false,
            icon: Codicon.collapseAll,
            menu: {
                id: MenuId.ViewTitle,
                group: 'navigation',
                when: ContextKeyExpr.equals('view', VARIABLES_VIEW_ID)
            }
        });
    }
    runInView(_accessor, view) {
        view.collapseAll();
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFyaWFibGVzVmlldy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL3ZhcmlhYmxlc1ZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0saUNBQWlDLENBQUM7QUFFdkQsT0FBTyxFQUFFLGdCQUFnQixFQUFjLE1BQU0sa0VBQWtFLENBQUM7QUFLaEgsT0FBTyxFQUFXLFFBQVEsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNwRSxPQUFPLEVBQXFCLHVCQUF1QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDckcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBYyxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRSxPQUFPLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUN4RyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN2RyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUM5RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNwRixPQUFPLEVBQUUscUJBQXFCLEVBQUUs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