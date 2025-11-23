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
import { IInstantiationService } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ChatCollapsibleListContentPart } from '../chatReferencesContentPart.js';
import { BaseChatToolInvocationSubPart } from './chatToolInvocationSubPart.js';
let ChatResultListSubPart = class ChatResultListSubPart extends BaseChatToolInvocationSubPart {
    constructor(toolInvocation, context, message, toolDetails, listPool, instantiationService) {
        super(toolInvocation);
        this.codeblocks = [];
        const collapsibleListPart = this._register(instantiationService.createInstance(ChatCollapsibleListContentPart, toolDetails.map(detail => ({
            kind: 'reference',
            reference: detail,
        })), message, context, listPool));
        this._register(collapsibleListPart.onDidChangeHeight(() => this._onDidChangeHeight.fire()));
        this.domNode = collapsibleListPart.domNode;
    }
};
ChatResultListSubPart = __decorate([
    __param(5, IInstantiationService)
], ChatResultListSubPart);
export { ChatResultListSubPart };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFJlc3VsdExpc3RTdWJQYXJ0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvYnJvd3Nlci9jaGF0Q29udGVudFBhcnRzL3Rvb2xJbnZvY2F0aW9uUGFydHMvY2hhdFJlc3VsdExpc3RTdWJQYXJ0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBS2hHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGtFQUFrRSxDQUFDO0FBSXpHLE9BQU8sRUFBRSw4QkFBOEIsRUFBaUQsTUFBTSxpQ0FBaUMsQ0FBQztBQUNoSSxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUV4RSxJQUFNLHFCQUFxQixHQUEzQixNQUFNLHFCQUFzQixTQUFRLDZCQUE2QjtJQUl2RSxZQUNDLGNBQW1FLEVBQ25FLE9BQXNDLEVBQ3RDLE9BQWlDLEVBQ2pDLFdBQWtDLEVBQ2xDLFFBQTZCLEVBQ04sb0JBQTJDO1FBRWxFLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztRQVZQLGVBQVUsR0FBeUIsRUFBRSxDQUFDO1FBWXJELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQzdFLDhCQUE4QixFQUM5QixXQUFXLENBQUMsR0FBRyxDQUEyQixNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDcEQsSUFBSSxFQUFFLFdBQVc7WUFDakIsU0FBUyxFQUFFLE1BQU07U0FDakIsQ0FBQyxDQUFDLEVBQ0gsT0FBTyxFQUNQLE9BQU8sRUFDUCxRQUFRLENBQ1IsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVGLElBQUksQ0FBQyxPQUFPLEdBQUcsbUJBQW1CLENBQUMsT0FBTyxDQUFDO0lBQzVDLENBQUM7Q0FDRCxDQUFBO0FBM0JZLHFCQUFxQjtJQVUvQixXQUFBLHFCQUFxQixDQUFBO0dBVlgscUJBQXFCLENBMkJqQyJ9