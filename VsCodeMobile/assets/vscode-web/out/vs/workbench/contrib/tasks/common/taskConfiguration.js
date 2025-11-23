/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import * as Objects from '../../../../base/common/objects.js';
import * as Types from '../../../../base/common/types.js';
import * as UUID from '../../../../base/common/uuid.js';
import { ProblemMatcherParser, isNamedProblemMatcher, ProblemMatcherRegistry } from './problemMatcher.js';
import * as Tasks from './tasks.js';
import { TaskDefinitionRegistry } from './taskDefinitionRegistry.js';
import { ShellExecutionSupportedContext, ProcessExecutionSupportedContext } from './taskService.js';
export var ShellQuoting;
(function (ShellQuoting) {
    /**
     * Default is character escaping.
     */
    ShellQuoting[ShellQuoting["escape"] = 1] = "escape";
    /**
     * Default is strong quoting
     */
    ShellQuoting[ShellQuoting["strong"] = 2] = "strong";
    /**
     * Default is weak quoting.
     */
    ShellQuoting[ShellQuoting["weak"] = 3] = "weak";
})(ShellQuoting || (ShellQuoting = {}));
export var ITaskIdentifier;
(function (ITaskIdentifier) {
    function is(value) {
        const candidate = value;
        return candidate !== undefined && Types.isString(value.type);
    }
    ITaskIdentifier.is = is;
})(ITaskIdentifier || (ITaskIdentifier = {}));
export var CommandString;
(function (CommandString) {
    function value(value) {
        if (Types.isString(value)) {
            return value;
        }
        else if (Types.isStringArray(value)) {
            return value.join(' ');
        }
        else {
            if (Types.isString(value.value)) {
                return value.value;
            }
            else {
                return value.value.join(' ');
            }
        }
    }
    CommandString.value = value;
})(CommandString || (CommandString = {}));
var ProblemMatcherKind;
(function (ProblemMatcherKind) {
    ProblemMatcherKind[ProblemMatcherKind["Unknown"] = 0] = "Unknown";
    ProblemMatcherKind[ProblemMatcherKind["String"] = 1] = "String";
    ProblemMatcherKind[ProblemMatcherKind["ProblemMatcher"] = 2] = "ProblemMatcher";
    ProblemMatcherKind[ProblemMatcherKind["Array"] = 3] = "Array";
})(ProblemMatcherKind || (ProblemMatcherKind = {}));
const EMPTY_ARRAY = [];
Object.freeze(EMPTY_ARRAY);
function assignProperty(target, source, key) {
    const sourceAtKey = source[key];
    if (sourceAtKey !== undefined) {
        target[key] = sourceAtKey;
    }
}
function fillProperty(target, source, key) {
    const sourceAtKey = source[key];
    if (target[key] === undefined && sourceAtKey !== undefined) {
        target[key] = sourceAtKey;
    }
}
function _isEmpty(value, properties, allowEmptyArray = false) {
    if (value === undefined || value === null || properties === undefined) {
        return true;
    }
    for (const meta of properties) {
        const property = value[meta.property];
        if (property !== undefined && property !== null) {
            if (meta.type !== undefined && !meta.type.isEmpty(property)) {
                return false;
            }
            else if (!Array.isArray(property) || (property.length > 0) || allowEmptyArray) {
                return false;
            }
        }
    }
    return true;
}
function _assignProperties(target, source, properties) {
    if (!source || _isEmpty(source, properties)) {
        return target;
    }
    if (!target || _isEmpty(target, properties)) {
        return source;
    }
    for (const meta of properties) {
        const property = meta.property;
        let value;
        if (meta.type !== undefined) {
            value = meta.type.assignProperties(target[property], source[property]);
        }
        else {
            value = source[property];
        }
        if (value !== undefined && value !== null) {
            target[property] = value;
        }
    }
    return target;
}
function _fillProperties(target, source, properties, allowEmptyArray = false) {
    if (!source || _isEmpty(source, properties)) {
        return target;
    }
    if (!target || _isEmpty(target, properties, allowEmptyArray)) {
        return source;
    }
    for (const meta of properties) {
        const property = meta.property;
        let value;
        if (meta.type) {
            value = meta.type.fillProperties(target[property], source[property]);
        }
        else if (target[property] === undefined) {
            value = source[property];
        }
        if (value !== undefined && value !== null) {
            target[property] = value;
        }
    }
    return target;
}
function _fillDefaults(target, defaults, properties, context) {
    if (target && Object.isFrozen(target)) {
        return target;
    }
    if (target === undefined || target === null || defaults === undefined || defaults === null) {
        if (defaults !== undefined && defaults !== null) {
            return Objects.deepClone(defaults);
        }
        else {
            return undefined;
        }
    }
    for (const meta of properties) {
        const property = meta.property;
        if (target[property] !== undefined) {
            continue;
        }
        let value;
        if (meta.type) {
            value = meta.type.fillDefaults(target[property], context);
        }
        else {
            value = defaults[property];
        }
        if (value !== undefined && value !== null) {
            target[property] = value;
        }
    }
    return target;
}
function _freeze(target, properties) {
    if (target === undefined || target === null) {
        return undefined;
    }
    if (Object.isFrozen(target)) {
        return target;
    }
    for (const meta of properties) {
        if (meta.type) {
            const value = target[meta.property];
            if (value) {
                meta.type.freeze(value);
            }
        }
    }
    Object.freeze(target);
    return target;
}
export var RunOnOptions;
(function (RunOnOptions) {
    function fromString(value) {
        if (!value) {
            return Tasks.RunOnOptions.default;
        }
        switch (value.toLowerCase()) {
            case 'folderopen':
                return Tasks.RunOnOptions.folderOpen;
            case 'default':
            default:
                return Tasks.RunOnOptions.default;
        }
    }
    RunOnOptions.fromString = fromString;
})(RunOnOptions || (RunOnOptions = {}));
export var RunOptions;
(function (RunOptions) {
    const properties = [{ property: 'reevaluateOnRerun' }, { property: 'runOn' }, { property: 'instanceLimit' }, { property: 'instancePolicy' }];
    function fromConfiguration(value) {
        return {
            reevaluateOnRerun: value ? value.reevaluateOnRerun : true,
            runOn: value ? RunOnOptions.fromString(value.runOn) : Tasks.RunOnOptions.default,
            instanceLimit: value?.instanceLimit ? Math.max(value.instanceLimit, 1) : 1,
            instancePolicy: value ? InstancePolicy.fromString(value.instancePolicy) : "prompt" /* Tasks.InstancePolicy.prompt */
        };
    }
    RunOptions.fromConfiguration = fromConfiguration;
    function assignProperties(target, source) {
        return _assignProperties(target, source, properties);
    }
    RunOptions.assignProperties = assignProperties;
    function fillProperties(target, source) {
        return _fillProperties(target, source, properties);
    }
    RunOptions.fillProperties = fillProperties;
})(RunOptions || (RunOptions = {}));
export var InstancePolicy;
(function (InstancePolicy) {
    function fromString(value) {
        if (!value) {
            return "prompt" /* Tasks.InstancePolicy.prompt */;
        }
        switch (value.toLowerCase()) {
            case 'terminatenewest':
                return "terminateNewest" /* Tasks.InstancePolicy.terminateNewest */;
            case 'terminateoldest':
                return "terminateOldest" /* Tasks.InstancePolicy.terminateOldest */;
            case 'warn':
                return "warn" /* Tasks.InstancePolicy.warn */;
            case 'silent':
                return "silent" /* Tasks.InstancePolicy.silent */;
            case 'prompt':
            default:
                return "prompt" /* Tasks.InstancePolicy.prompt */;
        }
    }
    InstancePolicy.fromString = fromString;
})(InstancePolicy || (InstancePolicy = {}));
var ShellConfiguration;
(function (ShellConfiguration) {
    const properties = [{ property: 'executable' }, { property: 'args' }, { property: 'quoting' }];
    function is(value) {
        const candidate = value;
        return candidate && (Types.isString(candidate.executable) || Types.isStringArray(candidate.args));
    }
    ShellConfiguration.is = is;
    function from(config, context) {
        if (!is(config)) {
            return undefined;
        }
        const result = {};
        if (config.executable !== undefined) {
            result.executable = config.executable;
        }
        if (config.args !== undefined) {
            result.args = config.args.slice();
        }
        if (config.quoting !== undefined) {
            result.quoting = Objects.deepClone(config.quoting);
        }
        return result;
    }
    ShellConfiguration.from = from;
    function isEmpty(value) {
        return _isEmpty(value, properties, true);
    }
    ShellConfiguration.isEmpty = isEmpty;
    function assignProperties(target, source) {
        return _assignProperties(target, source, properties);
    }
    ShellConfiguration.assignProperties = assignProperties;
    function fillProperties(target, source) {
        return _fillProperties(target, source, properties, true);
    }
    ShellConfiguration.fillProperties = fillProperties;
    function fillDefaults(value, context) {
        return value;
    }
    ShellConfiguration.fillDefaults = fillDefaults;
    function freeze(value) {
        if (!value) {
            return undefined;
        }
        return Object.freeze(value);
    }
    ShellConfiguration.freeze = freeze;
})(ShellConfiguration || (ShellConfiguration = {}));
var CommandOptions;
(function (CommandOptions) {
    const properties = [{ property: 'cwd' }, { property: 'env' }, { property: 'shell', type: ShellConfiguration }];
    const defaults = { cwd: '${workspaceFolder}' };
    function from(options, context) {
        const result = {};
        if (options.cwd !== undefined) {
            if (Types.isString(options.cwd)) {
                result.cwd = options.cwd;
            }
            else {
                context.taskLoadIssues.push(nls.localize('ConfigurationParser.invalidCWD', 'Warning: options.cwd must be of type string. Ignoring value {0}\n', options.cwd));
            }
        }
        if (options.env !== undefined) {
            result.env = Objects.deepClone(options.env);
        }
        result.shell = ShellConfiguration.from(options.shell, context);
        return isEmpty(result) ? undefined : result;
    }
    CommandOptions.from = from;
    function isEmpty(value) {
        return _isEmpty(value, properties);
    }
    CommandOptions.isEmpty = isEmpty;
    function assignProperties(target, source) {
        if ((source === undefined) || isEmpty(source)) {
            return target;
        }
        if ((target === undefined) || isEmpty(target)) {
            return source;
        }
        assignProperty(target, source, 'cwd');
        if (target.env === undefined) {
            target.env = source.env;
        }
        else if (source.env !== undefined) {
            const env = Object.create(null);
            if (target.env !== undefined) {
                Object.keys(target.env).forEach(key => env[key] = target.env[key]);
            }
            if (source.env !== undefined) {
                Object.keys(source.env).forEach(key => env[key] = source.env[key]);
            }
            target.env = env;
        }
        target.shell = ShellConfiguration.assignProperties(target.shell, source.shell);
        return target;
    }
    CommandOptions.assignProperties = assignProperties;
    function fillProperties(target, source) {
        return _fillProperties(target, source, properties);
    }
    CommandOptions.fillProperties = fillProperties;
    function fillDefaults(value, context) {
        return _fillDefaults(value, defaults, properties, context);
    }
    CommandOptions.fillDefaults = fillDefaults;
    function freeze(value) {
        return _freeze(value, properties);
    }
    CommandOptions.freeze = freeze;
})(CommandOptions || (CommandOptions = {}));
var CommandConfiguration;
(function (CommandConfiguration) {
    let PresentationOptions;
    (function (PresentationOptions) {
        const properties = [{ property: 'echo' }, { property: 'reveal' }, { property: 'revealProblems' }, { property: 'focus' }, { property: 'panel' }, { property: 'showReuseMessage' }, { property: 'clear' }, { property: 'group' }, { property: 'close' }, { property: 'preserveTerminalName' }];
        function from(config, context) {
            let echo;
            let reveal;
            let revealProblems;
            let focus;
            let panel;
            let showReuseMessage;
            let clear;
            let group;
            let close;
            let preserveTerminalName;
            let hasProps = false;
            if (Types.isBoolean(config.echoCommand)) {
                echo = config.echoCommand;
                hasProps = true;
            }
            if (Types.isString(config.showOutput)) {
                reveal = Tasks.RevealKind.fromString(config.showOutput);
                hasProps = true;
            }
            const presentation = config.presentation || config.terminal;
            if (presentation) {
                if (Types.isBoolean(presentation.echo)) {
                    echo = presentation.echo;
                }
                if (Types.isString(presentation.reveal)) {
                    reveal = Tasks.RevealKind.fromString(presentation.reveal);
                }
                if (Types.isString(presentation.revealProblems)) {
                    revealProblems = Tasks.RevealProblemKind.fromString(presentation.revealProblems);
                }
                if (Types.isBoolean(presentation.focus)) {
                    focus = presentation.focus;
                }
                if (Types.isString(presentation.panel)) {
                    panel = Tasks.PanelKind.fromString(presentation.panel);
                }
                if (Types.isBoolean(presentation.showReuseMessage)) {
                    showReuseMessage = presentation.showReuseMessage;
                }
                if (Types.isBoolean(presentation.clear)) {
                    clear = presentation.clear;
                }
                if (Types.isString(presentation.group)) {
                    group = presentation.group;
                }
                if (Types.isBoolean(presentation.close)) {
                    close = presentation.close;
                }
                if (Types.isBoolean(presentation.preserveTerminalName)) {
                    preserveTerminalName = presentation.preserveTerminalName;
                }
                hasProps = true;
            }
            if (!hasProps) {
                return undefined;
            }
            return { echo: echo, reveal: reveal, revealProblems: revealProblems, focus: focus, panel: panel, showReuseMessage: showReuseMessage, clear: clear, group, close: close, preserveTerminalName };
        }
        PresentationOptions.from = from;
        function assignProperties(target, source) {
            return _assignProperties(target, source, properties);
        }
        PresentationOptions.assignProperties = assignProperties;
        function fillProperties(target, source) {
            return _fillProperties(target, source, properties);
        }
        PresentationOptions.fillProperties = fillProperties;
        function fillDefaults(value, context) {
            const defaultEcho = context.engine === Tasks.ExecutionEngine.Terminal ? true : false;
            return _fillDefaults(value, { echo: defaultEcho, reveal: Tasks.RevealKind.Always, revealProblems: Tasks.RevealProblemKind.Never, focus: false, panel: Tasks.PanelKind.Shared, showReuseMessage: true, clear: false, preserveTerminalName: false }, properties, context);
        }
        PresentationOptions.fillDefaults = fillDefaults;
        function freeze(value) {
            return _freeze(value, properties);
        }
        PresentationOptions.freeze = freeze;
        function isEmpty(value) {
            return _isEmpty(value, properties);
        }
        PresentationOptions.isEmpty = isEmpty;
    })(PresentationOptions = CommandConfiguration.PresentationOptions || (CommandConfiguration.PresentationOptions = {}));
    let ShellString;
    (function (ShellString) {
        function from(value) {
            if (value === undefined || value === null) {
                return undefined;
            }
            if (Types.isString(value)) {
                return value;
            }
            else if (Types.isStringArray(value)) {
                return value.join(' ');
            }
            else {
                const quoting = Tasks.ShellQuoting.from(value.quoting);
                const result = Types.isString(value.value) ? value.value : Types.isStringArray(value.value) ? value.value.join(' ') : undefined;
                if (result) {
                    return {
                        value: result,
                        quoting: quoting
                    };
                }
                else {
                    return undefined;
                }
            }
        }
        ShellString.from = from;
    })(ShellString || (ShellString = {}));
    const properties = [
        { property: 'runtime' }, { property: 'name' }, { property: 'options', type: CommandOptions },
        { property: 'args' }, { property: 'taskSelector' }, { property: 'suppressTaskName' },
        { property: 'presentation', type: PresentationOptions }
    ];
    function from(config, context) {
        let result = fromBase(config, context);
        let osConfig = undefined;
        if (config.windows && context.platform === 3 /* Platform.Windows */) {
            osConfig = fromBase(config.windows, context);
        }
        else if (config.osx && context.platform === 1 /* Platform.Mac */) {
            osConfig = fromBase(config.osx, context);
        }
        else if (config.linux && context.platform === 2 /* Platform.Linux */) {
            osConfig = fromBase(config.linux, context);
        }
        if (osConfig) {
            result = assignProperties(result, osConfig, context.schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */);
        }
        return isEmpty(result) ? undefined : result;
    }
    CommandConfiguration.from = from;
    function fromBase(config, context) {
        const name = ShellString.from(config.command);
        let runtime;
        if (Types.isString(config.type)) {
            if (config.type === 'shell' || config.type === 'process') {
                runtime = Tasks.RuntimeType.fromString(config.type);
            }
        }
        if (Types.isBoolean(config.isShellCommand) || ShellConfiguration.is(config.isShellCommand)) {
            runtime = Tasks.RuntimeType.Shell;
        }
        else if (config.isShellCommand !== undefined) {
            runtime = !!config.isShellCommand ? Tasks.RuntimeType.Shell : Tasks.RuntimeType.Process;
        }
        const result = {
            name: name,
            runtime: runtime,
            presentation: PresentationOptions.from(config, context)
        };
        if (config.args !== undefined) {
            result.args = [];
            for (const arg of config.args) {
                const converted = ShellString.from(arg);
                if (converted !== undefined) {
                    result.args.push(converted);
                }
                else {
                    context.taskLoadIssues.push(nls.localize('ConfigurationParser.inValidArg', 'Error: command argument must either be a string or a quoted string. Provided value is:\n{0}', arg ? JSON.stringify(arg, undefined, 4) : 'undefined'));
                }
            }
        }
        if (config.options !== undefined) {
            result.options = CommandOptions.from(config.options, context);
            if (result.options && result.options.shell === undefined && ShellConfiguration.is(config.isShellCommand)) {
                result.options.shell = ShellConfiguration.from(config.isShellCommand, context);
                if (context.engine !== Tasks.ExecutionEngine.Terminal) {
                    context.taskLoadIssues.push(nls.localize('ConfigurationParser.noShell', 'Warning: shell configuration is only supported when executing tasks in the terminal.'));
                }
            }
        }
        if (Types.isString(config.taskSelector)) {
            result.taskSelector = config.taskSelector;
        }
        if (Types.isBoolean(config.suppressTaskName)) {
            result.suppressTaskName = config.suppressTaskName;
        }
        return isEmpty(result) ? undefined : result;
    }
    function hasCommand(value) {
        return value && !!value.name;
    }
    CommandConfiguration.hasCommand = hasCommand;
    function isEmpty(value) {
        return _isEmpty(value, properties);
    }
    CommandConfiguration.isEmpty = isEmpty;
    function assignProperties(target, source, overwriteArgs) {
        if (isEmpty(source)) {
            return target;
        }
        if (isEmpty(target)) {
            return source;
        }
        assignProperty(target, source, 'name');
        assignProperty(target, source, 'runtime');
        assignProperty(target, source, 'taskSelector');
        assignProperty(target, source, 'suppressTaskName');
        if (source.args !== undefined) {
            if (target.args === undefined || overwriteArgs) {
                target.args = source.args;
            }
            else {
                target.args = target.args.concat(source.args);
            }
        }
        target.presentation = PresentationOptions.assignProperties(target.presentation, source.presentation);
        target.options = CommandOptions.assignProperties(target.options, source.options);
        return target;
    }
    CommandConfiguration.assignProperties = assignProperties;
    function fillProperties(target, source) {
        return _fillProperties(target, source, properties);
    }
    CommandConfiguration.fillProperties = fillProperties;
    function fillGlobals(target, source, taskName) {
        if ((source === undefined) || isEmpty(source)) {
            return target;
        }
        target = target || {
            name: undefined,
            runtime: undefined,
            presentation: undefined
        };
        if (target.name === undefined) {
            fillProperty(target, source, 'name');
            fillProperty(target, source, 'taskSelector');
            fillProperty(target, source, 'suppressTaskName');
            let args = source.args ? source.args.slice() : [];
            if (!target.suppressTaskName && taskName) {
                if (target.taskSelector !== undefined) {
                    args.push(target.taskSelector + taskName);
                }
                else {
                    args.push(taskName);
                }
            }
            if (target.args) {
                args = args.concat(target.args);
            }
            target.args = args;
        }
        fillProperty(target, source, 'runtime');
        target.presentation = PresentationOptions.fillProperties(target.presentation, source.presentation);
        target.options = CommandOptions.fillProperties(target.options, source.options);
        return target;
    }
    CommandConfiguration.fillGlobals = fillGlobals;
    function fillDefaults(value, context) {
        if (!value || Object.isFrozen(value)) {
            return;
        }
        if (value.name !== undefined && value.runtime === undefined) {
            value.runtime = Tasks.RuntimeType.Process;
        }
        value.presentation = PresentationOptions.fillDefaults(value.presentation, context);
        if (!isEmpty(value)) {
            value.options = CommandOptions.fillDefaults(value.options, context);
        }
        if (value.args === undefined) {
            value.args = EMPTY_ARRAY;
        }
        if (value.suppressTaskName === undefined) {
            value.suppressTaskName = (context.schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */);
        }
    }
    CommandConfiguration.fillDefaults = fillDefaults;
    function freeze(value) {
        return _freeze(value, properties);
    }
    CommandConfiguration.freeze = freeze;
})(CommandConfiguration || (CommandConfiguration = {}));
export var ProblemMatcherConverter;
(function (ProblemMatcherConverter) {
    function namedFrom(declares, context) {
        const result = Object.create(null);
        if (!Array.isArray(declares)) {
            return result;
        }
        declares.forEach((value) => {
            const namedProblemMatcher = (new ProblemMatcherParser(context.problemReporter)).parse(value);
            if (isNamedProblemMatcher(namedProblemMatcher)) {
                result[namedProblemMatcher.name] = namedProblemMatcher;
            }
            else {
                context.problemReporter.error(nls.localize('ConfigurationParser.noName', 'Error: Problem Matcher in declare scope must have a name:\n{0}\n', JSON.stringify(value, undefined, 4)));
            }
        });
        return result;
    }
    ProblemMatcherConverter.namedFrom = namedFrom;
    function fromWithOsConfig(external, context) {
        let result = {};
        if (external.windows && external.windows.problemMatcher && context.platform === 3 /* Platform.Windows */) {
            result = from(external.windows.problemMatcher, context);
        }
        else if (external.osx && external.osx.problemMatcher && context.platform === 1 /* Platform.Mac */) {
            result = from(external.osx.problemMatcher, context);
        }
        else if (external.linux && external.linux.problemMatcher && context.platform === 2 /* Platform.Linux */) {
            result = from(external.linux.problemMatcher, context);
        }
        else if (external.problemMatcher) {
            result = from(external.problemMatcher, context);
        }
        return result;
    }
    ProblemMatcherConverter.fromWithOsConfig = fromWithOsConfig;
    function from(config, context) {
        const result = [];
        if (config === undefined) {
            return { value: result };
        }
        const errors = [];
        function addResult(matcher) {
            if (matcher.value) {
                result.push(matcher.value);
            }
            if (matcher.errors) {
                errors.push(...matcher.errors);
            }
        }
        const kind = getProblemMatcherKind(config);
        if (kind === ProblemMatcherKind.Unknown) {
            const error = nls.localize('ConfigurationParser.unknownMatcherKind', 'Warning: the defined problem matcher is unknown. Supported types are string | ProblemMatcher | Array<string | ProblemMatcher>.\n{0}\n', JSON.stringify(config, null, 4));
            context.problemReporter.warn(error);
        }
        else if (kind === ProblemMatcherKind.String || kind === ProblemMatcherKind.ProblemMatcher) {
            addResult(resolveProblemMatcher(config, context));
        }
        else if (kind === ProblemMatcherKind.Array) {
            const problemMatchers = config;
            problemMatchers.forEach(problemMatcher => {
                addResult(resolveProblemMatcher(problemMatcher, context));
            });
        }
        return { value: result, errors };
    }
    ProblemMatcherConverter.from = from;
    function getProblemMatcherKind(value) {
        if (Types.isString(value)) {
            return ProblemMatcherKind.String;
        }
        else if (Array.isArray(value)) {
            return ProblemMatcherKind.Array;
        }
        else if (!Types.isUndefined(value)) {
            return ProblemMatcherKind.ProblemMatcher;
        }
        else {
            return ProblemMatcherKind.Unknown;
        }
    }
    function resolveProblemMatcher(value, context) {
        if (Types.isString(value)) {
            let variableName = value;
            if (variableName.length > 1 && variableName[0] === '$') {
                variableName = variableName.substring(1);
                const global = ProblemMatcherRegistry.get(variableName);
                if (global) {
                    return { value: Objects.deepClone(global) };
                }
                let localProblemMatcher = context.namedProblemMatchers[variableName];
                if (localProblemMatcher) {
                    localProblemMatcher = Objects.deepClone(localProblemMatcher);
                    // remove the name
                    delete localProblemMatcher.name;
                    return { value: localProblemMatcher };
                }
            }
            return { errors: [nls.localize('ConfigurationParser.invalidVariableReference', 'Error: Invalid problemMatcher reference: {0}\n', value)] };
        }
        else {
            const json = value;
            return { value: new ProblemMatcherParser(context.problemReporter).parse(json) };
        }
    }
})(ProblemMatcherConverter || (ProblemMatcherConverter = {}));
export var GroupKind;
(function (GroupKind) {
    function from(external) {
        if (external === undefined) {
            return undefined;
        }
        else if (Types.isString(external) && Tasks.TaskGroup.is(external)) {
            return { _id: external, isDefault: false };
        }
        else if (Types.isString(external.kind) && Tasks.TaskGroup.is(external.kind)) {
            const group = external.kind;
            const isDefault = Types.isUndefined(external.isDefault) ? false : external.isDefault;
            return { _id: group, isDefault };
        }
        return undefined;
    }
    GroupKind.from = from;
    function to(group) {
        if (Types.isString(group)) {
            return group;
        }
        else if (!group.isDefault) {
            return group._id;
        }
        return {
            kind: group._id,
            isDefault: group.isDefault,
        };
    }
    GroupKind.to = to;
})(GroupKind || (GroupKind = {}));
var TaskDependency;
(function (TaskDependency) {
    function uriFromSource(context, source) {
        switch (source) {
            case TaskConfigSource.User: return Tasks.USER_TASKS_GROUP_KEY;
            case TaskConfigSource.TasksJson: return context.workspaceFolder.uri;
            default: return context.workspace && context.workspace.configuration ? context.workspace.configuration : context.workspaceFolder.uri;
        }
    }
    function from(external, context, source) {
        if (Types.isString(external)) {
            return { uri: uriFromSource(context, source), task: external };
        }
        else if (ITaskIdentifier.is(external)) {
            return {
                uri: uriFromSource(context, source),
                task: Tasks.TaskDefinition.createTaskIdentifier(external, context.problemReporter)
            };
        }
        else {
            return undefined;
        }
    }
    TaskDependency.from = from;
})(TaskDependency || (TaskDependency = {}));
var DependsOrder;
(function (DependsOrder) {
    function from(order) {
        switch (order) {
            case "sequence" /* Tasks.DependsOrder.sequence */:
                return "sequence" /* Tasks.DependsOrder.sequence */;
            case "parallel" /* Tasks.DependsOrder.parallel */:
            default:
                return "parallel" /* Tasks.DependsOrder.parallel */;
        }
    }
    DependsOrder.from = from;
})(DependsOrder || (DependsOrder = {}));
var ConfigurationProperties;
(function (ConfigurationProperties) {
    const properties = [
        { property: 'name' },
        { property: 'identifier' },
        { property: 'group' },
        { property: 'isBackground' },
        { property: 'promptOnClose' },
        { property: 'dependsOn' },
        { property: 'presentation', type: CommandConfiguration.PresentationOptions },
        { property: 'problemMatchers' },
        { property: 'options' },
        { property: 'icon' },
        { property: 'hide' }
    ];
    function from(external, context, includeCommandOptions, source, properties) {
        if (!external) {
            return {};
        }
        const result = {};
        if (properties) {
            for (const propertyName of Object.keys(properties)) {
                if (external[propertyName] !== undefined) {
                    result[propertyName] = Objects.deepClone(external[propertyName]);
                }
            }
        }
        if (Types.isString(external.taskName)) {
            result.name = external.taskName;
        }
        if (Types.isString(external.label) && context.schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */) {
            result.name = external.label;
        }
        if (Types.isString(external.identifier)) {
            result.identifier = external.identifier;
        }
        result.icon = external.icon;
        result.hide = external.hide;
        if (external.isBackground !== undefined) {
            result.isBackground = !!external.isBackground;
        }
        if (external.promptOnClose !== undefined) {
            result.promptOnClose = !!external.promptOnClose;
        }
        result.group = GroupKind.from(external.group);
        if (external.dependsOn !== undefined) {
            if (Array.isArray(external.dependsOn)) {
                result.dependsOn = external.dependsOn.reduce((dependencies, item) => {
                    const dependency = TaskDependency.from(item, context, source);
                    if (dependency) {
                        dependencies.push(dependency);
                    }
                    return dependencies;
                }, []);
            }
            else {
                const dependsOnValue = TaskDependency.from(external.dependsOn, context, source);
                result.dependsOn = dependsOnValue ? [dependsOnValue] : undefined;
            }
        }
        result.dependsOrder = DependsOrder.from(external.dependsOrder);
        if (includeCommandOptions && (external.presentation !== undefined || external.terminal !== undefined)) {
            result.presentation = CommandConfiguration.PresentationOptions.from(external, context);
        }
        if (includeCommandOptions && (external.options !== undefined)) {
            result.options = CommandOptions.from(external.options, context);
        }
        const configProblemMatcher = ProblemMatcherConverter.fromWithOsConfig(external, context);
        if (configProblemMatcher.value !== undefined) {
            result.problemMatchers = configProblemMatcher.value;
        }
        if (external.detail) {
            result.detail = external.detail;
        }
        return isEmpty(result) ? {} : { value: result, errors: configProblemMatcher.errors };
    }
    ConfigurationProperties.from = from;
    function isEmpty(value) {
        return _isEmpty(value, properties);
    }
    ConfigurationProperties.isEmpty = isEmpty;
})(ConfigurationProperties || (ConfigurationProperties = {}));
const label = 'Workspace';
var ConfiguringTask;
(function (ConfiguringTask) {
    const grunt = 'grunt.';
    const jake = 'jake.';
    const gulp = 'gulp.';
    const npm = 'vscode.npm.';
    const typescript = 'vscode.typescript.';
    function from(external, context, index, source, registry) {
        if (!external) {
            return undefined;
        }
        const type = external.type;
        const customize = external.customize;
        if (!type && !customize) {
            context.problemReporter.error(nls.localize('ConfigurationParser.noTaskType', 'Error: tasks configuration must have a type property. The configuration will be ignored.\n{0}\n', JSON.stringify(external, null, 4)));
            return undefined;
        }
        const typeDeclaration = type ? registry?.get?.(type) || TaskDefinitionRegistry.get(type) : undefined;
        if (!typeDeclaration) {
            const message = nls.localize('ConfigurationParser.noTypeDefinition', 'Error: there is no registered task type \'{0}\'. Did you miss installing an extension that provides a corresponding task provider?', type);
            context.problemReporter.error(message);
            return undefined;
        }
        let identifier;
        if (Types.isString(customize)) {
            if (customize.indexOf(grunt) === 0) {
                identifier = { type: 'grunt', task: customize.substring(grunt.length) };
            }
            else if (customize.indexOf(jake) === 0) {
                identifier = { type: 'jake', task: customize.substring(jake.length) };
            }
            else if (customize.indexOf(gulp) === 0) {
                identifier = { type: 'gulp', task: customize.substring(gulp.length) };
            }
            else if (customize.indexOf(npm) === 0) {
                identifier = { type: 'npm', script: customize.substring(npm.length + 4) };
            }
            else if (customize.indexOf(typescript) === 0) {
                identifier = { type: 'typescript', tsconfig: customize.substring(typescript.length + 6) };
            }
        }
        else {
            if (Types.isString(external.type)) {
                identifier = external;
            }
        }
        if (identifier === undefined) {
            context.problemReporter.error(nls.localize('ConfigurationParser.missingType', 'Error: the task configuration \'{0}\' is missing the required property \'type\'. The task configuration will be ignored.', JSON.stringify(external, undefined, 0)));
            return undefined;
        }
        const taskIdentifier = Tasks.TaskDefinition.createTaskIdentifier(identifier, context.problemReporter);
        if (taskIdentifier === undefined) {
            context.problemReporter.error(nls.localize('ConfigurationParser.incorrectType', 'Error: the task configuration \'{0}\' is using an unknown type. The task configuration will be ignored.', JSON.stringify(external, undefined, 0)));
            return undefined;
        }
        const configElement = {
            workspaceFolder: context.workspaceFolder,
            file: '.vscode/tasks.json',
            index,
            element: external
        };
        let taskSource;
        switch (source) {
            case TaskConfigSource.User: {
                taskSource = { kind: Tasks.TaskSourceKind.User, config: configElement, label };
                break;
            }
            case TaskConfigSource.WorkspaceFile: {
                taskSource = { kind: Tasks.TaskSourceKind.WorkspaceFile, config: configElement, label };
                break;
            }
            default: {
                taskSource = { kind: Tasks.TaskSourceKind.Workspace, config: configElement, label };
                break;
            }
        }
        const result = new Tasks.ConfiguringTask(`${typeDeclaration.extensionId}.${taskIdentifier._key}`, taskSource, undefined, type, taskIdentifier, RunOptions.fromConfiguration(external.runOptions), { hide: external.hide });
        const configuration = ConfigurationProperties.from(external, context, true, source, typeDeclaration.properties);
        result.addTaskLoadMessages(configuration.errors);
        if (configuration.value) {
            result.configurationProperties = Object.assign(result.configurationProperties, configuration.value);
            if (result.configurationProperties.name) {
                result._label = result.configurationProperties.name;
            }
            else {
                let label = result.configures.type;
                if (typeDeclaration.required && typeDeclaration.required.length > 0) {
                    for (const required of typeDeclaration.required) {
                        const value = result.configures[required];
                        if (value) {
                            label = label + ': ' + value;
                            break;
                        }
                    }
                }
                result._label = label;
            }
            if (!result.configurationProperties.identifier) {
                result.configurationProperties.identifier = taskIdentifier._key;
            }
        }
        return result;
    }
    ConfiguringTask.from = from;
})(ConfiguringTask || (ConfiguringTask = {}));
var CustomTask;
(function (CustomTask) {
    function from(external, context, index, source) {
        if (!external) {
            return undefined;
        }
        let type = external.type;
        if (type === undefined || type === null) {
            type = Tasks.CUSTOMIZED_TASK_TYPE;
        }
        if (type !== Tasks.CUSTOMIZED_TASK_TYPE && type !== 'shell' && type !== 'process') {
            context.problemReporter.error(nls.localize('ConfigurationParser.notCustom', 'Error: tasks is not declared as a custom task. The configuration will be ignored.\n{0}\n', JSON.stringify(external, null, 4)));
            return undefined;
        }
        let taskName = external.taskName;
        if (Types.isString(external.label) && context.schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */) {
            taskName = external.label;
        }
        if (!taskName) {
            context.problemReporter.error(nls.localize('ConfigurationParser.noTaskName', 'Error: a task must provide a label property. The task will be ignored.\n{0}\n', JSON.stringify(external, null, 4)));
            return undefined;
        }
        let taskSource;
        switch (source) {
            case TaskConfigSource.User: {
                taskSource = { kind: Tasks.TaskSourceKind.User, config: { index, element: external, file: '.vscode/tasks.json', workspaceFolder: context.workspaceFolder }, label };
                break;
            }
            case TaskConfigSource.WorkspaceFile: {
                taskSource = { kind: Tasks.TaskSourceKind.WorkspaceFile, config: { index, element: external, file: '.vscode/tasks.json', workspaceFolder: context.workspaceFolder, workspace: context.workspace }, label };
                break;
            }
            default: {
                taskSource = { kind: Tasks.TaskSourceKind.Workspace, config: { index, element: external, file: '.vscode/tasks.json', workspaceFolder: context.workspaceFolder }, label };
                break;
            }
        }
        const result = new Tasks.CustomTask(context.uuidMap.getUUID(taskName), taskSource, taskName, Tasks.CUSTOMIZED_TASK_TYPE, undefined, false, RunOptions.fromConfiguration(external.runOptions), {
            name: taskName,
            identifier: taskName,
        });
        const configuration = ConfigurationProperties.from(external, context, false, source);
        result.addTaskLoadMessages(configuration.errors);
        if (configuration.value) {
            result.configurationProperties = Object.assign(result.configurationProperties, configuration.value);
        }
        const supportLegacy = true; //context.schemaVersion === Tasks.JsonSchemaVersion.V2_0_0;
        if (supportLegacy) {
            const legacy = external;
            if (result.configurationProperties.isBackground === undefined && legacy.isWatching !== undefined) {
                result.configurationProperties.isBackground = !!legacy.isWatching;
            }
            if (result.configurationProperties.group === undefined) {
                if (legacy.isBuildCommand === true) {
                    result.configurationProperties.group = Tasks.TaskGroup.Build;
                }
                else if (legacy.isTestCommand === true) {
                    result.configurationProperties.group = Tasks.TaskGroup.Test;
                }
            }
        }
        const command = CommandConfiguration.from(external, context);
        if (command) {
            result.command = command;
        }
        if (external.command !== undefined) {
            // if the task has its own command then we suppress the
            // task name by default.
            command.suppressTaskName = true;
        }
        return result;
    }
    CustomTask.from = from;
    function fillGlobals(task, globals) {
        // We only merge a command from a global definition if there is no dependsOn
        // or there is a dependsOn and a defined command.
        if (CommandConfiguration.hasCommand(task.command) || task.configurationProperties.dependsOn === undefined) {
            task.command = CommandConfiguration.fillGlobals(task.command, globals.command, task.configurationProperties.name);
        }
        if (task.configurationProperties.problemMatchers === undefined && globals.problemMatcher !== undefined) {
            task.configurationProperties.problemMatchers = Objects.deepClone(globals.problemMatcher);
            task.hasDefinedMatchers = true;
        }
        // promptOnClose is inferred from isBackground if available
        if (task.configurationProperties.promptOnClose === undefined && task.configurationProperties.isBackground === undefined && globals.promptOnClose !== undefined) {
            task.configurationProperties.promptOnClose = globals.promptOnClose;
        }
    }
    CustomTask.fillGlobals = fillGlobals;
    function fillDefaults(task, context) {
        CommandConfiguration.fillDefaults(task.command, context);
        if (task.configurationProperties.promptOnClose === undefined) {
            task.configurationProperties.promptOnClose = task.configurationProperties.isBackground !== undefined ? !task.configurationProperties.isBackground : true;
        }
        if (task.configurationProperties.isBackground === undefined) {
            task.configurationProperties.isBackground = false;
        }
        if (task.configurationProperties.problemMatchers === undefined) {
            task.configurationProperties.problemMatchers = EMPTY_ARRAY;
        }
    }
    CustomTask.fillDefaults = fillDefaults;
    function createCustomTask(contributedTask, configuredProps) {
        const result = new Tasks.CustomTask(configuredProps._id, Object.assign({}, configuredProps._source, { customizes: contributedTask.defines }), configuredProps.configurationProperties.name || contributedTask._label, Tasks.CUSTOMIZED_TASK_TYPE, contributedTask.command, false, contributedTask.runOptions, {
            name: configuredProps.configurationProperties.name || contributedTask.configurationProperties.name,
            identifier: configuredProps.configurationProperties.identifier || contributedTask.configurationProperties.identifier,
            icon: configuredProps.configurationProperties.icon,
            hide: configuredProps.configurationProperties.hide
        });
        result.addTaskLoadMessages(configuredProps.taskLoadMessages);
        const resultConfigProps = result.configurationProperties;
        assignProperty(resultConfigProps, configuredProps.configurationProperties, 'group');
        assignProperty(resultConfigProps, configuredProps.configurationProperties, 'isBackground');
        assignProperty(resultConfigProps, configuredProps.configurationProperties, 'dependsOn');
        assignProperty(resultConfigProps, configuredProps.configurationProperties, 'problemMatchers');
        assignProperty(resultConfigProps, configuredProps.configurationProperties, 'promptOnClose');
        assignProperty(resultConfigProps, configuredProps.configurationProperties, 'detail');
        result.command.presentation = CommandConfiguration.PresentationOptions.assignProperties(result.command.presentation, configuredProps.configurationProperties.presentation);
        result.command.options = CommandOptions.assignProperties(result.command.options, configuredProps.configurationProperties.options);
        result.runOptions = RunOptions.assignProperties(result.runOptions, configuredProps.runOptions);
        const contributedConfigProps = contributedTask.configurationProperties;
        fillProperty(resultConfigProps, contributedConfigProps, 'group');
        fillProperty(resultConfigProps, contributedConfigProps, 'isBackground');
        fillProperty(resultConfigProps, contributedConfigProps, 'dependsOn');
        fillProperty(resultConfigProps, contributedConfigProps, 'problemMatchers');
        fillProperty(resultConfigProps, contributedConfigProps, 'promptOnClose');
        fillProperty(resultConfigProps, contributedConfigProps, 'detail');
        result.command.presentation = CommandConfiguration.PresentationOptions.fillProperties(result.command.presentation, contributedConfigProps.presentation);
        result.command.options = CommandOptions.fillProperties(result.command.options, contributedConfigProps.options);
        result.runOptions = RunOptions.fillProperties(result.runOptions, contributedTask.runOptions);
        if (contributedTask.hasDefinedMatchers === true) {
            result.hasDefinedMatchers = true;
        }
        return result;
    }
    CustomTask.createCustomTask = createCustomTask;
})(CustomTask || (CustomTask = {}));
export var TaskParser;
(function (TaskParser) {
    function isCustomTask(value) {
        const type = value.type;
        // eslint-disable-next-line local/code-no-any-casts
        const customize = value.customize;
        return customize === undefined && (type === undefined || type === null || type === Tasks.CUSTOMIZED_TASK_TYPE || type === 'shell' || type === 'process');
    }
    const builtinTypeContextMap = {
        shell: ShellExecutionSupportedContext,
        process: ProcessExecutionSupportedContext
    };
    function from(externals, globals, context, source, registry) {
        const result = { custom: [], configured: [] };
        if (!externals) {
            return result;
        }
        const defaultBuildTask = { task: undefined, rank: -1 };
        const defaultTestTask = { task: undefined, rank: -1 };
        const schema2_0_0 = context.schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */;
        const baseLoadIssues = Objects.deepClone(context.taskLoadIssues);
        for (let index = 0; index < externals.length; index++) {
            const external = externals[index];
            const definition = external.type ? registry?.get?.(external.type) || TaskDefinitionRegistry.get(external.type) : undefined;
            let typeNotSupported = false;
            if (definition && definition.when && !context.contextKeyService.contextMatchesRules(definition.when)) {
                typeNotSupported = true;
            }
            else if (!definition && external.type) {
                for (const key of Object.keys(builtinTypeContextMap)) {
                    if (external.type === key) {
                        typeNotSupported = !ShellExecutionSupportedContext.evaluate(context.contextKeyService.getContext(null));
                        break;
                    }
                }
            }
            if (typeNotSupported) {
                context.problemReporter.info(nls.localize('taskConfiguration.providerUnavailable', 'Warning: {0} tasks are unavailable in the current environment.\n', external.type));
                continue;
            }
            if (isCustomTask(external)) {
                const customTask = CustomTask.from(external, context, index, source);
                if (customTask) {
                    CustomTask.fillGlobals(customTask, globals);
                    CustomTask.fillDefaults(customTask, context);
                    if (schema2_0_0) {
                        if ((customTask.command === undefined || customTask.command.name === undefined) && (customTask.configurationProperties.dependsOn === undefined || customTask.configurationProperties.dependsOn.length === 0)) {
                            context.problemReporter.error(nls.localize('taskConfiguration.noCommandOrDependsOn', 'Error: the task \'{0}\' neither specifies a command nor a dependsOn property. The task will be ignored. Its definition is:\n{1}', customTask.configurationProperties.name, JSON.stringify(external, undefined, 4)));
                            continue;
                        }
                    }
                    else {
                        if (customTask.command === undefined || customTask.command.name === undefined) {
                            context.problemReporter.warn(nls.localize('taskConfiguration.noCommand', 'Error: the task \'{0}\' doesn\'t define a command. The task will be ignored. Its definition is:\n{1}', customTask.configurationProperties.name, JSON.stringify(external, undefined, 4)));
                            continue;
                        }
                    }
                    if (customTask.configurationProperties.group === Tasks.TaskGroup.Build && defaultBuildTask.rank < 2) {
                        defaultBuildTask.task = customTask;
                        defaultBuildTask.rank = 2;
                    }
                    else if (customTask.configurationProperties.group === Tasks.TaskGroup.Test && defaultTestTask.rank < 2) {
                        defaultTestTask.task = customTask;
                        defaultTestTask.rank = 2;
                    }
                    else if (customTask.configurationProperties.name === 'build' && defaultBuildTask.rank < 1) {
                        defaultBuildTask.task = customTask;
                        defaultBuildTask.rank = 1;
                    }
                    else if (customTask.configurationProperties.name === 'test' && defaultTestTask.rank < 1) {
                        defaultTestTask.task = customTask;
                        defaultTestTask.rank = 1;
                    }
                    customTask.addTaskLoadMessages(context.taskLoadIssues);
                    result.custom.push(customTask);
                }
            }
            else {
                const configuredTask = ConfiguringTask.from(external, context, index, source, registry);
                if (configuredTask) {
                    configuredTask.addTaskLoadMessages(context.taskLoadIssues);
                    result.configured.push(configuredTask);
                }
            }
            context.taskLoadIssues = Objects.deepClone(baseLoadIssues);
        }
        // There is some special logic for tasks with the labels "build" and "test".
        // Even if they are not marked as a task group Build or Test, we automagically group them as such.
        // However, if they are already grouped as Build or Test, we don't need to add this grouping.
        const defaultBuildGroupName = Types.isString(defaultBuildTask.task?.configurationProperties.group) ? defaultBuildTask.task?.configurationProperties.group : defaultBuildTask.task?.configurationProperties.group?._id;
        const defaultTestTaskGroupName = Types.isString(defaultTestTask.task?.configurationProperties.group) ? defaultTestTask.task?.configurationProperties.group : defaultTestTask.task?.configurationProperties.group?._id;
        if ((defaultBuildGroupName !== Tasks.TaskGroup.Build._id) && (defaultBuildTask.rank > -1) && (defaultBuildTask.rank < 2) && defaultBuildTask.task) {
            defaultBuildTask.task.configurationProperties.group = Tasks.TaskGroup.Build;
        }
        else if ((defaultTestTaskGroupName !== Tasks.TaskGroup.Test._id) && (defaultTestTask.rank > -1) && (defaultTestTask.rank < 2) && defaultTestTask.task) {
            defaultTestTask.task.configurationProperties.group = Tasks.TaskGroup.Test;
        }
        return result;
    }
    TaskParser.from = from;
    function assignTasks(target, source) {
        if (source === undefined || source.length === 0) {
            return target;
        }
        if (target === undefined || target.length === 0) {
            return source;
        }
        if (source) {
            // Tasks are keyed by ID but we need to merge by name
            const map = Object.create(null);
            target.forEach((task) => {
                map[task.configurationProperties.name] = task;
            });
            source.forEach((task) => {
                map[task.configurationProperties.name] = task;
            });
            const newTarget = [];
            target.forEach(task => {
                newTarget.push(map[task.configurationProperties.name]);
                delete map[task.configurationProperties.name];
            });
            Object.keys(map).forEach(key => newTarget.push(map[key]));
            target = newTarget;
        }
        return target;
    }
    TaskParser.assignTasks = assignTasks;
})(TaskParser || (TaskParser = {}));
var Globals;
(function (Globals) {
    function from(config, context) {
        let result = fromBase(config, context);
        let osGlobals = undefined;
        if (config.windows && context.platform === 3 /* Platform.Windows */) {
            osGlobals = fromBase(config.windows, context);
        }
        else if (config.osx && context.platform === 1 /* Platform.Mac */) {
            osGlobals = fromBase(config.osx, context);
        }
        else if (config.linux && context.platform === 2 /* Platform.Linux */) {
            osGlobals = fromBase(config.linux, context);
        }
        if (osGlobals) {
            result = Globals.assignProperties(result, osGlobals);
        }
        const command = CommandConfiguration.from(config, context);
        if (command) {
            result.command = command;
        }
        Globals.fillDefaults(result, context);
        Globals.freeze(result);
        return result;
    }
    Globals.from = from;
    function fromBase(config, context) {
        const result = {};
        if (config.suppressTaskName !== undefined) {
            result.suppressTaskName = !!config.suppressTaskName;
        }
        if (config.promptOnClose !== undefined) {
            result.promptOnClose = !!config.promptOnClose;
        }
        if (config.problemMatcher) {
            result.problemMatcher = ProblemMatcherConverter.from(config.problemMatcher, context).value;
        }
        return result;
    }
    Globals.fromBase = fromBase;
    function isEmpty(value) {
        return !value || value.command === undefined && value.promptOnClose === undefined && value.suppressTaskName === undefined;
    }
    Globals.isEmpty = isEmpty;
    function assignProperties(target, source) {
        if (isEmpty(source)) {
            return target;
        }
        if (isEmpty(target)) {
            return source;
        }
        assignProperty(target, source, 'promptOnClose');
        assignProperty(target, source, 'suppressTaskName');
        return target;
    }
    Globals.assignProperties = assignProperties;
    function fillDefaults(value, context) {
        if (!value) {
            return;
        }
        CommandConfiguration.fillDefaults(value.command, context);
        if (value.suppressTaskName === undefined) {
            value.suppressTaskName = (context.schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */);
        }
        if (value.promptOnClose === undefined) {
            value.promptOnClose = true;
        }
    }
    Globals.fillDefaults = fillDefaults;
    function freeze(value) {
        Object.freeze(value);
        if (value.command) {
            CommandConfiguration.freeze(value.command);
        }
    }
    Globals.freeze = freeze;
})(Globals || (Globals = {}));
export var ExecutionEngine;
(function (ExecutionEngine) {
    function from(config) {
        const runner = config.runner || config._runner;
        let result;
        if (runner) {
            switch (runner) {
                case 'terminal':
                    result = Tasks.ExecutionEngine.Terminal;
                    break;
                case 'process':
                    result = Tasks.ExecutionEngine.Process;
                    break;
            }
        }
        const schemaVersion = JsonSchemaVersion.from(config);
        if (schemaVersion === 1 /* Tasks.JsonSchemaVersion.V0_1_0 */) {
            return result || Tasks.ExecutionEngine.Process;
        }
        else if (schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */) {
            return Tasks.ExecutionEngine.Terminal;
        }
        else {
            throw new Error('Shouldn\'t happen.');
        }
    }
    ExecutionEngine.from = from;
})(ExecutionEngine || (ExecutionEngine = {}));
export var JsonSchemaVersion;
(function (JsonSchemaVersion) {
    const _default = 2 /* Tasks.JsonSchemaVersion.V2_0_0 */;
    function from(config) {
        const version = config.version;
        if (!version) {
            return _default;
        }
        switch (version) {
            case '0.1.0':
                return 1 /* Tasks.JsonSchemaVersion.V0_1_0 */;
            case '2.0.0':
                return 2 /* Tasks.JsonSchemaVersion.V2_0_0 */;
            default:
                return _default;
        }
    }
    JsonSchemaVersion.from = from;
})(JsonSchemaVersion || (JsonSchemaVersion = {}));
export class UUIDMap {
    constructor(other) {
        this.current = Object.create(null);
        if (other) {
            for (const key of Object.keys(other.current)) {
                const value = other.current[key];
                if (Array.isArray(value)) {
                    this.current[key] = value.slice();
                }
                else {
                    this.current[key] = value;
                }
            }
        }
    }
    start() {
        this.last = this.current;
        this.current = Object.create(null);
    }
    getUUID(identifier) {
        const lastValue = this.last ? this.last[identifier] : undefined;
        let result = undefined;
        if (lastValue !== undefined) {
            if (Array.isArray(lastValue)) {
                result = lastValue.shift();
                if (lastValue.length === 0) {
                    delete this.last[identifier];
                }
            }
            else {
                result = lastValue;
                delete this.last[identifier];
            }
        }
        if (result === undefined) {
            result = UUID.generateUuid();
        }
        const currentValue = this.current[identifier];
        if (currentValue === undefined) {
            this.current[identifier] = result;
        }
        else {
            if (Array.isArray(currentValue)) {
                currentValue.push(result);
            }
            else {
                const arrayValue = [currentValue];
                arrayValue.push(result);
                this.current[identifier] = arrayValue;
            }
        }
        return result;
    }
    finish() {
        this.last = undefined;
    }
}
export var TaskConfigSource;
(function (TaskConfigSource) {
    TaskConfigSource[TaskConfigSource["TasksJson"] = 0] = "TasksJson";
    TaskConfigSource[TaskConfigSource["WorkspaceFile"] = 1] = "WorkspaceFile";
    TaskConfigSource[TaskConfigSource["User"] = 2] = "User";
})(TaskConfigSource || (TaskConfigSource = {}));
class ConfigurationParser {
    constructor(workspaceFolder, workspace, platform, problemReporter, uuidMap) {
        this.workspaceFolder = workspaceFolder;
        this.workspace = workspace;
        this.platform = platform;
        this.problemReporter = problemReporter;
        this.uuidMap = uuidMap;
    }
    run(fileConfig, source, contextKeyService) {
        const engine = ExecutionEngine.from(fileConfig);
        const schemaVersion = JsonSchemaVersion.from(fileConfig);
        const context = {
            workspaceFolder: this.workspaceFolder,
            workspace: this.workspace,
            problemReporter: this.problemReporter,
            uuidMap: this.uuidMap,
            namedProblemMatchers: {},
            engine,
            schemaVersion,
            platform: this.platform,
            taskLoadIssues: [],
            contextKeyService
        };
        const taskParseResult = this.createTaskRunnerConfiguration(fileConfig, context, source);
        return {
            validationStatus: this.problemReporter.status,
            custom: taskParseResult.custom,
            configured: taskParseResult.configured,
            engine
        };
    }
    createTaskRunnerConfiguration(fileConfig, context, source) {
        const globals = Globals.from(fileConfig, context);
        if (this.problemReporter.status.isFatal()) {
            return { custom: [], configured: [] };
        }
        context.namedProblemMatchers = ProblemMatcherConverter.namedFrom(fileConfig.declares, context);
        let globalTasks = undefined;
        let externalGlobalTasks = undefined;
        if (fileConfig.windows && context.platform === 3 /* Platform.Windows */) {
            globalTasks = TaskParser.from(fileConfig.windows.tasks, globals, context, source).custom;
            externalGlobalTasks = fileConfig.windows.tasks;
        }
        else if (fileConfig.osx && context.platform === 1 /* Platform.Mac */) {
            globalTasks = TaskParser.from(fileConfig.osx.tasks, globals, context, source).custom;
            externalGlobalTasks = fileConfig.osx.tasks;
        }
        else if (fileConfig.linux && context.platform === 2 /* Platform.Linux */) {
            globalTasks = TaskParser.from(fileConfig.linux.tasks, globals, context, source).custom;
            externalGlobalTasks = fileConfig.linux.tasks;
        }
        if (context.schemaVersion === 2 /* Tasks.JsonSchemaVersion.V2_0_0 */ && globalTasks && globalTasks.length > 0 && externalGlobalTasks && externalGlobalTasks.length > 0) {
            const taskContent = [];
            for (const task of externalGlobalTasks) {
                taskContent.push(JSON.stringify(task, null, 4));
            }
            context.problemReporter.error(nls.localize({ key: 'TaskParse.noOsSpecificGlobalTasks', comment: ['\"Task version 2.0.0\" refers to the 2.0.0 version of the task system. The \"version 2.0.0\" is not localizable as it is a json key and value.'] }, 'Task version 2.0.0 doesn\'t support global OS specific tasks. Convert them to a task with a OS specific command. Affected tasks are:\n{0}', taskContent.join('\n')));
        }
        let result = { custom: [], configured: [] };
        if (fileConfig.tasks) {
            result = TaskParser.from(fileConfig.tasks, globals, context, source);
        }
        if (globalTasks) {
            result.custom = TaskParser.assignTasks(result.custom, globalTasks);
        }
        if ((!result.custom || result.custom.length === 0) && (globals.command && globals.command.name)) {
            const matchers = ProblemMatcherConverter.from(fileConfig.problemMatcher, context).value ?? [];
            const isBackground = fileConfig.isBackground ? !!fileConfig.isBackground : fileConfig.isWatching ? !!fileConfig.isWatching : undefined;
            const name = Tasks.CommandString.value(globals.command.name);
            const task = new Tasks.CustomTask(context.uuidMap.getUUID(name), Object.assign({}, source, 'workspace', { config: { index: -1, element: fileConfig, workspaceFolder: context.workspaceFolder } }), name, Tasks.CUSTOMIZED_TASK_TYPE, {
                name: undefined,
                runtime: undefined,
                presentation: undefined,
                suppressTaskName: true
            }, false, { reevaluateOnRerun: true }, {
                name: name,
                identifier: name,
                group: Tasks.TaskGroup.Build,
                isBackground: isBackground,
                problemMatchers: matchers
            });
            const taskGroupKind = GroupKind.from(fileConfig.group);
            if (taskGroupKind !== undefined) {
                task.configurationProperties.group = taskGroupKind;
            }
            else if (fileConfig.group === 'none') {
                task.configurationProperties.group = undefined;
            }
            CustomTask.fillGlobals(task, globals);
            CustomTask.fillDefaults(task, context);
            result.custom = [task];
        }
        result.custom = result.custom || [];
        result.configured = result.configured || [];
        return result;
    }
}
const uuidMaps = new Map();
const recentUuidMaps = new Map();
export function parse(workspaceFolder, workspace, platform, configuration, logger, source, contextKeyService, isRecents = false) {
    const recentOrOtherMaps = isRecents ? recentUuidMaps : uuidMaps;
    let selectedUuidMaps = recentOrOtherMaps.get(source);
    if (!selectedUuidMaps) {
        recentOrOtherMaps.set(source, new Map());
        selectedUuidMaps = recentOrOtherMaps.get(source);
    }
    let uuidMap = selectedUuidMaps.get(workspaceFolder.uri.toString());
    if (!uuidMap) {
        uuidMap = new UUIDMap();
        selectedUuidMaps.set(workspaceFolder.uri.toString(), uuidMap);
    }
    try {
        uuidMap.start();
        return (new ConfigurationParser(workspaceFolder, workspace, platform, logger, uuidMap)).run(configuration, source, contextKeyService);
    }
    finally {
        uuidMap.finish();
    }
}
export function createCustomTask(contributedTask, configuredProps) {
    return CustomTask.createCustomTask(contributedTask, configuredProps);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza0NvbmZpZ3VyYXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGFza3MvY29tbW9uL3Rhc2tDb25maWd1cmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFFMUMsT0FBTyxLQUFLLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUk5RCxPQUFPLEtBQUssS0FBSyxNQUFNLGtDQUFrQyxDQUFDO0FBQzFELE9BQU8sS0FBSyxJQUFJLE1BQU0saUNBQWlDLENBQUM7QUFHeEQsT0FBTyxFQUNnQixvQkFBb0IsRUFDMUMscUJBQXFCLEVBQUUsc0JBQXNCLEVBQzdDLE1BQU0scUJBQXFCLENBQUM7QUFHN0IsT0FBTyxLQUFLLEtBQUssTUFBTSxZQUFZLENBQUM7QUFDcEMsT0FBTyxFQUEyQixzQkFBc0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBRzlGLE9BQU8sRUFBRSw4QkFBOEIsRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBR3BHLE1BQU0sQ0FBTixJQUFrQixZQWVqQjtBQWZELFdBQWtCLFlBQVk7SUFDN0I7O09BRUc7SUFDSCxtREFBVSxDQUFBO0lBRVY7O09BRUc7SUFDSCxtREFBVSxDQUFBO0lBRVY7O09BRUc7SUFDSCwrQ0FBUSxDQUFBO0FBQ1QsQ0FBQyxFQWZpQixZQUFZLEtBQVosWUFBWSxRQWU3QjtBQWtIRCxNQUFNLEtBQVcsZUFBZSxDQUsvQjtBQUxELFdBQWlCLGVBQWU7SUFDL0IsU0FBZ0IsRUFBRSxDQUFDLEtBQVU7UUFDNUIsTUFBTSxTQUFTLEdBQW9CLEtBQUssQ0FBQztRQUN6QyxPQUFPLFNBQVMsS0FBSyxTQUFTLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUhlLGtCQUFFLEtBR2pCLENBQUE7QUFDRixDQUFDLEVBTGdCLGVBQWUsS0FBZixlQUFlLFFBSy9CO0FBd0VELE1BQU0sS0FBVyxhQUFhLENBYzdCO0FBZEQsV0FBaUIsYUFBYTtJQUM3QixTQUFnQixLQUFLLENBQUMsS0FBb0I7UUFDekMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0IsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO2FBQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDdkMsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUNqQyxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDcEIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBWmUsbUJBQUssUUFZcEIsQ0FBQTtBQUNGLENBQUMsRUFkZ0IsYUFBYSxLQUFiLGFBQWEsUUFjN0I7QUEwU0QsSUFBSyxrQkFLSjtBQUxELFdBQUssa0JBQWtCO0lBQ3RCLGlFQUFPLENBQUE7SUFDUCwrREFBTSxDQUFBO0lBQ04sK0VBQWMsQ0FBQTtJQUNkLDZEQUFLLENBQUE7QUFDTixDQUFDLEVBTEksa0JBQWtCLEtBQWxCLGtCQUFrQixRQUt0QjtBQU9ELE1BQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztBQUM5QixNQUFNLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBRTNCLFNBQVMsY0FBYyxDQUF1QixNQUFTLEVBQUUsTUFBa0IsRUFBRSxHQUFNO0lBQ2xGLE1BQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoQyxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUMvQixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsV0FBWSxDQUFDO0lBQzVCLENBQUM7QUFDRixDQUFDO0FBRUQsU0FBUyxZQUFZLENBQXVCLE1BQVMsRUFBRSxNQUFrQixFQUFFLEdBQU07SUFDaEYsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2hDLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsSUFBSSxXQUFXLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDNUQsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVksQ0FBQztJQUM1QixDQUFDO0FBQ0YsQ0FBQztBQWlCRCxTQUFTLFFBQVEsQ0FBZ0IsS0FBb0IsRUFBRSxVQUEyQyxFQUFFLGtCQUEyQixLQUFLO0lBQ25JLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUN2RSxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFDRCxLQUFLLE1BQU0sSUFBSSxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQy9CLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdEMsSUFBSSxRQUFRLEtBQUssU0FBUyxJQUFJLFFBQVEsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNqRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDN0QsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO2lCQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsSUFBSSxlQUFlLEVBQUUsQ0FBQztnQkFDakYsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNiLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFnQixNQUFxQixFQUFFLE1BQXFCLEVBQUUsVUFBK0I7SUFDdEgsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDN0MsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBQ0QsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQyxFQUFFLENBQUM7UUFDN0MsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBQ0QsS0FBSyxNQUFNLElBQUksSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUMvQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQy9CLElBQUksS0FBVSxDQUFDO1FBQ2YsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzdCLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUN4RSxDQUFDO2FBQU0sQ0FBQztZQUNQLEtBQUssR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDMUIsQ0FBQztRQUNELElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDM0MsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUMxQixDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMsZUFBZSxDQUFnQixNQUFxQixFQUFFLE1BQXFCLEVBQUUsVUFBMkMsRUFBRSxrQkFBMkIsS0FBSztJQUNsSyxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUUsVUFBVSxDQUFDLEVBQUUsQ0FBQztRQUM3QyxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFDRCxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQyxFQUFFLENBQUM7UUFDOUQsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBQ0QsS0FBSyxNQUFNLElBQUksSUFBSSxVQUFXLEVBQUUsQ0FBQztRQUNoQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQy9CLElBQUksS0FBVSxDQUFDO1FBQ2YsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDZixLQUFLLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7YUFBTSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMzQyxLQUFLLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFCLENBQUM7UUFDRCxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzNDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUM7UUFDMUIsQ0FBQztJQUNGLENBQUM7SUFDRCxPQUFPLE1BQU0sQ0FBQztBQUNmLENBQUM7QUFFRCxTQUFTLGFBQWEsQ0FBZ0IsTUFBcUIsRUFBRSxRQUF1QixFQUFFLFVBQStCLEVBQUUsT0FBc0I7SUFDNUksSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ3ZDLE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUNELElBQUksTUFBTSxLQUFLLFNBQVMsSUFBSSxNQUFNLEtBQUssSUFBSSxJQUFJLFFBQVEsS0FBSyxTQUFTLElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQzVGLElBQUksUUFBUSxLQUFLLFNBQVMsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDakQsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztJQUNGLENBQUM7SUFDRCxLQUFLLE1BQU0sSUFBSSxJQUFJLFVBQVUsRUFBRSxDQUFDO1FBQy9CLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDL0IsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDcEMsU0FBUztRQUNWLENBQUM7UUFDRCxJQUFJLEtBQVUsQ0FBQztRQUNmLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2YsS0FBSyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMzRCxDQUFDO2FBQU0sQ0FBQztZQUNQLEtBQUssR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUIsQ0FBQztRQUVELElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDM0MsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQztRQUMxQixDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELFNBQVMsT0FBTyxDQUFnQixNQUFTLEVBQUUsVUFBK0I7SUFDekUsSUFBSSxNQUFNLEtBQUssU0FBUyxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUM3QyxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBQ0QsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7UUFDN0IsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBQ0QsS0FBSyxNQUFNLElBQUksSUFBSSxVQUFVLEVBQUUsQ0FBQztRQUMvQixJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNmLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDcEMsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN6QixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFDRCxNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RCLE9BQU8sTUFBTSxDQUFDO0FBQ2YsQ0FBQztBQUVELE1BQU0sS0FBVyxZQUFZLENBYTVCO0FBYkQsV0FBaUIsWUFBWTtJQUM1QixTQUFnQixVQUFVLENBQUMsS0FBeUI7UUFDbkQsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUNuQyxDQUFDO1FBQ0QsUUFBUSxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztZQUM3QixLQUFLLFlBQVk7Z0JBQ2hCLE9BQU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUM7WUFDdEMsS0FBSyxTQUFTLENBQUM7WUFDZjtnQkFDQyxPQUFPLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDO1FBQ3BDLENBQUM7SUFDRixDQUFDO0lBWGUsdUJBQVUsYUFXekIsQ0FBQTtBQUNGLENBQUMsRUFiZ0IsWUFBWSxLQUFaLFlBQVksUUFhNUI7QUFFRCxNQUFNLEtBQVcsVUFBVSxDQWtCMUI7QUFsQkQsV0FBaUIsVUFBVTtJQUMxQixNQUFNLFVBQVUsR0FBeUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLGdCQUFnQixFQUFFLENBQUMsQ0FBQztJQUNuTCxTQUFnQixpQkFBaUIsQ0FBQyxLQUFvQztRQUNyRSxPQUFPO1lBQ04saUJBQWlCLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDLElBQUk7WUFDekQsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBTztZQUNoRixhQUFhLEVBQUUsS0FBSyxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFFLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsMkNBQTRCO1NBQ3JHLENBQUM7SUFDSCxDQUFDO0lBUGUsNEJBQWlCLG9CQU9oQyxDQUFBO0lBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBeUIsRUFBRSxNQUFxQztRQUNoRyxPQUFPLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFFLENBQUM7SUFDdkQsQ0FBQztJQUZlLDJCQUFnQixtQkFFL0IsQ0FBQTtJQUVELFNBQWdCLGNBQWMsQ0FBQyxNQUF5QixFQUFFLE1BQXFDO1FBQzlGLE9BQU8sZUFBZSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFFLENBQUM7SUFDckQsQ0FBQztJQUZlLHlCQUFjLGlCQUU3QixDQUFBO0FBQ0YsQ0FBQyxFQWxCZ0IsVUFBVSxLQUFWLFVBQVUsUUFrQjFCO0FBRUQsTUFBTSxLQUFXLGNBQWMsQ0FtQjlCO0FBbkJELFdBQWlCLGNBQWM7SUFDOUIsU0FBZ0IsVUFBVSxDQUFDLEtBQXlCO1FBQ25ELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLGtEQUFtQztRQUNwQyxDQUFDO1FBQ0QsUUFBUSxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztZQUM3QixLQUFLLGlCQUFpQjtnQkFDckIsb0VBQTRDO1lBQzdDLEtBQUssaUJBQWlCO2dCQUNyQixvRUFBNEM7WUFDN0MsS0FBSyxNQUFNO2dCQUNWLDhDQUFpQztZQUNsQyxLQUFLLFFBQVE7Z0JBQ1osa0RBQW1DO1lBQ3BDLEtBQUssUUFBUSxDQUFDO1lBQ2Q7Z0JBQ0Msa0RBQW1DO1FBQ3JDLENBQUM7SUFDRixDQUFDO0lBakJlLHlCQUFVLGFBaUJ6QixDQUFBO0FBQ0YsQ0FBQyxFQW5CZ0IsY0FBYyxLQUFkLGNBQWMsUUFtQjlCO0FBZ0JELElBQVUsa0JBQWtCLENBaUQzQjtBQWpERCxXQUFVLGtCQUFrQjtJQUUzQixNQUFNLFVBQVUsR0FBaUQsQ0FBQyxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBRTdJLFNBQWdCLEVBQUUsQ0FBQyxLQUFVO1FBQzVCLE1BQU0sU0FBUyxHQUF3QixLQUFLLENBQUM7UUFDN0MsT0FBTyxTQUFTLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ25HLENBQUM7SUFIZSxxQkFBRSxLQUdqQixDQUFBO0lBRUQsU0FBZ0IsSUFBSSxDQUFhLE1BQXVDLEVBQUUsT0FBc0I7UUFDL0YsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ2pCLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBd0IsRUFBRSxDQUFDO1FBQ3ZDLElBQUksTUFBTSxDQUFDLFVBQVUsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNyQyxNQUFNLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDdkMsQ0FBQztRQUNELElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMvQixNQUFNLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDbkMsQ0FBQztRQUNELElBQUksTUFBTSxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNsQyxNQUFNLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BELENBQUM7UUFFRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFoQmUsdUJBQUksT0FnQm5CLENBQUE7SUFFRCxTQUFnQixPQUFPLENBQWEsS0FBZ0M7UUFDbkUsT0FBTyxRQUFRLENBQUMsS0FBSyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRmUsMEJBQU8sVUFFdEIsQ0FBQTtJQUVELFNBQWdCLGdCQUFnQixDQUFhLE1BQTZDLEVBQUUsTUFBNkM7UUFDeEksT0FBTyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFGZSxtQ0FBZ0IsbUJBRS9CLENBQUE7SUFFRCxTQUFnQixjQUFjLENBQWEsTUFBaUMsRUFBRSxNQUFpQztRQUM5RyxPQUFPLGVBQWUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRmUsaUNBQWMsaUJBRTdCLENBQUE7SUFFRCxTQUFnQixZQUFZLENBQWEsS0FBZ0MsRUFBRSxPQUFzQjtRQUNoRyxPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFGZSwrQkFBWSxlQUUzQixDQUFBO0lBRUQsU0FBZ0IsTUFBTSxDQUFhLEtBQWdDO1FBQ2xFLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUxlLHlCQUFNLFNBS3JCLENBQUE7QUFDRixDQUFDLEVBakRTLGtCQUFrQixLQUFsQixrQkFBa0IsUUFpRDNCO0FBRUQsSUFBVSxjQUFjLENBNER2QjtBQTVERCxXQUFVLGNBQWM7SUFFdkIsTUFBTSxVQUFVLEdBQWlFLENBQUMsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxDQUFDLENBQUM7SUFDN0ssTUFBTSxRQUFRLEdBQTBCLEVBQUUsR0FBRyxFQUFFLG9CQUFvQixFQUFFLENBQUM7SUFFdEUsU0FBZ0IsSUFBSSxDQUFhLE9BQThCLEVBQUUsT0FBc0I7UUFDdEYsTUFBTSxNQUFNLEdBQXlCLEVBQUUsQ0FBQztRQUN4QyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDL0IsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNqQyxNQUFNLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDMUIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsZ0NBQWdDLEVBQUUsbUVBQW1FLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDL0osQ0FBQztRQUNGLENBQUM7UUFDRCxJQUFJLE9BQU8sQ0FBQyxHQUFHLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDL0IsTUFBTSxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBQ0QsTUFBTSxDQUFDLEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDN0MsQ0FBQztJQWRlLG1CQUFJLE9BY25CLENBQUE7SUFFRCxTQUFnQixPQUFPLENBQUMsS0FBdUM7UUFDOUQsT0FBTyxRQUFRLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFGZSxzQkFBTyxVQUV0QixDQUFBO0lBRUQsU0FBZ0IsZ0JBQWdCLENBQUMsTUFBd0MsRUFBRSxNQUF3QztRQUNsSCxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQy9DLE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDL0MsT0FBTyxNQUFNLENBQUM7UUFDZixDQUFDO1FBQ0QsY0FBYyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdEMsSUFBSSxNQUFNLENBQUMsR0FBRyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzlCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztRQUN6QixDQUFDO2FBQU0sSUFBSSxNQUFNLENBQUMsR0FBRyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sR0FBRyxHQUE4QixNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzNELElBQUksTUFBTSxDQUFDLEdBQUcsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxHQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNyRSxDQUFDO1lBQ0QsSUFBSSxNQUFNLENBQUMsR0FBRyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUM5QixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3JFLENBQUM7WUFDRCxNQUFNLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTSxDQUFDLEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvRSxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUF0QmUsK0JBQWdCLG1CQXNCL0IsQ0FBQTtJQUVELFNBQWdCLGNBQWMsQ0FBQyxNQUF3QyxFQUFFLE1BQXdDO1FBQ2hILE9BQU8sZUFBZSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUZlLDZCQUFjLGlCQUU3QixDQUFBO0lBRUQsU0FBZ0IsWUFBWSxDQUFDLEtBQXVDLEVBQUUsT0FBc0I7UUFDM0YsT0FBTyxhQUFhLENBQUMsS0FBSyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUZlLDJCQUFZLGVBRTNCLENBQUE7SUFFRCxTQUFnQixNQUFNLENBQUMsS0FBMkI7UUFDakQsT0FBTyxPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFGZSxxQkFBTSxTQUVyQixDQUFBO0FBQ0YsQ0FBQyxFQTVEUyxjQUFjLEtBQWQsY0FBYyxRQTREdkI7QUFFRCxJQUFVLG9CQUFvQixDQXNTN0I7QUF0U0QsV0FBVSxvQkFBb0I7SUFFN0IsSUFBaUIsbUJBQW1CLENBdUZuQztJQXZGRCxXQUFpQixtQkFBbUI7UUFDbkMsTUFBTSxVQUFVLEdBQWtELENBQUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLHNCQUFzQixFQUFFLENBQUMsQ0FBQztRQU01VSxTQUFnQixJQUFJLENBQWEsTUFBaUMsRUFBRSxPQUFzQjtZQUN6RixJQUFJLElBQWEsQ0FBQztZQUNsQixJQUFJLE1BQXdCLENBQUM7WUFDN0IsSUFBSSxjQUF1QyxDQUFDO1lBQzVDLElBQUksS0FBYyxDQUFDO1lBQ25CLElBQUksS0FBc0IsQ0FBQztZQUMzQixJQUFJLGdCQUF5QixDQUFDO1lBQzlCLElBQUksS0FBYyxDQUFDO1lBQ25CLElBQUksS0FBeUIsQ0FBQztZQUM5QixJQUFJLEtBQTBCLENBQUM7WUFDL0IsSUFBSSxvQkFBeUMsQ0FBQztZQUM5QyxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7WUFDckIsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO2dCQUN6QyxJQUFJLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztnQkFDMUIsUUFBUSxHQUFHLElBQUksQ0FBQztZQUNqQixDQUFDO1lBQ0QsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUN2QyxNQUFNLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUN4RCxRQUFRLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLENBQUM7WUFDRCxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsWUFBWSxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFDNUQsSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUN4QyxJQUFJLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQztnQkFDMUIsQ0FBQztnQkFDRCxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQ3pDLE1BQU0sR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzNELENBQUM7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO29CQUNqRCxjQUFjLEdBQUcsS0FBSyxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLENBQUM7Z0JBQ2xGLENBQUM7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUN6QyxLQUFLLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQztnQkFDNUIsQ0FBQztnQkFDRCxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3hDLEtBQUssR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3hELENBQUM7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUM7b0JBQ3BELGdCQUFnQixHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDbEQsQ0FBQztnQkFDRCxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3pDLEtBQUssR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDO2dCQUM1QixDQUFDO2dCQUNELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztvQkFDeEMsS0FBSyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUM7Z0JBQzVCLENBQUM7Z0JBQ0QsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO29CQUN6QyxLQUFLLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQztnQkFDNUIsQ0FBQztnQkFDRCxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLG9CQUFvQixDQUFDLEVBQUUsQ0FBQztvQkFDeEQsb0JBQW9CLEdBQUcsWUFBWSxDQUFDLG9CQUFvQixDQUFDO2dCQUMxRCxDQUFDO2dCQUNELFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDakIsQ0FBQztZQUNELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDZixPQUFPLFNBQVMsQ0FBQztZQUNsQixDQUFDO1lBQ0QsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU8sRUFBRSxjQUFjLEVBQUUsY0FBZSxFQUFFLEtBQUssRUFBRSxLQUFNLEVBQUUsS0FBSyxFQUFFLEtBQU0sRUFBRSxnQkFBZ0IsRUFBRSxnQkFBaUIsRUFBRSxLQUFLLEVBQUUsS0FBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLENBQUM7UUFDdk0sQ0FBQztRQTFEZSx3QkFBSSxPQTBEbkIsQ0FBQTtRQUVELFNBQWdCLGdCQUFnQixDQUFDLE1BQWtDLEVBQUUsTUFBOEM7WUFDbEgsT0FBTyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFGZSxvQ0FBZ0IsbUJBRS9CLENBQUE7UUFFRCxTQUFnQixjQUFjLENBQUMsTUFBa0MsRUFBRSxNQUE4QztZQUNoSCxPQUFPLGVBQWUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELENBQUM7UUFGZSxrQ0FBYyxpQkFFN0IsQ0FBQTtRQUVELFNBQWdCLFlBQVksQ0FBQyxLQUFpQyxFQUFFLE9BQXNCO1lBQ3JGLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ3JGLE9BQU8sYUFBYSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLEtBQUssQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLGNBQWMsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLGdCQUFnQixFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLG9CQUFvQixFQUFFLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6USxDQUFDO1FBSGUsZ0NBQVksZUFHM0IsQ0FBQTtRQUVELFNBQWdCLE1BQU0sQ0FBQyxLQUFpQztZQUN2RCxPQUFPLE9BQU8sQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUZlLDBCQUFNLFNBRXJCLENBQUE7UUFFRCxTQUFnQixPQUFPLENBQWEsS0FBaUM7WUFDcEUsT0FBTyxRQUFRLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFGZSwyQkFBTyxVQUV0QixDQUFBO0lBQ0YsQ0FBQyxFQXZGZ0IsbUJBQW1CLEdBQW5CLHdDQUFtQixLQUFuQix3Q0FBbUIsUUF1Rm5DO0lBRUQsSUFBVSxXQUFXLENBc0JwQjtJQXRCRCxXQUFVLFdBQVc7UUFDcEIsU0FBZ0IsSUFBSSxDQUFhLEtBQWdDO1lBQ2hFLElBQUksS0FBSyxLQUFLLFNBQVMsSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQzNDLE9BQU8sU0FBUyxDQUFDO1lBQ2xCLENBQUM7WUFDRCxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDM0IsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO2lCQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUN2QyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDeEIsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdkQsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUNoSSxJQUFJLE1BQU0sRUFBRSxDQUFDO29CQUNaLE9BQU87d0JBQ04sS0FBSyxFQUFFLE1BQU07d0JBQ2IsT0FBTyxFQUFFLE9BQU87cUJBQ2hCLENBQUM7Z0JBQ0gsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE9BQU8sU0FBUyxDQUFDO2dCQUNsQixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFwQmUsZ0JBQUksT0FvQm5CLENBQUE7SUFDRixDQUFDLEVBdEJTLFdBQVcsS0FBWCxXQUFXLFFBc0JwQjtJQVdELE1BQU0sVUFBVSxHQUFrRDtRQUNqRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRTtRQUM1RixFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsRUFBRSxFQUFFLFFBQVEsRUFBRSxrQkFBa0IsRUFBRTtRQUNwRixFQUFFLFFBQVEsRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixFQUFFO0tBQ3ZELENBQUM7SUFFRixTQUFnQixJQUFJLENBQWEsTUFBa0MsRUFBRSxPQUFzQjtRQUMxRixJQUFJLE1BQU0sR0FBZ0MsUUFBUSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUUsQ0FBQztRQUVyRSxJQUFJLFFBQVEsR0FBNEMsU0FBUyxDQUFDO1FBQ2xFLElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsUUFBUSw2QkFBcUIsRUFBRSxDQUFDO1lBQzdELFFBQVEsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztRQUM5QyxDQUFDO2FBQU0sSUFBSSxNQUFNLENBQUMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxRQUFRLHlCQUFpQixFQUFFLENBQUM7WUFDNUQsUUFBUSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzFDLENBQUM7YUFBTSxJQUFJLE1BQU0sQ0FBQyxLQUFLLElBQUksT0FBTyxDQUFDLFFBQVEsMkJBQW1CLEVBQUUsQ0FBQztZQUNoRSxRQUFRLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUNELElBQUksUUFBUSxFQUFFLENBQUM7WUFDZCxNQUFNLEdBQUcsZ0JBQWdCLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLENBQUMsYUFBYSwyQ0FBbUMsQ0FBQyxDQUFDO1FBQ3ZHLENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDN0MsQ0FBQztJQWZlLHlCQUFJLE9BZW5CLENBQUE7SUFFRCxTQUFTLFFBQVEsQ0FBYSxNQUFzQyxFQUFFLE9BQXNCO1FBQzNGLE1BQU0sSUFBSSxHQUFvQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMvRSxJQUFJLE9BQTBCLENBQUM7UUFDL0IsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2pDLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxPQUFPLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDMUQsT0FBTyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNyRCxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksa0JBQWtCLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1lBQzVGLE9BQU8sR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQztRQUNuQyxDQUFDO2FBQU0sSUFBSSxNQUFNLENBQUMsY0FBYyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hELE9BQU8sR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDO1FBQ3pGLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBZ0M7WUFDM0MsSUFBSSxFQUFFLElBQUk7WUFDVixPQUFPLEVBQUUsT0FBUTtZQUNqQixZQUFZLEVBQUUsbUJBQW1CLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUU7U0FDeEQsQ0FBQztRQUVGLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMvQixNQUFNLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNqQixLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDL0IsTUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDeEMsSUFBSSxTQUFTLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQzdCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUM3QixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQzFCLEdBQUcsQ0FBQyxRQUFRLENBQ1gsZ0NBQWdDLEVBQ2hDLDZGQUE2RixFQUM3RixHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUNyRCxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsSUFBSSxNQUFNLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxPQUFPLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzlELElBQUksTUFBTSxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxTQUFTLElBQUksa0JBQWtCLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO2dCQUMxRyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDL0UsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLEtBQUssQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQ3ZELE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsNkJBQTZCLEVBQUUsc0ZBQXNGLENBQUMsQ0FBQyxDQUFDO2dCQUNsSyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7WUFDekMsTUFBTSxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDO1FBQzNDLENBQUM7UUFDRCxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQztZQUM5QyxNQUFNLENBQUMsZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1FBQ25ELENBQUM7UUFFRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDN0MsQ0FBQztJQUVELFNBQWdCLFVBQVUsQ0FBQyxLQUFrQztRQUM1RCxPQUFPLEtBQUssSUFBSSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztJQUM5QixDQUFDO0lBRmUsK0JBQVUsYUFFekIsQ0FBQTtJQUVELFNBQWdCLE9BQU8sQ0FBQyxLQUE4QztRQUNyRSxPQUFPLFFBQVEsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUZlLDRCQUFPLFVBRXRCLENBQUE7SUFFRCxTQUFnQixnQkFBZ0IsQ0FBQyxNQUFtQyxFQUFFLE1BQW1DLEVBQUUsYUFBc0I7UUFDaEksSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNyQixPQUFPLE1BQU0sQ0FBQztRQUNmLENBQUM7UUFDRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ3JCLE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQztRQUNELGNBQWMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQy9DLGNBQWMsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDbkQsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQy9CLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksYUFBYSxFQUFFLENBQUM7Z0JBQ2hELE1BQU0sQ0FBQyxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztZQUMzQixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0MsQ0FBQztRQUNGLENBQUM7UUFDRCxNQUFNLENBQUMsWUFBWSxHQUFHLG1CQUFtQixDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxZQUFhLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBRSxDQUFDO1FBQ3ZHLE1BQU0sQ0FBQyxPQUFPLEdBQUcsY0FBYyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pGLE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQXJCZSxxQ0FBZ0IsbUJBcUIvQixDQUFBO0lBRUQsU0FBZ0IsY0FBYyxDQUFDLE1BQW1DLEVBQUUsTUFBbUM7UUFDdEcsT0FBTyxlQUFlLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRmUsbUNBQWMsaUJBRTdCLENBQUE7SUFFRCxTQUFnQixXQUFXLENBQUMsTUFBbUMsRUFBRSxNQUErQyxFQUFFLFFBQTRCO1FBQzdJLElBQUksQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDL0MsT0FBTyxNQUFNLENBQUM7UUFDZixDQUFDO1FBQ0QsTUFBTSxHQUFHLE1BQU0sSUFBSTtZQUNsQixJQUFJLEVBQUUsU0FBUztZQUNmLE9BQU8sRUFBRSxTQUFTO1lBQ2xCLFlBQVksRUFBRSxTQUFTO1NBQ3ZCLENBQUM7UUFDRixJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDL0IsWUFBWSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDckMsWUFBWSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDN0MsWUFBWSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNqRCxJQUFJLElBQUksR0FBMEIsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3pFLElBQUksQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQzFDLElBQUksTUFBTSxDQUFDLFlBQVksS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDdkMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxHQUFHLFFBQVEsQ0FBQyxDQUFDO2dCQUMzQyxDQUFDO3FCQUFNLENBQUM7b0JBQ1AsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDckIsQ0FBQztZQUNGLENBQUM7WUFDRCxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDakIsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2pDLENBQUM7WUFDRCxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNwQixDQUFDO1FBQ0QsWUFBWSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEMsTUFBTSxDQUFDLFlBQVksR0FBRyxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFlBQWEsRUFBRSxNQUFNLENBQUMsWUFBWSxDQUFFLENBQUM7UUFDckcsTUFBTSxDQUFDLE9BQU8sR0FBRyxjQUFjLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRS9FLE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQWhDZSxnQ0FBVyxjQWdDMUIsQ0FBQTtJQUVELFNBQWdCLFlBQVksQ0FBQyxLQUE4QyxFQUFFLE9BQXNCO1FBQ2xHLElBQUksQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3RDLE9BQU87UUFDUixDQUFDO1FBQ0QsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxLQUFLLENBQUMsT0FBTyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzdELEtBQUssQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7UUFDM0MsQ0FBQztRQUNELEtBQUssQ0FBQyxZQUFZLEdBQUcsbUJBQW1CLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxZQUFhLEVBQUUsT0FBTyxDQUFFLENBQUM7UUFDckYsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3JCLEtBQUssQ0FBQyxPQUFPLEdBQUcsY0FBYyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3JFLENBQUM7UUFDRCxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDOUIsS0FBSyxDQUFDLElBQUksR0FBRyxXQUFXLENBQUM7UUFDMUIsQ0FBQztRQUNELElBQUksS0FBSyxDQUFDLGdCQUFnQixLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzFDLEtBQUssQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLE9BQU8sQ0FBQyxhQUFhLDJDQUFtQyxDQUFDLENBQUM7UUFDckYsQ0FBQztJQUNGLENBQUM7SUFqQmUsaUNBQVksZUFpQjNCLENBQUE7SUFFRCxTQUFnQixNQUFNLENBQUMsS0FBa0M7UUFDeEQsT0FBTyxPQUFPLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFGZSwyQkFBTSxTQUVyQixDQUFBO0FBQ0YsQ0FBQyxFQXRTUyxvQkFBb0IsS0FBcEIsb0JBQW9CLFFBc1M3QjtBQUVELE1BQU0sS0FBVyx1QkFBdUIsQ0FvR3ZDO0FBcEdELFdBQWlCLHVCQUF1QjtJQUV2QyxTQUFnQixTQUFTLENBQWEsUUFBaUUsRUFBRSxPQUFzQjtRQUM5SCxNQUFNLE1BQU0sR0FBNEMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUU1RSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzlCLE9BQU8sTUFBTSxDQUFDO1FBQ2YsQ0FBQztRQUM2QyxRQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDekUsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLElBQUksb0JBQW9CLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzdGLElBQUkscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDO2dCQUNoRCxNQUFNLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLEdBQUcsbUJBQW1CLENBQUM7WUFDeEQsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLE9BQU8sQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsNEJBQTRCLEVBQUUsa0VBQWtFLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwTCxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFmZSxpQ0FBUyxZQWV4QixDQUFBO0lBRUQsU0FBZ0IsZ0JBQWdCLENBQWEsUUFBMkQsRUFBRSxPQUFzQjtRQUMvSCxJQUFJLE1BQU0sR0FBdUQsRUFBRSxDQUFDO1FBQ3BFLElBQUksUUFBUSxDQUFDLE9BQU8sSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUMsUUFBUSw2QkFBcUIsRUFBRSxDQUFDO1lBQ2xHLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekQsQ0FBQzthQUFNLElBQUksUUFBUSxDQUFDLEdBQUcsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUMsUUFBUSx5QkFBaUIsRUFBRSxDQUFDO1lBQzdGLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDckQsQ0FBQzthQUFNLElBQUksUUFBUSxDQUFDLEtBQUssSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLGNBQWMsSUFBSSxPQUFPLENBQUMsUUFBUSwyQkFBbUIsRUFBRSxDQUFDO1lBQ25HLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkQsQ0FBQzthQUFNLElBQUksUUFBUSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3BDLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRCxDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBWmUsd0NBQWdCLG1CQVkvQixDQUFBO0lBRUQsU0FBZ0IsSUFBSSxDQUFhLE1BQTJELEVBQUUsT0FBc0I7UUFDbkgsTUFBTSxNQUFNLEdBQXFCLEVBQUUsQ0FBQztRQUNwQyxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMxQixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQzFCLENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7UUFDNUIsU0FBUyxTQUFTLENBQUMsT0FBeUQ7WUFDM0UsSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ25CLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzVCLENBQUM7WUFDRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDcEIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNoQyxDQUFDO1FBQ0YsQ0FBQztRQUNELE1BQU0sSUFBSSxHQUFHLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNDLElBQUksSUFBSSxLQUFLLGtCQUFrQixDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3pDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQ3pCLHdDQUF3QyxFQUN4Qyx1SUFBdUksRUFDdkksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDckMsQ0FBQzthQUFNLElBQUksSUFBSSxLQUFLLGtCQUFrQixDQUFDLE1BQU0sSUFBSSxJQUFJLEtBQUssa0JBQWtCLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDN0YsU0FBUyxDQUFDLHFCQUFxQixDQUFDLE1BQTZDLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUMxRixDQUFDO2FBQU0sSUFBSSxJQUFJLEtBQUssa0JBQWtCLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDOUMsTUFBTSxlQUFlLEdBQXFELE1BQU0sQ0FBQztZQUNqRixlQUFlLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFO2dCQUN4QyxTQUFTLENBQUMscUJBQXFCLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDM0QsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDO1FBQ0QsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLENBQUM7SUFDbEMsQ0FBQztJQTlCZSw0QkFBSSxPQThCbkIsQ0FBQTtJQUVELFNBQVMscUJBQXFCLENBQWEsS0FBOEM7UUFDeEYsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0IsT0FBTyxrQkFBa0IsQ0FBQyxNQUFNLENBQUM7UUFDbEMsQ0FBQzthQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sa0JBQWtCLENBQUMsS0FBSyxDQUFDO1FBQ2pDLENBQUM7YUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sa0JBQWtCLENBQUMsY0FBYyxDQUFDO1FBQzFDLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxrQkFBa0IsQ0FBQyxPQUFPLENBQUM7UUFDbkMsQ0FBQztJQUNGLENBQUM7SUFFRCxTQUFTLHFCQUFxQixDQUFhLEtBQW1ELEVBQUUsT0FBc0I7UUFDckgsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0IsSUFBSSxZQUFZLEdBQVcsS0FBSyxDQUFDO1lBQ2pDLElBQUksWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUN4RCxZQUFZLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekMsTUFBTSxNQUFNLEdBQUcsc0JBQXNCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUN4RCxJQUFJLE1BQU0sRUFBRSxDQUFDO29CQUNaLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUM3QyxDQUFDO2dCQUNELElBQUksbUJBQW1CLEdBQW1ELE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDckgsSUFBSSxtQkFBbUIsRUFBRSxDQUFDO29CQUN6QixtQkFBbUIsR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDLG1CQUFtQixDQUFDLENBQUM7b0JBQzdELGtCQUFrQjtvQkFDbEIsT0FBTyxtQkFBbUIsQ0FBQyxJQUFJLENBQUM7b0JBQ2hDLE9BQU8sRUFBRSxLQUFLLEVBQUUsbUJBQW1CLEVBQUUsQ0FBQztnQkFDdkMsQ0FBQztZQUNGLENBQUM7WUFDRCxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyw4Q0FBOEMsRUFBRSxnREFBZ0QsRUFBRSxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDNUksQ0FBQzthQUFNLENBQUM7WUFDUCxNQUFNLElBQUksR0FBd0MsS0FBSyxDQUFDO1lBQ3hELE9BQU8sRUFBRSxLQUFLLEVBQUUsSUFBSSxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDakYsQ0FBQztJQUNGLENBQUM7QUFDRixDQUFDLEVBcEdnQix1QkFBdUIsS0FBdkIsdUJBQXVCLFFBb0d2QztBQUVELE1BQU0sS0FBVyxTQUFTLENBMEJ6QjtBQTFCRCxXQUFpQixTQUFTO0lBQ3pCLFNBQWdCLElBQUksQ0FBYSxRQUF5QztRQUN6RSxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM1QixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO2FBQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDckUsT0FBTyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQzVDLENBQUM7YUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQy9FLE1BQU0sS0FBSyxHQUFXLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDcEMsTUFBTSxTQUFTLEdBQXFCLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7WUFFdkcsT0FBTyxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUM7UUFDbEMsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ2xCLENBQUM7SUFaZSxjQUFJLE9BWW5CLENBQUE7SUFFRCxTQUFnQixFQUFFLENBQUMsS0FBK0I7UUFDakQsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0IsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO2FBQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUM3QixPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUM7UUFDbEIsQ0FBQztRQUNELE9BQU87WUFDTixJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDZixTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVM7U0FDMUIsQ0FBQztJQUNILENBQUM7SUFWZSxZQUFFLEtBVWpCLENBQUE7QUFDRixDQUFDLEVBMUJnQixTQUFTLEtBQVQsU0FBUyxRQTBCekI7QUFFRCxJQUFVLGNBQWMsQ0FxQnZCO0FBckJELFdBQVUsY0FBYztJQUN2QixTQUFTLGFBQWEsQ0FBQyxPQUFzQixFQUFFLE1BQXdCO1FBQ3RFLFFBQVEsTUFBTSxFQUFFLENBQUM7WUFDaEIsS0FBSyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFPLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQztZQUM5RCxLQUFLLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUM7WUFDcEUsT0FBTyxDQUFDLENBQUMsT0FBTyxPQUFPLENBQUMsU0FBUyxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUM7UUFDdEksQ0FBQztJQUNGLENBQUM7SUFFRCxTQUFnQixJQUFJLENBQWEsUUFBa0MsRUFBRSxPQUFzQixFQUFFLE1BQXdCO1FBQ3BILElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzlCLE9BQU8sRUFBRSxHQUFHLEVBQUUsYUFBYSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7UUFDaEUsQ0FBQzthQUFNLElBQUksZUFBZSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3pDLE9BQU87Z0JBQ04sR0FBRyxFQUFFLGFBQWEsQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO2dCQUNuQyxJQUFJLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFpQyxFQUFFLE9BQU8sQ0FBQyxlQUFlLENBQUM7YUFDM0csQ0FBQztRQUNILENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztJQUNGLENBQUM7SUFYZSxtQkFBSSxPQVduQixDQUFBO0FBQ0YsQ0FBQyxFQXJCUyxjQUFjLEtBQWQsY0FBYyxRQXFCdkI7QUFFRCxJQUFVLFlBQVksQ0FVckI7QUFWRCxXQUFVLFlBQVk7SUFDckIsU0FBZ0IsSUFBSSxDQUFDLEtBQXlCO1FBQzdDLFFBQVEsS0FBSyxFQUFFLENBQUM7WUFDZjtnQkFDQyxvREFBbUM7WUFDcEMsa0RBQWlDO1lBQ2pDO2dCQUNDLG9EQUFtQztRQUNyQyxDQUFDO0lBQ0YsQ0FBQztJQVJlLGlCQUFJLE9BUW5CLENBQUE7QUFDRixDQUFDLEVBVlMsWUFBWSxLQUFaLFlBQVksUUFVckI7QUFFRCxJQUFVLHVCQUF1QixDQW1GaEM7QUFuRkQsV0FBVSx1QkFBdUI7SUFFaEMsTUFBTSxVQUFVLEdBQXFEO1FBQ3BFLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRTtRQUNwQixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUU7UUFDMUIsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFO1FBQ3JCLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRTtRQUM1QixFQUFFLFFBQVEsRUFBRSxlQUFlLEVBQUU7UUFDN0IsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFO1FBQ3pCLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsb0JBQW9CLENBQUMsbUJBQW1CLEVBQUU7UUFDNUUsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUU7UUFDL0IsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFO1FBQ3ZCLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRTtRQUNwQixFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUU7S0FDcEIsQ0FBQztJQUVGLFNBQWdCLElBQUksQ0FBYSxRQUEyRCxFQUFFLE9BQXNCLEVBQ25ILHFCQUE4QixFQUFFLE1BQXdCLEVBQUUsVUFBMkI7UUFDckYsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsT0FBTyxFQUFFLENBQUM7UUFDWCxDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQTRELEVBQUUsQ0FBQztRQUUzRSxJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2hCLEtBQUssTUFBTSxZQUFZLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUNwRCxJQUFJLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDMUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7Z0JBQ2xFLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUN2QyxNQUFNLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUM7UUFDakMsQ0FBQztRQUNELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksT0FBTyxDQUFDLGFBQWEsMkNBQW1DLEVBQUUsQ0FBQztZQUNoRyxNQUFNLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7UUFDOUIsQ0FBQztRQUNELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUN6QyxNQUFNLENBQUMsVUFBVSxHQUFHLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFDekMsQ0FBQztRQUNELE1BQU0sQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztRQUM1QixNQUFNLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7UUFDNUIsSUFBSSxRQUFRLENBQUMsWUFBWSxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUM7UUFDL0MsQ0FBQztRQUNELElBQUksUUFBUSxDQUFDLGFBQWEsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUMxQyxNQUFNLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDO1FBQ2pELENBQUM7UUFDRCxNQUFNLENBQUMsS0FBSyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzlDLElBQUksUUFBUSxDQUFDLFNBQVMsS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUN0QyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3ZDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxZQUFxQyxFQUFFLElBQUksRUFBMkIsRUFBRTtvQkFDckgsTUFBTSxVQUFVLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUM5RCxJQUFJLFVBQVUsRUFBRSxDQUFDO3dCQUNoQixZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO29CQUMvQixDQUFDO29CQUNELE9BQU8sWUFBWSxDQUFDO2dCQUNyQixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDUixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsTUFBTSxjQUFjLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDaEYsTUFBTSxDQUFDLFNBQVMsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUNsRSxDQUFDO1FBQ0YsQ0FBQztRQUNELE1BQU0sQ0FBQyxZQUFZLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDL0QsSUFBSSxxQkFBcUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEtBQUssU0FBUyxJQUFLLFFBQXFDLENBQUMsUUFBUSxLQUFLLFNBQVMsQ0FBQyxFQUFFLENBQUM7WUFDckksTUFBTSxDQUFDLFlBQVksR0FBRyxvQkFBb0IsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3hGLENBQUM7UUFDRCxJQUFJLHFCQUFxQixJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQy9ELE1BQU0sQ0FBQyxPQUFPLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ2pFLENBQUM7UUFDRCxNQUFNLG9CQUFvQixHQUFHLHVCQUF1QixDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6RixJQUFJLG9CQUFvQixDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM5QyxNQUFNLENBQUMsZUFBZSxHQUFHLG9CQUFvQixDQUFDLEtBQUssQ0FBQztRQUNyRCxDQUFDO1FBQ0QsSUFBSSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDckIsTUFBTSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQ2pDLENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ3RGLENBQUM7SUE5RGUsNEJBQUksT0E4RG5CLENBQUE7SUFFRCxTQUFnQixPQUFPLENBQWEsS0FBcUM7UUFDeEUsT0FBTyxRQUFRLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFGZSwrQkFBTyxVQUV0QixDQUFBO0FBQ0YsQ0FBQyxFQW5GUyx1QkFBdUIsS0FBdkIsdUJBQXVCLFFBbUZoQztBQUNELE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQztBQUUxQixJQUFVLGVBQWUsQ0FvSHhCO0FBcEhELFdBQVUsZUFBZTtJQUV4QixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUM7SUFDdkIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDO0lBQ3JCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQztJQUNyQixNQUFNLEdBQUcsR0FBRyxhQUFhLENBQUM7SUFDMUIsTUFBTSxVQUFVLEdBQUcsb0JBQW9CLENBQUM7SUFNeEMsU0FBZ0IsSUFBSSxDQUFhLFFBQTBCLEVBQUUsT0FBc0IsRUFBRSxLQUFhLEVBQUUsTUFBd0IsRUFBRSxRQUEyQztRQUN4SyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDZixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztRQUMzQixNQUFNLFNBQVMsR0FBSSxRQUE0QixDQUFDLFNBQVMsQ0FBQztRQUMxRCxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDekIsT0FBTyxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxnQ0FBZ0MsRUFBRSxpR0FBaUcsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BOLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUNyRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdEIsTUFBTSxPQUFPLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxzQ0FBc0MsRUFBRSxvSUFBb0ksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNqTixPQUFPLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN2QyxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsSUFBSSxVQUE2QyxDQUFDO1FBQ2xELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQy9CLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDcEMsVUFBVSxHQUFHLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUN6RSxDQUFDO2lCQUFNLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDMUMsVUFBVSxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUN2RSxDQUFDO2lCQUFNLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDMUMsVUFBVSxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUN2RSxDQUFDO2lCQUFNLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDekMsVUFBVSxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDM0UsQ0FBQztpQkFBTSxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ2hELFVBQVUsR0FBRyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FB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