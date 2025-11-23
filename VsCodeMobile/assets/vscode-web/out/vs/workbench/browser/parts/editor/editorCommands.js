/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { KeyChord } from '../../../../base/common/keyCodes.js';
import { Schemas, matchesScheme } from '../../../../base/common/network.js';
import { extname, isEqual } from '../../../../base/common/resources.js';
import { isNumber, isObject, isString, isUndefined } from '../../../../base/common/types.js';
import { URI } from '../../../../base/common/uri.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { localize, localize2 } from '../../../../nls.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { EditorResolution } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IListService } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { ActiveGroupEditorsByMostRecentlyUsedQuickAccess } from './editorQuickAccess.js';
import { SideBySideEditor } from './sideBySideEditor.js';
import { TextDiffEditor } from './textDiffEditor.js';
import { ActiveEditorCanSplitInGroupContext, ActiveEditorGroupEmptyContext, ActiveEditorGroupLockedContext, ActiveEditorStickyContext, MultipleEditorGroupsContext, SideBySideEditorActiveContext, TextCompareEditorActiveContext } from '../../../common/contextkeys.js';
import { isEditorInputWithOptionsAndGroup } from '../../../common/editor.js';
import { SideBySideEditorInput } from '../../../common/editor/sideBySideEditorInput.js';
import { columnToEditorGroup } from '../../../services/editor/common/editorGroupColumn.js';
import { IEditorGroupsService, preferredSideBySideGroupDirection } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorResolverService } from '../../../services/editor/common/editorResolverService.js';
import { IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IUntitledTextEditorService } from '../../../services/untitled/common/untitledTextEditorService.js';
import { DIFF_FOCUS_OTHER_SIDE, DIFF_FOCUS_PRIMARY_SIDE, DIFF_FOCUS_SECONDARY_SIDE, registerDiffEditorCommands } from './diffEditorCommands.js';
import { resolveCommandsContext } from './editorCommandsContext.js';
import { prepareMoveCopyEditors } from './editor.js';
export const CLOSE_SAVED_EDITORS_COMMAND_ID = 'workbench.action.closeUnmodifiedEditors';
export const CLOSE_EDITORS_IN_GROUP_COMMAND_ID = 'workbench.action.closeEditorsInGroup';
export const CLOSE_EDITORS_AND_GROUP_COMMAND_ID = 'workbench.action.closeEditorsAndGroup';
export const CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID = 'workbench.action.closeEditorsToTheRight';
export const CLOSE_EDITOR_COMMAND_ID = 'workbench.action.closeActiveEditor';
export const CLOSE_PINNED_EDITOR_COMMAND_ID = 'workbench.action.closeActivePinnedEditor';
export const CLOSE_EDITOR_GROUP_COMMAND_ID = 'workbench.action.closeGroup';
export const CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID = 'workbench.action.closeOtherEditors';
export const MOVE_ACTIVE_EDITOR_COMMAND_ID = 'moveActiveEditor';
export const COPY_ACTIVE_EDITOR_COMMAND_ID = 'copyActiveEditor';
export const LAYOUT_EDITOR_GROUPS_COMMAND_ID = 'layoutEditorGroups';
export const KEEP_EDITOR_COMMAND_ID = 'workbench.action.keepEditor';
export const TOGGLE_KEEP_EDITORS_COMMAND_ID = 'workbench.action.toggleKeepEditors';
export const TOGGLE_LOCK_GROUP_COMMAND_ID = 'workbench.action.toggleEditorGroupLock';
export const LOCK_GROUP_COMMAND_ID = 'workbench.action.lockEditorGroup';
export const UNLOCK_GROUP_COMMAND_ID = 'workbench.action.unlockEditorGroup';
export const SHOW_EDITORS_IN_GROUP = 'workbench.action.showEditorsInGroup';
export const REOPEN_WITH_COMMAND_ID = 'workbench.action.reopenWithEditor';
export const REOPEN_ACTIVE_EDITOR_WITH_COMMAND_ID = 'reopenActiveEditorWith';
export const PIN_EDITOR_COMMAND_ID = 'workbench.action.pinEditor';
export const UNPIN_EDITOR_COMMAND_ID = 'workbench.action.unpinEditor';
export const SPLIT_EDITOR = 'workbench.action.splitEditor';
export const SPLIT_EDITOR_UP = 'workbench.action.splitEditorUp';
export const SPLIT_EDITOR_DOWN = 'workbench.action.splitEditorDown';
export const SPLIT_EDITOR_LEFT = 'workbench.action.splitEditorLeft';
export const SPLIT_EDITOR_RIGHT = 'workbench.action.splitEditorRight';
export const MOVE_EDITOR_INTO_ABOVE_GROUP = 'workbench.action.moveEditorToAboveGroup';
export const MOVE_EDITOR_INTO_BELOW_GROUP = 'workbench.action.moveEditorToBelowGroup';
export const MOVE_EDITOR_INTO_LEFT_GROUP = 'workbench.action.moveEditorToLeftGroup';
export const MOVE_EDITOR_INTO_RIGHT_GROUP = 'workbench.action.moveEditorToRightGroup';
export const TOGGLE_MAXIMIZE_EDITOR_GROUP = 'workbench.action.toggleMaximizeEditorGroup';
export const SPLIT_EDITOR_IN_GROUP = 'workbench.action.splitEditorInGroup';
export const TOGGLE_SPLIT_EDITOR_IN_GROUP = 'workbench.action.toggleSplitEditorInGroup';
export const JOIN_EDITOR_IN_GROUP = 'workbench.action.joinEditorInGroup';
export const TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT = 'workbench.action.toggleSplitEditorInGroupLayout';
export const FOCUS_FIRST_SIDE_EDITOR = 'workbench.action.focusFirstSideEditor';
export const FOCUS_SECOND_SIDE_EDITOR = 'workbench.action.focusSecondSideEditor';
export const FOCUS_OTHER_SIDE_EDITOR = 'workbench.action.focusOtherSideEditor';
export const FOCUS_LEFT_GROUP_WITHOUT_WRAP_COMMAND_ID = 'workbench.action.focusLeftGroupWithoutWrap';
export const FOCUS_RIGHT_GROUP_WITHOUT_WRAP_COMMAND_ID = 'workbench.action.focusRightGroupWithoutWrap';
export const FOCUS_ABOVE_GROUP_WITHOUT_WRAP_COMMAND_ID = 'workbench.action.focusAboveGroupWithoutWrap';
export const FOCUS_BELOW_GROUP_WITHOUT_WRAP_COMMAND_ID = 'workbench.action.focusBelowGroupWithoutWrap';
export const OPEN_EDITOR_AT_INDEX_COMMAND_ID = 'workbench.action.openEditorAtIndex';
export const MOVE_EDITOR_INTO_NEW_WINDOW_COMMAND_ID = 'workbench.action.moveEditorToNewWindow';
export const COPY_EDITOR_INTO_NEW_WINDOW_COMMAND_ID = 'workbench.action.copyEditorToNewWindow';
export const MOVE_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID = 'workbench.action.moveEditorGroupToNewWindow';
export const COPY_EDITOR_GROUP_INTO_NEW_WINDOW_COMMAND_ID = 'workbench.action.copyEditorGroupToNewWindow';
export const NEW_EMPTY_EDITOR_WINDOW_COMMAND_ID = 'workbench.action.newEmptyEditorWindow';
export const API_OPEN_EDITOR_COMMAND_ID = '_workbench.open';
export const API_OPEN_DIFF_EDITOR_COMMAND_ID = '_workbench.diff';
export const API_OPEN_WITH_EDITOR_COMMAND_ID = '_workbench.openWith';
export const EDITOR_CORE_NAVIGATION_COMMANDS = [
    SPLIT_EDITOR,
    CLOSE_EDITOR_COMMAND_ID,
    UNPIN_EDITOR_COMMAND_ID,
    UNLOCK_GROUP_COMMAND_ID,
    TOGGLE_MAXIMIZE_EDITOR_GROUP
];
const isSelectedEditorsMoveCopyArg = function (arg) {
    if (!isObject(arg)) {
        return false;
    }
    if (!isString(arg.to)) {
        return false;
    }
    if (!isUndefined(arg.by) && !isString(arg.by)) {
        return false;
    }
    if (!isUndefined(arg.value) && !isNumber(arg.value)) {
        return false;
    }
    return true;
};
function registerActiveEditorMoveCopyCommand() {
    const moveCopyJSONSchema = {
        'type': 'object',
        'required': ['to'],
        'properties': {
            'to': {
                'type': 'string',
                'enum': ['left', 'right']
            },
            'by': {
                'type': 'string',
                'enum': ['tab', 'group']
            },
            'value': {
                'type': 'number'
            }
        }
    };
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: MOVE_ACTIVE_EDITOR_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: EditorContextKeys.editorTextFocus,
        primary: 0,
        handler: (accessor, args) => moveCopySelectedEditors(true, args, accessor),
        metadata: {
            description: localize('editorCommand.activeEditorMove.description', "Move the active editor by tabs or groups"),
            args: [
                {
                    name: localize('editorCommand.activeEditorMove.arg.name', "Active editor move argument"),
                    description: localize('editorCommand.activeEditorMove.arg.description', "Argument Properties:\n\t* 'to': String value providing where to move.\n\t* 'by': String value providing the unit for move (by tab or by group).\n\t* 'value': Number value providing how many positions or an absolute position to move."),
                    constraint: isSelectedEditorsMoveCopyArg,
                    schema: moveCopyJSONSchema
                }
            ]
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: COPY_ACTIVE_EDITOR_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: EditorContextKeys.editorTextFocus,
        primary: 0,
        handler: (accessor, args) => moveCopySelectedEditors(false, args, accessor),
        metadata: {
            description: localize('editorCommand.activeEditorCopy.description', "Copy the active editor by groups"),
            args: [
                {
                    name: localize('editorCommand.activeEditorCopy.arg.name', "Active editor copy argument"),
                    description: localize('editorCommand.activeEditorCopy.arg.description', "Argument Properties:\n\t* 'to': String value providing where to copy.\n\t* 'value': Number value providing how many positions or an absolute position to copy."),
                    constraint: isSelectedEditorsMoveCopyArg,
                    schema: moveCopyJSONSchema
                }
            ]
        }
    });
    function moveCopySelectedEditors(isMove, args = Object.create(null), accessor) {
        args.to = args.to || 'right';
        args.by = args.by || 'tab';
        args.value = typeof args.value === 'number' ? args.value : 1;
        const activeGroup = accessor.get(IEditorGroupsService).activeGroup;
        const selectedEditors = activeGroup.selectedEditors;
        if (selectedEditors.length > 0) {
            switch (args.by) {
                case 'tab':
                    if (isMove) {
                        return moveTabs(args, activeGroup, selectedEditors);
                    }
                    break;
                case 'group':
                    return moveCopyActiveEditorToGroup(isMove, args, activeGroup, selectedEditors, accessor);
            }
        }
    }
    function moveTabs(args, group, editors) {
        const to = args.to;
        if (to === 'first' || to === 'right') {
            editors = [...editors].reverse();
        }
        else if (to === 'position' && (args.value ?? 1) < group.getIndexOfEditor(editors[0])) {
            editors = [...editors].reverse();
        }
        for (const editor of editors) {
            moveTab(args, group, editor);
        }
    }
    function moveTab(args, group, editor) {
        let index = group.getIndexOfEditor(editor);
        switch (args.to) {
            case 'first':
                index = 0;
                break;
            case 'last':
                index = group.count - 1;
                break;
            case 'left':
                index = index - (args.value ?? 1);
                break;
            case 'right':
                index = index + (args.value ?? 1);
                break;
            case 'center':
                index = Math.round(group.count / 2) - 1;
                break;
            case 'position':
                index = (args.value ?? 1) - 1;
                break;
        }
        index = index < 0 ? 0 : index >= group.count ? group.count - 1 : index;
        group.moveEditor(editor, group, { index });
    }
    function moveCopyActiveEditorToGroup(isMove, args, sourceGroup, editors, accessor) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const configurationService = accessor.get(IConfigurationService);
        let targetGroup;
        switch (args.to) {
            case 'left':
                targetGroup = editorGroupsService.findGroup({ direction: 2 /* GroupDirection.LEFT */ }, sourceGroup);
                if (!targetGroup) {
                    targetGroup = editorGroupsService.addGroup(sourceGroup, 2 /* GroupDirection.LEFT */);
                }
                break;
            case 'right':
                targetGroup = editorGroupsService.findGroup({ direction: 3 /* GroupDirection.RIGHT */ }, sourceGroup);
                if (!targetGroup) {
                    targetGroup = editorGroupsService.addGroup(sourceGroup, 3 /* GroupDirection.RIGHT */);
                }
                break;
            case 'up':
                targetGroup = editorGroupsService.findGroup({ direction: 0 /* GroupDirection.UP */ }, sourceGroup);
                if (!targetGroup) {
                    targetGroup = editorGroupsService.addGroup(sourceGroup, 0 /* GroupDirection.UP */);
                }
                break;
            case 'down':
                targetGroup = editorGroupsService.findGroup({ direction: 1 /* GroupDirection.DOWN */ }, sourceGroup);
                if (!targetGroup) {
                    targetGroup = editorGroupsService.addGroup(sourceGroup, 1 /* GroupDirection.DOWN */);
                }
                break;
            case 'first':
                targetGroup = editorGroupsService.findGroup({ location: 0 /* GroupLocation.FIRST */ }, sourceGroup);
                break;
            case 'last':
                targetGroup = editorGroupsService.findGroup({ location: 1 /* GroupLocation.LAST */ }, sourceGroup);
                break;
            case 'previous':
                targetGroup = editorGroupsService.findGroup({ location: 3 /* GroupLocation.PREVIOUS */ }, sourceGroup);
                if (!targetGroup) {
                    const oppositeDirection = preferredSideBySideGroupDirection(configurationService) === 3 /* GroupDirection.RIGHT */ ? 2 /* GroupDirection.LEFT */ : 0 /* GroupDirection.UP */;
                    targetGroup = editorGroupsService.addGroup(sourceGroup, oppositeDirection);
                }
                break;
            case 'next':
                targetGroup = editorGroupsService.findGroup({ location: 2 /* GroupLocation.NEXT */ }, sourceGroup);
                if (!targetGroup) {
                    targetGroup = editorGroupsService.addGroup(sourceGroup, preferredSideBySideGroupDirection(configurationService));
                }
                break;
            case 'center':
                targetGroup = editorGroupsService.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */)[(editorGroupsService.count / 2) - 1];
                break;
            case 'position':
                targetGroup = editorGroupsService.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */)[(args.value ?? 1) - 1];
                break;
        }
        if (targetGroup) {
            const editorsWithOptions = prepareMoveCopyEditors(sourceGroup, editors);
            if (isMove) {
                sourceGroup.moveEditors(editorsWithOptions, targetGroup);
            }
            else if (sourceGroup.id !== targetGroup.id) {
                sourceGroup.copyEditors(editorsWithOptions, targetGroup);
            }
            targetGroup.focus();
        }
    }
}
function registerEditorGroupsLayoutCommands() {
    function applyEditorLayout(accessor, layout) {
        if (!layout || typeof layout !== 'object') {
            return;
        }
        const editorGroupsService = accessor.get(IEditorGroupsService);
        editorGroupsService.applyLayout(layout);
    }
    CommandsRegistry.registerCommand(LAYOUT_EDITOR_GROUPS_COMMAND_ID, (accessor, args) => {
        applyEditorLayout(accessor, args);
    });
    // API Commands
    CommandsRegistry.registerCommand({
        id: 'vscode.setEditorLayout',
        handler: (accessor, args) => applyEditorLayout(accessor, args),
        metadata: {
            'description': `Set the editor layout. Editor layout is represented as a tree of groups in which the first group is the root group of the layout.
					The orientation of the first group is 0 (horizontal) by default unless specified otherwise. The other orientations are 1 (vertical).
					The orientation of subsequent groups is the opposite of the orientation of the group that contains it.
					Here are some examples: A layout representing 1 row and 2 columns: { orientation: 0, groups: [{}, {}] }.
					A layout representing 3 rows and 1 column: { orientation: 1, groups: [{}, {}, {}] }.
					A layout representing 3 rows and 1 column in which the second row has 2 columns: { orientation: 1, groups: [{}, { groups: [{}, {}] }, {}] }
					`,
            args: [{
                    name: 'args',
                    schema: {
                        'type': 'object',
                        'required': ['groups'],
                        'properties': {
                            'orientation': {
                                'type': 'number',
                                'default': 0,
                                'description': `The orientation of the root group in the layout. 0 for horizontal, 1 for vertical.`,
                                'enum': [0, 1],
                                'enumDescriptions': [
                                    localize('editorGroupLayout.horizontal', "Horizontal"),
                                    localize('editorGroupLayout.vertical', "Vertical")
                                ],
                            },
                            'groups': {
                                '$ref': '#/definitions/editorGroupsSchema',
                                'default': [{}, {}]
                            }
                        }
                    }
                }]
        }
    });
    CommandsRegistry.registerCommand({
        id: 'vscode.getEditorLayout',
        handler: (accessor) => {
            const editorGroupsService = accessor.get(IEditorGroupsService);
            return editorGroupsService.getLayout();
        },
        metadata: {
            description: 'Get Editor Layout',
            args: [],
            returns: 'An editor layout object, in the same format as vscode.setEditorLayout'
        }
    });
}
function registerOpenEditorAPICommands() {
    function mixinContext(context, options, column) {
        if (!context) {
            return [options, column];
        }
        return [
            { ...context.editorOptions, ...(options ?? Object.create(null)) },
            context.sideBySide ? SIDE_GROUP : column
        ];
    }
    // partial, renderer-side API command to open editor only supporting
    // arguments that do not need to be converted from the extension host
    // complements https://github.com/microsoft/vscode/blob/2b164efb0e6a5de3826bff62683eaeafe032284f/src/vs/workbench/api/common/extHostApiCommands.ts#L373
    CommandsRegistry.registerCommand({
        id: 'vscode.open',
        handler: (accessor, arg) => {
            accessor.get(ICommandService).executeCommand(API_OPEN_EDITOR_COMMAND_ID, arg);
        },
        metadata: {
            description: 'Opens the provided resource in the editor.',
            args: [{ name: 'Uri' }]
        }
    });
    CommandsRegistry.registerCommand(API_OPEN_EDITOR_COMMAND_ID, async function (accessor, resourceArg, columnAndOptions, label, context) {
        const editorService = accessor.get(IEditorService);
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const openerService = accessor.get(IOpenerService);
        const pathService = accessor.get(IPathService);
        const configurationService = accessor.get(IConfigurationService);
        const untitledTextEditorService = accessor.get(IUntitledTextEditorService);
        const resourceOrString = typeof resourceArg === 'string' ? resourceArg : URI.from(resourceArg, true);
        const [columnArg, optionsArg] = columnAndOptions ?? [];
        // use editor options or editor view column or resource scheme
        // as a hint to use the editor service for opening directly
        if (optionsArg || typeof columnArg === 'number' || matchesScheme(resourceOrString, Schemas.untitled)) {
            const [options, column] = mixinContext(context, optionsArg, columnArg);
            const resource = URI.isUri(resourceOrString) ? resourceOrString : URI.parse(resourceOrString);
            let input;
            if (untitledTextEditorService.isUntitledWithAssociatedResource(resource)) {
                // special case for untitled: we are getting a resource with meaningful
                // path from an extension to use for the untitled editor. as such, we
                // have to assume it as an associated resource to use when saving. we
                // do so by setting the `forceUntitled: true` and changing the scheme
                // to a file based one. the untitled editor service takes care to
                // associate the path properly then.
                input = { resource: resource.with({ scheme: pathService.defaultUriScheme }), forceUntitled: true, options, label };
            }
            else {
                // use any other resource as is
                input = { resource, options, label };
            }
            await editorService.openEditor(input, columnToEditorGroup(editorGroupsService, configurationService, column));
        }
        // do not allow to execute commands from here
        else if (matchesScheme(resourceOrString, Schemas.command)) {
            return;
        }
        // finally, delegate to opener service
        else {
            await openerService.open(resourceOrString, { openToSide: context?.sideBySide, editorOptions: context?.editorOptions });
        }
    });
    // partial, renderer-side API command to open diff editor only supporting
    // arguments that do not need to be converted from the extension host
    // complements https://github.com/microsoft/vscode/blob/2b164efb0e6a5de3826bff62683eaeafe032284f/src/vs/workbench/api/common/extHostApiCommands.ts#L397
    CommandsRegistry.registerCommand({
        id: 'vscode.diff',
        handler: (accessor, left, right, label) => {
            accessor.get(ICommandService).executeCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, left, right, label);
        },
        metadata: {
            description: 'Opens the provided resources in the diff editor to compare their contents.',
            args: [
                { name: 'left', description: 'Left-hand side resource of the diff editor' },
                { name: 'right', description: 'Right-hand side resource of the diff editor' },
                { name: 'title', description: 'Human readable title for the diff editor' },
            ]
        }
    });
    CommandsRegistry.registerCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID, async function (accessor, originalResource, modifiedResource, labelAndOrDescription, columnAndOptions, context) {
        const editorService = accessor.get(IEditorService);
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const configurationService = accessor.get(IConfigurationService);
        const [columnArg, optionsArg] = columnAndOptions ?? [];
        const [options, column] = mixinContext(context, optionsArg, columnArg);
        let label = undefined;
        let description = undefined;
        if (typeof labelAndOrDescription === 'string') {
            label = labelAndOrDescription;
        }
        else if (labelAndOrDescription) {
            label = labelAndOrDescription.label;
            description = labelAndOrDescription.description;
        }
        await editorService.openEditor({
            original: { resource: URI.from(originalResource, true) },
            modified: { resource: URI.from(modifiedResource, true) },
            label,
            description,
            options
        }, columnToEditorGroup(editorGroupsService, configurationService, column));
    });
    CommandsRegistry.registerCommand(API_OPEN_WITH_EDITOR_COMMAND_ID, async (accessor, resource, id, columnAndOptions) => {
        const editorService = accessor.get(IEditorService);
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const configurationService = accessor.get(IConfigurationService);
        const [columnArg, optionsArg] = columnAndOptions ?? [];
        await editorService.openEditor({ resource: URI.from(resource, true), options: { pinned: true, ...optionsArg, override: id } }, columnToEditorGroup(editorGroupsService, configurationService, columnArg));
    });
    // partial, renderer-side API command to open diff editor only supporting
    // arguments that do not need to be converted from the extension host
    // complements https://github.com/microsoft/vscode/blob/2b164efb0e6a5de3826bff62683eaeafe032284f/src/vs/workbench/api/common/extHostApiCommands.ts#L397
    CommandsRegistry.registerCommand({
        id: 'vscode.changes',
        handler: (accessor, title, resources) => {
            accessor.get(ICommandService).executeCommand('_workbench.changes', title, resources);
        },
        metadata: {
            description: 'Opens a list of resources in the changes editor to compare their contents.',
            args: [
                { name: 'title', description: 'Human readable title for the diff editor' },
                { name: 'resources', description: 'List of resources to open in the changes editor' }
            ]
        }
    });
    CommandsRegistry.registerCommand('_workbench.changes', async (accessor, title, resources) => {
        const editorService = accessor.get(IEditorService);
        const editor = [];
        for (const [label, original, modified] of resources) {
            editor.push({
                resource: URI.revive(label),
                original: { resource: URI.revive(original) },
                modified: { resource: URI.revive(modified) },
            });
        }
        await editorService.openEditor({ resources: editor, label: title });
    });
    CommandsRegistry.registerCommand('_workbench.openMultiDiffEditor', async (accessor, options) => {
        const editorService = accessor.get(IEditorService);
        const resources = options.resources?.map(r => ({ original: { resource: URI.revive(r.originalUri) }, modified: { resource: URI.revive(r.modifiedUri) } }));
        const revealUri = options.reveal?.modifiedUri ? URI.revive(options.reveal.modifiedUri) : undefined;
        const revealResource = revealUri && resources ? resources.find(r => isEqual(r.modified.resource, revealUri)) : undefined;
        if (options.reveal && !revealResource) {
            console.error('Reveal resource not found');
        }
        const multiDiffEditorOptions = {
            viewState: revealResource ? {
                revealData: {
                    resource: {
                        original: revealResource.original.resource,
                        modified: revealResource.modified.resource,
                    },
                    range: options.reveal?.range,
                }
            } : undefined
        };
        await editorService.openEditor({
            multiDiffSource: options.multiDiffSourceUri ? URI.revive(options.multiDiffSourceUri) : undefined,
            resources,
            label: options.title,
            options: multiDiffEditorOptions,
        });
    });
}
function registerOpenEditorAtIndexCommands() {
    const openEditorAtIndex = (accessor, editorIndex) => {
        const editorService = accessor.get(IEditorService);
        const activeEditorPane = editorService.activeEditorPane;
        if (activeEditorPane && typeof editorIndex === 'number') {
            const editor = activeEditorPane.group.getEditorByIndex(editorIndex);
            if (editor) {
                editorService.openEditor(editor);
            }
        }
    };
    // This command takes in the editor index number to open as an argument
    CommandsRegistry.registerCommand({
        id: OPEN_EDITOR_AT_INDEX_COMMAND_ID,
        handler: openEditorAtIndex
    });
    // Keybindings to focus a specific index in the tab folder if tabs are enabled
    for (let i = 0; i < 9; i++) {
        const editorIndex = i;
        const visibleIndex = i + 1;
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: OPEN_EDITOR_AT_INDEX_COMMAND_ID + visibleIndex,
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: undefined,
            primary: 512 /* KeyMod.Alt */ | toKeyCode(visibleIndex),
            mac: { primary: 256 /* KeyMod.WinCtrl */ | toKeyCode(visibleIndex) },
            handler: accessor => openEditorAtIndex(accessor, editorIndex)
        });
    }
    function toKeyCode(index) {
        switch (index) {
            case 0: return 21 /* KeyCode.Digit0 */;
            case 1: return 22 /* KeyCode.Digit1 */;
            case 2: return 23 /* KeyCode.Digit2 */;
            case 3: return 24 /* KeyCode.Digit3 */;
            case 4: return 25 /* KeyCode.Digit4 */;
            case 5: return 26 /* KeyCode.Digit5 */;
            case 6: return 27 /* KeyCode.Digit6 */;
            case 7: return 28 /* KeyCode.Digit7 */;
            case 8: return 29 /* KeyCode.Digit8 */;
            case 9: return 30 /* KeyCode.Digit9 */;
        }
        throw new Error('invalid index');
    }
}
function registerFocusEditorGroupAtIndexCommands() {
    // Keybindings to focus a specific group (2-8) in the editor area
    for (let groupIndex = 1; groupIndex < 8; groupIndex++) {
        KeybindingsRegistry.registerCommandAndKeybindingRule({
            id: toCommandId(groupIndex),
            weight: 200 /* KeybindingWeight.WorkbenchContrib */,
            when: undefined,
            primary: 2048 /* KeyMod.CtrlCmd */ | toKeyCode(groupIndex),
            handler: accessor => {
                const editorGroupsService = accessor.get(IEditorGroupsService);
                const configurationService = accessor.get(IConfigurationService);
                // To keep backwards compatibility (pre-grid), allow to focus a group
                // that does not exist as long as it is the next group after the last
                // opened group. Otherwise we return.
                if (groupIndex > editorGroupsService.count) {
                    return;
                }
                // Group exists: just focus
                const groups = editorGroupsService.getGroups(2 /* GroupsOrder.GRID_APPEARANCE */);
                if (groups[groupIndex]) {
                    return groups[groupIndex].focus();
                }
                // Group does not exist: create new by splitting the active one of the last group
                const direction = preferredSideBySideGroupDirection(configurationService);
                const lastGroup = editorGroupsService.findGroup({ location: 1 /* GroupLocation.LAST */ });
                if (!lastGroup) {
                    return;
                }
                const newGroup = editorGroupsService.addGroup(lastGroup, direction);
                // Focus
                newGroup.focus();
            }
        });
    }
    function toCommandId(index) {
        switch (index) {
            case 1: return 'workbench.action.focusSecondEditorGroup';
            case 2: return 'workbench.action.focusThirdEditorGroup';
            case 3: return 'workbench.action.focusFourthEditorGroup';
            case 4: return 'workbench.action.focusFifthEditorGroup';
            case 5: return 'workbench.action.focusSixthEditorGroup';
            case 6: return 'workbench.action.focusSeventhEditorGroup';
            case 7: return 'workbench.action.focusEighthEditorGroup';
        }
        throw new Error('Invalid index');
    }
    function toKeyCode(index) {
        switch (index) {
            case 1: return 23 /* KeyCode.Digit2 */;
            case 2: return 24 /* KeyCode.Digit3 */;
            case 3: return 25 /* KeyCode.Digit4 */;
            case 4: return 26 /* KeyCode.Digit5 */;
            case 5: return 27 /* KeyCode.Digit6 */;
            case 6: return 28 /* KeyCode.Digit7 */;
            case 7: return 29 /* KeyCode.Digit8 */;
        }
        throw new Error('Invalid index');
    }
}
export function splitEditor(editorGroupsService, direction, resolvedContext) {
    if (!resolvedContext.groupedEditors.length) {
        return;
    }
    // Only support splitting from one source group
    const { group, editors } = resolvedContext.groupedEditors[0];
    const preserveFocus = resolvedContext.preserveFocus;
    const newGroup = editorGroupsService.addGroup(group, direction);
    for (const editorToCopy of editors) {
        // Split editor (if it can be split)
        if (editorToCopy && !editorToCopy.hasCapability(8 /* EditorInputCapabilities.Singleton */)) {
            group.copyEditor(editorToCopy, newGroup, { preserveFocus });
        }
    }
    // Focus
    newGroup.focus();
}
function registerSplitEditorCommands() {
    [
        { id: SPLIT_EDITOR_UP, direction: 0 /* GroupDirection.UP */ },
        { id: SPLIT_EDITOR_DOWN, direction: 1 /* GroupDirection.DOWN */ },
        { id: SPLIT_EDITOR_LEFT, direction: 2 /* GroupDirection.LEFT */ },
        { id: SPLIT_EDITOR_RIGHT, direction: 3 /* GroupDirection.RIGHT */ }
    ].forEach(({ id, direction }) => {
        CommandsRegistry.registerCommand(id, function (accessor, ...args) {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            splitEditor(accessor.get(IEditorGroupsService), direction, resolvedContext);
        });
    });
}
function registerCloseEditorCommands() {
    // A special handler for "Close Editor" depending on context
    // - keybindining: do not close sticky editors, rather open the next non-sticky editor
    // - menu: always close editor, even sticky ones
    function closeEditorHandler(accessor, forceCloseStickyEditors, ...args) {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const editorService = accessor.get(IEditorService);
        let keepStickyEditors = undefined;
        if (forceCloseStickyEditors) {
            keepStickyEditors = false; // explicitly close sticky editors
        }
        else if (args.length) {
            keepStickyEditors = false; // we have a context, as such this command was used e.g. from the tab context menu
        }
        else {
            keepStickyEditors = editorGroupsService.partOptions.preventPinnedEditorClose === 'keyboard' || editorGroupsService.partOptions.preventPinnedEditorClose === 'keyboardAndMouse'; // respect setting otherwise
        }
        // Skip over sticky editor and select next if we are configured to do so
        if (keepStickyEditors) {
            const activeGroup = editorGroupsService.activeGroup;
            const activeEditor = activeGroup.activeEditor;
            if (activeEditor && activeGroup.isSticky(activeEditor)) {
                // Open next recently active in same group
                const nextNonStickyEditorInGroup = activeGroup.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */, { excludeSticky: true })[0];
                if (nextNonStickyEditorInGroup) {
                    return activeGroup.openEditor(nextNonStickyEditorInGroup);
                }
                // Open next recently active across all groups
                const nextNonStickyEditorInAllGroups = editorService.getEditors(0 /* EditorsOrder.MOST_RECENTLY_ACTIVE */, { excludeSticky: true })[0];
                if (nextNonStickyEditorInAllGroups) {
                    return Promise.resolve(editorGroupsService.getGroup(nextNonStickyEditorInAllGroups.groupId)?.openEditor(nextNonStickyEditorInAllGroups.editor));
                }
            }
        }
        // With context: proceed to close editors as instructed
        const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
        const preserveFocus = resolvedContext.preserveFocus;
        return Promise.all(resolvedContext.groupedEditors.map(async ({ group, editors }) => {
            const editorsToClose = editors.filter(editor => !keepStickyEditors || !group.isSticky(editor));
            await group.closeEditors(editorsToClose, { preserveFocus });
        }));
    }
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: CLOSE_EDITOR_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: 2048 /* KeyMod.CtrlCmd */ | 53 /* KeyCode.KeyW */,
        win: { primary: 2048 /* KeyMod.CtrlCmd */ | 62 /* KeyCode.F4 */, secondary: [2048 /* KeyMod.CtrlCmd */ | 53 /* KeyCode.KeyW */] },
        handler: (accessor, ...args) => {
            return closeEditorHandler(accessor, false, ...args);
        }
    });
    CommandsRegistry.registerCommand(CLOSE_PINNED_EDITOR_COMMAND_ID, (accessor, ...args) => {
        return closeEditorHandler(accessor, true /* force close pinned editors */, ...args);
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: CLOSE_EDITORS_IN_GROUP_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 53 /* KeyCode.KeyW */),
        handler: (accessor, ...args) => {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            return Promise.all(resolvedContext.groupedEditors.map(async ({ group }) => {
                await group.closeAllEditors({ excludeSticky: true });
            }));
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: CLOSE_EDITOR_GROUP_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: ContextKeyExpr.and(ActiveEditorGroupEmptyContext, MultipleEditorGroupsContext),
        primary: 2048 /* KeyMod.CtrlCmd */ | 53 /* KeyCode.KeyW */,
        win: { primary: 2048 /* KeyMod.CtrlCmd */ | 62 /* KeyCode.F4 */, secondary: [2048 /* KeyMod.CtrlCmd */ | 53 /* KeyCode.KeyW */] },
        handler: (accessor, ...args) => {
            const editorGroupsService = accessor.get(IEditorGroupsService);
            const commandsContext = resolveCommandsContext(args, accessor.get(IEditorService), editorGroupsService, accessor.get(IListService));
            if (commandsContext.groupedEditors.length) {
                editorGroupsService.removeGroup(commandsContext.groupedEditors[0].group);
            }
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: CLOSE_SAVED_EDITORS_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 51 /* KeyCode.KeyU */),
        handler: (accessor, ...args) => {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            return Promise.all(resolvedContext.groupedEditors.map(async ({ group }) => {
                await group.closeEditors({ savedOnly: true, excludeSticky: true }, { preserveFocus: resolvedContext.preserveFocus });
            }));
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: CLOSE_OTHER_EDITORS_IN_GROUP_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 512 /* KeyMod.Alt */ | 50 /* KeyCode.KeyT */ },
        handler: (accessor, ...args) => {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            return Promise.all(resolvedContext.groupedEditors.map(async ({ group, editors }) => {
                const editorsToClose = group.getEditors(1 /* EditorsOrder.SEQUENTIAL */, { excludeSticky: true }).filter(editor => !editors.includes(editor));
                for (const editorToKeep of editors) {
                    if (editorToKeep) {
                        group.pinEditor(editorToKeep);
                    }
                }
                await group.closeEditors(editorsToClose, { preserveFocus: resolvedContext.preserveFocus });
            }));
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: CLOSE_EDITORS_TO_THE_RIGHT_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: async (accessor, ...args) => {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            if (resolvedContext.groupedEditors.length) {
                const { group, editors } = resolvedContext.groupedEditors[0];
                if (group.activeEditor) {
                    group.pinEditor(group.activeEditor);
                }
                await group.closeEditors({ direction: 1 /* CloseDirection.RIGHT */, except: editors[0], excludeSticky: true }, { preserveFocus: resolvedContext.preserveFocus });
            }
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: REOPEN_WITH_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => {
            return reopenEditorWith(accessor, EditorResolution.PICK, ...args);
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: REOPEN_ACTIVE_EDITOR_WITH_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, override, ...args) => {
            return reopenEditorWith(accessor, override ?? EditorResolution.PICK, ...args);
        }
    });
    async function reopenEditorWith(accessor, editorOverride, ...args) {
        const editorService = accessor.get(IEditorService);
        const editorResolverService = accessor.get(IEditorResolverService);
        const telemetryService = accessor.get(ITelemetryService);
        const resolvedContext = resolveCommandsContext(args, editorService, accessor.get(IEditorGroupsService), accessor.get(IListService));
        const editorReplacements = new Map();
        for (const { group, editors } of resolvedContext.groupedEditors) {
            for (const editor of editors) {
                const untypedEditor = editor.toUntyped();
                if (!untypedEditor) {
                    return; // Resolver can only resolve untyped editors
                }
                untypedEditor.options = { ...editorService.activeEditorPane?.options, override: editorOverride };
                const resolvedEditor = await editorResolverService.resolveEditor(untypedEditor, group);
                if (!isEditorInputWithOptionsAndGroup(resolvedEditor)) {
                    return;
                }
                let editorReplacementsInGroup = editorReplacements.get(group);
                if (!editorReplacementsInGroup) {
                    editorReplacementsInGroup = [];
                    editorReplacements.set(group, editorReplacementsInGroup);
                }
                editorReplacementsInGroup.push({
                    editor: editor,
                    replacement: resolvedEditor.editor,
                    forceReplaceDirty: editor.resource?.scheme === Schemas.untitled,
                    options: resolvedEditor.options
                });
                telemetryService.publicLog2('workbenchEditorReopen', {
                    scheme: editor.resource?.scheme ?? '',
                    ext: editor.resource ? extname(editor.resource) : '',
                    from: editor.editorId ?? '',
                    to: resolvedEditor.editor.editorId ?? ''
                });
            }
        }
        // Replace editor with resolved one and make active
        for (const [group, replacements] of editorReplacements) {
            await group.replaceEditors(replacements);
            await group.openEditor(replacements[0].replacement);
        }
    }
    CommandsRegistry.registerCommand(CLOSE_EDITORS_AND_GROUP_COMMAND_ID, async (accessor, ...args) => {
        const editorGroupsService = accessor.get(IEditorGroupsService);
        const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), editorGroupsService, accessor.get(IListService));
        if (resolvedContext.groupedEditors.length) {
            const { group } = resolvedContext.groupedEditors[0];
            await group.closeAllEditors();
            if (group.count === 0 && editorGroupsService.getGroup(group.id) /* could be gone by now */) {
                editorGroupsService.removeGroup(group); // only remove group if it is now empty
            }
        }
    });
}
function registerFocusEditorGroupWihoutWrapCommands() {
    const commands = [
        {
            id: FOCUS_LEFT_GROUP_WITHOUT_WRAP_COMMAND_ID,
            direction: 2 /* GroupDirection.LEFT */
        },
        {
            id: FOCUS_RIGHT_GROUP_WITHOUT_WRAP_COMMAND_ID,
            direction: 3 /* GroupDirection.RIGHT */
        },
        {
            id: FOCUS_ABOVE_GROUP_WITHOUT_WRAP_COMMAND_ID,
            direction: 0 /* GroupDirection.UP */,
        },
        {
            id: FOCUS_BELOW_GROUP_WITHOUT_WRAP_COMMAND_ID,
            direction: 1 /* GroupDirection.DOWN */
        }
    ];
    for (const command of commands) {
        CommandsRegistry.registerCommand(command.id, async (accessor) => {
            const editorGroupsService = accessor.get(IEditorGroupsService);
            const group = editorGroupsService.findGroup({ direction: command.direction }, editorGroupsService.activeGroup, false) ?? editorGroupsService.activeGroup;
            group.focus();
        });
    }
}
function registerSplitEditorInGroupCommands() {
    async function splitEditorInGroup(accessor, resolvedContext) {
        const instantiationService = accessor.get(IInstantiationService);
        if (!resolvedContext.groupedEditors.length) {
            return;
        }
        const { group, editors } = resolvedContext.groupedEditors[0];
        const editor = editors[0];
        if (!editor) {
            return;
        }
        await group.replaceEditors([{
                editor,
                replacement: instantiationService.createInstance(SideBySideEditorInput, undefined, undefined, editor, editor),
                forceReplaceDirty: true
            }]);
    }
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: SPLIT_EDITOR_IN_GROUP,
                title: localize2('splitEditorInGroup', 'Split Editor in Group'),
                category: Categories.View,
                precondition: ActiveEditorCanSplitInGroupContext,
                f1: true,
                keybinding: {
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    when: ActiveEditorCanSplitInGroupContext,
                    primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 93 /* KeyCode.Backslash */)
                }
            });
        }
        run(accessor, ...args) {
            return splitEditorInGroup(accessor, resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService)));
        }
    });
    async function joinEditorInGroup(resolvedContext) {
        if (!resolvedContext.groupedEditors.length) {
            return;
        }
        const { group, editors } = resolvedContext.groupedEditors[0];
        const editor = editors[0];
        if (!editor) {
            return;
        }
        if (!(editor instanceof SideBySideEditorInput)) {
            return;
        }
        let options = undefined;
        const activeEditorPane = group.activeEditorPane;
        if (activeEditorPane instanceof SideBySideEditor && group.activeEditor === editor) {
            for (const pane of [activeEditorPane.getPrimaryEditorPane(), activeEditorPane.getSecondaryEditorPane()]) {
                if (pane?.hasFocus()) {
                    options = { viewState: pane.getViewState() };
                    break;
                }
            }
        }
        await group.replaceEditors([{
                editor,
                replacement: editor.primary,
                options
            }]);
    }
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: JOIN_EDITOR_IN_GROUP,
                title: localize2('joinEditorInGroup', 'Join Editor in Group'),
                category: Categories.View,
                precondition: SideBySideEditorActiveContext,
                f1: true,
                keybinding: {
                    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
                    when: SideBySideEditorActiveContext,
                    primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 2048 /* KeyMod.CtrlCmd */ | 1024 /* KeyMod.Shift */ | 93 /* KeyCode.Backslash */)
                }
            });
        }
        run(accessor, ...args) {
            return joinEditorInGroup(resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService)));
        }
    });
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: TOGGLE_SPLIT_EDITOR_IN_GROUP,
                title: localize2('toggleJoinEditorInGroup', 'Toggle Split Editor in Group'),
                category: Categories.View,
                precondition: ContextKeyExpr.or(ActiveEditorCanSplitInGroupContext, SideBySideEditorActiveContext),
                f1: true
            });
        }
        async run(accessor, ...args) {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            if (!resolvedContext.groupedEditors.length) {
                return;
            }
            const { editors } = resolvedContext.groupedEditors[0];
            if (editors[0] instanceof SideBySideEditorInput) {
                await joinEditorInGroup(resolvedContext);
            }
            else if (editors[0]) {
                await splitEditorInGroup(accessor, resolvedContext);
            }
        }
    });
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: TOGGLE_SPLIT_EDITOR_IN_GROUP_LAYOUT,
                title: localize2('toggleSplitEditorInGroupLayout', 'Toggle Layout of Split Editor in Group'),
                category: Categories.View,
                precondition: SideBySideEditorActiveContext,
                f1: true
            });
        }
        async run(accessor) {
            const configurationService = accessor.get(IConfigurationService);
            const currentSetting = configurationService.getValue(SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING);
            let newSetting;
            if (currentSetting !== 'horizontal') {
                newSetting = 'horizontal';
            }
            else {
                newSetting = 'vertical';
            }
            return configurationService.updateValue(SideBySideEditor.SIDE_BY_SIDE_LAYOUT_SETTING, newSetting);
        }
    });
}
function registerFocusSideEditorsCommands() {
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: FOCUS_FIRST_SIDE_EDITOR,
                title: localize2('focusLeftSideEditor', 'Focus First Side in Active Editor'),
                category: Categories.View,
                precondition: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
                f1: true
            });
        }
        async run(accessor) {
            const editorService = accessor.get(IEditorService);
            const commandService = accessor.get(ICommandService);
            const activeEditorPane = editorService.activeEditorPane;
            if (activeEditorPane instanceof SideBySideEditor) {
                activeEditorPane.getSecondaryEditorPane()?.focus();
            }
            else if (activeEditorPane instanceof TextDiffEditor) {
                await commandService.executeCommand(DIFF_FOCUS_SECONDARY_SIDE);
            }
        }
    });
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: FOCUS_SECOND_SIDE_EDITOR,
                title: localize2('focusRightSideEditor', 'Focus Second Side in Active Editor'),
                category: Categories.View,
                precondition: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
                f1: true
            });
        }
        async run(accessor) {
            const editorService = accessor.get(IEditorService);
            const commandService = accessor.get(ICommandService);
            const activeEditorPane = editorService.activeEditorPane;
            if (activeEditorPane instanceof SideBySideEditor) {
                activeEditorPane.getPrimaryEditorPane()?.focus();
            }
            else if (activeEditorPane instanceof TextDiffEditor) {
                await commandService.executeCommand(DIFF_FOCUS_PRIMARY_SIDE);
            }
        }
    });
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: FOCUS_OTHER_SIDE_EDITOR,
                title: localize2('focusOtherSideEditor', 'Focus Other Side in Active Editor'),
                category: Categories.View,
                precondition: ContextKeyExpr.or(SideBySideEditorActiveContext, TextCompareEditorActiveContext),
                f1: true
            });
        }
        async run(accessor) {
            const editorService = accessor.get(IEditorService);
            const commandService = accessor.get(ICommandService);
            const activeEditorPane = editorService.activeEditorPane;
            if (activeEditorPane instanceof SideBySideEditor) {
                if (activeEditorPane.getPrimaryEditorPane()?.hasFocus()) {
                    activeEditorPane.getSecondaryEditorPane()?.focus();
                }
                else {
                    activeEditorPane.getPrimaryEditorPane()?.focus();
                }
            }
            else if (activeEditorPane instanceof TextDiffEditor) {
                await commandService.executeCommand(DIFF_FOCUS_OTHER_SIDE);
            }
        }
    });
}
function registerOtherEditorCommands() {
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: KEEP_EDITOR_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 3 /* KeyCode.Enter */),
        handler: async (accessor, ...args) => {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            for (const { group, editors } of resolvedContext.groupedEditors) {
                for (const editor of editors) {
                    group.pinEditor(editor);
                }
            }
        }
    });
    CommandsRegistry.registerCommand({
        id: TOGGLE_KEEP_EDITORS_COMMAND_ID,
        handler: accessor => {
            const configurationService = accessor.get(IConfigurationService);
            const currentSetting = configurationService.getValue('workbench.editor.enablePreview');
            const newSetting = currentSetting !== true;
            configurationService.updateValue('workbench.editor.enablePreview', newSetting);
        }
    });
    function setEditorGroupLock(accessor, locked, ...args) {
        const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
        const group = resolvedContext.groupedEditors[0]?.group;
        group?.lock(locked ?? !group.isLocked);
    }
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: TOGGLE_LOCK_GROUP_COMMAND_ID,
                title: localize2('toggleEditorGroupLock', 'Toggle Editor Group Lock'),
                category: Categories.View,
                f1: true
            });
        }
        async run(accessor, ...args) {
            setEditorGroupLock(accessor, undefined, ...args);
        }
    });
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: LOCK_GROUP_COMMAND_ID,
                title: localize2('lockEditorGroup', 'Lock Editor Group'),
                category: Categories.View,
                precondition: ActiveEditorGroupLockedContext.toNegated(),
                f1: true
            });
        }
        async run(accessor, ...args) {
            setEditorGroupLock(accessor, true, ...args);
        }
    });
    registerAction2(class extends Action2 {
        constructor() {
            super({
                id: UNLOCK_GROUP_COMMAND_ID,
                title: localize2('unlockEditorGroup', 'Unlock Editor Group'),
                precondition: ActiveEditorGroupLockedContext,
                category: Categories.View,
                f1: true
            });
        }
        async run(accessor, ...args) {
            setEditorGroupLock(accessor, false, ...args);
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: PIN_EDITOR_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: ActiveEditorStickyContext.toNegated(),
        primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */),
        handler: async (accessor, ...args) => {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            for (const { group, editors } of resolvedContext.groupedEditors) {
                for (const editor of editors) {
                    group.stickEditor(editor);
                }
            }
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: UNPIN_EDITOR_COMMAND_ID,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: ActiveEditorStickyContext,
        primary: KeyChord(2048 /* KeyMod.CtrlCmd */ | 41 /* KeyCode.KeyK */, 1024 /* KeyMod.Shift */ | 3 /* KeyCode.Enter */),
        handler: async (accessor, ...args) => {
            const resolvedContext = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
            for (const { group, editors } of resolvedContext.groupedEditors) {
                for (const editor of editors) {
                    group.unstickEditor(editor);
                }
            }
        }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
        id: SHOW_EDITORS_IN_GROUP,
        weight: 200 /* KeybindingWeight.WorkbenchContrib */,
        when: undefined,
        primary: undefined,
        handler: (accessor, ...args) => {
            const editorGroupsService = accessor.get(IEditorGroupsService);
            const quickInputService = accessor.get(IQuickInputService);
            const commandsContext = resolveCommandsContext(args, accessor.get(IEditorService), editorGroupsService, accessor.get(IListService));
            const group = commandsContext.groupedEditors[0]?.group;
            if (group) {
                editorGroupsService.activateGroup(group); // we need the group to be active
            }
            return quickInputService.quickAccess.show(ActiveGroupEditorsByMostRecentlyUsedQuickAccess.PREFIX);
        }
    });
}
export function setup() {
    registerActiveEditorMoveCopyCommand();
    registerEditorGroupsLayoutCommands();
    registerDiffEditorCommands();
    registerOpenEditorAPICommands();
    registerOpenEditorAtIndexCommands();
    registerCloseEditorCommands();
    registerOtherEditorCommands();
    registerSplitEditorInGroupCommands();
    registerFocusSideEditorsCommands();
    registerFocusEditorGroupAtIndexCommands();
    registerSplitEditorCommands();
    registerFocusEditorGroupWihoutWrapCommands();
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yQ29tbWFuZHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckNvbW1hbmRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxRQUFRLEVBQW1CLE1BQU0scUNBQXFDLENBQUM7QUFDaEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM1RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUM3RixPQUFPLEVBQUUsR0FBRyxFQUFpQixNQUFNLGdDQUFnQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLDhEQUE4RCxDQUFDO0FBQzFGLE9BQU8sRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDMUYsT0FBTyxFQUFFLGdCQUFnQixFQUFtQixlQUFlLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN0SCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDdEYsT0FBTyxFQUFFLGdCQUFnQixFQUE0RCxNQUFNLDhDQUE4QyxDQUFDO0FBQzFJLE9BQU8sRUFBRSxxQkFBcUIsRUFBb0IsTUFBTSw0REFBNEQsQ0FBQztBQUNySCxPQUFPLEVB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