/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getWindowId } from '../../../../base/browser/dom.js';
import { List } from '../../../../base/browser/ui/list/listWidget.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { deepClone } from '../../../../base/common/objects.js';
import { isWeb, isWindows } from '../../../../base/common/platform.js';
import { isCodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { EditorContextKeys } from '../../../../editor/common/editorContextKeys.js';
import { ITextResourcePropertiesService } from '../../../../editor/common/services/textResourceConfiguration.js';
import * as nls from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { InputFocusedContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { IExtensionHostDebugService } from '../../../../platform/debug/common/extensionHostDebug.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { KeybindingsRegistry } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IListService } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { ActiveEditorContext, PanelFocusContext, ResourceContextKey } from '../../../common/contextkeys.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IPaneCompositePartService } from '../../../services/panecomposite/browser/panecomposite.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { ChatContextKeys } from '../../chat/common/chatContextKeys.js';
import { IExtensionsWorkbenchService } from '../../extensions/common/extensions.js';
import { TEXT_FILE_EDITOR_ID } from '../../files/common/files.js';
import { CONTEXT_BREAKPOINT_INPUT_FOCUSED, CONTEXT_BREAKPOINTS_FOCUSED, CONTEXT_DEBUG_STATE, CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DISASSEMBLY_VIEW_FOCUS, CONTEXT_EXPRESSION_SELECTED, CONTEXT_FOCUSED_SESSION_IS_ATTACH, CONTEXT_IN_DEBUG_MODE, CONTEXT_IN_DEBUG_REPL, CONTEXT_JUMP_TO_CURSOR_SUPPORTED, CONTEXT_STEP_INTO_TARGETS_SUPPORTED, CONTEXT_VARIABLES_FOCUSED, CONTEXT_WATCH_EXPRESSIONS_FOCUSED, EDITOR_CONTRIBUTION_ID, getStateLabel, IDebugService, isFrameDeemphasized, REPL_VIEW_ID, VIEWLET_ID } from '../common/debug.js';
import { Breakpoint, DataBreakpoint, Expression, FunctionBreakpoint, Variable } from '../common/debugModel.js';
import { saveAllBeforeDebugStart, resolveChildSession } from '../common/debugUtils.js';
import { showLoadedScriptMenu } from '../common/loadedScriptsPicker.js';
import { openBreakpointSource } from './breakpointsView.js';
import { showDebugSessionMenu } from './debugSessionPicker.js';
export const ADD_CONFIGURATION_ID = 'debug.addConfiguration';
export const COPY_ADDRESS_ID = 'editor.debug.action.copyAddress';
export const TOGGLE_BREAKPOINT_ID = 'editor.debug.action.toggleBreakpoint';
export const TOGGLE_INLINE_BREAKPOINT_ID = 'editor.debug.action.toggleInlineBreakpoint';
export const COPY_STACK_TRACE_ID = 'debug.copyStackTrace';
export const REVERSE_CONTINUE_ID = 'workbench.action.debug.reverseContinue';
export const STEP_BACK_ID = 'workbench.action.debug.stepBack';
export const RESTART_SESSION_ID = 'workbench.action.debug.restart';
export const TERMINATE_THREAD_ID = 'workbench.action.debug.terminateThread';
export const STEP_OVER_ID = 'workbench.action.debug.stepOver';
export const STEP_INTO_ID = 'workbench.action.debug.stepInto';
export const STEP_INTO_TARGET_ID = 'workbench.action.debug.stepIntoTarget';
export const STEP_OUT_ID = 'workbench.action.debug.stepOut';
export const PAUSE_ID = 'workbench.action.debug.pause';
export const DISCONNECT_ID = 'workbench.action.debug.disconnect';
export const DISCONNECT_AND_SUSPEND_ID = 'workbench.action.debug.disconnectAndSuspend';
export const STOP_ID = 'workbench.action.debug.stop';
export const RESTART_FRAME_ID = 'workbench.action.debug.restartFrame';
export const CONTINUE_ID = 'workbench.action.debug.continue';
export const FOCUS_REPL_ID = 'workbench.debug.action.focusRepl';
export const JUMP_TO_CURSOR_ID = 'debug.jumpToCursor';
export const FOCUS_SESSION_ID = 'workbench.action.debug.focusProcess';
export const SELECT_AND_START_ID = 'workbench.action.debug.selectandstart';
export const SELECT_DEBUG_CONSOLE_ID = 'workbench.action.debug.selectDebugConsole';
export const SELECT_DEBUG_SESSION_ID = 'workbench.action.debug.selectDebugSession';
export const DEBUG_CONFIGURE_COMMAND_ID = 'workbench.action.debug.configure';
export const DEBUG_START_COMMAND_ID = 'workbench.action.debug.start';
export const DEBUG_RUN_COMMAND_ID = 'workbench.action.debug.run';
export const EDIT_EXPRESSION_COMMAND_ID = 'debug.renameWatchExpression';
export const COPY_WATCH_EXPRESSION_COMMAND_ID = 'debug.copyWatchExpression';
export const SET_EXPRESSION_COMMAND_ID = 'debug.setWatchExpression';
export const REMOVE_EXPRESSION_COMMAND_ID = 'debug.removeWatchExpression';
export const NEXT_DEBUG_CONSOLE_ID = 'workbench.action.debug.nextConsole';
export const PREV_DEBUG_CONSOLE_ID = 'workbench.action.debug.prevConsole';
export const SHOW_LOADED_SCRIPTS_ID = 'workbench.action.debug.showLoadedScripts';
export const CALLSTACK_TOP_ID = 'workbench.action.debug.callStackTop';
export const CALLSTACK_BOTTOM_ID = 'workbench.action.debug.callStackBottom';
export const CALLSTACK_UP_ID = 'workbench.action.debug.callStackUp';
export const CALLSTACK_DOWN_ID = 'workbench.action.debug.callStackDown';
export const ADD_TO_WATCH_ID = 'debug.addToWatchExpressions';
export const COPY_EVALUATE_PATH_ID = 'debug.copyEvaluatePath';
export const COPY_VALUE_ID = 'workbench.debug.viewlet.action.copyValue';
export const BREAK_WHEN_VALUE_CHANGES_ID = 'debug.breakWhenValueChanges';
export const BREAK_WHEN_VALUE_IS_ACCESSED_ID = 'debug.breakWhenValueIsAccessed';
export const BREAK_WHEN_VALUE_IS_READ_ID = 'debug.breakWhenValueIsRead';
export const TOGGLE_EXCEPTION_BREAKPOINTS_ID = 'debug.toggleExceptionBreakpoints';
export const ATTACH_TO_CURRENT_CODE_RENDERER = 'debug.attachToCurrentCodeRenderer';
export const DEBUG_COMMAND_CATEGORY = nls.localize2('debug', 'Debug');
export const RESTART_LABEL = nls.localize2('restartDebug', "Restart");
export const STEP_OVER_LABEL = nls.localize2('stepOverDebug', "Step Over");
export const STEP_INTO_LABEL = nls.localize2('stepIntoDebug', "Step Into");
export const STEP_INTO_TARGET_LABEL = nls.localize2('stepIntoTargetDebug', "Step Into Target");
export const STEP_OUT_LABEL = nls.localize2('stepOutDebug', "Step Out");
export const PAUSE_LABEL = nls.localize2('pauseDebug', "Pause");
export const DISCONNECT_LABEL = nls.localize2('disconnect', "Disconnect");
export const DISCONNECT_AND_SUSPEND_LABEL = nls.localize2('disconnectSuspend', "Disconnect and Suspend");
export const STOP_LABEL = nls.localize2('stop', "Stop");
export const CONTINUE_LABEL = nls.localize2('continueDebug', "Continue");
export const FOCUS_SESSION_LABEL = nls.localize2('focusSession', "Focus Session");
export const SELECT_AND_START_LABEL = nls.localize2('selectAndStartDebugging', "Select and Start Debugging");
export const DEBUG_CONFIGURE_LABEL = nls.localize('openLaunchJson', "Open '{0}'", 'launch.json');
export const DEBUG_START_LABEL = nls.localize2('startDebug', "Start Debugging");
export const DEBUG_RUN_LABEL = nls.localize2('startWithoutDebugging', "Start Without Debugging");
export const NEXT_DEBUG_CONSOLE_LABEL = nls.localize2('nextDebugConsole', "Focus Next Debug Console");
export const PREV_DEBUG_CONSOLE_LABEL = nls.localize2('prevDebugConsole', "Focus Previous Debug Console");
export const OPEN_LOADED_SCRIPTS_LABEL = nls.localize2('openLoadedScript', "Open Loaded Script...");
export const CALLSTACK_TOP_LABEL = nls.localize2('callStackTop', "Navigate to Top of Call Stack");
export const CALLSTACK_BOTTOM_LABEL = nls.localize2('callStackBottom', "Navigate to Bottom of Call Stack");
export const CALLSTACK_UP_LABEL = nls.localize2('callStackUp', "Navigate Up Call Stack");
export const CALLSTACK_DOWN_LABEL = nls.localize2('callStackDown', "Navigate Down Call Stack");
export const COPY_EVALUATE_PATH_LABEL = nls.localize2('copyAsExpression', "Copy as Expression");
export const COPY_VALUE_LABEL = nls.localize2('copyValue', "Copy Value");
export const COPY_ADDRESS_LABEL = nls.localize2('copyAddress', "Copy Address");
export const ADD_TO_WATCH_LABEL = nls.localize2('addToWatchExpressions', "Add to Watch");
export const SELECT_DEBUG_CONSOLE_LABEL = nls.localize2('selectDebugConsole', "Select Debug Console");
export const SELECT_DEBUG_SESSION_LABEL = nls.localize2('selectDebugSession', "Select Debug Session");
export const DEBUG_QUICK_ACCESS_PREFIX = 'debug ';
export const DEBUG_CONSOLE_QUICK_ACCESS_PREFIX = 'debug consoles ';
let dataBreakpointInfoResponse;
export function setDataBreakpointInfoResponse(resp) {
    dataBreakpointInfoResponse = resp;
}
function isThreadContext(obj) {
    return obj && typeof obj.sessionId === 'string' && typeof obj.threadId === 'string';
}
async function getThreadAndRun(accessor, sessionAndThreadId, run) {
    const debugService = accessor.get(IDebugService);
    let thread;
    if (isThreadContext(sessionAndThreadId)) {
        const session = debugService.getModel().getSession(sessionAndThreadId.sessionId);
        if (session) {
            thread = session.getAllThreads().find(t => t.getId() === sessionAndThreadId.threadId);
        }
    }
    else if (isSessionContext(sessionAndThreadId)) {
        const session = debugService.getModel().getSession(sessionAndThreadId.sessionId);
        if (session) {
            const threads = session.getAllThreads();
            thread = threads.length > 0 ? threads[0] : undefined;
        }
    }
    if (!thread) {
        thread = debugService.getViewModel().focusedThread;
        if (!thread) {
            const focusedSession = debugService.getViewModel().focusedSession;
            const threads = focusedSession ? focusedSession.getAllThreads() : undefined;
            thread = threads && threads.length ? threads[0] : undefined;
        }
    }
    if (thread) {
        await run(thread);
    }
}
function isStackFrameContext(obj) {
    return obj && typeof obj.sessionId === 'string' && typeof obj.threadId === 'string' && typeof obj.frameId === 'string';
}
function getFrame(debugService, context) {
    if (isStackFrameContext(context)) {
        const session = debugService.getModel().getSession(context.sessionId);
        if (session) {
            const thread = session.getAllThreads().find(t => t.getId() === context.threadId);
            if (thread) {
                return thread.getCallStack().find(sf => sf.getId() === context.frameId);
            }
        }
    }
    else {
        return debugService.getViewModel().focusedStackFrame;
    }
    return undefined;
}
function isSessionContext(obj) {
    return obj && typeof obj.sessionId === 'string';
}
async function changeDebugConsoleFocus(accessor, next) {
    const debugService = accessor.get(IDebugService);
    const viewsService = accessor.get(IViewsService);
    const sessions = debugService.getModel().getSessions(true).filter(s => s.hasSeparateRepl());
    let currSession = debugService.getViewModel().focusedSession;
    let nextIndex = 0;
    if (sessions.length > 0 && currSession) {
        while (currSession && !currSession.hasSeparateRepl()) {
            currSession = currSession.parentSession;
        }
        if (currSession) {
            const currIndex = sessions.indexOf(currSession);
            if (next) {
                nextIndex = (currIndex === (sessions.length - 1) ? 0 : (currIndex + 1));
            }
            else {
                nextIndex = (currIndex === 0 ? (sessions.length - 1) : (currIndex - 1));
            }
        }
    }
    await debugService.focusStackFrame(undefined, undefined, sessions[nextIndex], { explicit: true });
    if (!viewsService.isViewVisible(REPL_VIEW_ID)) {
        await viewsService.openView(REPL_VIEW_ID, true);
    }
}
async function navigateCallStack(debugService, down) {
    const frame = debugService.getViewModel().focusedStackFrame;
    if (frame) {
        let callStack = frame.thread.getCallStack();
        let index = callStack.findIndex(elem => elem.frameId === frame.frameId);
        let nextVisibleFrame;
        if (down) {
            if (index >= callStack.length - 1) {
                if (frame.thread.reachedEndOfCallStack) {
                    goToTopOfCallStack(debugService);
                    return;
                }
                else {
                    await debugService.getModel().fetchCallstack(frame.thread, 20);
                    callStack = frame.thread.getCallStack();
                    index = callStack.findIndex(elem => elem.frameId === frame.frameId);
                }
            }
            nextVisibleFrame = findNextVisibleFrame(true, callStack, index);
        }
        else {
            if (index <= 0) {
                goToBottomOfCallStack(debugService);
                return;
            }
            nextVisibleFrame = findNextVisibleFrame(false, callStack, index);
        }
        if (nextVisibleFrame) {
            debugService.focusStackFrame(nextVisibleFrame, undefined, undefined, { preserveFocus: false });
        }
    }
}
async function goToBottomOfCallStack(debugService) {
    const thread = debugService.getViewModel().focusedThread;
    if (thread) {
        await debugService.getModel().fetchCallstack(thread);
        const callStack = thread.getCallStack();
        if (callStack.length > 0) {
            const nextVisibleFrame = findNextVisibleFrame(false, callStack, 0); // must consider the next frame up first, which will be the last frame
            if (nextVisibleFrame) {
                debugService.focusStackFrame(nextVisibleFrame, undefined, undefined, { preserveFocus: false });
            }
        }
    }
}
function goToTopOfCallStack(debugService) {
    const thread = debugService.getViewModel().focusedThread;
    if (thread) {
        debugService.focusStackFrame(thread.getTopStackFrame(), undefined, undefined, { preserveFocus: false });
    }
}
/**
 * Finds next frame that is not skipped by SkipFiles. Skips frame at index and starts searching at next.
 * Must satisfy `0 <= startIndex <= callStack - 1`
 * @param down specifies whether to search downwards if the current file is skipped.
 * @param callStack the call stack to search
 * @param startIndex the index to start the search at
 */
function findNextVisibleFrame(down, callStack, startIndex) {
    if (startIndex >= callStack.length) {
        startIndex = callStack.length - 1;
    }
    else if (startIndex < 0) {
        startIndex = 0;
    }
    let index = startIndex;
    let currFrame;
    do {
        if (down) {
            if (index === callStack.length - 1) {
                index = 0;
            }
            else {
                index++;
            }
        }
        else {
            if (index === 0) {
                index = callStack.length - 1;
            }
            else {
                index--;
            }
        }
        currFrame = callStack[index];
        if (!isFrameDeemphasized(currFrame)) {
            return currFrame;
        }
    } while (index !== startIndex); // end loop when we've just checked the start index, since that should be the last one checked
    return undefined;
}
// These commands are used in call stack context menu, call stack inline actions, command palette, debug toolbar, mac native touch bar
// When the command is exectued in the context of a thread(context menu on a thread, inline call stack action) we pass the thread id
// Otherwise when it is executed "globaly"(using the touch bar, debug toolbar, command palette) we do not pass any id and just take whatever is the focussed thread
// Same for stackFrame commands and session commands.
CommandsRegistry.registerCommand({
    id: COPY_STACK_TRACE_ID,
    handler: async (accessor, _, context) => {
        const textResourcePropertiesService = accessor.get(ITextResourcePropertiesService);
        const clipboardService = accessor.get(IClipboardService);
        const debugService = accessor.get(IDebugService);
        const frame = getFrame(debugService, context);
        if (frame) {
            const eol = textResourcePropertiesService.getEOL(frame.source.uri);
            await clipboardService.writeText(frame.thread.getCallStack().map(sf => sf.toString()).join(eol));
        }
    }
});
CommandsRegistry.registerCommand({
    id: REVERSE_CONTINUE_ID,
    handler: async (accessor, _, context) => {
        await getThreadAndRun(accessor, context, thread => thread.reverseContinue());
    }
});
CommandsRegistry.registerCommand({
    id: STEP_BACK_ID,
    handler: async (accessor, _, context) => {
        const contextKeyService = accessor.get(IContextKeyService);
        if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
            await getThreadAndRun(accessor, context, (thread) => thread.stepBack('instruction'));
        }
        else {
            await getThreadAndRun(accessor, context, (thread) => thread.stepBack());
        }
    }
});
CommandsRegistry.registerCommand({
    id: TERMINATE_THREAD_ID,
    handler: async (accessor, _, context) => {
        await getThreadAndRun(accessor, context, thread => thread.terminate());
    }
});
CommandsRegistry.registerCommand({
    id: JUMP_TO_CURSOR_ID,
    handler: async (accessor) => {
        const debugService = accessor.get(IDebugService);
        const stackFrame = debugService.getViewModel().focusedStackFrame;
        const editorService = accessor.get(IEditorService);
        const activeEditorControl = editorService.activeTextEditorControl;
        const notificationService = accessor.get(INotificationService);
        const quickInputService = accessor.get(IQuickInputService);
        if (stackFrame && isCodeEditor(activeEditorControl) && activeEditorControl.hasModel()) {
            const position = activeEditorControl.getPosition();
            const resource = activeEditorControl.getModel().uri;
            const source = stackFrame.thread.session.getSourceForUri(resource);
            if (source) {
                const response = await stackFrame.thread.session.gotoTargets(source.raw, position.lineNumber, position.column);
                const targets = response?.body.targets;
                if (targets && targets.length) {
                    let id = targets[0].id;
                    if (targets.length > 1) {
                        const picks = targets.map(t => ({ label: t.label, _id: t.id }));
                        const pick = await quickInputService.pick(picks, { placeHolder: nls.localize('chooseLocation', "Choose the specific location") });
                        if (!pick) {
                            return;
                        }
                        id = pick._id;
                    }
                    return await stackFrame.thread.session.goto(stackFrame.thread.threadId, id).catch(e => notificationService.warn(e));
                }
            }
        }
        return notificationService.warn(nls.localize('noExecutableCode', "No executable code is associated at the current cursor position."));
    }
});
CommandsRegistry.registerCommand({
    id: CALLSTACK_TOP_ID,
    handler: async (accessor, _, context) => {
        const debugService = accessor.get(IDebugService);
        goToTopOfCallStack(debugService);
    }
});
CommandsRegistry.registerCommand({
    id: CALLSTACK_BOTTOM_ID,
    handler: async (accessor, _, context) => {
        const debugService = accessor.get(IDebugService);
        await goToBottomOfCallStack(debugService);
    }
});
CommandsRegistry.registerCommand({
    id: CALLSTACK_UP_ID,
    handler: async (accessor, _, context) => {
        const debugService = accessor.get(IDebugService);
        navigateCallStack(debugService, false);
    }
});
CommandsRegistry.registerCommand({
    id: CALLSTACK_DOWN_ID,
    handler: async (accessor, _, context) => {
        const debugService = accessor.get(IDebugService);
        navigateCallStack(debugService, true);
    }
});
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
    command: {
        id: JUMP_TO_CURSOR_ID,
        title: nls.localize('jumpToCursor', "Jump to Cursor"),
        category: DEBUG_COMMAND_CATEGORY
    },
    when: ContextKeyExpr.and(CONTEXT_JUMP_TO_CURSOR_SUPPORTED, EditorContextKeys.editorTextFocus),
    group: 'debug',
    order: 3
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: NEXT_DEBUG_CONSOLE_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
    when: CONTEXT_IN_DEBUG_REPL,
    primary: 2048 /* KeyMod.CtrlCmd */ | 12 /* KeyCode.PageDown */,
    mac: { primary: 1024 /* KeyMod.Shift */ | 2048 /* KeyMod.CtrlCmd */ | 94 /* KeyCode.BracketRight */ },
    handler: async (accessor, _, context) => {
        changeDebugConsoleFocus(accessor, true);
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: PREV_DEBUG_CONSOLE_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 1,
    when: CONTEXT_IN_DEBUG_REPL,
    primary: 2048 /* KeyMod.CtrlCmd */ | 11 /* KeyCode.PageUp */,
    mac: { primary: 1024 /* KeyMod.Shift */ | 2048 /* KeyMod.CtrlCmd */ | 92 /* KeyCode.BracketLeft */ },
    handler: async (accessor, _, context) => {
        changeDebugConsoleFocus(accessor, false);
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: RESTART_SESSION_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 1024 /* KeyMod.Shift */ | 2048 /* KeyMod.CtrlCmd */ | 63 /* KeyCode.F5 */,
    when: CONTEXT_IN_DEBUG_MODE,
    handler: async (accessor, _, context) => {
        const debugService = accessor.get(IDebugService);
        const configurationService = accessor.get(IConfigurationService);
        let session;
        if (isSessionContext(context)) {
            session = debugService.getModel().getSession(context.sessionId);
        }
        else {
            session = debugService.getViewModel().focusedSession;
        }
        if (!session) {
            const { launch, name } = debugService.getConfigurationManager().selectedConfiguration;
            await debugService.startDebugging(launch, name, { noDebug: false, startedByUser: true });
        }
        else {
            const showSubSessions = configurationService.getValue('debug').showSubSessionsInToolBar;
            // Stop should be sent to the root parent session
            while (!showSubSessions && session.lifecycleManagedByParent && session.parentSession) {
                session = session.parentSession;
            }
            session.removeReplExpressions();
            await debugService.restartSession(session);
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: STEP_OVER_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 68 /* KeyCode.F10 */,
    when: CONTEXT_DEBUG_STATE.isEqualTo('stopped'),
    handler: async (accessor, _, context) => {
        const contextKeyService = accessor.get(IContextKeyService);
        if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
            await getThreadAndRun(accessor, context, (thread) => thread.next('instruction'));
        }
        else {
            await getThreadAndRun(accessor, context, (thread) => thread.next());
        }
    }
});
// Windows browsers use F11 for full screen, thus use alt+F11 as the default shortcut
const STEP_INTO_KEYBINDING = (isWeb && isWindows) ? (512 /* KeyMod.Alt */ | 69 /* KeyCode.F11 */) : 69 /* KeyCode.F11 */;
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: STEP_INTO_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 10, // Have a stronger weight to have priority over full screen when debugging
    primary: STEP_INTO_KEYBINDING,
    // Use a more flexible when clause to not allow full screen command to take over when F11 pressed a lot of times
    when: CONTEXT_DEBUG_STATE.notEqualsTo('inactive'),
    handler: async (accessor, _, context) => {
        const contextKeyService = accessor.get(IContextKeyService);
        if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
            await getThreadAndRun(accessor, context, (thread) => thread.stepIn('instruction'));
        }
        else {
            await getThreadAndRun(accessor, context, (thread) => thread.stepIn());
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: STEP_OUT_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 1024 /* KeyMod.Shift */ | 69 /* KeyCode.F11 */,
    when: CONTEXT_DEBUG_STATE.isEqualTo('stopped'),
    handler: async (accessor, _, context) => {
        const contextKeyService = accessor.get(IContextKeyService);
        if (CONTEXT_DISASSEMBLY_VIEW_FOCUS.getValue(contextKeyService)) {
            await getThreadAndRun(accessor, context, (thread) => thread.stepOut('instruction'));
        }
        else {
            await getThreadAndRun(accessor, context, (thread) => thread.stepOut());
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: PAUSE_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 2, // take priority over focus next part while we are debugging
    primary: 64 /* KeyCode.F6 */,
    when: CONTEXT_DEBUG_STATE.isEqualTo('running'),
    handler: async (accessor, _, context) => {
        await getThreadAndRun(accessor, context, thread => thread.pause());
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: STEP_INTO_TARGET_ID,
    primary: STEP_INTO_KEYBINDING | 2048 /* KeyMod.CtrlCmd */,
    when: ContextKeyExpr.and(CONTEXT_STEP_INTO_TARGETS_SUPPORTED, CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE.isEqualTo('stopped')),
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    handler: async (accessor, _, context) => {
        const quickInputService = accessor.get(IQuickInputService);
        const debugService = accessor.get(IDebugService);
        const session = debugService.getViewModel().focusedSession;
        const frame = debugService.getViewModel().focusedStackFrame;
        if (!frame || !session) {
            return;
        }
        const editor = await accessor.get(IEditorService).openEditor({
            resource: frame.source.uri,
            options: { revealIfOpened: true }
        });
        let codeEditor;
        if (editor) {
            const ctrl = editor?.getControl();
            if (isCodeEditor(ctrl)) {
                codeEditor = ctrl;
            }
        }
        const disposables = new DisposableStore();
        const qp = disposables.add(quickInputService.createQuickPick());
        qp.busy = true;
        qp.show();
        disposables.add(qp.onDidChangeActive(([item]) => {
            if (codeEditor && item && item.target.line !== undefined) {
                codeEditor.revealLineInCenterIfOutsideViewport(item.target.line);
                codeEditor.setSelection({
                    startLineNumber: item.target.line,
                    startColumn: item.target.column || 1,
                    endLineNumber: item.target.endLine || item.target.line,
                    endColumn: item.target.endColumn || item.target.column || 1,
                });
            }
        }));
        disposables.add(qp.onDidAccept(() => {
            if (qp.activeItems.length) {
                session.stepIn(frame.thread.threadId, qp.activeItems[0].target.id);
            }
        }));
        disposables.add(qp.onDidHide(() => disposables.dispose()));
        session.stepInTargets(frame.frameId).then(targets => {
            qp.busy = false;
            if (targets?.length) {
                qp.items = targets?.map(target => ({ target, label: target.label }));
            }
            else {
                qp.placeholder = nls.localize('editor.debug.action.stepIntoTargets.none', "No step targets available");
            }
        });
    }
});
async function stopHandler(accessor, _, context, disconnect, suspend) {
    const debugService = accessor.get(IDebugService);
    let session;
    if (isSessionContext(context)) {
        session = debugService.getModel().getSession(context.sessionId);
    }
    else {
        session = debugService.getViewModel().focusedSession;
    }
    const configurationService = accessor.get(IConfigurationService);
    const showSubSessions = configurationService.getValue('debug').showSubSessionsInToolBar;
    // Stop should be sent to the root parent session
    while (!showSubSessions && session && session.lifecycleManagedByParent && session.parentSession) {
        session = session.parentSession;
    }
    await debugService.stopSession(session, disconnect, suspend);
}
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: DISCONNECT_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 1024 /* KeyMod.Shift */ | 63 /* KeyCode.F5 */,
    when: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH, CONTEXT_IN_DEBUG_MODE),
    handler: (accessor, _, context) => stopHandler(accessor, _, context, true)
});
CommandsRegistry.registerCommand({
    id: DISCONNECT_AND_SUSPEND_ID,
    handler: (accessor, _, context) => stopHandler(accessor, _, context, true, true)
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: STOP_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 1024 /* KeyMod.Shift */ | 63 /* KeyCode.F5 */,
    when: ContextKeyExpr.and(CONTEXT_FOCUSED_SESSION_IS_ATTACH.toNegated(), CONTEXT_IN_DEBUG_MODE),
    handler: (accessor, _, context) => stopHandler(accessor, _, context, false)
});
CommandsRegistry.registerCommand({
    id: RESTART_FRAME_ID,
    handler: async (accessor, _, context) => {
        const debugService = accessor.get(IDebugService);
        const notificationService = accessor.get(INotificationService);
        const frame = getFrame(debugService, context);
        if (frame) {
            try {
                await frame.restart();
            }
            catch (e) {
                notificationService.error(e);
            }
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: CONTINUE_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 10, // Use a stronger weight to get priority over start debugging F5 shortcut
    primary: 63 /* KeyCode.F5 */,
    when: CONTEXT_DEBUG_STATE.isEqualTo('stopped'),
    handler: async (accessor, _, context) => {
        await getThreadAndRun(accessor, context, thread => thread.continue());
    }
});
CommandsRegistry.registerCommand({
    id: SHOW_LOADED_SCRIPTS_ID,
    handler: async (accessor) => {
        await showLoadedScriptMenu(accessor);
    }
});
CommandsRegistry.registerCommand({
    id: 'debug.startFromConfig',
    handler: async (accessor, config) => {
        const debugService = accessor.get(IDebugService);
        await debugService.startDebugging(undefined, config);
    }
});
CommandsRegistry.registerCommand({
    id: FOCUS_SESSION_ID,
    handler: async (accessor, session) => {
        const debugService = accessor.get(IDebugService);
        const editorService = accessor.get(IEditorService);
        session = resolveChildSession(session, debugService.getModel().getSessions());
        await debugService.focusStackFrame(undefined, undefined, session, { explicit: true });
        const stackFrame = debugService.getViewModel().focusedStackFrame;
        if (stackFrame) {
            await stackFrame.openInEditor(editorService, true);
        }
    }
});
CommandsRegistry.registerCommand({
    id: SELECT_AND_START_ID,
    handler: async (accessor, debugType, debugStartOptions) => {
        const quickInputService = accessor.get(IQuickInputService);
        const debugService = accessor.get(IDebugService);
        if (debugType) {
            const configManager = debugService.getConfigurationManager();
            const dynamicProviders = await configManager.getDynamicProviders();
            for (const provider of dynamicProviders) {
                if (provider.type === debugType) {
                    const pick = await provider.pick();
                    if (pick) {
                        await configManager.selectConfiguration(pick.launch, pick.config.name, pick.config, { type: provider.type });
                        debugService.startDebugging(pick.launch, pick.config, { noDebug: debugStartOptions?.noDebug, startedByUser: true });
                        return;
                    }
                }
            }
        }
        quickInputService.quickAccess.show(DEBUG_QUICK_ACCESS_PREFIX);
    }
});
CommandsRegistry.registerCommand({
    id: SELECT_DEBUG_CONSOLE_ID,
    handler: async (accessor) => {
        const quickInputService = accessor.get(IQuickInputService);
        quickInputService.quickAccess.show(DEBUG_CONSOLE_QUICK_ACCESS_PREFIX);
    }
});
CommandsRegistry.registerCommand({
    id: SELECT_DEBUG_SESSION_ID,
    handler: async (accessor) => {
        showDebugSessionMenu(accessor, SELECT_AND_START_ID);
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: DEBUG_START_COMMAND_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 63 /* KeyCode.F5 */,
    when: ContextKeyExpr.and(CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DEBUG_STATE.isEqualTo('inactive')),
    handler: async (accessor, debugStartOptions) => {
        const debugService = accessor.get(IDebugService);
        await saveAllBeforeDebugStart(accessor.get(IConfigurationService), accessor.get(IEditorService));
        const { launch, name, getConfig } = debugService.getConfigurationManager().selectedConfiguration;
        const config = await getConfig();
        const configOrName = config ? Object.assign(deepClone(config), debugStartOptions?.config) : name;
        await debugService.startDebugging(launch, configOrName, { noDebug: debugStartOptions?.noDebug, startedByUser: true }, false);
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: DEBUG_RUN_COMMAND_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 2048 /* KeyMod.CtrlCmd */ | 63 /* KeyCode.F5 */,
    mac: { primary: 256 /* KeyMod.WinCtrl */ | 63 /* KeyCode.F5 */ },
    when: ContextKeyExpr.and(CONTEXT_DEBUGGERS_AVAILABLE, CONTEXT_DEBUG_STATE.notEqualsTo(getStateLabel(1 /* State.Initializing */))),
    handler: async (accessor) => {
        const commandService = accessor.get(ICommandService);
        await commandService.executeCommand(DEBUG_START_COMMAND_ID, { noDebug: true });
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'debug.toggleBreakpoint',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 5,
    when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_FOCUSED, InputFocusedContext.toNegated()),
    primary: 10 /* KeyCode.Space */,
    handler: (accessor) => {
        const listService = accessor.get(IListService);
        const debugService = accessor.get(IDebugService);
        const list = listService.lastFocusedList;
        if (list instanceof List) {
            const focused = list.getFocusedElements();
            if (focused && focused.length) {
                debugService.enableOrDisableBreakpoints(!focused[0].enabled, focused[0]);
            }
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'debug.enableOrDisableBreakpoint',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: undefined,
    when: EditorContextKeys.editorTextFocus,
    handler: (accessor) => {
        const debugService = accessor.get(IDebugService);
        const editorService = accessor.get(IEditorService);
        const control = editorService.activeTextEditorControl;
        if (isCodeEditor(control)) {
            const model = control.getModel();
            if (model) {
                const position = control.getPosition();
                if (position) {
                    const bps = debugService.getModel().getBreakpoints({ uri: model.uri, lineNumber: position.lineNumber });
                    if (bps.length) {
                        debugService.enableOrDisableBreakpoints(!bps[0].enabled, bps[0]);
                    }
                }
            }
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: EDIT_EXPRESSION_COMMAND_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 5,
    when: CONTEXT_WATCH_EXPRESSIONS_FOCUSED,
    primary: 60 /* KeyCode.F2 */,
    mac: { primary: 3 /* KeyCode.Enter */ },
    handler: (accessor, expression) => {
        const debugService = accessor.get(IDebugService);
        if (!(expression instanceof Expression)) {
            const listService = accessor.get(IListService);
            const focused = listService.lastFocusedList;
            if (focused) {
                const elements = focused.getFocus();
                if (Array.isArray(elements) && elements[0] instanceof Expression) {
                    expression = elements[0];
                }
            }
        }
        if (expression instanceof Expression) {
            debugService.getViewModel().setSelectedExpression(expression, false);
        }
    }
});
CommandsRegistry.registerCommand({
    id: SET_EXPRESSION_COMMAND_ID,
    handler: async (accessor, expression) => {
        const debugService = accessor.get(IDebugService);
        if (expression instanceof Expression || expression instanceof Variable) {
            debugService.getViewModel().setSelectedExpression(expression, true);
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'debug.setVariable',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */ + 5,
    when: CONTEXT_VARIABLES_FOCUSED,
    primary: 60 /* KeyCode.F2 */,
    mac: { primary: 3 /* KeyCode.Enter */ },
    handler: (accessor) => {
        const listService = accessor.get(IListService);
        const debugService = accessor.get(IDebugService);
        const focused = listService.lastFocusedList;
        if (focused) {
            const elements = focused.getFocus();
            if (Array.isArray(elements) && elements[0] instanceof Variable) {
                debugService.getViewModel().setSelectedExpression(elements[0], false);
            }
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: REMOVE_EXPRESSION_COMMAND_ID,
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    when: ContextKeyExpr.and(CONTEXT_WATCH_EXPRESSIONS_FOCUSED, CONTEXT_EXPRESSION_SELECTED.toNegated()),
    primary: 20 /* KeyCode.Delete */,
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */ },
    handler: (accessor, expression) => {
        const debugService = accessor.get(IDebugService);
        if (expression instanceof Expression) {
            debugService.removeWatchExpressions(expression.getId());
            return;
        }
        const listService = accessor.get(IListService);
        const focused = listService.lastFocusedList;
        if (focused) {
            let elements = focused.getFocus();
            if (Array.isArray(elements) && elements[0] instanceof Expression) {
                const selection = focused.getSelection();
                if (selection && selection.indexOf(elements[0]) >= 0) {
                    elements = selection;
                }
                elements.forEach((e) => debugService.removeWatchExpressions(e.getId()));
            }
        }
    }
});
CommandsRegistry.registerCommand({
    id: BREAK_WHEN_VALUE_CHANGES_ID,
    handler: async (accessor) => {
        const debugService = accessor.get(IDebugService);
        if (dataBreakpointInfoResponse) {
            await debugService.addDataBreakpoint({ description: dataBreakpointInfoResponse.description, src: { type: 0 /* DataBreakpointSetType.Variable */, dataId: dataBreakpointInfoResponse.dataId }, canPersist: !!dataBreakpointInfoResponse.canPersist, accessTypes: dataBreakpointInfoResponse.accessTypes, accessType: 'write' });
        }
    }
});
CommandsRegistry.registerCommand({
    id: BREAK_WHEN_VALUE_IS_ACCESSED_ID,
    handler: async (accessor) => {
        const debugService = accessor.get(IDebugService);
        if (dataBreakpointInfoResponse) {
            await debugService.addDataBreakpoint({ description: dataBreakpointInfoResponse.description, src: { type: 0 /* DataBreakpointSetType.Variable */, dataId: dataBreakpointInfoResponse.dataId }, canPersist: !!dataBreakpointInfoResponse.canPersist, accessTypes: dataBreakpointInfoResponse.accessTypes, accessType: 'readWrite' });
        }
    }
});
CommandsRegistry.registerCommand({
    id: BREAK_WHEN_VALUE_IS_READ_ID,
    handler: async (accessor) => {
        const debugService = accessor.get(IDebugService);
        if (dataBreakpointInfoResponse) {
            await debugService.addDataBreakpoint({ description: dataBreakpointInfoResponse.description, src: { type: 0 /* DataBreakpointSetType.Variable */, dataId: dataBreakpointInfoResponse.dataId }, canPersist: !!dataBreakpointInfoResponse.canPersist, accessTypes: dataBreakpointInfoResponse.accessTypes, accessType: 'read' });
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'debug.removeBreakpoint',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    when: ContextKeyExpr.and(CONTEXT_BREAKPOINTS_FOCUSED, CONTEXT_BREAKPOINT_INPUT_FOCUSED.toNegated()),
    primary: 20 /* KeyCode.Delete */,
    mac: { primary: 2048 /* KeyMod.CtrlCmd */ | 1 /* KeyCode.Backspace */ },
    handler: (accessor) => {
        const listService = accessor.get(IListService);
        const debugService = accessor.get(IDebugService);
        const list = listService.lastFocusedList;
        if (list instanceof List) {
            const focused = list.getFocusedElements();
            const element = focused.length ? focused[0] : undefined;
            if (element instanceof Breakpoint) {
                debugService.removeBreakpoints(element.getId());
            }
            else if (element instanceof FunctionBreakpoint) {
                debugService.removeFunctionBreakpoints(element.getId());
            }
            else if (element instanceof DataBreakpoint) {
                debugService.removeDataBreakpoints(element.getId());
            }
        }
    }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'debug.installAdditionalDebuggers',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    when: undefined,
    primary: undefined,
    handler: async (accessor, query) => {
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        let searchFor = `@category:debuggers`;
        if (typeof query === 'string') {
            searchFor += ` ${query}`;
        }
        return extensionsWorkbenchService.openSearch(searchFor);
    }
});
registerAction2(class AddConfigurationAction extends Action2 {
    constructor() {
        super({
            id: ADD_CONFIGURATION_ID,
            title: nls.localize2('addConfiguration', "Add Configuration..."),
            category: DEBUG_COMMAND_CATEGORY,
            f1: true,
            menu: {
                id: MenuId.EditorContent,
                when: ContextKeyExpr.and(ContextKeyExpr.regex(ResourceContextKey.Path.key, /\.vscode[/\\]launch\.json$/), ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID))
            }
        });
    }
    async run(accessor, launchUri) {
        const manager = accessor.get(IDebugService).getConfigurationManager();
        const launch = manager.getLaunches().find(l => l.uri.toString() === launchUri) || manager.selectedConfiguration.launch;
        if (launch) {
            const { editor, created } = await launch.openConfigFile({ preserveFocus: false });
            if (editor && !created) {
                const codeEditor = editor.getControl();
                if (codeEditor) {
                    await codeEditor.getContribution(EDITOR_CONTRIBUTION_ID)?.addLaunchConfiguration();
                }
            }
        }
    }
});
const inlineBreakpointHandler = (accessor) => {
    const debugService = accessor.get(IDebugService);
    const editorService = accessor.get(IEditorService);
    const control = editorService.activeTextEditorControl;
    if (isCodeEditor(control)) {
        const position = control.getPosition();
        if (position && control.hasModel() && debugService.canSetBreakpointsIn(control.getModel())) {
            const modelUri = control.getModel().uri;
            const breakpointAlreadySet = debugService.getModel().getBreakpoints({ lineNumber: position.lineNumber, uri: modelUri })
                .some(bp => (bp.sessionAgnosticData.column === position.column || (!bp.column && position.column <= 1)));
            if (!breakpointAlreadySet) {
                debugService.addBreakpoints(modelUri, [{ lineNumber: position.lineNumber, column: position.column > 1 ? position.column : undefined }]);
            }
        }
    }
};
KeybindingsRegistry.registerCommandAndKeybindingRule({
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    primary: 1024 /* KeyMod.Shift */ | 67 /* KeyCode.F9 */,
    when: EditorContextKeys.editorTextFocus,
    id: TOGGLE_INLINE_BREAKPOINT_ID,
    handler: inlineBreakpointHandler
});
MenuRegistry.appendMenuItem(MenuId.EditorContext, {
    command: {
        id: TOGGLE_INLINE_BREAKPOINT_ID,
        title: nls.localize('addInlineBreakpoint', "Add Inline Breakpoint"),
        category: DEBUG_COMMAND_CATEGORY
    },
    when: ContextKeyExpr.and(CONTEXT_IN_DEBUG_MODE, PanelFocusContext.toNegated(), EditorContextKeys.editorTextFocus, ChatContextKeys.inChatSession.toNegated()),
    group: 'debug',
    order: 1
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'debug.openBreakpointToSide',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    when: CONTEXT_BREAKPOINTS_FOCUSED,
    primary: 2048 /* KeyMod.CtrlCmd */ | 3 /* KeyCode.Enter */,
    secondary: [512 /* KeyMod.Alt */ | 3 /* KeyCode.Enter */],
    handler: (accessor) => {
        const listService = accessor.get(IListService);
        const list = listService.lastFocusedList;
        if (list instanceof List) {
            const focus = list.getFocusedElements();
            if (focus.length && focus[0] instanceof Breakpoint) {
                return openBreakpointSource(focus[0], true, false, true, accessor.get(IDebugService), accessor.get(IEditorService));
            }
        }
        return undefined;
    }
});
registerAction2(class ToggleExceptionBreakpointsAction extends Action2 {
    constructor() {
        super({
            id: TOGGLE_EXCEPTION_BREAKPOINTS_ID,
            title: nls.localize2('toggleExceptionBreakpoints', "Toggle Exception Breakpoints"),
            category: DEBUG_COMMAND_CATEGORY,
            f1: true,
            precondition: CONTEXT_DEBUGGERS_AVAILABLE
        });
    }
    async run(accessor) {
        const debugService = accessor.get(IDebugService);
        const quickInputService = accessor.get(IQuickInputService);
        // Get the focused session or the first available session
        const debugModel = debugService.getModel();
        const session = debugService.getViewModel().focusedSession || debugModel.getSessions()[0];
        const exceptionBreakpoints = session ? debugModel.getExceptionBreakpointsForSession(session.getId()) : debugModel.getExceptionBreakpoints();
        if (exceptionBreakpoints.length === 0) {
            return;
        }
        // If only one exception breakpoint type, toggle it directly
        if (exceptionBreakpoints.length === 1) {
            const breakpoint = exceptionBreakpoints[0];
            await debugService.enableOrDisableBreakpoints(!breakpoint.enabled, breakpoint);
            return;
        }
        const disposables = new DisposableStore();
        const quickPick = disposables.add(quickInputService.createQuickPick());
        quickPick.placeholder = nls.localize('selectExceptionBreakpointsPlaceholder', "Pick enabled exception breakpoints");
        quickPick.canSelectMany = true;
        quickPick.matchOnDescription = true;
        quickPick.matchOnDetail = true;
        // Create quickpick items from exception breakpoints
        quickPick.items = exceptionBreakpoints.map(bp => ({
            label: bp.label,
            description: bp.description,
            picked: bp.enabled,
            breakpoint: bp
        }));
        quickPick.selectedItems = quickPick.items.filter(item => item.picked);
        disposables.add(quickPick.onDidAccept(() => {
            const selectedItems = quickPick.selectedItems;
            const toEnable = [];
            const toDisable = [];
            // Determine which breakpoints need to be toggled
            for (const bp of exceptionBreakpoints) {
                const isSelected = selectedItems.some(item => item.breakpoint === bp);
                if (isSelected && !bp.enabled) {
                    toEnable.push(bp);
                }
                else if (!isSelected && bp.enabled) {
                    toDisable.push(bp);
                }
            }
            // Toggle the breakpoints
            const promises = [];
            for (const bp of toEnable) {
                promises.push(debugService.enableOrDisableBreakpoints(true, bp));
            }
            for (const bp of toDisable) {
                promises.push(debugService.enableOrDisableBreakpoints(false, bp));
            }
            Promise.all(promises).then(() => disposables.dispose());
        }));
        disposables.add(quickPick.onDidHide(() => disposables.dispose()));
        quickPick.show();
    }
});
// When there are no debug extensions, open the debug viewlet when F5 is pressed so the user can read the limitations
KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: 'debug.openView',
    weight: 200 /* KeybindingWeight.WorkbenchContrib */,
    when: CONTEXT_DEBUGGERS_AVAILABLE.toNegated(),
    primary: 63 /* KeyCode.F5 */,
    secondary: [2048 /* KeyMod.CtrlCmd */ | 63 /* KeyCode.F5 */],
    handler: async (accessor) => {
        const paneCompositeService = accessor.get(IPaneCompositePartService);
        await paneCompositeService.openPaneComposite(VIEWLET_ID, 0 /* ViewContainerLocation.Sidebar */, true);
    }
});
registerAction2(class extends Action2 {
    constructor() {
        super({
            id: ATTACH_TO_CURRENT_CODE_RENDERER,
            title: nls.localize2('attachToCurrentCodeRenderer', "Attach to Current Code Renderer"),
        });
    }
    async run(accessor) {
        const env = accessor.get(IEnvironmentService);
        if (!env.isExtensionDevelopment && !env.extensionTestsLocationURI) {
            throw new Error('Refusing to attach to renderer outside of development context');
        }
        const windowId = getWindowId(mainWindow);
        const extDebugService = accessor.get(IExtensionHostDebugService);
        const result = await extDebugService.attachToCurrentWindowRenderer(windowId);
        return result;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdDb21tYW5kcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnQ29tbWFuZHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUN0RSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFFaEUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ3ZFLE9BQU8sRUFBZSxZQUFZLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUV4RixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNuRixPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxpRUFBaUUsQ0FBQztBQUNqSCxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBRTFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNoSCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSwyREFBMkQsQ0FBQztBQUM5RixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDckcsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHNEQUFzRCxDQUFD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