/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../base/common/event.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { asWebviewUri, webviewGenericCspSource } from '../../contrib/webview/common/webview.js';
export class ExtHostEditorInsets {
    constructor(_proxy, _editors, _remoteInfo) {
        this._proxy = _proxy;
        this._editors = _editors;
        this._remoteInfo = _remoteInfo;
        this._handlePool = 0;
        this._disposables = new DisposableStore();
        this._insets = new Map();
        // dispose editor inset whenever the hosting editor goes away
        this._disposables.add(_editors.onDidChangeVisibleTextEditors(() => {
            const visibleEditor = _editors.getVisibleTextEditors();
            for (const value of this._insets.values()) {
                if (visibleEditor.indexOf(value.editor) < 0) {
                    value.inset.dispose(); // will remove from `this._insets`
                }
            }
        }));
    }
    dispose() {
        this._insets.forEach(value => value.inset.dispose());
        this._disposables.dispose();
    }
    createWebviewEditorInset(editor, line, height, options, extension) {
        let apiEditor;
        for (const candidate of this._editors.getVisibleTextEditors(true)) {
            if (candidate.value === editor) {
                apiEditor = candidate;
                break;
            }
        }
        if (!apiEditor) {
            throw new Error('not a visible editor');
        }
        const that = this;
        const handle = this._handlePool++;
        const onDidReceiveMessage = new Emitter();
        const onDidDispose = new Emitter();
        const webview = new class {
            constructor() {
                this._html = '';
                this._options = Object.create(null);
            }
            asWebviewUri(resource) {
                return asWebviewUri(resource, that._remoteInfo);
            }
            get cspSource() {
                return webviewGenericCspSource;
            }
            set options(value) {
                this._options = value;
                that._proxy.$setOptions(handle, value);
            }
            get options() {
                return this._options;
            }
            set html(value) {
                this._html = value;
                that._proxy.$setHtml(handle, value);
            }
            get html() {
                return this._html;
            }
            get onDidReceiveMessage() {
                return onDidReceiveMessage.event;
            }
            postMessage(message) {
                return that._proxy.$postMessage(handle, message);
            }
        };
        const inset = new class {
            constructor() {
                this.editor = editor;
                this.line = line;
                this.height = height;
                this.webview = webview;
                this.onDidDispose = onDidDispose.event;
            }
            dispose() {
                if (that._insets.delete(handle)) {
                    that._proxy.$disposeEditorInset(handle);
                    onDidDispose.fire();
                    // final cleanup
                    onDidDispose.dispose();
                    onDidReceiveMessage.dispose();
                }
            }
        };
        this._proxy.$createEditorInset(handle, apiEditor.id, apiEditor.value.document.uri, line + 1, height, options || {}, extension.identifier, extension.extensionLocation);
        this._insets.set(handle, { editor, inset, onDidReceiveMessage });
        return inset;
    }
    $onDidDispose(handle) {
        const value = this._insets.get(handle);
        if (value) {
            value.inset.dispose();
        }
    }
    $onDidReceiveMessage(handle, message) {
        const value = this._insets.get(handle);
        value?.onDidReceiveMessage.fire(message);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENvZGVJbnNldHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS9jb21tb24vZXh0SG9zdENvZGVJbnNldHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUlwRSxPQUFPLEVBQUUsWUFBWSxFQUFFLHVCQUF1QixFQUFxQixNQUFNLHlDQUF5QyxDQUFDO0FBSW5ILE1BQU0sT0FBTyxtQkFBbUI7SUFNL0IsWUFDa0IsTUFBbUMsRUFDbkMsUUFBd0IsRUFDeEIsV0FBOEI7UUFGOUIsV0FBTSxHQUFOLE1BQU0sQ0FBNkI7UUFDbkMsYUFBUSxHQUFSLFFBQVEsQ0FBZ0I7UUFDeEIsZ0JBQVcsR0FBWCxXQUFXLENBQW1CO1FBUHhDLGdCQUFXLEdBQUcsQ0FBQyxDQUFDO1FBQ1AsaUJBQVksR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQzlDLFlBQU8sR0FBRyxJQUFJLEdBQUcsRUFBOEcsQ0FBQztRQVF2SSw2REFBNkQ7UUFDN0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLDZCQUE2QixDQUFDLEdBQUcsRUFBRTtZQUNqRSxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUN2RCxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDM0MsSUFBSSxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDN0MsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLGtDQUFrQztnQkFD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