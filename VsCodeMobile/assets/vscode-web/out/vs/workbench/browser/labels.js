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
import { localize } from '../../nls.js';
import { URI } from '../../base/common/uri.js';
import { dirname, isEqual, basenameOrAuthority } from '../../base/common/resources.js';
import { IconLabel } from '../../base/browser/ui/iconLabel/iconLabel.js';
import { ILanguageService } from '../../editor/common/languages/language.js';
import { IWorkspaceContextService } from '../../platform/workspace/common/workspace.js';
import { IConfigurationService } from '../../platform/configuration/common/configuration.js';
import { IModelService } from '../../editor/common/services/model.js';
import { ITextFileService } from '../services/textfile/common/textfiles.js';
import { IDecorationsService } from '../services/decorations/common/decorations.js';
import { Schemas } from '../../base/common/network.js';
import { FileKind, FILES_ASSOCIATIONS_CONFIG } from '../../platform/files/common/files.js';
import { IThemeService } from '../../platform/theme/common/themeService.js';
import { Event, Emitter } from '../../base/common/event.js';
import { ILabelService } from '../../platform/label/common/label.js';
import { getIconClasses } from '../../editor/common/services/getIconClasses.js';
import { Disposable, dispose, MutableDisposable } from '../../base/common/lifecycle.js';
import { IInstantiationService } from '../../platform/instantiation/common/instantiation.js';
import { normalizeDriveLetter } from '../../base/common/labels.js';
import { INotebookDocumentService, extractCellOutputDetails } from '../services/notebook/common/notebookDocumentService.js';
function toResource(props) {
    if (!props?.resource) {
        return undefined;
    }
    if (URI.isUri(props.resource)) {
        return props.resource;
    }
    return props.resource.primary;
}
export const DEFAULT_LABELS_CONTAINER = {
    onDidChangeVisibility: Event.None
};
let ResourceLabels = class ResourceLabels extends Disposable {
    get onDidChangeDecorations() { return this._onDidChangeDecorations.event; }
    constructor(container, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService) {
        super();
        this.instantiationService = instantiationService;
        this.configurationService = configurationService;
        this.modelService = modelService;
        this.workspaceService = workspaceService;
        this.languageService = languageService;
        this.decorationsService = decorationsService;
        this.themeService = themeService;
        this.labelService = labelService;
        this.textFileService = textFileService;
        this._onDidChangeDecorations = this._register(new Emitter());
        this.widgets = [];
        this.labels = [];
        this.registerListeners(container);
    }
    registerListeners(container) {
        // notify when visibility changes
        this._register(container.onDidChangeVisibility(visible => {
            this.widgets.forEach(widget => widget.notifyVisibilityChanged(visible));
        }));
        // notify when extensions are registered with potentially new languages
        this._register(this.languageService.onDidChange(() => this.widgets.forEach(widget => widget.notifyExtensionsRegistered())));
        // notify when model language changes
        this._register(this.modelService.onModelLanguageChanged(e => {
            if (!e.model.uri) {
                return; // we need the resource to compare
            }
            this.widgets.forEach(widget => widget.notifyModelLanguageChanged(e.model));
        }));
        // notify when model is added
        this._register(this.modelService.onModelAdded(model => {
            if (!model.uri) {
                return; // we need the resource to compare
            }
            this.widgets.forEach(widget => widget.notifyModelAdded(model));
        }));
        // notify when workspace folders changes
        this._register(this.workspaceService.onDidChangeWorkspaceFolders(() => {
            this.widgets.forEach(widget => widget.notifyWorkspaceFoldersChange());
        }));
        // notify when file decoration changes
        this._register(this.decorationsService.onDidChangeDecorations(e => {
            let notifyDidChangeDecorations = false;
            this.widgets.forEach(widget => {
                if (widget.notifyFileDecorationsChanges(e)) {
                    notifyDidChangeDecorations = true;
                }
            });
            if (notifyDidChangeDecorations) {
                this._onDidChangeDecorations.fire();
            }
        }));
        // notify when theme changes
        this._register(this.themeService.onDidColorThemeChange(() => this.widgets.forEach(widget => widget.notifyThemeChange())));
        // notify when files.associations changes
        this._register(this.configurationService.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration(FILES_ASSOCIATIONS_CONFIG)) {
                this.widgets.forEach(widget => widget.notifyFileAssociationsChange());
            }
        }));
        // notify when label formatters change
        this._register(this.labelService.onDidChangeFormatters(e => {
            this.widgets.forEach(widget => widget.notifyFormattersChange(e.scheme));
        }));
        // notify when untitled labels change
        this._register(this.textFileService.untitled.onDidChangeLabel(model => {
            this.widgets.forEach(widget => widget.notifyUntitledLabelChange(model.resource));
        }));
    }
    get(index) {
        return this.labels[index];
    }
    create(container, options) {
        const widget = this.instantiationService.createInstance(ResourceLabelWidget, container, options);
        // Only expose a handle to the outside
        const label = {
            element: widget.element,
            get onDidRender() { return widget.onDidRender; },
            setLabel: (label, description, options) => widget.setLabel(label, description, options),
            setResource: (label, options) => widget.setResource(label, options),
            setFile: (resource, options) => widget.setFile(resource, options),
            clear: () => widget.clear(),
            dispose: () => this.disposeWidget(widget)
        };
        // Store
        this.labels.push(label);
        this.widgets.push(widget);
        return label;
    }
    disposeWidget(widget) {
        const index = this.widgets.indexOf(widget);
        if (index > -1) {
            this.widgets.splice(index, 1);
            this.labels.splice(index, 1);
        }
        dispose(widget);
    }
    clear() {
        this.widgets = dispose(this.widgets);
        this.labels = [];
    }
    dispose() {
        super.dispose();
        this.clear();
    }
};
ResourceLabels = __decorate([
    __param(1, IInstantiationService),
    __param(2, IConfigurationService),
    __param(3, IModelService),
    __param(4, IWorkspaceContextService),
    __param(5, ILanguageService),
    __param(6, IDecorationsService),
    __param(7, IThemeService),
    __param(8, ILabelService),
    __param(9, ITextFileService)
], ResourceLabels);
export { ResourceLabels };
/**
 * Note: please consider to use `ResourceLabels` if you are in need
 * of more than one label for your widget.
 */
let ResourceLabel = class ResourceLabel extends ResourceLabels {
    get element() { return this.label; }
    constructor(container, options, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService) {
        super(DEFAULT_LABELS_CONTAINER, instantiationService, configurationService, modelService, workspaceService, languageService, decorationsService, themeService, labelService, textFileService);
        this.label = this._register(this.create(container, options));
    }
};
ResourceLabel = __decorate([
    __param(2, IInstantiationService),
    __param(3, IConfigurationService),
    __param(4, IModelService),
    __param(5, IWorkspaceContextService),
    __param(6, ILanguageService),
    __param(7, IDecorationsService),
    __param(8, IThemeService),
    __param(9, ILabelService),
    __param(10, ITextFileService)
], ResourceLabel);
export { ResourceLabel };
var Redraw;
(function (Redraw) {
    Redraw[Redraw["Basic"] = 1] = "Basic";
    Redraw[Redraw["Full"] = 2] = "Full";
})(Redraw || (Redraw = {}));
let ResourceLabelWidget = class ResourceLabelWidget extends IconLabel {
    get onDidRender() { return this._onDidRender.event; }
    constructor(container, options, languageService, modelService, decorationsService, labelService, textFileService, contextService, notebookDocumentService) {
        super(container, options);
        this.languageService = languageService;
        this.modelService = modelService;
        this.decorationsService = decorationsService;
        this.labelService = labelService;
        this.textFileService = textFileService;
        this.contextService = contextService;
        this.notebookDocumentService = notebookDocumentService;
        this._onDidRender = this._register(new Emitter());
        this.label = undefined;
        this.decoration = this._register(new MutableDisposable());
        this.options = undefined;
        this.computedIconClasses = undefined;
        this.computedLanguageId = undefined;
        this.computedPathLabel = undefined;
        this.computedWorkspaceFolderLabel = undefined;
        this.needsRedraw = undefined;
        this.isHidden = false;
    }
    notifyVisibilityChanged(visible) {
        if (visible === this.isHidden) {
            this.isHidden = !visible;
            if (visible && this.needsRedraw) {
                this.render({
                    updateIcon: this.needsRedraw === Redraw.Full,
                    updateDecoration: this.needsRedraw === Redraw.Full
                });
                this.needsRedraw = undefined;
            }
        }
    }
    notifyModelLanguageChanged(model) {
        this.handleModelEvent(model);
    }
    notifyModelAdded(model) {
        this.handleModelEvent(model);
    }
    handleModelEvent(model) {
        const resource = toResource(this.label);
        if (!resource) {
            return; // only update if resource exists
        }
        if (isEqual(model.uri, resource)) {
            if (this.computedLanguageId !== model.getLanguageId()) {
                this.computedLanguageId = model.getLanguageId();
                this.render({ updateIcon: true, updateDecoration: false }); // update if the language id of the model has changed from our last known state
            }
        }
    }
    notifyFileDecorationsChanges(e) {
        if (!this.options) {
            return false;
        }
        const resource = toResource(this.label);
        if (!resource) {
            return false;
        }
        if (this.options.fileDecorations && e.affectsResource(resource)) {
            return this.render({ updateIcon: false, updateDecoration: true });
        }
        return false;
    }
    notifyExtensionsRegistered() {
        this.render({ updateIcon: true, updateDecoration: false });
    }
    notifyThemeChange() {
        this.render({ updateIcon: false, updateDecoration: false });
    }
    notifyFileAssociationsChange() {
        this.render({ updateIcon: true, updateDecoration: false });
    }
    notifyFormattersChange(scheme) {
        if (toResource(this.label)?.scheme === scheme) {
            this.render({ updateIcon: false, updateDecoration: false });
        }
    }
    notifyUntitledLabelChange(resource) {
        if (isEqual(resource, toResource(this.label))) {
            this.render({ updateIcon: false, updateDecoration: false });
        }
    }
    notifyWorkspaceFoldersChange() {
        if (typeof this.computedWorkspaceFolderLabel === 'string') {
            const resource = toResource(this.label);
            if (URI.isUri(resource) && this.label?.name === this.computedWorkspaceFolderLabel) {
                this.setFile(resource, this.options);
            }
        }
    }
    setFile(resource, options) {
        const hideLabel = options?.hideLabel;
        let name;
        if (!hideLabel) {
            if (options?.fileKind === FileKind.ROOT_FOLDER) {
                const workspaceFolder = this.contextService.getWorkspaceFolder(resource);
                if (workspaceFolder) {
                    name = workspaceFolder.name;
                    this.computedWorkspaceFolderLabel = name;
                }
            }
            if (!name) {
                name = normalizeDriveLetter(basenameOrAuthority(resource));
            }
        }
        let description;
        if (!options?.hidePath) {
            const descriptionCandidate = this.labelService.getUriLabel(dirname(resource), { relative: true });
            if (descriptionCandidate && descriptionCandidate !== '.') {
                // omit description if its not significant: a relative path
                // of '.' just indicates that there is no parent to the path
                // https://github.com/microsoft/vscode/issues/208692
                description = descriptionCandidate;
            }
        }
        this.setResource({ resource, name, description, range: options?.range }, options);
    }
    setResource(label, options = Object.create(null)) {
        const resource = toResource(label);
        const isSideBySideEditor = label?.resource && !URI.isUri(label.resource);
        if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.untitled) {
            // Untitled labels are very dynamic because they may change
            // whenever the content changes (unless a path is associated).
            // As such we always ask the actual editor for it's name and
            // description to get latest in case name/description are
            // provided. If they are not provided from the label we got
            // we assume that the client does not want to display them
            // and as such do not override.
            //
            // We do not touch the label if it represents a primary-secondary
            // because in that case we expect it to carry a proper label
            // and description.
            const untitledModel = this.textFileService.untitled.get(resource);
            if (untitledModel && !untitledModel.hasAssociatedFilePath) {
                if (typeof label.name === 'string') {
                    label.name = untitledModel.name;
                }
                if (typeof label.description === 'string') {
                    const untitledDescription = untitledModel.resource.path;
                    if (label.name !== untitledDescription) {
                        label.description = untitledDescription;
                    }
                    else {
                        label.description = undefined;
                    }
                }
                const untitledTitle = untitledModel.resource.path;
                if (untitledModel.name !== untitledTitle) {
                    options.title = `${untitledModel.name} • ${untitledTitle}`;
                }
                else {
                    options.title = untitledTitle;
                }
            }
        }
        if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.vscodeNotebookCell) {
            // Notebook cells are embeded in a notebook document
            // As such we always ask the actual notebook document
            // for its position in the document.
            const notebookDocument = this.notebookDocumentService.getNotebook(resource);
            const cellIndex = notebookDocument?.getCellIndex(resource);
            if (notebookDocument && cellIndex !== undefined && typeof label.name === 'string') {
                options.title = localize('notebookCellLabel', "{0} • Cell {1}", label.name, `${cellIndex + 1}`);
            }
            if (typeof label.name === 'string' && notebookDocument && cellIndex !== undefined && typeof label.name === 'string') {
                label.name = localize('notebookCellLabel', "{0} • Cell {1}", label.name, `${cellIndex + 1}`);
            }
        }
        if (!options.forceLabel && !isSideBySideEditor && resource?.scheme === Schemas.vscodeNotebookCellOutput) {
            const notebookDocument = this.notebookDocumentService.getNotebook(resource);
            const outputUriData = extractCellOutputDetails(resource);
            if (outputUriData?.cellFragment) {
                if (!outputUriData.notebook) {
                    return;
                }
                const cellUri = outputUriData.notebook.with({
                    scheme: Schemas.vscodeNotebookCell,
                    fragment: outputUriData.cellFragment
                });
                const cellIndex = notebookDocument?.getCellIndex(cellUri);
                const outputIndex = outputUriData.outputIndex;
                if (cellIndex !== undefined && outputIndex !== undefined && typeof label.name === 'string') {
                    label.name = localize('notebookCellOutputLabel', "{0} • Cell {1} • Output {2}", label.name, `${cellIndex + 1}`, `${outputIndex + 1}`);
                }
                else if (cellIndex !== undefined && typeof label.name === 'string') {
                    label.name = localize('notebookCellOutputLabelSimple', "{0} • Cell {1} • Output", label.name, `${cellIndex + 1}`);
                }
            }
        }
        if (options.namePrefix) {
            if (typeof label.name === 'string') {
                label.name = options.namePrefix + label.name;
            }
            else if (Array.isArray(label.name) && label.name.length > 0) {
                label.name = [options.namePrefix + label.name[0], ...label.name.slice(1)];
            }
        }
        if (options.nameSuffix) {
            if (typeof label.name === 'string') {
                label.name = label.name + options.nameSuffix;
            }
            else if (Array.isArray(label.name) && label.name.length > 0) {
                label.name = [...label.name.slice(0, label.name.length - 1), label.name[label.name.length - 1] + options.nameSuffix];
            }
        }
        const hasResourceChanged = this.hasResourceChanged(label);
        const hasPathLabelChanged = hasResourceChanged || this.hasPathLabelChanged(label);
        const hasFileKindChanged = this.hasFileKindChanged(options);
        const hasIconChanged = this.hasIconChanged(options);
        this.label = label;
        this.options = options;
        if (hasResourceChanged) {
            this.computedLanguageId = undefined; // reset computed language since resource changed
        }
        if (hasPathLabelChanged) {
            this.computedPathLabel = undefined; // reset path label due to resource/path-label change
        }
        this.render({
            updateIcon: hasResourceChanged || hasFileKindChanged || hasIconChanged,
            updateDecoration: hasResourceChanged || hasFileKindChanged
        });
    }
    hasFileKindChanged(newOptions) {
        const newFileKind = newOptions?.fileKind;
        const oldFileKind = this.options?.fileKind;
        return newFileKind !== oldFileKind; // same resource but different kind (file, folder)
    }
    hasResourceChanged(newLabel) {
        const newResource = toResource(newLabel);
        const oldResource = toResource(this.label);
        if (newResource && oldResource) {
            return newResource.toString() !== oldResource.toString();
        }
        if (!newResource && !oldResource) {
            return false;
        }
        return true;
    }
    hasPathLabelChanged(newLabel) {
        const newResource = toResource(newLabel);
        return !!newResource && this.computedPathLabel !== this.labelService.getUriLabel(newResource);
    }
    hasIconChanged(newOptions) {
        return this.options?.icon !== newOptions?.icon;
    }
    clear() {
        this.label = undefined;
        this.options = undefined;
        this.computedLanguageId = undefined;
        this.computedIconClasses = undefined;
        this.computedPathLabel = undefined;
        this.setLabel('');
    }
    render(options) {
        if (this.isHidden) {
            if (this.needsRedraw !== Redraw.Full) {
                this.needsRedraw = (options.updateIcon || options.updateDecoration) ? Redraw.Full : Redraw.Basic;
            }
            return false;
        }
        if (options.updateIcon) {
            this.computedIconClasses = undefined;
        }
        if (!this.label) {
            return false;
        }
        const iconLabelOptions = {
            title: '',
            bold: this.options?.bold,
            italic: this.options?.italic,
            strikethrough: this.options?.strikethrough,
            matches: this.options?.matches,
            descriptionMatches: this.options?.descriptionMatches,
            extraClasses: [],
            separator: this.options?.separator,
            domId: this.options?.domId,
            disabledCommand: this.options?.disabledCommand,
            labelEscapeNewLines: this.options?.labelEscapeNewLines,
            descriptionTitle: this.options?.descriptionTitle,
            supportIcons: this.options?.supportIcons,
        };
        const resource = toResource(this.label);
        if (this.options?.title !== undefined) {
            iconLabelOptions.title = this.options.title;
        }
        if (resource && resource.scheme !== Schemas.data /* do not accidentally inline Data URIs */
            && ((!this.options?.title)
                || ((typeof this.options.title !== 'string') && !this.options.title.markdownNotSupportedFallback))) {
            if (!this.computedPathLabel) {
                this.computedPathLabel = this.labelService.getUriLabel(resource);
            }
            if (!iconLabelOptions.title || (typeof iconLabelOptions.title === 'string')) {
                iconLabelOptions.title = this.computedPathLabel;
            }
            else if (!iconLabelOptions.title.markdownNotSupportedFallback) {
                iconLabelOptions.title.markdownNotSupportedFallback = this.computedPathLabel;
            }
        }
        if (this.options && !this.options.hideIcon) {
            if (!this.computedIconClasses) {
                this.computedIconClasses = getIconClasses(this.modelService, this.languageService, resource, this.options.fileKind, this.options.icon);
            }
            if (URI.isUri(this.options.icon)) {
                iconLabelOptions.iconPath = this.options.icon;
            }
            iconLabelOptions.extraClasses = this.computedIconClasses.slice(0);
        }
        if (this.options?.extraClasses) {
            iconLabelOptions.extraClasses.push(...this.options.extraClasses);
        }
        if (this.options?.fileDecorations && resource) {
            if (options.updateDecoration) {
                this.decoration.value = this.decorationsService.getDecoration(resource, this.options.fileKind !== FileKind.FILE);
            }
            const decoration = this.decoration.value;
            if (decoration) {
                if (decoration.tooltip) {
                    if (typeof iconLabelOptions.title === 'string') {
                        iconLabelOptions.title = `${iconLabelOptions.title} • ${decoration.tooltip}`;
                    }
                    else if (typeof iconLabelOptions.title?.markdown === 'string') {
                        const title = `${iconLabelOptions.title.markdown} • ${decoration.tooltip}`;
                        iconLabelOptions.title = { markdown: title, markdownNotSupportedFallback: title };
                    }
                }
                if (decoration.strikethrough) {
                    iconLabelOptions.strikethrough = true;
                }
                if (this.options.fileDecorations.colors) {
                    iconLabelOptions.extraClasses.push(decoration.labelClassName);
                }
                if (this.options.fileDecorations.badges) {
                    iconLabelOptions.extraClasses.push(decoration.badgeClassName);
                    iconLabelOptions.extraClasses.push(decoration.iconClassName);
                }
            }
        }
        if (this.label.range) {
            iconLabelOptions.suffix = this.label.range.startLineNumber !== this.label.range.endLineNumber ?
                `:${this.label.range.startLineNumber}-${this.label.range.endLineNumber}` :
                `:${this.label.range.startLineNumber}`;
        }
        this.setLabel(this.label.name ?? '', this.label.description, iconLabelOptions);
        this._onDidRender.fire();
        return true;
    }
    dispose() {
        super.dispose();
        this.label = undefined;
        this.options = undefined;
        this.computedLanguageId = undefined;
        this.computedIconClasses = undefined;
        this.computedPathLabel = undefined;
        this.computedWorkspaceFolderLabel = undefined;
    }
};
ResourceLabelWidget = __decorate([
    __param(2, ILanguageService),
    __param(3, IModelService),
    __param(4, IDecorationsService),
    __param(5, ILabelService),
    __param(6, ITextFileService),
    __param(7, IWorkspaceContextService),
    __param(8, INotebookDocumentService)
], ResourceLabelWidget);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFiZWxzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9icm93c2VyL2xhYmVscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3hDLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxTQUFTLEVBQXFELE1BQU0sOENBQThDLENBQUM7QUFDNUgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDN0UsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDeEYsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDN0YsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzVFLE9BQU8sRUFBZSxtQkFBbUIsRUFBa0MsTUFBTSwrQ0FBK0MsQ0FBQztBQUNqSSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDdkQsT0FBTyxFQUFFLFFBQVEsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRTNGLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUM1RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQzVELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0s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