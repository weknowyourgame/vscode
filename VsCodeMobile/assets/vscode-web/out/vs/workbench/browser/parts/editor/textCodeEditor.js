/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../nls.js';
import { assertReturnsDefined } from '../../../../base/common/types.js';
import { applyTextEditorOptions } from '../../../common/editor/editorOptions.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { isEqual } from '../../../../base/common/resources.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { AbstractTextEditor } from './textEditor.js';
/**
 * A text editor using the code editor widget.
 */
export class AbstractTextCodeEditor extends AbstractTextEditor {
    constructor() {
        super(...arguments);
        this.editorControl = undefined;
    }
    get scopedContextKeyService() {
        return this.editorControl?.invokeWithinContext(accessor => accessor.get(IContextKeyService));
    }
    getTitle() {
        if (this.input) {
            return this.input.getName();
        }
        return localize('textEditor', "Text Editor");
    }
    createEditorControl(parent, initialOptions) {
        this.editorControl = this._register(this.instantiationService.createInstance(CodeEditorWidget, parent, initialOptions, this.getCodeEditorWidgetOptions()));
    }
    getCodeEditorWidgetOptions() {
        return Object.create(null);
    }
    updateEditorControlOptions(options) {
        this.editorControl?.updateOptions(options);
    }
    getMainControl() {
        return this.editorControl;
    }
    getControl() {
        return this.editorControl;
    }
    computeEditorViewState(resource) {
        if (!this.editorControl) {
            return undefined;
        }
        const model = this.editorControl.getModel();
        if (!model) {
            return undefined; // view state always needs a model
        }
        const modelUri = model.uri;
        if (!modelUri) {
            return undefined; // model URI is needed to make sure we save the view state correctly
        }
        if (!isEqual(modelUri, resource)) {
            return undefined; // prevent saving view state for a model that is not the expected one
        }
        return this.editorControl.saveViewState() ?? undefined;
    }
    setOptions(options) {
        super.setOptions(options);
        if (options) {
            applyTextEditorOptions(options, assertReturnsDefined(this.editorControl), 0 /* ScrollType.Smooth */);
        }
    }
    focus() {
        super.focus();
        this.editorControl?.focus();
    }
    hasFocus() {
        return this.editorControl?.hasTextFocus() || super.hasFocus();
    }
    setEditorVisible(visible) {
        super.setEditorVisible(visible);
        if (visible) {
            this.editorControl?.onVisible();
        }
        else {
            this.editorControl?.onHide();
        }
    }
    layout(dimension) {
        this.editorControl?.layout(dimension);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dENvZGVFZGl0b3IuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL3RleHRDb2RlRWRpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUU5QyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUV4RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUUxRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFL0QsT0FBTyxFQUFFLGdCQUFnQixFQUE0QixNQUFNLGtFQUFrRSxDQUFDO0FBRzlILE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBR3JEOztHQUVHO0FBQ0gsTUFBTSxPQUFnQixzQkFBbUQsU0FBUSxrQkFBcUI7SUFBdEc7O1FBRVcsa0JBQWEsR0FBNEIsU0FBUyxDQUFDO0lBdUY5RCxDQUFDO0lBckZBLElBQWEsdUJBQXVCO1FBQ25DLE9BQU8sSUFBSSxDQUFDLGFBQWEsRUFBRSxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBQzlGLENBQUM7SUFFUSxRQUFRO1FBQ2hCLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUM3QixDQUFDO1FBRUQsT0FBTyxRQUFRLENBQUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFUyxtQkFBbUIs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