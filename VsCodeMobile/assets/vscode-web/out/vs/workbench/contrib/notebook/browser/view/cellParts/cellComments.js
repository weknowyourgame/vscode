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
import { coalesce } from '../../../../../../base/common/arrays.js';
import { DisposableMap, DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { ICommentService } from '../../../../comments/browser/commentService.js';
import { CommentThreadWidget } from '../../../../comments/browser/commentThreadWidget.js';
import { CellContentPart } from '../cellPart.js';
let CellComments = class CellComments extends CellContentPart {
    constructor(notebookEditor, container, contextKeyService, themeService, commentService, instantiationService) {
        super();
        this.notebookEditor = notebookEditor;
        this.container = container;
        this.contextKeyService = contextKeyService;
        this.themeService = themeService;
        this.commentService = commentService;
        this.instantiationService = instantiationService;
        this.container.classList.add('review-widget');
        this._register(this._commentThreadWidgets = new DisposableMap());
        this._register(this.themeService.onDidColorThemeChange(this._applyTheme, this));
        // TODO @rebornix onDidChangeLayout (font change)
        // this._register(this.notebookEditor.onDidchangeLa)
        this._applyTheme();
    }
    async initialize(element) {
        if (this.currentElement === element) {
            return;
        }
        this.currentElement = element;
        await this._updateThread();
    }
    async _createCommentTheadWidget(owner, commentThread) {
        const widgetDisposables = new DisposableStore();
        const widget = this.instantiationService.createInstance(CommentThreadWidget, this.container, this.notebookEditor, owner, this.notebookEditor.textModel.uri, this.contextKeyService, this.instantiationService, commentThread, undefined, undefined, {}, undefined, {
            actionRunner: () => {
            },
            collapse: async () => { return true; }
        });
        widgetDisposables.add(widget);
        this._commentThreadWidgets.set(commentThread.threadId, { widget, dispose: () => widgetDisposables.dispose() });
        const layoutInfo = this.notebookEditor.getLayoutInfo();
        await widget.display(layoutInfo.fontInfo.lineHeight, true);
        this._applyTheme();
        widgetDisposables.add(widget.onDidResize(() => {
            if (this.currentElement) {
                this.currentElement.commentHeight = this._calculateCommentThreadHeight(widget.getDimensions().height);
            }
        }));
    }
    _bindListeners() {
        this.cellDisposables.add(this.commentService.onDidUpdateCommentThreads(async () => this._updateThread()));
    }
    async _updateThread() {
        if (!this.currentElement) {
            return;
        }
        const infos = await this._getCommentThreadsForCell(this.currentElement);
        const widgetsToDelete = new Set(this._commentThreadWidgets.keys());
        const layoutInfo = this.currentElement.layoutInfo;
        this.container.style.top = `${layoutInfo.commentOffset}px`;
        for (const info of infos) {
            if (!info) {
                continue;
            }
            for (const thread of info.threads) {
                widgetsToDelete.delete(thread.threadId);
                const widget = this._commentThreadWidgets.get(thread.threadId)?.widget;
                if (widget) {
                    await widget.updateCommentThread(thread);
                }
                else {
                    await this._createCommentTheadWidget(info.uniqueOwner, thread);
                }
            }
        }
        for (const threadId of widgetsToDelete) {
            this._commentThreadWidgets.deleteAndDispose(threadId);
        }
        this._updateHeight();
    }
    _calculateCommentThreadHeight(bodyHeight) {
        const layoutInfo = this.notebookEditor.getLayoutInfo();
        const headHeight = Math.ceil(layoutInfo.fontInfo.lineHeight * 1.2);
        const lineHeight = layoutInfo.fontInfo.lineHeight;
        const arrowHeight = Math.round(lineHeight / 3);
        const frameThickness = Math.round(lineHeight / 9) * 2;
        const computedHeight = headHeight + bodyHeight + arrowHeight + frameThickness + 8 /** margin bottom to avoid margin collapse */;
        return computedHeight;
    }
    _updateHeight() {
        if (!this.currentElement) {
            return;
        }
        let height = 0;
        for (const { widget } of this._commentThreadWidgets.values()) {
            height += this._calculateCommentThreadHeight(widget.getDimensions().height);
        }
        this.currentElement.commentHeight = height;
    }
    async _getCommentThreadsForCell(element) {
        if (this.notebookEditor.hasModel()) {
            return coalesce(await this.commentService.getNotebookComments(element.uri));
        }
        return [];
    }
    _applyTheme() {
        const fontInfo = this.notebookEditor.getLayoutInfo().fontInfo;
        for (const { widget } of this._commentThreadWidgets.values()) {
            widget.applyTheme(fontInfo);
        }
    }
    didRenderCell(element) {
        this.initialize(element);
        this._bindListeners();
    }
    prepareLayout() {
        this._updateHeight();
    }
    updateInternalLayoutNow(element) {
        if (this.currentElement) {
            this.container.style.top = `${element.layoutInfo.commentOffset}px`;
        }
    }
};
CellComments = __decorate([
    __param(2, IContextKeyService),
    __param(3, IThemeService),
    __param(4, ICommentService),
    __param(5, IInstantiationService)
], CellComments);
export { CellComments };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbENvbW1lbnRzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvdmlldy9jZWxsUGFydHMvY2VsbENvbW1lbnRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBRTVGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBQ3pHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSx5REFBeUQsQ0FBQztBQUN4RixPQUFPLEVBQUUsZUFBZSxFQUF3QixNQUFNLGdEQUFnRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBRTFGLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUcxQyxJQUFNLFlBQVksR0FBbEIsTUFBTSxZQUFhLFNBQVEsZUFBZTtJQUtoRCxZQUNrQixjQUF1QyxFQUN2QyxTQUFzQixFQUNGLGlCQUFxQyxFQUMxQyxZQUEyQixFQUN6QixjQUErQixFQUN6QixvQkFBMkM7UUFFbkYsS0FBSyxFQUFFLENBQUM7UUFQUyxtQkFBYyxHQUFkLGNBQWMsQ0FBeUI7UUFDdkMsY0FBUyxHQUFULFNBQVMsQ0FBYTtRQUNGLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBb0I7UUFDMUMsaUJBQVksR0FBWixZQUFZLENBQWU7UUFDekIsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBQ3pCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBdUI7UUFHbkYsSUFBSSxD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