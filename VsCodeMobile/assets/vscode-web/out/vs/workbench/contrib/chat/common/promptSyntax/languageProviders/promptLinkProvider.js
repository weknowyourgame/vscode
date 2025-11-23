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
import { IPromptsService } from '../service/promptsService.js';
/**
 * Provides link references for prompt files.
 */
let PromptLinkProvider = class PromptLinkProvider {
    constructor(promptsService) {
        this.promptsService = promptsService;
    }
    /**
     * Provide list of links for the provided text model.
     */
    async provideLinks(model, token) {
        const promptAST = this.promptsService.getParsedPromptFile(model);
        if (!promptAST.body) {
            return;
        }
        const links = [];
        for (const ref of promptAST.body.fileReferences) {
            if (!ref.isMarkdownLink) {
                const url = promptAST.body.resolveFilePath(ref.content);
                if (url) {
                    links.push({ range: ref.range, url });
                }
            }
        }
        return { links };
    }
};
PromptLinkProvider = __decorate([
    __param(0, IPromptsService)
], PromptLinkProvider);
export { PromptLinkProvider };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0TGlua1Byb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9sYW5ndWFnZVByb3ZpZGVycy9wcm9tcHRMaW5rUHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBSy9EOztHQUVHO0FBQ0ksSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBa0I7SUFDOUIsWUFDbUMsY0FBK0I7UUFBL0IsbUJBQWMsR0FBZCxjQUFjLENBQWlCO0lBRWxFLENBQUM7SUFFRDs7T0FFRztJQUNJLEtBQUssQ0FBQyxZQUFZLENBQUMsS0FBaUIsRUFBRSxLQUF3QjtRQUNwRSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDckIsT0FBTztRQUNSLENBQUM7UUFDRCxNQUFNLEtBQUssR0FBWSxFQUFFLENBQUM7UUFDMUIsS0FBSyxNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ3pCLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDeEQsSUFBSSxHQUFHLEVBQUUsQ0FBQztvQkFDVCxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztnQkFDdkMsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBQ0QsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO0lBQ2xCLENBQUM7Q0FDRCxDQUFBO0FBekJZLGtCQUFrQjtJQUU1QixXQUFBLGVBQWUsQ0FBQTtHQUZMLGtCQUFrQixDQXlCOUIifQ==