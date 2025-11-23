/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import * as Objects from '../../../../base/common/objects.js';
import commonSchema from './jsonSchemaCommon.js';
import { ProblemMatcherRegistry } from './problemMatcher.js';
import { TaskDefinitionRegistry } from './taskDefinitionRegistry.js';
import * as ConfigurationResolverUtils from '../../../services/configurationResolver/common/configurationResolverUtils.js';
import { inputsSchema } from '../../../services/configurationResolver/common/configurationResolverSchema.js';
import { getAllCodicons } from '../../../../base/common/codicons.js';
function fixReferences(literal) {
    if (Array.isArray(literal)) {
        literal.forEach(fixReferences);
    }
    else if (typeof literal === 'object') {
        if (literal['$ref']) {
            literal['$ref'] = literal['$ref'] + '2';
        }
        Object.getOwnPropertyNames(literal).forEach(property => {
            const value = literal[property];
            if (Array.isArray(value) || typeof value === 'object') {
                fixReferences(value);
            }
        });
    }
}
const shellCommand = {
    anyOf: [
        {
            type: 'boolean',
            default: true,
            description: nls.localize('JsonSchema.shell', 'Specifies whether the command is a shell command or an external program. Defaults to false if omitted.')
        },
        {
            $ref: '#/definitions/shellConfiguration'
        }
    ],
    deprecationMessage: nls.localize('JsonSchema.tasks.isShellCommand.deprecated', 'The property isShellCommand is deprecated. Use the type property of the task and the shell property in the options instead. See also the 1.14 release notes.')
};
const hide = {
    type: 'boolean',
    description: nls.localize('JsonSchema.hide', 'Hide this task from the run task quick pick'),
    default: true
};
const taskIdentifier = {
    type: 'object',
    additionalProperties: true,
    properties: {
        type: {
            type: 'string',
            description: nls.localize('JsonSchema.tasks.dependsOn.identifier', 'The task identifier.')
        }
    }
};
const dependsOn = {
    anyOf: [
        {
            type: 'string',
            description: nls.localize('JsonSchema.tasks.dependsOn.string', 'Another task this task depends on.')
        },
        taskIdentifier,
        {
            type: 'array',
            description: nls.localize('JsonSchema.tasks.dependsOn.array', 'The other tasks this task depends on.'),
            items: {
                anyOf: [
                    {
                        type: 'string',
                    },
                    taskIdentifier
                ]
            }
        }
    ],
    description: nls.localize('JsonSchema.tasks.dependsOn', 'Either a string representing another task or an array of other tasks that this task depends on.')
};
const dependsOrder = {
    type: 'string',
    enum: ['parallel', 'sequence'],
    enumDescriptions: [
        nls.localize('JsonSchema.tasks.dependsOrder.parallel', 'Run all dependsOn tasks in parallel.'),
        nls.localize('JsonSchema.tasks.dependsOrder.sequence', 'Run all dependsOn tasks in sequence.'),
    ],
    default: 'parallel',
    description: nls.localize('JsonSchema.tasks.dependsOrder', 'Determines the order of the dependsOn tasks for this task. Note that this property is not recursive.')
};
const detail = {
    type: 'string',
    description: nls.localize('JsonSchema.tasks.detail', 'An optional description of a task that shows in the Run Task quick pick as a detail.')
};
const icon = {
    type: 'object',
    description: nls.localize('JsonSchema.tasks.icon', 'An optional icon for the task'),
    properties: {
        id: {
            description: nls.localize('JsonSchema.tasks.icon.id', 'An optional codicon ID to use'),
            type: ['string', 'null'],
            enum: Array.from(getAllCodicons(), icon => icon.id),
            markdownEnumDescriptions: Array.from(getAllCodicons(), icon => `$(${icon.id})`),
        },
        color: {
            description: nls.localize('JsonSchema.tasks.icon.color', 'An optional color of the icon'),
            type: ['string', 'null'],
            enum: [
                'terminal.ansiBlack',
                'terminal.ansiRed',
                'terminal.ansiGreen',
                'terminal.ansiYellow',
                'terminal.ansiBlue',
                'terminal.ansiMagenta',
                'terminal.ansiCyan',
                'terminal.ansiWhite'
            ],
        },
    }
};
const presentation = {
    type: 'object',
    default: {
        echo: true,
        reveal: 'always',
        focus: false,
        panel: 'shared',
        showReuseMessage: true,
        clear: false,
    },
    description: nls.localize('JsonSchema.tasks.presentation', 'Configures the panel that is used to present the task\'s output and reads its input.'),
    additionalProperties: false,
    properties: {
        echo: {
            type: 'boolean',
            default: true,
            description: nls.localize('JsonSchema.tasks.presentation.echo', 'Controls whether the executed command is echoed to the panel. Default is true.')
        },
        focus: {
            type: 'boolean',
            default: false,
            description: nls.localize('JsonSchema.tasks.presentation.focus', 'Controls whether the panel takes focus. Default is false. If set to true the panel is revealed as well.')
        },
        revealProblems: {
            type: 'string',
            enum: ['always', 'onProblem', 'never'],
            enumDescriptions: [
                nls.localize('JsonSchema.tasks.presentation.revealProblems.always', 'Always reveals the problems panel when this task is executed.'),
                nls.localize('JsonSchema.tasks.presentation.revealProblems.onProblem', 'Only reveals the problems panel if a problem is found.'),
                nls.localize('JsonSchema.tasks.presentation.revealProblems.never', 'Never reveals the problems panel when this task is executed.'),
            ],
            default: 'never',
            description: nls.localize('JsonSchema.tasks.presentation.revealProblems', 'Controls whether the problems panel is revealed when running this task or not. Takes precedence over option \"reveal\". Default is \"never\".')
        },
        reveal: {
            type: 'string',
            enum: ['always', 'silent', 'never'],
            enumDescriptions: [
                nls.localize('JsonSchema.tasks.presentation.reveal.always', 'Always reveals the terminal when this task is executed.'),
                nls.localize('JsonSchema.tasks.presentation.reveal.silent', 'Only reveals the terminal if the task exits with an error or the problem matcher finds an error.'),
                nls.localize('JsonSchema.tasks.presentation.reveal.never', 'Never reveals the terminal when this task is executed.'),
            ],
            default: 'always',
            description: nls.localize('JsonSchema.tasks.presentation.reveal', 'Controls whether the terminal running the task is revealed or not. May be overridden by option \"revealProblems\". Default is \"always\".')
        },
        panel: {
            type: 'string',
            enum: ['shared', 'dedicated', 'new'],
            default: 'shared',
            description: nls.localize('JsonSchema.tasks.presentation.instance', 'Controls if the panel is shared between tasks, dedicated to this task or a new one is created on every run.')
        },
        showReuseMessage: {
            type: 'boolean',
            default: true,
            description: nls.localize('JsonSchema.tasks.presentation.showReuseMessage', 'Controls whether to show the `Terminal will be reused by tasks, press any key to close it` message.')
        },
        clear: {
            type: 'boolean',
            default: false,
            description: nls.localize('JsonSchema.tasks.presentation.clear', 'Controls whether the terminal is cleared before executing the task.')
        },
        group: {
            type: 'string',
            description: nls.localize('JsonSchema.tasks.presentation.group', 'Controls whether the task is executed in a specific terminal group using split panes.')
        },
        close: {
            type: 'boolean',
            description: nls.localize('JsonSchema.tasks.presentation.close', 'Controls whether the terminal the task runs in is closed when the task exits.')
        },
        preserveTerminalName: {
            type: 'boolean',
            default: false,
            description: nls.localize('JsonSchema.tasks.presentation.preserveTerminalName', 'Controls whether to preserve the task name in the terminal after task completion.')
        }
    }
};
const terminal = Objects.deepClone(presentation);
terminal.deprecationMessage = nls.localize('JsonSchema.tasks.terminal', 'The terminal property is deprecated. Use presentation instead');
const groupStrings = {
    type: 'string',
    enum: [
        'build',
        'test',
        'none'
    ],
    enumDescriptions: [
        nls.localize('JsonSchema.tasks.group.build', 'Marks the task as a build task accessible through the \'Run Build Task\' command.'),
        nls.localize('JsonSchema.tasks.group.test', 'Marks the task as a test task accessible through the \'Run Test Task\' command.'),
        nls.localize('JsonSchema.tasks.group.none', 'Assigns the task to no group')
    ],
    description: nls.localize('JsonSchema.tasks.group.kind', 'The task\'s execution group.')
};
const group = {
    oneOf: [
        groupStrings,
        {
            type: 'object',
            properties: {
                kind: groupStrings,
                isDefault: {
                    type: ['boolean', 'string'],
                    default: false,
                    description: nls.localize('JsonSchema.tasks.group.isDefault', 'Defines if this task is the default task in the group, or a glob to match the file which should trigger this task.')
                }
            }
        },
    ],
    defaultSnippets: [
        {
            body: { kind: 'build', isDefault: true },
            description: nls.localize('JsonSchema.tasks.group.defaultBuild', 'Marks the task as the default build task.')
        },
        {
            body: { kind: 'test', isDefault: true },
            description: nls.localize('JsonSchema.tasks.group.defaultTest', 'Marks the task as the default test task.')
        }
    ],
    description: nls.localize('JsonSchema.tasks.group', 'Defines to which execution group this task belongs to. It supports "build" to add it to the build group and "test" to add it to the test group.')
};
const taskType = {
    type: 'string',
    enum: ['shell'],
    default: 'process',
    description: nls.localize('JsonSchema.tasks.type', 'Defines whether the task is run as a process or as a command inside a shell.')
};
const command = {
    oneOf: [
        {
            oneOf: [
                {
                    type: 'string'
                },
                {
                    type: 'array',
                    items: {
                        type: 'string'
                    },
                    description: nls.localize('JsonSchema.commandArray', 'The shell command to be executed. Array items will be joined using a space character')
                }
            ]
        },
        {
            type: 'object',
            required: ['value', 'quoting'],
            properties: {
                value: {
                    oneOf: [
                        {
                            type: 'string'
                        },
                        {
                            type: 'array',
                            items: {
                                type: 'string'
                            },
                            description: nls.localize('JsonSchema.commandArray', 'The shell command to be executed. Array items will be joined using a space character')
                        }
                    ],
                    description: nls.localize('JsonSchema.command.quotedString.value', 'The actual command value')
                },
                quoting: {
                    type: 'string',
                    enum: ['escape', 'strong', 'weak'],
                    enumDescriptions: [
                        nls.localize('JsonSchema.tasks.quoting.escape', 'Escapes characters using the shell\'s escape character (e.g. ` under PowerShell and \\ under bash).'),
                        nls.localize('JsonSchema.tasks.quoting.strong', 'Quotes the argument using the shell\'s strong quote character (e.g. \' under PowerShell and bash).'),
                        nls.localize('JsonSchema.tasks.quoting.weak', 'Quotes the argument using the shell\'s weak quote character (e.g. " under PowerShell and bash).'),
                    ],
                    default: 'strong',
                    description: nls.localize('JsonSchema.command.quotesString.quote', 'How the command value should be quoted.')
                }
            }
        }
    ],
    description: nls.localize('JsonSchema.command', 'The command to be executed. Can be an external program or a shell command.')
};
const args = {
    type: 'array',
    items: {
        oneOf: [
            {
                type: 'string',
            },
            {
                type: 'object',
                required: ['value', 'quoting'],
                properties: {
                    value: {
                        type: 'string',
                        description: nls.localize('JsonSchema.args.quotedString.value', 'The actual argument value')
                    },
                    quoting: {
                        type: 'string',
                        enum: ['escape', 'strong', 'weak'],
                        enumDescriptions: [
                            nls.localize('JsonSchema.tasks.quoting.escape', 'Escapes characters using the shell\'s escape character (e.g. ` under PowerShell and \\ under bash).'),
                            nls.localize('JsonSchema.tasks.quoting.strong', 'Quotes the argument using the shell\'s strong quote character (e.g. \' under PowerShell and bash).'),
                            nls.localize('JsonSchema.tasks.quoting.weak', 'Quotes the argument using the shell\'s weak quote character (e.g. " under PowerShell and bash).'),
                        ],
                        default: 'strong',
                        description: nls.localize('JsonSchema.args.quotesString.quote', 'How the argument value should be quoted.')
                    }
                }
            }
        ]
    },
    description: nls.localize('JsonSchema.tasks.args', 'Arguments passed to the command when this task is invoked.')
};
const label = {
    type: 'string',
    description: nls.localize('JsonSchema.tasks.label', "The task's user interface label")
};
const version = {
    type: 'string',
    enum: ['2.0.0'],
    description: nls.localize('JsonSchema.version', 'The config\'s version number.')
};
const identifier = {
    type: 'string',
    description: nls.localize('JsonSchema.tasks.identifier', 'A user defined identifier to reference the task in launch.json or a dependsOn clause.'),
    deprecationMessage: nls.localize('JsonSchema.tasks.identifier.deprecated', 'User defined identifiers are deprecated. For custom task use the name as a reference and for tasks provided by extensions use their defined task identifier.')
};
const runOptions = {
    type: 'object',
    additionalProperties: false,
    properties: {
        reevaluateOnRerun: {
            type: 'boolean',
            description: nls.localize('JsonSchema.tasks.reevaluateOnRerun', 'Whether to reevaluate task variables on rerun.'),
            default: true
        },
        runOn: {
            type: 'string',
            enum: ['default', 'folderOpen'],
            description: nls.localize('JsonSchema.tasks.runOn', 'Configures when the task should be run. If set to folderOpen, then the task will be run automatically when the folder is opened.'),
            default: 'default'
        },
        instanceLimit: {
            type: 'number',
            description: nls.localize('JsonSchema.tasks.instanceLimit', 'The number of instances of the task that are allowed to run simultaneously.'),
            default: 1
        },
        instancePolicy: {
            type: 'string',
            enum: ['terminateNewest', 'terminateOldest', 'prompt', 'warn', 'silent'],
            enumDescriptions: [
                nls.localize('JsonSchema.tasks.instancePolicy.terminateNewest', 'Terminates the newest instance.'),
                nls.localize('JsonSchema.tasks.instancePolicy.terminateOldest', 'Terminates the oldest instance.'),
                nls.localize('JsonSchema.tasks.instancePolicy.prompt', 'Asks which instance to terminate.'),
                nls.localize('JsonSchema.tasks.instancePolicy.warn', 'Does nothing but warns that the instance limit has been reached.'),
                nls.localize('JsonSchema.tasks.instancePolicy.silent', 'Does nothing.'),
            ],
            description: nls.localize('JsonSchema.tasks.instancePolicy', 'Policy to apply when instance limit is reached.'),
            default: 'prompt'
        }
    },
    description: nls.localize('JsonSchema.tasks.runOptions', 'The task\'s run related options')
};
const commonSchemaDefinitions = commonSchema.definitions;
const options = Objects.deepClone(commonSchemaDefinitions.options);
const optionsProperties = options.properties;
optionsProperties.shell = Objects.deepClone(commonSchemaDefinitions.shellConfiguration);
const taskConfiguration = {
    type: 'object',
    additionalProperties: false,
    properties: {
        label: {
            type: 'string',
            description: nls.localize('JsonSchema.tasks.taskLabel', "The task's label")
        },
        taskName: {
            type: 'string',
            description: nls.localize('JsonSchema.tasks.taskName', 'The task\'s name'),
            deprecationMessage: nls.localize('JsonSchema.tasks.taskName.deprecated', 'The task\'s name property is deprecated. Use the label property instead.')
        },
        identifier: Objects.deepClone(identifier),
        group: Objects.deepClone(group),
        isBackground: {
            type: 'boolean',
            description: nls.localize('JsonSchema.tasks.background', 'Whether the executed task is kept alive and is running in the background.'),
            default: true
        },
        promptOnClose: {
            type: 'boolean',
            description: nls.localize('JsonSchema.tasks.promptOnClose', 'Whether the user is prompted when VS Code closes with a running task.'),
            default: false
        },
        presentation: Objects.deepClone(presentation),
        icon: Objects.deepClone(icon),
        hide: Objects.deepClone(hide),
        options: options,
        problemMatcher: {
            $ref: '#/definitions/problemMatcherType',
            description: nls.localize('JsonSchema.tasks.matchers', 'The problem matcher(s) to use. Can either be a string or a problem matcher definition or an array of strings and problem matchers.')
        },
        runOptions: Objects.deepClone(runOptions),
        dependsOn: Objects.deepClone(dependsOn),
        dependsOrder: Objects.deepClone(dependsOrder),
        detail: Objects.deepClone(detail),
    }
};
const taskDefinitions = [];
TaskDefinitionRegistry.onReady().then(() => {
    updateTaskDefinitions();
});
export function updateTaskDefinitions() {
    for (const taskType of TaskDefinitionRegistry.all()) {
        // Check that we haven't already added this task type
        if (taskDefinitions.find(schema => {
            return schema.properties?.type?.enum?.find ? schema.properties?.type.enum.find(element => element === taskType.taskType) : undefined;
        })) {
            continue;
        }
        const schema = Objects.deepClone(taskConfiguration);
        const schemaProperties = schema.properties;
        // Since we do this after the schema is assigned we need to patch the refs.
        schemaProperties.type = {
            type: 'string',
            description: nls.localize('JsonSchema.customizations.customizes.type', 'The task type to customize'),
            enum: [taskType.taskType]
        };
        if (taskType.required) {
            schema.required = taskType.required.slice();
        }
        else {
            schema.required = [];
        }
        // Customized tasks require that the task type be set.
        schema.required.push('type');
        if (taskType.properties) {
            for (const key of Object.keys(taskType.properties)) {
                const property = taskType.properties[key];
                schemaProperties[key] = Objects.deepClone(property);
            }
        }
        fixReferences(schema);
        taskDefinitions.push(schema);
    }
}
const customize = Objects.deepClone(taskConfiguration);
customize.properties.customize = {
    type: 'string',
    deprecationMessage: nls.localize('JsonSchema.tasks.customize.deprecated', 'The customize property is deprecated. See the 1.14 release notes on how to migrate to the new task customization approach')
};
if (!customize.required) {
    customize.required = [];
}
customize.required.push('customize');
taskDefinitions.push(customize);
const definitions = Objects.deepClone(commonSchemaDefinitions);
const taskDescription = definitions.taskDescription;
taskDescription.required = ['label'];
const taskDescriptionProperties = taskDescription.properties;
taskDescriptionProperties.label = Objects.deepClone(label);
taskDescriptionProperties.command = Objects.deepClone(command);
taskDescriptionProperties.args = Objects.deepClone(args);
taskDescriptionProperties.isShellCommand = Objects.deepClone(shellCommand);
taskDescriptionProperties.dependsOn = dependsOn;
taskDescriptionProperties.hide = Objects.deepClone(hide);
taskDescriptionProperties.dependsOrder = dependsOrder;
taskDescriptionProperties.identifier = Objects.deepClone(identifier);
taskDescriptionProperties.type = Objects.deepClone(taskType);
taskDescriptionProperties.presentation = Objects.deepClone(presentation);
taskDescriptionProperties.terminal = terminal;
taskDescriptionProperties.icon = Objects.deepClone(icon);
taskDescriptionProperties.group = Objects.deepClone(group);
taskDescriptionProperties.runOptions = Objects.deepClone(runOptions);
taskDescriptionProperties.detail = detail;
taskDescriptionProperties.taskName.deprecationMessage = nls.localize('JsonSchema.tasks.taskName.deprecated', 'The task\'s name property is deprecated. Use the label property instead.');
// Clone the taskDescription for process task before setting a default to prevent two defaults #115281
const processTask = Objects.deepClone(taskDescription);
taskDescription.default = {
    label: 'My Task',
    type: 'shell',
    command: 'echo Hello',
    problemMatcher: []
};
definitions.showOutputType.deprecationMessage = nls.localize('JsonSchema.tasks.showOutput.deprecated', 'The property showOutput is deprecated. Use the reveal property inside the presentation property instead. See also the 1.14 release notes.');
taskDescriptionProperties.echoCommand.deprecationMessage = nls.localize('JsonSchema.tasks.echoCommand.deprecated', 'The property echoCommand is deprecated. Use the echo property inside the presentation property instead. See also the 1.14 release notes.');
taskDescriptionProperties.suppressTaskName.deprecationMessage = nls.localize('JsonSchema.tasks.suppressTaskName.deprecated', 'The property suppressTaskName is deprecated. Inline the command with its arguments into the task instead. See also the 1.14 release notes.');
taskDescriptionProperties.isBuildCommand.deprecationMessage = nls.localize('JsonSchema.tasks.isBuildCommand.deprecated', 'The property isBuildCommand is deprecated. Use the group property instead. See also the 1.14 release notes.');
taskDescriptionProperties.isTestCommand.deprecationMessage = nls.localize('JsonSchema.tasks.isTestCommand.deprecated', 'The property isTestCommand is deprecated. Use the group property instead. See also the 1.14 release notes.');
// Process tasks are almost identical schema-wise to shell tasks, but they are required to have a command
processTask.properties.type = {
    type: 'string',
    enum: ['process'],
    default: 'process',
    description: nls.localize('JsonSchema.tasks.type', 'Defines whether the task is run as a process or as a command inside a shell.')
};
processTask.required.push('command');
processTask.required.push('type');
taskDefinitions.push(processTask);
taskDefinitions.push({
    $ref: '#/definitions/taskDescription'
});
const definitionsTaskRunnerConfigurationProperties = definitions.taskRunnerConfiguration.properties;
const tasks = definitionsTaskRunnerConfigurationProperties.tasks;
tasks.items = {
    oneOf: taskDefinitions
};
definitionsTaskRunnerConfigurationProperties.inputs = inputsSchema.definitions.inputs;
definitions.commandConfiguration.properties.isShellCommand = Objects.deepClone(shellCommand);
definitions.commandConfiguration.properties.args = Objects.deepClone(args);
definitions.options.properties.shell = {
    $ref: '#/definitions/shellConfiguration'
};
definitionsTaskRunnerConfigurationProperties.isShellCommand = Objects.deepClone(shellCommand);
definitionsTaskRunnerConfigurationProperties.type = Objects.deepClone(taskType);
definitionsTaskRunnerConfigurationProperties.group = Objects.deepClone(group);
definitionsTaskRunnerConfigurationProperties.presentation = Objects.deepClone(presentation);
definitionsTaskRunnerConfigurationProperties.suppressTaskName.deprecationMessage = nls.localize('JsonSchema.tasks.suppressTaskName.deprecated', 'The property suppressTaskName is deprecated. Inline the command with its arguments into the task instead. See also the 1.14 release notes.');
definitionsTaskRunnerConfigurationProperties.taskSelector.deprecationMessage = nls.localize('JsonSchema.tasks.taskSelector.deprecated', 'The property taskSelector is deprecated. Inline the command with its arguments into the task instead. See also the 1.14 release notes.');
const osSpecificTaskRunnerConfiguration = Objects.deepClone(definitions.taskRunnerConfiguration);
delete osSpecificTaskRunnerConfiguration.properties.tasks;
osSpecificTaskRunnerConfiguration.additionalProperties = false;
definitions.osSpecificTaskRunnerConfiguration = osSpecificTaskRunnerConfiguration;
definitionsTaskRunnerConfigurationProperties.version = Objects.deepClone(version);
const schema = {
    oneOf: [
        {
            'allOf': [
                {
                    type: 'object',
                    required: ['version'],
                    properties: {
                        version: Objects.deepClone(version),
                        windows: {
                            '$ref': '#/definitions/osSpecificTaskRunnerConfiguration',
                            'description': nls.localize('JsonSchema.windows', 'Windows specific command configuration')
                        },
                        osx: {
                            '$ref': '#/definitions/osSpecificTaskRunnerConfiguration',
                            'description': nls.localize('JsonSchema.mac', 'Mac specific command configuration')
                        },
                        linux: {
                            '$ref': '#/definitions/osSpecificTaskRunnerConfiguration',
                            'description': nls.localize('JsonSchema.linux', 'Linux specific command configuration')
                        }
                    }
                },
                {
                    $ref: '#/definitions/taskRunnerConfiguration'
                }
            ]
        }
    ]
};
schema.definitions = definitions;
function deprecatedVariableMessage(schemaMap, property) {
    const mapAtProperty = schemaMap[property].properties;
    if (mapAtProperty) {
        Object.keys(mapAtProperty).forEach(name => {
            deprecatedVariableMessage(mapAtProperty, name);
        });
    }
    else {
        ConfigurationResolverUtils.applyDeprecatedVariableMessage(schemaMap[property]);
    }
}
Object.getOwnPropertyNames(definitions).forEach(key => {
    const newKey = key + '2';
    definitions[newKey] = definitions[key];
    delete definitions[key];
    deprecatedVariableMessage(definitions, newKey);
});
fixReferences(schema);
export function updateProblemMatchers() {
    try {
        const matcherIds = ProblemMatcherRegistry.keys().map(key => '$' + key);
        definitions.problemMatcherType2.oneOf[0].enum = matcherIds;
        definitions.problemMatcherType2.oneOf[2].items.anyOf[0].enum = matcherIds;
    }
    catch (err) {
        console.log('Installing problem matcher ids failed');
    }
}
ProblemMatcherRegistry.onReady().then(() => {
    updateProblemMatchers();
});
export default schema;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvblNjaGVtYV92Mi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vanNvblNjaGVtYV92Mi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBQzFDLE9BQU8sS0FBSyxPQUFPLE1BQU0sb0NBQW9DLENBQUM7QUFHOUQsT0FBTyxZQUFZLE1BQU0sdUJBQXVCLENBQUM7QUFFakQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDN0QsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDckUsT0FBTyxLQUFLLDBCQUEwQixNQUFNLDhFQUE4RSxDQUFDO0FBQzNILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUM3RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFckUsU0FBUyxhQUFhLENBQUMsT0FBWTtJQUNsQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUM1QixPQUFPLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7U0FBTSxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3hDLElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7WUFDckIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDekMsQ0FBQztRQUNELE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDdEQsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLFFB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