/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createSingleCallFunction } from '../../../../base/common/functional.js';
export class CustomEditorModelManager {
    constructor() {
        this._references = new Map();
    }
    async getAllModels(resource) {
        const keyStart = `${resource.toString()}@@@`;
        const models = [];
        for (const [key, entry] of this._references) {
            if (key.startsWith(keyStart) && entry.model) {
                models.push(await entry.model);
            }
        }
        return models;
    }
    async get(resource, viewType) {
        const key = this.key(resource, viewType);
        const entry = this._references.get(key);
        return entry?.model;
    }
    tryRetain(resource, viewType) {
        const key = this.key(resource, viewType);
        const entry = this._references.get(key);
        if (!entry) {
            return undefined;
        }
        entry.counter++;
        return entry.model.then(model => {
            return {
                object: model,
                dispose: createSingleCallFunction(() => {
                    if (--entry.counter <= 0) {
                        entry.model.then(x => x.dispose());
                        this._references.delete(key);
                    }
                }),
            };
        });
    }
    add(resource, viewType, model) {
        const key = this.key(resource, viewType);
        const existing = this._references.get(key);
        if (existing) {
            throw new Error('Model already exists');
        }
        this._references.set(key, { viewType, model, counter: 0 });
        return this.tryRetain(resource, viewType);
    }
    disposeAllModelsForView(viewType) {
        for (const [key, value] of this._references) {
            if (value.viewType === viewType) {
                value.model.then(x => x.dispose());
                this._references.delete(key);
            }
        }
    }
    key(resource, viewType) {
        return `${resource.toString()}@@@${viewType}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3VzdG9tRWRpdG9yTW9kZWxNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2N1c3RvbUVkaXRvci9jb21tb24vY3VzdG9tRWRpdG9yTW9kZWxNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBS2pGLE1BQU0sT0FBTyx3QkFBd0I7SUFBckM7UUFFa0IsZ0JBQVcsR0FBRyxJQUFJLEdBQUcsRUFJbEMsQ0FBQztJQWdFTixDQUFDO0lBOURPLEtBQUssQ0FBQyxZQUFZLENBQUMsUUFBYTtRQUN0QyxNQUFNLFFBQVEsR0FBRyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDO1FBQzdDLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNsQixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzdDLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQzdDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEMsQ0FBQztRQUNGLENBQUM7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFDTSxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQWEsRUFBRSxRQUFnQjtRQUMvQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN6QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN4QyxPQUFPLEtBQUssRUFBRSxLQUFLLENBQUM7SUFDckIsQ0FBQztJQUVNLFNBQVMsQ0FBQyxRQUFhLEVBQUUsUUFBZ0I7UUFDL0MsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFekMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1osT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUVoQixPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQy9CLE9BQU87Z0JBQ04sTUFBTSxFQUFFLEtBQUs7Z0JBQ2IsT0FBTyxFQUFFLHdCQUF3QixDQUFDLEdBQUcsRUFBRTtvQkFDdEMsSUFBSSxFQUFFLEtBQUssQ0FBQyxPQUFPLElBQUksQ0FBQyxFQUFFLENBQUM7d0JBQzFCLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7d0JBQ25DLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUM5QixDQUFDO2dCQUNGLENBQUMsQ0FBQzthQUNGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFTSxHQUFHLENBQUMsUUFBYSxFQUFFLFFBQWdCLEVBQUUsS0FBa0M7UUFDN0UsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDekMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDM0MsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUN6QyxDQUFDO1FBRUQsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMzRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBRSxDQUFDO0lBQzVDLENBQUM7SUFFTSx1QkFBdUIsQ0FBQyxRQUFnQjtRQUM5QyxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQzdDLElBQUksS0FBSyxDQUFDLFFBQVEsS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDakMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDOUIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO0lBRU8sR0FBRyxDQUFDLFFBQWEsRUFBRSxRQUFnQjtRQUMxQyxPQUFPLEdBQUcsUUFBUSxDQUFDLFFBQVEsRUFBRSxNQUFNLFFBQVEsRUFBRSxDQUFDO0lBQy9DLENBQUM7Q0FDRCJ9