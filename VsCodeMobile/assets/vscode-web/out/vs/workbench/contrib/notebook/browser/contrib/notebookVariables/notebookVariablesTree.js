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
var NotebookVariableRenderer_1;
import * as dom from '../../../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { observableValue } from '../../../../../../base/common/observable.js';
import { localize, localize2 } from '../../../../../../nls.js';
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchObjectTree } from '../../../../../../platform/list/browser/listService.js';
import { DebugExpressionRenderer } from '../../../../debug/browser/debugExpressionRenderer.js';
const $ = dom.$;
const MAX_VALUE_RENDER_LENGTH_IN_VIEWLET = 1024;
export const NOTEBOOK_TITLE = localize2('notebook.notebookVariables', "Notebook Variables");
export const REPL_TITLE = localize2('notebook.ReplVariables', "REPL Variables");
export class NotebookVariablesTree extends WorkbenchObjectTree {
}
export class NotebookVariablesDelegate {
    getHeight(element) {
        return 22;
    }
    getTemplateId(element) {
        return NotebookVariableRenderer.ID;
    }
}
let NotebookVariableRenderer = class NotebookVariableRenderer {
    static { NotebookVariableRenderer_1 = this; }
    static { this.ID = 'variableElement'; }
    get templateId() {
        return NotebookVariableRenderer_1.ID;
    }
    constructor(instantiationService) {
        this.expressionRenderer = instantiationService.createInstance(DebugExpressionRenderer);
    }
    renderTemplate(container) {
        const expression = dom.append(container, $('.expression'));
        const name = dom.append(expression, $('span.name'));
        const value = dom.append(expression, $('span.value'));
        const template = { expression, name, value, elementDisposables: new DisposableStore() };
        return template;
    }
    renderElement(element, _index, data) {
        const text = element.element.value.trim() !== '' ? `${element.element.name}:` : element.element.name;
        data.name.textContent = text;
        data.name.title = element.element.type ?? '';
        data.elementDisposables.add(this.expressionRenderer.renderValue(data.value, element.element, {
            colorize: true,
            maxValueLength: MAX_VALUE_RENDER_LENGTH_IN_VIEWLET,
            session: undefined,
        }));
    }
    disposeElement(element, index, templateData) {
        templateData.elementDisposables.clear();
    }
    disposeTemplate(templateData) {
        templateData.elementDisposables.dispose();
    }
};
NotebookVariableRenderer = NotebookVariableRenderer_1 = __decorate([
    __param(0, IInstantiationService)
], NotebookVariableRenderer);
export { NotebookVariableRenderer };
export class NotebookVariableAccessibilityProvider {
    constructor() {
        this._widgetAriaLabel = observableValue('widgetAriaLabel', NOTEBOOK_TITLE.value);
    }
    getWidgetAriaLabel() {
        return this._widgetAriaLabel;
    }
    updateWidgetAriaLabel(label) {
        this._widgetAriaLabel.set(label, undefined);
    }
    getAriaLabel(element) {
        return localize('notebookVariableAriaLabel', "Variable {0}, value {1}", element.name, element.value);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm90ZWJvb2tWYXJpYWJsZXNUcmVlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL25vdGVib29rL2Jyb3dzZXIvY29udHJpYi9ub3RlYm9va1ZhcmlhYmxlcy9ub3RlYm9va1ZhcmlhYmxlc1RyZWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sdUNBQXVDLENBQUM7QUFLN0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDRDQUE0QyxDQUFDO0FBQzdFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM5RSxPQUFPLEVBQW9CLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUNqRixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSxrRUFBa0UsQ0FBQztBQUN6RyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUM3RixPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUcvRixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2hCLE1BQU0sa0NBQWtDLEdBQUcsSUFBSSxDQUFDO0FBRWhELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBcUIsU0FBUyxDQUFDLDRCQUE0QixFQUFFLG9CQUFvQixDQUFDLENBQUM7QUFDOUcsTUFBTSxDQUFDLE1BQU0sVUFBVSxHQUFxQixTQUFTLENBQUMsd0JBQXdCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztBQUVsRyxNQUFNLE9BQU8scUJBQXNCLFNBQVEsbUJBQTZDO0NBQUk7QUFFNUYsTUFBTSxPQUFPLHlCQUF5QjtJQUVyQyxTQUFTLENBQUMsT0FBaUM7UUFDMUMsT0FBTyxFQUFFLENBQUM7SUFDWCxDQUFDO0lBRUQsYUFBYSxD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