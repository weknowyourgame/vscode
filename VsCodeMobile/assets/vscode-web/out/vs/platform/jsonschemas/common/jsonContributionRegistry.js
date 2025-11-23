/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../base/common/event.js';
import { getCompressedContent } from '../../../base/common/jsonSchema.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';
import * as platform from '../../registry/common/platform.js';
export const Extensions = {
    JSONContribution: 'base.contributions.json'
};
function normalizeId(id) {
    if (id.length > 0 && id.charAt(id.length - 1) === '#') {
        return id.substring(0, id.length - 1);
    }
    return id;
}
class JSONContributionRegistry extends Disposable {
    constructor() {
        super(...arguments);
        this.schemasById = {};
        this.schemaAssociations = {};
        this._onDidChangeSchema = this._register(new Emitter());
        this.onDidChangeSchema = this._onDidChangeSchema.event;
        this._onDidChangeSchemaAssociations = this._register(new Emitter());
        this.onDidChangeSchemaAssociations = this._onDidChangeSchemaAssociations.event;
    }
    registerSchema(uri, unresolvedSchemaContent, store) {
        const normalizedUri = normalizeId(uri);
        this.schemasById[normalizedUri] = unresolvedSchemaContent;
        this._onDidChangeSchema.fire(uri);
        if (store) {
            store.add(toDisposable(() => {
                delete this.schemasById[normalizedUri];
                this._onDidChangeSchema.fire(uri);
            }));
        }
    }
    registerSchemaAssociation(uri, glob) {
        const normalizedUri = normalizeId(uri);
        if (!this.schemaAssociations[normalizedUri]) {
            this.schemaAssociations[normalizedUri] = [];
        }
        if (!this.schemaAssociations[normalizedUri].includes(glob)) {
            this.schemaAssociations[normalizedUri].push(glob);
            this._onDidChangeSchemaAssociations.fire();
        }
        return toDisposable(() => {
            const associations = this.schemaAssociations[normalizedUri];
            if (associations) {
                const index = associations.indexOf(glob);
                if (index !== -1) {
                    associations.splice(index, 1);
                    if (associations.length === 0) {
                        delete this.schemaAssociations[normalizedUri];
                    }
                    this._onDidChangeSchemaAssociations.fire();
                }
            }
        });
    }
    notifySchemaChanged(uri) {
        this._onDidChangeSchema.fire(uri);
    }
    getSchemaContributions() {
        return {
            schemas: this.schemasById,
        };
    }
    getSchemaContent(uri) {
        const schema = this.schemasById[uri];
        return schema ? getCompressedContent(schema) : undefined;
    }
    hasSchemaContent(uri) {
        return !!this.schemasById[uri];
    }
    getSchemaAssociations() {
        return this.schemaAssociations;
    }
}
const jsonContributionRegistry = new JSONContributionRegistry();
platform.Registry.add(Extensions.JSONContribution, jsonContributionRegistry);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2pzb25zY2hlbWFzL2NvbW1vbi9qc29uQ29udHJpYnV0aW9uUmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLCtCQUErQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxvQkFBb0IsRUFBZSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxVQUFVLEVBQWdDLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNHLE9BQU8sS0FBSyxRQUFRLE1BQU0sbUNBQW1DLENBQUM7QUFFOUQsTUFBTSxDQUFDLE1BQU0sVUFBVSxHQUFHO0lBQ3pCLGdCQUFnQixFQUFFLHlCQUF5QjtDQUMzQyxDQUFDO0FBOENGLFNBQVMsV0FBVyxDQUFDLEVBQVU7SUFDOUIsSUFBSSxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDdkQsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFDRCxPQUFPLEVBQUUsQ0FBQztBQUNYLENBQUM7QUFJRCxNQUFNLHdCQUF5QixTQUFRLFVBQVU7SUFBakQ7O1FBRWtCLGdCQUFXLEdBQWtDLEVBQUUsQ0FBQztRQUNoRCx1QkFBa0IsR0FBZ0MsRUFBRSxDQUFDO1FBRXJELHVCQUFrQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVUsQ0FBQyxDQUFDO1FBQ25FLHNCQUFpQixHQUFrQixJQUFJLENBQUMsa0JBQWtCLENB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