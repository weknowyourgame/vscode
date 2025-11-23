/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Documentation link for the reusable prompts feature.
 */
export const PROMPT_DOCUMENTATION_URL = 'https://aka.ms/vscode-ghcp-prompt-snippets';
export const INSTRUCTIONS_DOCUMENTATION_URL = 'https://aka.ms/vscode-ghcp-custom-instructions';
export const AGENT_DOCUMENTATION_URL = 'https://aka.ms/vscode-ghcp-custom-chat-modes'; // todo
/**
 * Language ID for the reusable prompt syntax.
 */
export const PROMPT_LANGUAGE_ID = 'prompt';
/**
 * Language ID for instructions syntax.
 */
export const INSTRUCTIONS_LANGUAGE_ID = 'instructions';
/**
 * Language ID for agent syntax.
 */
export const AGENT_LANGUAGE_ID = 'chatagent';
/**
 * Prompt and instructions files language selector.
 */
export const ALL_PROMPTS_LANGUAGE_SELECTOR = [PROMPT_LANGUAGE_ID, INSTRUCTIONS_LANGUAGE_ID, AGENT_LANGUAGE_ID];
/**
 * The language id for for a prompts type.
 */
export function getLanguageIdForPromptsType(type) {
    switch (type) {
        case PromptsType.prompt:
            return PROMPT_LANGUAGE_ID;
        case PromptsType.instructions:
            return INSTRUCTIONS_LANGUAGE_ID;
        case PromptsType.agent:
            return AGENT_LANGUAGE_ID;
        default:
            throw new Error(`Unknown prompt type: ${type}`);
    }
}
export function getPromptsTypeForLanguageId(languageId) {
    switch (languageId) {
        case PROMPT_LANGUAGE_ID:
            return PromptsType.prompt;
        case INSTRUCTIONS_LANGUAGE_ID:
            return PromptsType.instructions;
        case AGENT_LANGUAGE_ID:
            return PromptsType.agent;
        default:
            return undefined;
    }
}
/**
 * What the prompt is used for.
 */
export var PromptsType;
(function (PromptsType) {
    PromptsType["instructions"] = "instructions";
    PromptsType["prompt"] = "prompt";
    PromptsType["agent"] = "agent";
})(PromptsType || (PromptsType = {}));
export function isValidPromptType(type) {
    return Object.values(PromptsType).includes(type);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VHlwZXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC9jb21tb24vcHJvbXB0U3ludGF4L3Byb21wdFR5cGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsNENBQTRDLENBQUM7QUFDckYsTUFBTSxDQUFDLE1BQU0sOEJBQThCLEdBQUcsZ0RBQWdELENBQUM7QUFDL0YsTUFBTSxDQUFDLE1BQU0sdUJBQXVCLEdBQUcsOENBQThDLENBQUMsQ0FBQyxPQUFPO0FBRTlGOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sa0JBQWtCLEdBQUcsUUFBUSxDQUFDO0FBRTNDOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sd0JBQXdCLEdBQUcsY0FBYyxDQUFDO0FBRXZEOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0saUJBQWlCLEdBQUcsV0FBVyxDQUFDO0FBRTdDOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sNkJBQTZCLEdBQXFCLENBQUMsa0JBQWtCLEVBQUUsd0JBQXdCLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztBQUVqSTs7R0FFRztBQUNILE1BQU0sVUFBVSwyQkFBMkIsQ0FBQyxJQUFpQjtJQUM1RCxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2QsS0FBSyxXQUFXLENBQUMsTUFBTTtZQUN0QixPQUFPLGtCQUFrQixDQUFDO1FBQzNCLEtBQUssV0FBVyxDQUFDLFlBQVk7WUFDNUIsT0FBTyx3QkFBd0IsQ0FBQztRQUNqQyxLQUFLLFdBQVcsQ0FBQyxLQUFLO1lBQ3JCLE9BQU8saUJBQWlCLENBQUM7UUFDMUI7WUFDQyxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2xELENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSxVQUFVLDJCQUEyQixDQUFDLFVBQWtCO0lBQzdELFFBQVEsVUFBVSxFQUFFLENBQUM7UUFDcEIsS0FBSyxrQkFBa0I7WUFDdEIsT0FBTyxXQUFXLENBQUMsTUFBTSxDQUFDO1FBQzNCLEtBQUssd0JBQXdCO1lBQzVCLE9BQU8sV0FBVyxDQUFDLFlBQVksQ0FBQztRQUNqQyxLQUFLLGlCQUFpQjtZQUNyQixPQUFPLFdBQVcsQ0FBQyxLQUFLLENBQUM7UUFDMUI7WUFDQyxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0FBQ0YsQ0FBQztBQUdEOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQVksV0FJWDtBQUpELFdBQVksV0FBVztJQUN0Qiw0Q0FBNkIsQ0FBQTtJQUM3QixnQ0FBaUIsQ0FBQTtJQUNqQiw4QkFBZSxDQUFBO0FBQ2hCLENBQUMsRUFKVyxXQUFXLEtBQVgsV0FBVyxRQUl0QjtBQUNELE1BQU0sVUFBVSxpQkFBaUIsQ0FBQyxJQUFZO0lBQzdDLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBbUIsQ0FBQyxDQUFDO0FBQ2pFLENBQUMifQ==