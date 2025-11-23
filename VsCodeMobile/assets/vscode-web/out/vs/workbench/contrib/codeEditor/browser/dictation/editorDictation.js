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
var EditorDictation_1;
import './editorDictation.css';
import { localize, localize2 } from '../../../../../nls.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ContextKeyExpr, IContextKeyService, RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { HasSpeechProvider, ISpeechService, SpeechToTextInProgress, SpeechToTextStatus } from '../../../speech/common/speechService.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { EditorAction2, registerEditorContribution } from '../../../../../editor/browser/editorExtensions.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { EditOperation } from '../../../../../editor/common/core/editOperation.js';
import { Selection } from '../../../../../editor/common/core/selection.js';
import { Position } from '../../../../../editor/common/core/position.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { assertReturnsDefined } from '../../../../../base/common/types.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { toAction } from '../../../../../base/common/actions.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { isWindows } from '../../../../../base/common/platform.js';
const EDITOR_DICTATION_IN_PROGRESS = new RawContextKey('editorDictation.inProgress', false);
const VOICE_CATEGORY = localize2('voiceCategory', "Voice");
export class EditorDictationStartAction extends EditorAction2 {
    constructor() {
        super({
            id: 'workbench.action.editorDictation.start',
            title: localize2('startDictation', "Start Dictation in Editor"),
            category: VOICE_CATEGORY,
            precondition: ContextKeyExpr.and(HasSpeechProvider, SpeechToTextInProgress.toNegated(), // disable when any speech-to-text is in progress
            EditorContextKeys.readOnly.toNegated() // disable in read-only editors
            ),
            f1: true,
            keybinding: {
                primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 52 /* KeyCode.KeyV */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                secondary: isWindows ? [
                    512 /* KeyMod.Alt */ | 91 /* KeyCode.Backquote */
                ] : undefined
            }
        });
    }
    runEditorCommand(accessor, editor) {
        const keybindingService = accessor.get(IKeybindingService);
        const holdMode = keybindingService.enableKeybindingHoldMode(this.desc.id);
        if (holdMode) {
            let shouldCallStop = false;
            const handle = setTimeout(() => {
                shouldCallStop = true;
            }, 500);
            holdMode.finally(() => {
                clearTimeout(handle);
                if (shouldCallStop) {
                    EditorDictation.get(editor)?.stop();
                }
            });
        }
        EditorDictation.get(editor)?.start();
    }
}
export class EditorDictationStopAction extends EditorAction2 {
    static { this.ID = 'workbench.action.editorDictation.stop'; }
    constructor() {
        super({
            id: EditorDictationStopAction.ID,
            title: localize2('stopDictation', "Stop Dictation in Editor"),
            category: VOICE_CATEGORY,
            precondition: EDITOR_DICTATION_IN_PROGRESS,
            f1: true,
            keybinding: {
                primary: 9 /* KeyCode.Escape */,
                weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 100
            }
        });
    }
    runEditorCommand(_accessor, editor) {
        EditorDictation.get(editor)?.stop();
    }
}
export class DictationWidget extends Disposable {
    constructor(editor, keybindingService) {
        super();
        this.editor = editor;
        this.suppressMouseDown = true;
        this.allowEditorOverflow = true;
        this.domNode = document.createElement('div');
        const actionBar = this._register(new ActionBar(this.domNode));
        const stopActionKeybinding = keybindingService.lookupKeybinding(EditorDictationStopAction.ID)?.getLabel();
        actionBar.push(toAction({
            id: EditorDictationStopAction.ID,
            label: stopActionKeybinding ? localize('stopDictationShort1', "Stop Dictation ({0})", stopActionKeybinding) : localize('stopDictationShort2', "Stop Dictation"),
            class: ThemeIcon.asClassName(Codicon.micFilled),
            run: () => EditorDictation.get(editor)?.stop()
        }), { icon: true, label: false, keybinding: stopActionKeybinding });
        this.domNode.classList.add('editor-dictation-widget');
        this.domNode.appendChild(actionBar.domNode);
    }
    getId() {
        return 'editorDictation';
    }
    getDomNode() {
        return this.domNode;
    }
    getPosition() {
        if (!this.editor.hasModel()) {
            return null;
        }
        const selection = this.editor.getSelection();
        return {
            position: selection.getPosition(),
            preference: [
                selection.getPosition().equals(selection.getStartPosition()) ? 1 /* ContentWidgetPositionPreference.ABOVE */ : 2 /* ContentWidgetPositionPreference.BELOW */,
                0 /* ContentWidgetPositionPreference.EXACT */
            ]
        };
    }
    beforeRender() {
        const position = this.editor.getPosition();
        const lineHeight = position ? this.editor.getLineHeightForPosition(position) : this.editor.getOption(75 /* EditorOption.lineHeight */);
        const width = this.editor.getLayoutInfo().contentWidth * 0.7;
        this.domNode.style.setProperty('--vscode-editor-dictation-widget-height', `${lineHeight}px`);
        this.domNode.style.setProperty('--vscode-editor-dictation-widget-width', `${width}px`);
        return null;
    }
    show() {
        this.editor.addContentWidget(this);
    }
    layout() {
        this.editor.layoutContentWidget(this);
    }
    active() {
        this.domNode.classList.add('recording');
    }
    hide() {
        this.domNode.classList.remove('recording');
        this.editor.removeContentWidget(this);
    }
}
let EditorDictation = class EditorDictation extends Disposable {
    static { EditorDictation_1 = this; }
    static { this.ID = 'editorDictation'; }
    static get(editor) {
        return editor.getContribution(EditorDictation_1.ID);
    }
    constructor(editor, speechService, contextKeyService, keybindingService) {
        super();
        this.editor = editor;
        this.speechService = speechService;
        this.sessionDisposables = this._register(new MutableDisposable());
        this.widget = this._register(new DictationWidget(this.editor, keybindingService));
        this.editorDictationInProgress = EDITOR_DICTATION_IN_PROGRESS.bindTo(contextKeyService);
    }
    async start() {
        const disposables = new DisposableStore();
        this.sessionDisposables.value = disposables;
        this.widget.show();
        disposables.add(toDisposable(() => this.widget.hide()));
        this.editorDictationInProgress.set(true);
        disposables.add(toDisposable(() => this.editorDictationInProgress.reset()));
        const collection = this.editor.createDecorationsCollection();
        disposables.add(toDisposable(() => collection.clear()));
        disposables.add(this.editor.onDidChangeCursorPosition(() => this.widget.layout()));
        let previewStart = undefined;
        let lastReplaceTextLength = 0;
        const replaceText = (text, isPreview) => {
            if (!previewStart) {
                previewStart = assertReturnsDefined(this.editor.getPosition());
            }
            const endPosition = new Position(previewStart.lineNumber, previewStart.column + text.length);
            this.editor.executeEdits(EditorDictation_1.ID, [
                EditOperation.replace(Range.fromPositions(previewStart, previewStart.with(undefined, previewStart.column + lastReplaceTextLength)), text)
            ], [
                Selection.fromPositions(endPosition)
            ]);
            if (isPreview) {
                collection.set([
                    {
                        range: Range.fromPositions(previewStart, previewStart.with(undefined, previewStart.column + text.length)),
                        options: {
                            description: 'editor-dictation-preview',
                            inlineClassName: 'ghost-text-decoration-preview'
                        }
                    }
                ]);
            }
            else {
                collection.clear();
            }
            lastReplaceTextLength = text.length;
            if (!isPreview) {
                previewStart = undefined;
                lastReplaceTextLength = 0;
            }
            this.editor.revealPositionInCenterIfOutsideViewport(endPosition);
        };
        const cts = new CancellationTokenSource();
        disposables.add(toDisposable(() => cts.dispose(true)));
        const session = await this.speechService.createSpeechToTextSession(cts.token, 'editor');
        disposables.add(session.onDidChange(e => {
            if (cts.token.isCancellationRequested) {
                return;
            }
            switch (e.status) {
                case SpeechToTextStatus.Started:
                    this.widget.active();
                    break;
                case SpeechToTextStatus.Stopped:
                    disposables.dispose();
                    break;
                case SpeechToTextStatus.Recognizing: {
                    if (!e.text) {
                        return;
                    }
                    replaceText(e.text, true);
                    break;
                }
                case SpeechToTextStatus.Recognized: {
                    if (!e.text) {
                        return;
                    }
                    replaceText(`${e.text} `, false);
                    break;
                }
            }
        }));
    }
    stop() {
        this.sessionDisposables.clear();
    }
};
EditorDictation = EditorDictation_1 = __decorate([
    __param(1, ISpeechService),
    __param(2, IContextKeyService),
    __param(3, IKeybindingService)
], EditorDictation);
export { EditorDictation };
registerEditorContribution(EditorDictation.ID, EditorDictation, 4 /* EditorContributionInstantiation.Lazy */);
registerAction2(EditorDictationStartAction);
registerAction2(EditorDictationStopAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yRGljdGF0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NvZGVFZGl0b3IvYnJvd3Nlci9kaWN0YXRpb24vZWRpdG9yRGljdGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7OztBQUVoRyxPQUFPLHVCQUF1QixDQUFDO0FBQy9CLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFNUQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDckYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFHdkgsT0FBTyxFQUFFLGNBQWMsRUFBZSxrQkFBa0IsRUFBRSxhQUFhLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN6SSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsY0FBYyxFQUFFLHNCQUFzQixFQUFFLGtCQUFrQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDeEksT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRWpFLE9BQU8sRUFBRSxhQUFhLEVBQW1DLDBCQUEwQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDL0ksT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFJdEYsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDN0YsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUMzRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDekUsT0FBTyxFQUFFLEtBQUssRUFB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