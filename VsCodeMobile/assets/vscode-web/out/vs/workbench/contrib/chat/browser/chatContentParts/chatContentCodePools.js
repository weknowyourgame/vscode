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
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { CodeBlockPart, CodeCompareBlockPart } from '../codeBlockPart.js';
import { ResourcePool } from './chatCollections.js';
let EditorPool = class EditorPool extends Disposable {
    inUse() {
        return this._pool.inUse;
    }
    constructor(options, delegate, overflowWidgetsDomNode, isSimpleWidget = false, instantiationService) {
        super();
        this.isSimpleWidget = isSimpleWidget;
        this._pool = this._register(new ResourcePool(() => {
            return instantiationService.createInstance(CodeBlockPart, options, MenuId.ChatCodeBlock, delegate, overflowWidgetsDomNode, this.isSimpleWidget);
        }));
    }
    get() {
        const codeBlock = this._pool.get();
        let stale = false;
        return {
            object: codeBlock,
            isStale: () => stale,
            dispose: () => {
                codeBlock.reset();
                stale = true;
                this._pool.release(codeBlock);
            }
        };
    }
};
EditorPool = __decorate([
    __param(4, IInstantiationService)
], EditorPool);
export { EditorPool };
let DiffEditorPool = class DiffEditorPool extends Disposable {
    inUse() {
        return this._pool.inUse;
    }
    constructor(options, delegate, overflowWidgetsDomNode, isSimpleWidget = false, instantiationService) {
        super();
        this.isSimpleWidget = isSimpleWidget;
        this._pool = this._register(new ResourcePool(() => {
            return instantiationService.createInstance(CodeCompareBlockPart, options, MenuId.ChatCompareBlock, delegate, overflowWidgetsDomNode, this.isSimpleWidget);
        }));
    }
    get() {
        const codeBlock = this._pool.get();
        let stale = false;
        return {
            object: codeBlock,
            isStale: () => stale,
            dispose: () => {
                codeBlock.reset();
                stale = true;
                this._pool.release(codeBlock);
            }
        };
    }
};
DiffEditorPool = __decorate([
    __param(4, IInstantiationService)
], DiffEditorPool);
export { DiffEditorPool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdENvbnRlbnRDb2RlUG9vbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRDb250ZW50UGFydHMvY2hhdENvbnRlbnRDb2RlUG9vbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUMzRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUd0RyxPQUFPLEVBQUUsYUFBYSxFQUFFLG9CQUFvQixFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDMUUsT0FBTyxFQUFFLFlBQVksRUFBd0IsTUFBTSxzQkFBc0IsQ0FBQztBQUVuRSxJQUFNLFVBQVUsR0FBaEIsTUFBTSxVQUFXLFNBQVEsVUFBVTtJQUl6QyxLQUFLO1FBQ0osT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQztJQUN6QixDQUFDO0lBRUQsWUFDQyxPQUEwQixFQUMxQixRQUErQixFQUMvQixzQkFBK0MsRUFDOUIsaUJBQTBCLEtBQUssRUFDekIsb0JBQTJDO1FBRWxFLEtBQUssRUFBRSxDQUFDO1FBSFMsbUJBQWMsR0FBZCxjQUFjLENBQWlCO1FBSWhELElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFlBQVksQ0FBQyxHQUFHLEVBQUU7WUFDakQsT0FBTyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsYUFBYSxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxzQkFBc0IsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDakosQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxHQUFHO1FBQ0YsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuQyxJQUFJLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbEIsT0FBTztZQUNOLE1BQU0sRUFBRSxTQUFTO1lBQ2pCLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxLQUFLO1lBQ3BCLE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ2IsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNsQixLQUFLLEdBQUcsSUFBSSxDQUFDO2dCQUNiLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQy9CLENBQUM7U0FDRCxDQUFDO0lBQ0gsQ0FBQztDQUNELENBQUE7QUFsQ1ksVUFBVTtJQWFwQixXQUFBLHFCQUFxQixDQUFBO0dBYlgsVUFBVSxDQWtDdEI7O0FBRU0sSUFBTSxjQUFjLEdBQXBCLE1BQU0sY0FBZSxTQUFRLFVBQVU7SUFJdEMsS0FBSztRQUNYLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7SUFDekIsQ0FBQztJQUVELFlBQ0MsT0FBMEIsRUFDMUIsUUFBK0IsRUFDL0Isc0JBQStDLEVBQzlCLGlCQUEwQixLQUFLLEVBQ3pCLG9CQUEyQztRQUVsRSxLQUFLLEVBQUUsQ0FBQztRQUhTLG1CQUFjLEdBQWQsY0FBYyxDQUFpQjtRQUloRCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxZQUFZLENBQUMsR0FBRyxFQUFFO1lBQ2pELE9BQU8sb0JBQW9CLENBQUMsY0FBYyxDQUFDLG9CQUFvQixFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLHNCQUFzQixFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUMzSixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELEdBQUc7UUFDRixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ25DLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNsQixPQUFPO1lBQ04sTUFBTSxFQUFFLFNBQVM7WUFDakIsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUs7WUFDcEIsT0FBTyxFQUFFLEdBQUcsRUFBRTtnQkFDYixTQUFTLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ2xCLEtBQUssR0FBRyxJQUFJLENBQUM7Z0JBQ2IsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDL0IsQ0FBQztTQUNELENBQUM7SUFDSCxDQUFDO0NBQ0QsQ0FBQTtBQWxDWSxjQUFjO0lBYXhCLFdBQUEscUJBQXFCLENBQUE7R0FiWCxjQUFjLENBa0MxQiJ9