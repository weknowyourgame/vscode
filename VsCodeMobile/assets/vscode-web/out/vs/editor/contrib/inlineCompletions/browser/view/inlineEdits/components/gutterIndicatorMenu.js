/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
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
import { n } from '../../../../../../../base/browser/dom.js';
import { ActionBar } from '../../../../../../../base/browser/ui/actionbar/actionbar.js';
import { renderIcon } from '../../../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { KeybindingLabel } from '../../../../../../../base/browser/ui/keybindingLabel/keybindingLabel.js';
import { Codicon } from '../../../../../../../base/common/codicons.js';
import { autorun, constObservable, derived, observableFromEvent, observableValue } from '../../../../../../../base/common/observable.js';
import { OS } from '../../../../../../../base/common/platform.js';
import { ThemeIcon } from '../../../../../../../base/common/themables.js';
import { localize } from '../../../../../../../nls.js';
import { ICommandService } from '../../../../../../../platform/commands/common/commands.js';
import { IContextKeyService } from '../../../../../../../platform/contextkey/common/contextkey.js';
import { nativeHoverDelegate } from '../../../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../../../platform/keybinding/common/keybinding.js';
import { defaultKeybindingLabelStyles } from '../../../../../../../platform/theme/browser/defaultStyles.js';
import { asCssVariable, descriptionForeground, editorActionListForeground, editorHoverBorder } from '../../../../../../../platform/theme/common/colorRegistry.js';
import { hideInlineCompletionId, inlineSuggestCommitId, toggleShowCollapsedId } from '../../../controller/commandIds.js';
let GutterIndicatorMenuContent = class GutterIndicatorMenuContent {
    constructor(_editorObs, _data, _close, _contextKeyService, _keybindingService, _commandService) {
        this._editorObs = _editorObs;
        this._data = _data;
        this._close = _close;
        this._contextKeyService = _contextKeyService;
        this._keybindingService = _keybindingService;
        this._commandService = _commandService;
        this._inlineEditsShowCollapsed = this._editorObs.getOption(71 /* EditorOption.inlineSuggest */).map(s => s.edits.showCollapsed);
    }
    toDisposableLiveElement() {
        return this._createHoverContent().toDisposableLiveElement();
    }
    _createHoverContent() {
        const activeElement = observableValue('active', undefined);
        const createOptionArgs = (options) => {
            return {
                title: options.title,
                icon: options.icon,
                keybinding: typeof options.commandId === 'string' ? this._getKeybinding(options.commandArgs ? undefined : options.commandId) : derived(this, reader => typeof options.commandId === 'string' ? undefined : this._getKeybinding(options.commandArgs ? undefined : options.commandId.read(reader)).read(reader)),
                isActive: activeElement.map(v => v === options.id),
                onHoverChange: v => activeElement.set(v ? options.id : undefined, undefined),
                onAction: () => {
                    this._close(true);
                    return this._commandService.executeCommand(typeof options.commandId === 'string' ? options.commandId : options.commandId.get(), ...(options.commandArgs ?? []));
                },
            };
        };
        const title = header(this._data.displayName);
        const gotoAndAccept = option(createOptionArgs({
            id: 'gotoAndAccept',
            title: `${localize('goto', "Go To")} / ${localize('accept', "Accept")}`,
            icon: Codicon.check,
            commandId: inlineSuggestCommitId
        }));
        const reject = option(createOptionArgs({
            id: 'reject',
            title: localize('reject', "Reject"),
            icon: Codicon.close,
            commandId: hideInlineCompletionId
        }));
        const extensionCommands = this._data.extensionCommands.map((c, idx) => option(createOptionArgs({
            id: c.command.id + '_' + idx,
            title: c.command.title,
            icon: c.icon ?? Codicon.symbolEvent,
            commandId: c.command.id,
            commandArgs: c.command.arguments
        })));
        const toggleCollapsedMode = this._inlineEditsShowCollapsed.map(showCollapsed => showCollapsed ?
            option(createOptionArgs({
                id: 'showExpanded',
                title: localize('showExpanded', "Show Expanded"),
                icon: Codicon.expandAll,
                commandId: toggleShowCollapsedId
            }))
            : option(createOptionArgs({
                id: 'showCollapsed',
                title: localize('showCollapsed', "Show Collapsed"),
                icon: Codicon.collapseAll,
                commandId: toggleShowCollapsedId
            })));
        const snooze = option(createOptionArgs({
            id: 'snooze',
            title: localize('snooze', "Snooze"),
            icon: Codicon.bellSlash,
            commandId: 'editor.action.inlineSuggest.snooze'
        }));
        const settings = option(createOptionArgs({
            id: 'settings',
            title: localize('settings', "Settings"),
            icon: Codicon.gear,
            commandId: 'workbench.action.openSettings',
            commandArgs: ['@tag:nextEditSuggestions']
        }));
        const actions = this._data.action ? [this._data.action] : [];
        const actionBarFooter = actions.length > 0 ? actionBar(actions.map(action => ({
            id: action.id,
            label: action.title + '...',
            enabled: true,
            run: () => this._commandService.executeCommand(action.id, ...(action.arguments ?? [])),
            class: undefined,
            tooltip: action.tooltip ?? action.title
        })), { hoverDelegate: nativeHoverDelegate /* unable to show hover inside another hover */ }) : undefined;
        return hoverContent([
            title,
            gotoAndAccept,
            reject,
            toggleCollapsedMode,
            extensionCommands.length ? separator() : undefined,
            snooze,
            settings,
            ...extensionCommands,
            actionBarFooter ? separator() : undefined,
            actionBarFooter
        ]);
    }
    _getKeybinding(commandId) {
        if (!commandId) {
            return constObservable(undefined);
        }
        return observableFromEvent(this._contextKeyService.onDidChangeContext, () => this._keybindingService.lookupKeybinding(commandId)); // TODO: use contextkeyservice to use different renderings
    }
};
GutterIndicatorMenuContent = __decorate([
    __param(3, IContextKeyService),
    __param(4, IKeybindingService),
    __param(5, ICommandService)
], GutterIndicatorMenuContent);
export { GutterIndicatorMenuContent };
function hoverContent(content) {
    return n.div({
        class: 'content',
        style: {
            margin: 4,
            minWidth: 180,
        }
    }, content);
}
function header(title) {
    return n.div({
        class: 'header',
        style: {
            color: asCssVariable(descriptionForeground),
            fontSize: '13px',
            fontWeight: '600',
            padding: '0 4px',
            lineHeight: 28,
        }
    }, [title]);
}
function option(props) {
    return derived({ name: 'inlineEdits.option' }, (_reader) => n.div({
        class: ['monaco-menu-option', props.isActive?.map(v => v && 'active')],
        onmouseenter: () => props.onHoverChange?.(true),
        onmouseleave: () => props.onHoverChange?.(false),
        onclick: props.onAction,
        onkeydown: e => {
            if (e.key === 'Enter') {
                props.onAction?.();
            }
        },
        tabIndex: 0,
        style: {
            borderRadius: 3, // same as hover widget border radius
        }
    }, [
        n.elem('span', {
            style: {
                fontSize: 16,
                display: 'flex',
            }
        }, [ThemeIcon.isThemeIcon(props.icon) ? renderIcon(props.icon) : props.icon.map(icon => renderIcon(icon))]),
        n.elem('span', {}, [props.title]),
        n.div({
            style: { marginLeft: 'auto' },
            ref: elem => {
                const keybindingLabel = _reader.store.add(new KeybindingLabel(elem, OS, {
                    disableTitle: true,
                    ...defaultKeybindingLabelStyles,
                    keybindingLabelShadow: undefined,
                    keybindingLabelForeground: asCssVariable(descriptionForeground),
                    keybindingLabelBackground: 'transparent',
                    keybindingLabelBorder: 'transparent',
                    keybindingLabelBottomBorder: undefined,
                }));
                _reader.store.add(autorun(reader => {
                    keybindingLabel.set(props.keybinding.read(reader));
                }));
            }
        })
    ]));
}
// TODO: make this observable
function actionBar(actions, options) {
    return derived({ name: 'inlineEdits.actionBar' }, (_reader) => n.div({
        class: ['action-widget-action-bar'],
        style: {
            padding: '3px 24px',
        }
    }, [
        n.div({
            ref: elem => {
                const actionBar = _reader.store.add(new ActionBar(elem, options));
                actionBar.push(actions, { icon: false, label: true });
            }
        })
    ]));
}
function separator() {
    return n.div({
        id: 'inline-edit-gutter-indicator-menu-separator',
        class: 'menu-separator',
        style: {
            color: asCssVariable(editorActionListForeground),
            padding: '2px 0',
        }
    }, n.div({
        style: {
            borderBottom: `1px solid ${asCssVariable(editorHoverBorder)}`,
        }
    }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3V0dGVySW5kaWNhdG9yTWVudS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvY29tcG9uZW50cy9ndXR0ZXJJbmRpY2F0b3JNZW51LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBQ2hHOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBMEIsQ0FBQyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDckYsT0FBTyxFQUFFLFNBQVMsRUFBcUIsTUFBTSw2REFBNkQsQ0FBQztBQUMzRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sOERBQThELENBQUM7QUFDMUYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBRTFHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUV2RSxPQUFPLEVBQWUsT0FBTyxFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDdEosT0FBTyxFQUFFLEVBQUUsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMxRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDdkQsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQzVGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzNGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ25HLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxN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