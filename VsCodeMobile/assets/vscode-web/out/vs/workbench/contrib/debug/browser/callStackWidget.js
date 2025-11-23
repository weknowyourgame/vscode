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
var FrameCodeRenderer_1, MissingCodeRenderer_1, SkippedRenderer_1;
import * as dom from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { assertNever } from '../../../../base/common/assert.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, autorunWithStore, derived, observableValue, transaction } from '../../../../base/common/observable.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { EmbeddedCodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js';
import { Position } from '../../../../editor/common/core/position.js';
import { Range } from '../../../../editor/common/core/range.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { ClickLinkGesture } from '../../../../editor/contrib/gotoSymbol/browser/link/clickLinkGesture.js';
import { localize, localize2 } from '../../../../nls.js';
import { createActionViewItem } from '../../../../platform/actions/browser/menuEntryActionViewItem.js';
import { MenuWorkbenchToolBar } from '../../../../platform/actions/browser/toolbar.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { ResourceLabel } from '../../../browser/labels.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { makeStackFrameColumnDecoration, TOP_STACK_FRAME_DECORATION } from './callStackEditorContribution.js';
import './media/callStackWidget.css';
export class CallStackFrame {
    constructor(name, source, line = 1, column = 1) {
        this.name = name;
        this.source = source;
        this.line = line;
        this.column = column;
    }
}
export class SkippedCallFrames {
    constructor(label, load) {
        this.label = label;
        this.load = load;
    }
}
export class CustomStackFrame {
    constructor() {
        this.showHeader = observableValue('CustomStackFrame.showHeader', true);
    }
}
class WrappedCallStackFrame extends CallStackFrame {
    constructor(original) {
        super(original.name, original.source, original.line, original.column);
        this.editorHeight = observableValue('WrappedCallStackFrame.height', this.source ? 100 : 0);
        this.collapsed = observableValue('WrappedCallStackFrame.collapsed', false);
        this.height = derived(reader => {
            return this.collapsed.read(reader) ? CALL_STACK_WIDGET_HEADER_HEIGHT : CALL_STACK_WIDGET_HEADER_HEIGHT + this.editorHeight.read(reader);
        });
    }
}
class WrappedCustomStackFrame {
    constructor(original) {
        this.original = original;
        this.collapsed = observableValue('WrappedCallStackFrame.collapsed', false);
        this.height = derived(reader => {
            const headerHeight = this.original.showHeader.read(reader) ? CALL_STACK_WIDGET_HEADER_HEIGHT : 0;
            return this.collapsed.read(reader) ? headerHeight : headerHeight + this.original.height.read(reader);
        });
    }
}
const isFrameLike = (item) => item instanceof WrappedCallStackFrame || item instanceof WrappedCustomStackFrame;
const WIDGET_CLASS_NAME = 'multiCallStackWidget';
/**
 * A reusable widget that displays a call stack as a series of editors. Note
 * that this both used in debug's exception widget as well as in the testing
 * call stack view.
 */
let CallStackWidget = class CallStackWidget extends Disposable {
    get onDidChangeContentHeight() {
        return this.list.onDidChangeContentHeight;
    }
    get onDidScroll() {
        return this.list.onDidScroll;
    }
    get contentHeight() {
        return this.list.contentHeight;
    }
    constructor(container, containingEditor, instantiationService) {
        super();
        this.layoutEmitter = this._register(new Emitter());
        this.currentFramesDs = this._register(new DisposableStore());
        container.classList.add(WIDGET_CLASS_NAME);
        this._register(toDisposable(() => container.classList.remove(WIDGET_CLASS_NAME)));
        this.list = this._register(instantiationService.createInstance(WorkbenchList, 'TestResultStackWidget', container, new StackDelegate(), [
            instantiationService.createInstance(FrameCodeRenderer, containingEditor, this.layoutEmitter.event),
            instantiationService.createInstance(MissingCodeRenderer),
            instantiationService.createInstance(CustomRenderer),
            instantiationService.createInstance(SkippedRenderer, (i) => this.loadFrame(i)),
        ], {
            multipleSelectionSupport: false,
            mouseSupport: false,
            keyboardSupport: false,
            setRowLineHeight: false,
            alwaysConsumeMouseWheel: false,
            accessibilityProvider: instantiationService.createInstance(StackAccessibilityProvider),
        }));
    }
    /** Replaces the call frames display in the view. */
    setFrames(frames) {
        // cancel any existing load
        this.currentFramesDs.clear();
        this.cts = new CancellationTokenSource();
        this._register(toDisposable(() => this.cts.dispose(true)));
        this.list.splice(0, this.list.length, this.mapFrames(frames));
    }
    layout(height, width) {
        this.list.layout(height, width);
        this.layoutEmitter.fire();
    }
    collapseAll() {
        transaction(tx => {
            for (let i = 0; i < this.list.length; i++) {
                const frame = this.list.element(i);
                if (isFrameLike(frame)) {
                    frame.collapsed.set(true, tx);
                }
            }
        });
    }
    async loadFrame(replacing) {
        if (!this.cts) {
            return;
        }
        const frames = await replacing.load(this.cts.token);
        if (this.cts.token.isCancellationRequested) {
            return;
        }
        const index = this.list.indexOf(replacing);
        this.list.splice(index, 1, this.mapFrames(frames));
    }
    mapFrames(frames) {
        const result = [];
        for (const frame of frames) {
            if (frame instanceof SkippedCallFrames) {
                result.push(frame);
                continue;
            }
            const wrapped = frame instanceof CustomStackFrame
                ? new WrappedCustomStackFrame(frame) : new WrappedCallStackFrame(frame);
            result.push(wrapped);
            this.currentFramesDs.add(autorun(reader => {
                const height = wrapped.height.read(reader);
                const idx = this.list.indexOf(wrapped);
                if (idx !== -1) {
                    this.list.updateElementHeight(idx, height);
                }
            }));
        }
        return result;
    }
};
CallStackWidget = __decorate([
    __param(2, IInstantiationService)
], CallStackWidget);
export { CallStackWidget };
let StackAccessibilityProvider = class StackAccessibilityProvider {
    constructor(labelService) {
        this.labelService = labelService;
    }
    getAriaLabel(e) {
        if (e instanceof SkippedCallFrames) {
            return e.label;
        }
        if (e instanceof WrappedCustomStackFrame) {
            return e.original.label;
        }
        if (e instanceof CallStackFrame) {
            if (e.source && e.line) {
                return localize({
                    comment: ['{0} is an extension-defined label, then line number and filename'],
                    key: 'stackTraceLabel',
                }, '{0}, line {1} in {2}', e.name, e.line, this.labelService.getUriLabel(e.source, { relative: true }));
            }
            return e.name;
        }
        assertNever(e);
    }
    getWidgetAriaLabel() {
        return localize('stackTrace', 'Stack Trace');
    }
};
StackAccessibilityProvider = __decorate([
    __param(0, ILabelService)
], StackAccessibilityProvider);
class StackDelegate {
    getHeight(element) {
        if (element instanceof CallStackFrame || element instanceof WrappedCustomStackFrame) {
            return element.height.get();
        }
        if (element instanceof SkippedCallFrames) {
            return CALL_STACK_WIDGET_HEADER_HEIGHT;
        }
        assertNever(element);
    }
    getTemplateId(element) {
        if (element instanceof CallStackFrame) {
            return element.source ? FrameCodeRenderer.templateId : MissingCodeRenderer.templateId;
        }
        if (element instanceof SkippedCallFrames) {
            return SkippedRenderer.templateId;
        }
        if (element instanceof WrappedCustomStackFrame) {
            return CustomRenderer.templateId;
        }
        assertNever(element);
    }
}
const editorOptions = {
    scrollBeyondLastLine: false,
    scrollbar: {
        vertical: 'hidden',
        horizontal: 'hidden',
        handleMouseWheel: false,
        useShadows: false,
    },
    overviewRulerLanes: 0,
    fixedOverflowWidgets: true,
    overviewRulerBorder: false,
    stickyScroll: { enabled: false },
    minimap: { enabled: false },
    readOnly: true,
    automaticLayout: false,
};
const makeFrameElements = () => dom.h('div.multiCallStackFrame', [
    dom.h('div.header@header', [
        dom.h('div.collapse-button@collapseButton'),
        dom.h('div.title.show-file-icons@title'),
        dom.h('div.actions@actions'),
    ]),
    dom.h('div.editorParent', [
        dom.h('div.editorContainer@editor'),
    ])
]);
export const CALL_STACK_WIDGET_HEADER_HEIGHT = 24;
let AbstractFrameRenderer = class AbstractFrameRenderer {
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
    }
    renderTemplate(container) {
        const elements = makeFrameElements();
        container.appendChild(elements.root);
        const templateStore = new DisposableStore();
        container.classList.add('multiCallStackFrameContainer');
        templateStore.add(toDisposable(() => {
            container.classList.remove('multiCallStackFrameContainer');
            elements.root.remove();
        }));
        const label = templateStore.add(this.instantiationService.createInstance(ResourceLabel, elements.title, {}));
        const collapse = templateStore.add(new Button(elements.collapseButton, {}));
        const contentId = generateUuid();
        elements.editor.id = contentId;
        elements.editor.role = 'region';
        elements.collapseButton.setAttribute('aria-controls', contentId);
        return this.finishRenderTemplate({
            container,
            decorations: [],
            elements,
            label,
            collapse,
            elementStore: templateStore.add(new DisposableStore()),
            templateStore,
        });
    }
    renderElement(element, index, template) {
        const { elementStore } = template;
        elementStore.clear();
        const item = element;
        this.setupCollapseButton(item, template);
    }
    setupCollapseButton(item, { elementStore, elements, collapse }) {
        elementStore.add(autorun(reader => {
            collapse.element.className = '';
            const collapsed = item.collapsed.read(reader);
            collapse.icon = collapsed ? Codicon.chevronRight : Codicon.chevronDown;
            collapse.element.ariaExpanded = String(!collapsed);
            elements.root.classList.toggle('collapsed', collapsed);
        }));
        const toggleCollapse = () => item.collapsed.set(!item.collapsed.get(), undefined);
        elementStore.add(collapse.onDidClick(toggleCollapse));
        elementStore.add(dom.addDisposableListener(elements.title, 'click', toggleCollapse));
    }
    disposeElement(element, index, templateData) {
        templateData.elementStore.clear();
    }
    disposeTemplate(templateData) {
        templateData.templateStore.dispose();
    }
};
AbstractFrameRenderer = __decorate([
    __param(0, IInstantiationService)
], AbstractFrameRenderer);
const CONTEXT_LINES = 2;
/** Renderer for a normal stack frame where code is available. */
let FrameCodeRenderer = class FrameCodeRenderer extends AbstractFrameRenderer {
    static { FrameCodeRenderer_1 = this; }
    static { this.templateId = 'f'; }
    constructor(containingEditor, onLayout, modelService, instantiationService) {
        super(instantiationService);
        this.containingEditor = containingEditor;
        this.onLayout = onLayout;
        this.modelService = modelService;
        this.templateId = FrameCodeRenderer_1.templateId;
    }
    finishRenderTemplate(data) {
        // override default e.g. language contributions, only allow users to click
        // on code in the call stack to go to its source location
        const contributions = [{
                id: ClickToLocationContribution.ID,
                instantiation: 2 /* EditorContributionInstantiation.BeforeFirstInteraction */,
                ctor: ClickToLocationContribution,
            }];
        const editor = this.containingEditor
            ? this.instantiationService.createInstance(EmbeddedCodeEditorWidget, data.elements.editor, editorOptions, { isSimpleWidget: true, contributions }, this.containingEditor)
            : this.instantiationService.createInstance(CodeEditorWidget, data.elements.editor, editorOptions, { isSimpleWidget: true, contributions });
        data.templateStore.add(editor);
        const toolbar = data.templateStore.add(this.instantiationService.createInstance(MenuWorkbenchToolBar, data.elements.actions, MenuId.DebugCallStackToolbar, {
            menuOptions: { shouldForwardArgs: true },
            actionViewItemProvider: (action, options) => createActionViewItem(this.instantiationService, action, options),
        }));
        return { ...data, editor, toolbar };
    }
    renderElement(element, index, template) {
        super.renderElement(element, index, template);
        const { elementStore, editor } = template;
        const item = element;
        const uri = item.source;
        template.label.element.setFile(uri);
        const cts = new CancellationTokenSource();
        elementStore.add(toDisposable(() => cts.dispose(true)));
        this.modelService.createModelReference(uri).then(reference => {
            if (cts.token.isCancellationRequested) {
                return reference.dispose();
            }
            elementStore.add(reference);
            editor.setModel(reference.object.textEditorModel);
            this.setupEditorAfterModel(item, template);
            this.setupEditorLayout(item, template);
        });
    }
    setupEditorLayout(item, { elementStore, container, editor }) {
        const layout = () => {
            const prev = editor.getContentHeight();
            editor.layout({ width: container.clientWidth, height: prev });
            const next = editor.getContentHeight();
            if (next !== prev) {
                editor.layout({ width: container.clientWidth, height: next });
            }
            item.editorHeight.set(next, undefined);
        };
        elementStore.add(editor.onDidChangeModelDecorations(layout));
        elementStore.add(editor.onDidChangeModelContent(layout));
        elementStore.add(editor.onDidChangeModelOptions(layout));
        elementStore.add(this.onLayout(layout));
        layout();
    }
    setupEditorAfterModel(item, template) {
        const range = Range.fromPositions({
            column: item.column ?? 1,
            lineNumber: item.line ?? 1,
        });
        template.toolbar.context = { uri: item.source, range };
        template.editor.setHiddenAreas([
            Range.fromPositions({ column: 1, lineNumber: 1 }, { column: 1, lineNumber: Math.max(1, item.line - CONTEXT_LINES - 1) }),
            Range.fromPositions({ column: 1, lineNumber: item.line + CONTEXT_LINES + 1 }, { column: 1, lineNumber: 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */ }),
        ]);
        template.editor.changeDecorations(accessor => {
            for (const d of template.decorations) {
                accessor.removeDecoration(d);
            }
            template.decorations.length = 0;
            const beforeRange = range.setStartPosition(range.startLineNumber, 1);
            const hasCharactersBefore = !!template.editor.getModel()?.getValueInRange(beforeRange).trim();
            const decoRange = range.setEndPosition(range.startLineNumber, 1073741824 /* Constants.MAX_SAFE_SMALL_INTEGER */);
            template.decorations.push(accessor.addDecoration(decoRange, makeStackFrameColumnDecoration(!hasCharactersBefore)));
            template.decorations.push(accessor.addDecoration(decoRange, TOP_STACK_FRAME_DECORATION));
        });
        item.editorHeight.set(template.editor.getContentHeight(), undefined);
    }
};
FrameCodeRenderer = FrameCodeRenderer_1 = __decorate([
    __param(2, ITextModelService),
    __param(3, IInstantiationService)
], FrameCodeRenderer);
/** Renderer for a call frame that's missing a URI */
let MissingCodeRenderer = class MissingCodeRenderer {
    static { MissingCodeRenderer_1 = this; }
    static { this.templateId = 'm'; }
    constructor(instantiationService) {
        this.instantiationService = instantiationService;
        this.templateId = MissingCodeRenderer_1.templateId;
    }
    renderTemplate(container) {
        const elements = makeFrameElements();
        elements.root.classList.add('missing');
        container.appendChild(elements.root);
        const label = this.instantiationService.createInstance(ResourceLabel, elements.title, {});
        return { elements, label };
    }
    renderElement(element, _index, templateData) {
        const cast = element;
        templateData.label.element.setResource({
            name: cast.name,
            description: localize('stackFrameLocation', 'Line {0} column {1}', cast.line, cast.column),
            range: { startLineNumber: cast.line, startColumn: cast.column, endColumn: cast.column, endLineNumber: cast.line },
        }, {
            icon: Codicon.fileBinary,
        });
    }
    disposeTemplate(templateData) {
        templateData.label.dispose();
        templateData.elements.root.remove();
    }
};
MissingCodeRenderer = MissingCodeRenderer_1 = __decorate([
    __param(0, IInstantiationService)
], MissingCodeRenderer);
/** Renderer for a call frame that's missing a URI */
class CustomRenderer extends AbstractFrameRenderer {
    constructor() {
        super(...arguments);
        this.templateId = CustomRenderer.templateId;
    }
    static { this.templateId = 'c'; }
    finishRenderTemplate(data) {
        return data;
    }
    renderElement(element, index, template) {
        super.renderElement(element, index, template);
        const item = element;
        const { elementStore, container, label } = template;
        label.element.setResource({ name: item.original.label }, { icon: item.original.icon });
        elementStore.add(autorun(reader => {
            template.elements.header.style.display = item.original.showHeader.read(reader) ? '' : 'none';
        }));
        elementStore.add(autorunWithStore((reader, store) => {
            if (!item.collapsed.read(reader)) {
                store.add(item.original.render(container));
            }
        }));
        const actions = item.original.renderActions?.(template.elements.actions);
        if (actions) {
            elementStore.add(actions);
        }
    }
}
/** Renderer for a button to load more call frames */
let SkippedRenderer = class SkippedRenderer {
    static { SkippedRenderer_1 = this; }
    static { this.templateId = 's'; }
    constructor(loadFrames, notificationService) {
        this.loadFrames = loadFrames;
        this.notificationService = notificationService;
        this.templateId = SkippedRenderer_1.templateId;
    }
    renderTemplate(container) {
        const store = new DisposableStore();
        const button = new Button(container, { title: '', ...defaultButtonStyles });
        const data = { button, store };
        store.add(button);
        store.add(button.onDidClick(() => {
            if (!data.current || !button.enabled) {
                return;
            }
            button.enabled = false;
            this.loadFrames(data.current).catch(e => {
                this.notificationService.error(localize('failedToLoadFrames', 'Failed to load stack frames: {0}', e.message));
            });
        }));
        return data;
    }
    renderElement(element, index, templateData) {
        const cast = element;
        templateData.button.enabled = true;
        templateData.button.label = cast.label;
        templateData.current = cast;
    }
    disposeTemplate(templateData) {
        templateData.store.dispose();
    }
};
SkippedRenderer = SkippedRenderer_1 = __decorate([
    __param(1, INotificationService)
], SkippedRenderer);
/** A simple contribution that makes all data in the editor clickable to go to the location */
let ClickToLocationContribution = class ClickToLocationContribution extends Disposable {
    static { this.ID = 'clickToLocation'; }
    constructor(editor, editorService) {
        super();
        this.editor = editor;
        this.linkDecorations = editor.createDecorationsCollection();
        this._register(toDisposable(() => this.linkDecorations.clear()));
        const clickLinkGesture = this._register(new ClickLinkGesture(editor));
        this._register(clickLinkGesture.onMouseMoveOrRelevantKeyDown(([mouseEvent, keyboardEvent]) => {
            this.onMove(mouseEvent);
        }));
        this._register(clickLinkGesture.onExecute((e) => {
            const model = this.editor.getModel();
            if (!this.current || !model) {
                return;
            }
            editorService.openEditor({
                resource: model.uri,
                options: {
                    selection: Range.fromPositions(new Position(this.current.line, this.current.word.startColumn)),
                    selectionRevealType: 1 /* TextEditorSelectionRevealType.CenterIfOutsideViewport */,
                },
            }, e.hasSideBySideModifier ? SIDE_GROUP : undefined);
        }));
    }
    onMove(mouseEvent) {
        if (!mouseEvent.hasTriggerModifier) {
            return this.clear();
        }
        const position = mouseEvent.target.position;
        const word = position && this.editor.getModel()?.getWordAtPosition(position);
        if (!word) {
            return this.clear();
        }
        const prev = this.current?.word;
        if (prev && prev.startColumn === word.startColumn && prev.endColumn === word.endColumn && prev.word === word.word) {
            return;
        }
        this.current = { word, line: position.lineNumber };
        this.linkDecorations.set([{
                range: new Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
                options: {
                    description: 'call-stack-go-to-file-link',
                    inlineClassName: 'call-stack-go-to-file-link',
                },
            }]);
    }
    clear() {
        this.linkDecorations.clear();
        this.current = undefined;
    }
};
ClickToLocationContribution = __decorate([
    __param(1, IEditorService)
], ClickToLocationContribution);
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: 'callStackWidget.goToFile',
            title: localize2('goToFile', 'Open File'),
            icon: Codicon.goToFile,
            menu: {
                id: MenuId.DebugCallStackToolbar,
                order: 22,
                group: 'navigation',
            },
        });
    }
    async run(accessor, { uri, range }) {
        const editorService = accessor.get(IEditorService);
        await editorService.openEditor({
            resource: uri,
            options: {
                selection: range,
                selectionRevealType: 1 /* TextEditorSelectionRevealType.CenterIfOutsideViewport */,
            },
        });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbFN0YWNrV2lkZ2V0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2RlYnVnL2Jyb3dzZXIvY2FsbFN0YWNrV2lkZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLGlDQUFpQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUd0RSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFxQix1QkFBdUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDOUcsT0FBTyxFQUFFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQW9DLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUkzSixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFHL0QsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDcEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sMEVBQTBFLENBQUM7QUFFcEgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUloRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUMxRixPQUFPLEVBQUUsZ0JBQWdCLEVBQXVC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