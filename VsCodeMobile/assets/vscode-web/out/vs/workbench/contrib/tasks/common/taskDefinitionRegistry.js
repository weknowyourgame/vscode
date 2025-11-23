/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../nls.js';
import * as Types from '../../../../base/common/types.js';
import * as Objects from '../../../../base/common/objects.js';
import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { Emitter } from '../../../../base/common/event.js';
const taskDefinitionSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        type: {
            type: 'string',
            description: nls.localize('TaskDefinition.description', 'The actual task type. Please note that types starting with a \'$\' are reserved for internal usage.')
        },
        required: {
            type: 'array',
            items: {
                type: 'string'
            }
        },
        properties: {
            type: 'object',
            description: nls.localize('TaskDefinition.properties', 'Additional properties of the task type'),
            additionalProperties: {
                $ref: 'http://json-schema.org/draft-07/schema#'
            }
        },
        when: {
            type: 'string',
            markdownDescription: nls.localize('TaskDefinition.when', 'Condition which must be true to enable this type of task. Consider using `shellExecutionSupported`, `processExecutionSupported`, and `customExecutionSupported` as appropriate for this task definition. See the [API documentation](https://code.visualstudio.com/api/extension-guides/task-provider#when-clause) for more information.'),
            default: ''
        }
    }
};
var Configuration;
(function (Configuration) {
    function from(value, extensionId, messageCollector) {
        if (!value) {
            return undefined;
        }
        const taskType = Types.isString(value.type) ? value.type : undefined;
        if (!taskType || taskType.length === 0) {
            messageCollector.error(nls.localize('TaskTypeConfiguration.noType', 'The task type configuration is missing the required \'taskType\' property'));
            return undefined;
        }
        const required = [];
        if (Array.isArray(value.required)) {
            for (const element of value.required) {
                if (Types.isString(element)) {
                    required.push(element);
                }
            }
        }
        return {
            extensionId: extensionId.value,
            taskType, required: required,
            properties: value.properties ? Objects.deepClone(value.properties) : {},
            when: value.when ? ContextKeyExpr.deserialize(value.when) : undefined
        };
    }
    Configuration.from = from;
})(Configuration || (Configuration = {}));
const taskDefinitionsExtPoint = ExtensionsRegistry.registerExtensionPoint({
    extensionPoint: 'taskDefinitions',
    activationEventsGenerator: function* (contributions) {
        for (const task of contributions) {
            if (task.type) {
                yield `onTaskType:${task.type}`;
            }
        }
    },
    jsonSchema: {
        description: nls.localize('TaskDefinitionExtPoint', 'Contributes task kinds'),
        type: 'array',
        items: taskDefinitionSchema
    }
});
class TaskDefinitionRegistryImpl {
    constructor() {
        this._onDefinitionsChanged = new Emitter();
        this.onDefinitionsChanged = this._onDefinitionsChanged.event;
        this.taskTypes = Object.create(null);
        this.readyPromise = new Promise((resolve, reject) => {
            taskDefinitionsExtPoint.setHandler((extensions, delta) => {
                this._schema = undefined;
                try {
                    for (const extension of delta.removed) {
                        const taskTypes = extension.value;
                        for (const taskType of taskTypes) {
                            if (this.taskTypes && taskType.type && this.taskTypes[taskType.type]) {
                                delete this.taskTypes[taskType.type];
                            }
                        }
                    }
                    for (const extension of delta.added) {
                        const taskTypes = extension.value;
                        for (const taskType of taskTypes) {
                            const type = Configuration.from(taskType, extension.description.identifier, extension.collector);
                            if (type) {
                                this.taskTypes[type.taskType] = type;
                            }
                        }
                    }
                    if ((delta.removed.length > 0) || (delta.added.length > 0)) {
                        this._onDefinitionsChanged.fire();
                    }
                }
                catch (error) {
                }
                resolve(undefined);
            });
        });
    }
    onReady() {
        return this.readyPromise;
    }
    get(key) {
        return this.taskTypes[key];
    }
    all() {
        return Object.keys(this.taskTypes).map(key => this.taskTypes[key]);
    }
    getJsonSchema() {
        if (this._schema === undefined) {
            const schemas = [];
            for (const definition of this.all()) {
                const schema = {
                    type: 'object',
                    additionalProperties: false
                };
                if (definition.required.length > 0) {
                    schema.required = definition.required.slice(0);
                }
                if (definition.properties !== undefined) {
                    schema.properties = Objects.deepClone(definition.properties);
                }
                else {
                    schema.properties = Object.create(null);
                }
                schema.properties.type = {
                    type: 'string',
                    enum: [definition.taskType]
                };
                schemas.push(schema);
            }
            this._schema = { oneOf: schemas };
        }
        return this._schema;
    }
}
export const TaskDefinitionRegistry = new TaskDefinitionRegistryImpl();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFza0RlZmluaXRpb25SZWdpc3RyeS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vdGFza0RlZmluaXRpb25SZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLG9CQUFvQixDQUFDO0FBRzFDLE9BQU8sS0FBSyxLQUFLLE1BQU0sa0NBQWtDLENBQUM7QUFDMUQsT0FBTyxLQUFLLE9BQU8sTUFBTSxvQ0FBb0MsQ0FBQztBQUU5RCxPQUFPLEVBQUUsa0JBQWtCLEVBQTZCLE1BQU0sMkRBQTJELENBQUM7QUFJMUgsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSxrQ0FBa0MsQ0FBQztBQUdsRSxNQUFNLG9CQUFvQixHQUFnQjtJQUN6QyxJQUFJLEVBQUUsUUFBUTtJQUNkLG9CQUFvQixFQUFFLEtBQUs7SUFDM0IsVUFBVSxFQUFFO1FBQ1gsSUFBSSxFQUFFO1lBQ0wsSUFBSSxFQUFFLFFBQVE7WUFDZCxXQUFXLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyw0QkFBNEIsRUFBRSxxR0FBcUcsQ0FBQztTQUM5SjtRQUNELFFBQVEsRUFBRTtZQUNULElBQUksRUFBRSxPQUFPO1lBQ2IsS0FBSyxFQUFFO2dCQUNOLElBQUksRUFBRSxRQUFRO2FBQ2Q7U0FDRDtRQUNELFVBQVUsRUFBRTtZQUNYLElBQUksRUFBRSxRQUFRO1lBQ2QsV0FBVyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsd0NBQXdDLENBQUM7WUFDaEcsb0JBQW9CLEVBQUU7Z0JBQ3JCLElBQUksRUFBRSx5Q0FBeUM7YUFDL0M7U0FDRDtRQUNELElBQUksRUFBRTtZQUNMLElBQUksRUFBRSxRQUFRO1lBQ2QsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSwwVUFBMFUsQ0FBQztZQUNwWSxPQUFPLEVBQUUsRUFBRTtTQUNYO0tBQ0Q7Q0FDRCxDQUFDO0FBRUYsSUFBVSxhQUFhLENBZ0N0QjtBQWhDRCxXQUFVLGFBQWE7SUFRdEIsU0FBZ0IsSUFBSSxDQUFDLEtBQXNCLEVBQUUsV0FBZ0MsRUFBRSxnQkFBMkM7UUFDekgsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDckUsSUFBSSxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3hDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLDhCQUE4QixFQUFFLDJFQUEyRSxDQUFDLENBQUMsQ0FBQztZQUNsSixPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO1FBQzlCLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUNuQyxLQUFLLE1BQU0sT0FBTyxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQzdCLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3hCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUNELE9BQU87WUFDTixXQUFXLEVBQUUsV0FBVyxDQUFDLEtBQUs7WUFDOUIsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRO1lBQzVCLFVBQVUsRUFBRSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUN2RSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDckUsQ0FBQztJQUNILENBQUM7SUF2QmUsa0JBQUksT0F1Qm5CLENBQUE7QUFDRixDQUFDLEVBaENTLGFBQWEsS0FBYixhQUFhLFFBZ0N0QjtBQUdELE1BQU0sdUJBQXVCLEdBQUcsa0JBQWtCLENBQUMsc0JBQXNCLENBQWtDO0lBQzFHLGNBQWMsRUFBRSxpQkFBaUI7SUFDakMseUJBQXlCLEVBQUUsUUFBUSxDQUFDLEVBQUUsYUFBdUQ7UUFDNUYsS0FBSyxNQUFNLElBQUksSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNsQyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDZixNQUFNLGNBQWMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2pDLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQztJQUNELFVBQVUsRUFBRTtRQUNYLFdBQVcsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLHdCQUF3QixDQUFDO1FBQzdFLElBQUksRUFBRSxPQUFPO1FBQ2IsS0FBSyxFQUFFLG9CQUFvQjtLQUMzQjtDQUNELENBQUMsQ0FBQztBQVdILE1BQU0sMEJBQTBCO0lBUS9CO1FBSFEsMEJBQXFCLEdBQWtCLElBQUksT0FBTyxFQUFFLENBQUM7UUFDdEQseUJBQW9CLEdBQWdCLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUM7UUFHM0UsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDekQsdUJBQXVCLENBQUMsVUFBVSxDQUFDLENBQUMsVUFBVSxFQUFFLEtBQUssRUFBRSxFQUFFO2dCQUN4RCxJQUFJLENBQUMsT0FBTyxHQUFHLFNBQVMsQ0FBQztnQkFDekIsSUFBSSxDQUFDO29CQUNKLEtBQUssTUFBTSxTQUFTLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUN2QyxNQUFNLFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDO3dCQUNsQyxLQUFLLE1BQU0sUUFBUSxJQUFJLFNBQVMsRUFBRSxDQUFDOzRCQUNsQyxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksUUFBUSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dDQUN0RSxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDOzRCQUN0QyxDQUFDO3dCQUNGLENBQUM7b0JBQ0YsQ0FBQztvQkFDRCxLQUFLLE1BQU0sU0FBUyxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQzt3QkFDckMsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQzt3QkFDbEMsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUUsQ0FBQzs0QkFDbEMsTUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUUsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDOzRCQUNqRyxJQUFJLElBQUksRUFBRSxDQUFDO2dDQUNWLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQzs0QkFDdEMsQ0FBQzt3QkFDRixDQUFDO29CQUNGLENBQUM7b0JBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQzt3QkFDNUQsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxDQUFDO29CQUNuQyxDQUFDO2dCQUNGLENBQUM7Z0JBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDakIsQ0FBQztnQkFDRCxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDcEIsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTSxPQUFPO1FBQ2IsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQzFCLENBQUM7SUFFTSxHQUFHLENBQUMsR0FBVztRQUNyQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVNLEdBQUc7UUFDVCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRU0sYUFBYTtRQUNuQixJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDaEMsTUFBTSxPQUFPLEdBQWtCLEVBQUUsQ0FBQztZQUNsQyxLQUFLLE1BQU0sVUFBVSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDO2dCQUNyQyxNQUFNLE1BQU0sR0FBZ0I7b0JBQzNCLElBQUksRUFBRSxRQUFRO29CQUNkLG9CQUFvQixFQUFFLEtBQUs7aUJBQzNCLENBQUM7Z0JBQ0YsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDcEMsTUFBTSxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDaEQsQ0FBQztnQkFDRCxJQUFJLFVBQVUsQ0FBQyxVQUFVLEtBQUssU0FBUyxFQUFFLENBQUM7b0JBQ3pDLE1BQU0sQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQzlELENBQUM7cUJBQU0sQ0FBQztvQkFDUCxNQUFNLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3pDLENBQUM7Z0JBQ0QsTUFBTSxDQUFDLFVBQVcsQ0FBQyxJQUFJLEdBQUc7b0JBQ3pCLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUM7aUJBQzNCLENBQUM7Z0JBQ0YsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN0QixDQUFDO1lBQ0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQztRQUNuQyxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3JCLENBQUM7Q0FDRDtBQUVELE1BQU0sQ0FBQyxNQUFNLHNCQUFzQixHQUE0QixJQUFJLDBCQUEwQixFQUFFLENBQUMifQ==