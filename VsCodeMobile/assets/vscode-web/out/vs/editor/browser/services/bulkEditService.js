/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';
import { URI } from '../../../base/common/uri.js';
import { isObject } from '../../../base/common/types.js';
export const IBulkEditService = createDecorator('IWorkspaceEditService');
export class ResourceEdit {
    constructor(metadata) {
        this.metadata = metadata;
    }
    static convert(edit) {
        return edit.edits.map(edit => {
            if (ResourceTextEdit.is(edit)) {
                return ResourceTextEdit.lift(edit);
            }
            if (ResourceFileEdit.is(edit)) {
                return ResourceFileEdit.lift(edit);
            }
            throw new Error('Unsupported edit');
        });
    }
}
export class ResourceTextEdit extends ResourceEdit {
    static is(candidate) {
        if (candidate instanceof ResourceTextEdit) {
            return true;
        }
        return isObject(candidate)
            && URI.isUri(candidate.resource)
            && isObject(candidate.textEdit);
    }
    static lift(edit) {
        if (edit instanceof ResourceTextEdit) {
            return edit;
        }
        else {
            return new ResourceTextEdit(edit.resource, edit.textEdit, edit.versionId, edit.metadata);
        }
    }
    constructor(resource, textEdit, versionId = undefined, metadata) {
        super(metadata);
        this.resource = resource;
        this.textEdit = textEdit;
        this.versionId = versionId;
    }
}
export class ResourceFileEdit extends ResourceEdit {
    static is(candidate) {
        if (candidate instanceof ResourceFileEdit) {
            return true;
        }
        else {
            return isObject(candidate)
                && (Boolean(candidate.newResource) || Boolean(candidate.oldResource));
        }
    }
    static lift(edit) {
        if (edit instanceof ResourceFileEdit) {
            return edit;
        }
        else {
            return new ResourceFileEdit(edit.oldResource, edit.newResource, edit.options, edit.metadata);
        }
    }
    constructor(oldResource, newResource, options = {}, metadata) {
        super(metadata);
        this.oldResource = oldResource;
        this.newResource = newResource;
        this.options = options;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVsa0VkaXRTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2J1bGtFZGl0U2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seURBQXlELENBQUM7QUFHMUYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSwrQkFBK0IsQ0FBQztBQUt6RCxNQUFNLENBQUMsTUFBTSxnQkFBZ0IsR0FBRyxlQUFlLENBQW1CLHVCQUF1QixDQUFDLENBQUM7QUFFM0YsTUFBTSxPQUFPLFlBQVk7SUFFeEIsWUFBK0IsUUFBZ0M7UUFBaEMsYUFBUSxHQUFSLFFBQVEsQ0FBd0I7SUFBSSxDQUFDO0lBRXBFLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBbUI7UUFFakMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM1QixJQUFJLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUMvQixPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNwQyxDQUFDO1lBRUQsSUFBSSxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDL0IsT0FBTyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEMsQ0FBQztZQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUNyQyxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7Q0FDRDtBQUVELE1BQU0sT0FBTyxnQkFBaUIsU0FBUSxZQUFZO0lBRWpELE1BQU0sQ0FBQyxFQUFFLENBQUMsU0FBa0I7UUFDM0IsSUFBSSxTQUFTLFlBQVksZ0JBQWdCLEVBQUUsQ0FBQztZQUMzQyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFDRCxPQUFPLFFBQVEsQ0FBQyxTQUFTLENBQUM7ZUFDdEIsR0FBRyxDQUFDLEtBQUssQ0FBc0IsU0FBVSxDQUFDLFFBQVEsQ0FBQztlQUNuRCxRQUFRLENBQXNCLFNBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUF3QjtRQUNuQyxJQUFJLElBQUksWUFBWSxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLElBQUksZ0JBQWdCLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzFGLENBQUM7SUFDRixDQUFDO0lBRUQsWUFDVSxRQUFhLEVBQ2IsUUFBNEUsRUFDNUUsWUFBZ0MsU0FBUyxFQUNsRCxRQUFnQztRQUVoQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFMUCxhQUFRLEdBQVIsUUFBUSxDQUFLO1FBQ2IsYUFBUSxHQUFSLFFBQVEsQ0FBb0U7UUFDNUUsY0FBUyxHQUFULFNBQVMsQ0FBZ0M7SUFJbkQsQ0FBQztDQUNEO0FBRUQsTUFBTSxPQUFPLGdCQUFpQixTQUFRLFlBQVk7SUFFakQsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFrQjtRQUMzQixJQUFJLFNBQVMsWUFBWSxnQkFBZ0IsRUFBRSxDQUFDO1lBQzNDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQzthQUFNLENBQUM7WUFDUCxPQUFPLFFBQVEsQ0FBQyxTQUFTLENBQUM7bUJBQ3RCLENBQUMsT0FBTyxDQUFzQixTQUFVLENBQUMsV0FBVyxDQUFDLElBQUksT0FBTyxDQUFzQixTQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUNwSCxDQUFDO0lBQ0YsQ0FBQztJQUVELE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBd0I7UUFDbkMsSUFBSSxJQUFJLFlBQVksZ0JBQWdCLEVBQUUsQ0FBQztZQUN0QyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxJQUFJLGdCQUFnQixDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM5RixDQUFDO0lBQ0YsQ0FBQztJQUVELFlBQ1UsV0FBNEIsRUFDNUIsV0FBNEIsRUFDNUIsVUFBb0MsRUFBRSxFQUMvQyxRQUFnQztRQUVoQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7UUFMUCxnQkFBVyxHQUFYLFdBQVcsQ0FBaUI7UUFDNUIsZ0JBQVcsR0FBWCxXQUFXLENBQWlCO1FBQzVCLFlBQU8sR0FBUCxPQUFPLENBQStCO0lBSWhELENBQUM7Q0FDRCJ9