/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter, Event } from '../../../../base/common/event.js';
import { autorun, observableValue } from '../../../../base/common/observable.js';
import { setTimeout0 } from '../../../../base/common/platform.js';
import { localize } from '../../../../nls.js';
import { QuickInput } from '../quickInput.js';
import { getParentNodeState } from './quickInputTree.js';
// Contains the API
export class QuickTree extends QuickInput {
    static { this.DEFAULT_ARIA_LABEL = localize('quickInputBox.ariaLabel', "Type to narrow down results."); }
    constructor(ui) {
        super(ui);
        this.type = "quickTree" /* QuickInputType.QuickTree */;
        this._value = observableValue('value', '');
        this._ariaLabel = observableValue('ariaLabel', undefined);
        this._placeholder = observableValue('placeholder', undefined);
        this._matchOnDescription = observableValue('matchOnDescription', false);
        this._matchOnLabel = observableValue('matchOnLabel', true);
        this._sortByLabel = observableValue('sortByLabel', true);
        this._activeItems = observableValue('activeItems', []);
        this._itemTree = observableValue('itemTree', []);
        this.onDidChangeValue = Event.fromObservable(this._value, this._store);
        this.onDidChangeActive = Event.fromObservable(this._activeItems, this._store);
        this._onDidChangeCheckedLeafItems = this._register(new Emitter());
        this.onDidChangeCheckedLeafItems = this._onDidChangeCheckedLeafItems.event;
        this._onDidChangeCheckboxState = this._register(new Emitter());
        this.onDidChangeCheckboxState = this._onDidChangeCheckboxState.event;
        this.onDidAccept = ui.onDidAccept;
        this._registerAutoruns();
        this._register(ui.tree.onDidChangeCheckedLeafItems(e => this._onDidChangeCheckedLeafItems.fire(e)));
        this._register(ui.tree.onDidChangeCheckboxState(e => this._onDidChangeCheckboxState.fire(e.item)));
        // Sync active items with tree focus changes
        this._register(ui.tree.tree.onDidChangeFocus(e => {
            this._activeItems.set(ui.tree.getActiveItems(), undefined);
        }));
    }
    get value() { return this._value.get(); }
    set value(value) { this._value.set(value, undefined); }
    get ariaLabel() { return this._ariaLabel.get(); }
    set ariaLabel(ariaLabel) { this._ariaLabel.set(ariaLabel, undefined); }
    get placeholder() { return this._placeholder.get(); }
    set placeholder(placeholder) { this._placeholder.set(placeholder, undefined); }
    get matchOnDescription() { return this._matchOnDescription.get(); }
    set matchOnDescription(matchOnDescription) { this._matchOnDescription.set(matchOnDescription, undefined); }
    get matchOnLabel() { return this._matchOnLabel.get(); }
    set matchOnLabel(matchOnLabel) { this._matchOnLabel.set(matchOnLabel, undefined); }
    get sortByLabel() { return this._sortByLabel.get(); }
    set sortByLabel(sortByLabel) { this._sortByLabel.set(sortByLabel, undefined); }
    get activeItems() { return this._activeItems.get(); }
    set activeItems(activeItems) { this._activeItems.set(activeItems, undefined); }
    get itemTree() { return this._itemTree.get(); }
    get onDidTriggerItemButton() {
        // Is there a cleaner way to avoid the `as` cast here?
        return this.ui.tree.onDidTriggerButton;
    }
    // TODO: Fix the any casting
    // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
    get checkedLeafItems() { return this.ui.tree.getCheckedLeafItems(); }
    setItemTree(itemTree) {
        this._itemTree.set(itemTree, undefined);
    }
    getParent(element) {
        return this.ui.tree.tree.getParentElement(element) ?? undefined;
    }
    setCheckboxState(element, checked) {
        this.ui.tree.check(element, checked);
    }
    expand(element) {
        this.ui.tree.tree.expand(element);
    }
    collapse(element) {
        this.ui.tree.tree.collapse(element);
    }
    isCollapsed(element) {
        return this.ui.tree.tree.isCollapsed(element);
    }
    focusOnInput() {
        this.ui.inputBox.setFocus();
    }
    show() {
        if (!this.visible) {
            const visibilities = {
                title: !!this.title || !!this.step || !!this.titleButtons.length,
                description: !!this.description,
                checkAll: true,
                checkBox: true,
                inputBox: true,
                progressBar: true,
                visibleCount: true,
                count: true,
                ok: true,
                list: false,
                tree: true,
                message: !!this.validationMessage,
                customButton: false
            };
            this.ui.setVisibilities(visibilities);
            this.visibleDisposables.add(this.ui.inputBox.onDidChange(value => {
                this._value.set(value, undefined);
            }));
            this.visibleDisposables.add(this.ui.tree.onDidChangeCheckboxState((e) => {
                const checkAllState = getParentNodeState([...this.ui.tree.tree.getNode().children]);
                if (this.ui.checkAll.checked !== checkAllState) {
                    this.ui.checkAll.checked = checkAllState;
                }
            }));
            this.visibleDisposables.add(this.ui.checkAll.onChange(_e => {
                const checked = this.ui.checkAll.checked;
                this.ui.tree.checkAll(checked);
            }));
            this.visibleDisposables.add(this.ui.tree.onDidChangeCheckedLeafItems(e => {
                this.ui.count.setCount(e.length);
            }));
        }
        super.show(); // TODO: Why have show() bubble up while update() trickles down?
        // Initial state
        // TODO@TylerLeonhardt: Without this setTimeout, the screen reader will not read out
        // the final count of checked items correctly. Investigate a better way
        // to do this. ref https://github.com/microsoft/vscode/issues/258617
        setTimeout0(() => this.ui.count.setCount(this.ui.tree.getCheckedLeafItems().length));
        const checkAllState = getParentNodeState([...this.ui.tree.tree.getNode().children]);
        if (this.ui.checkAll.checked !== checkAllState) {
            this.ui.checkAll.checked = checkAllState;
        }
    }
    update() {
        if (!this.visible) {
            return;
        }
        const visibilities = {
            title: !!this.title || !!this.step || !!this.titleButtons.length,
            description: !!this.description,
            checkAll: true,
            checkBox: true,
            inputBox: true,
            progressBar: true,
            visibleCount: true,
            count: true,
            ok: true,
            tree: true,
            message: !!this.validationMessage
        };
        this.ui.setVisibilities(visibilities);
        super.update();
    }
    _registerListeners() {
    }
    // TODO: Move to using autoruns instead of update function
    _registerAutoruns() {
        this.registerVisibleAutorun(reader => {
            const value = this._value.read(reader);
            this.ui.inputBox.value = value;
            this.ui.tree.filter(value);
        });
        this.registerVisibleAutorun(reader => {
            let ariaLabel = this._ariaLabel.read(reader);
            if (!ariaLabel) {
                ariaLabel = this.placeholder || QuickTree.DEFAULT_ARIA_LABEL;
                // If we have a title, include it in the aria label.
                if (this.title) {
                    ariaLabel += ` - ${this.title}`;
                }
            }
            if (this.ui.list.ariaLabel !== ariaLabel) {
                this.ui.list.ariaLabel = ariaLabel ?? null;
            }
            if (this.ui.inputBox.ariaLabel !== ariaLabel) {
                this.ui.inputBox.ariaLabel = ariaLabel ?? 'input';
            }
        });
        this.registerVisibleAutorun(reader => {
            const placeholder = this._placeholder.read(reader);
            if (this.ui.inputBox.placeholder !== placeholder) {
                this.ui.inputBox.placeholder = placeholder ?? '';
            }
        });
        this.registerVisibleAutorun((reader) => {
            const matchOnLabel = this._matchOnLabel.read(reader);
            const matchOnDescription = this._matchOnDescription.read(reader);
            this.ui.tree.updateFilterOptions({ matchOnLabel, matchOnDescription });
        });
        this.registerVisibleAutorun((reader) => {
            const sortByLabel = this._sortByLabel.read(reader);
            this.ui.tree.sortByLabel = sortByLabel;
        });
        this.registerVisibleAutorun((reader) => {
            const itemTree = this._itemTree.read(reader);
            this.ui.tree.setTreeData(itemTree);
        });
    }
    registerVisibleAutorun(fn) {
        this._register(autorun((reader) => {
            if (this._visible.read(reader)) {
                fn(reader);
            }
        }));
    }
    focus(focus) {
        this.ui.tree.focus(focus);
        // To allow things like space to check/uncheck items
        this.ui.tree.tree.domFocus();
    }
    /**
     * Programmatically accepts an item. Used internally for keyboard navigation.
     * @param inBackground Whether you are accepting an item in the background and keeping the picker open.
     */
    accept(_inBackground) {
        // No-op for now since we expect only multi-select quick trees which don't need
        // the speed of accept.
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVpY2tUcmVlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3F1aWNraW5wdXQvYnJvd3Nlci90cmVlL3F1aWNrVHJlZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxPQUFPLEVBQVcsZUFBZSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDMUYsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUU5QyxPQUFPLEVBQUUsVUFBVSxFQUE4QixNQUFNLGtCQUFrQixDQUFDO0FBQzFFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBRXpELG1CQUFtQjtBQUVuQixNQUFNLE9BQU8sU0FBb0MsU0FBUSxVQUFVO2FBQzFDLHVCQUFrQixHQUFHLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSw4QkFBOEIsQ0FBQyxBQUF0RSxDQUF1RTtJQXdCakgsWUFBWSxFQUFnQjtRQUMzQixLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7UUF2QkYsU0FBSSw4Q0FBNEI7UUFFeEIsV0FBTSxHQUFHLGVBQWUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDdEMsZUFBVSxHQUFHLGVBQWUsQ0FBcUIsV0FBVyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3pFLGlCQUFZLEdBQUcsZUFBZSxDQUFxQixhQUFhLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDN0Usd0JBQW1CLEdBQUcsZUFBZSxDQUFDLG9CQUFvQixFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ25FLGtCQUFhLEdBQUcsZUFBZSxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FB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