/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PromptsType } from '../promptTypes.js';
import { getPromptFileDefaultLocation } from './promptFileLocations.js';
/**
 * Configuration helper for the `reusable prompts` feature.
 * @see {@link PromptsConfig.PROMPT_LOCATIONS_KEY}, {@link PromptsConfig.INSTRUCTIONS_LOCATION_KEY}, {@link PromptsConfig.MODE_LOCATION_KEY}, or {@link PromptsConfig.PROMPT_FILES_SUGGEST_KEY}.
 *
 * ### Functions
 *
 * - {@link getLocationsValue} allows to current read configuration value
 * - {@link promptSourceFolders} gets list of source folders for prompt files
 * - {@link getPromptFilesRecommendationsValue} gets prompt file recommendation configuration
 *
 * ### File Paths Resolution
 *
 * We resolve only `*.prompt.md` files inside the resulting source folders. Relative paths are resolved
 * relative to:
 *
 * - the current workspace `root`, if applicable, in other words one of the workspace folders
 *   can be used as a prompt files source folder
 * - root of each top-level folder in the workspace (if there are multiple workspace folders)
 * - current root folder (if a single folder is open)
 *
 * ### Prompt File Suggestions
 *
 * The `chat.promptFilesRecommendations` setting allows configuring which prompt files to suggest in different contexts:
 *
 * ```json
 * {
 *   "chat.promptFilesRecommendations": {
 *     "plan": true,                            // Always suggest
 *     "new-page": "resourceExtname == .js",    // Suggest for JavaScript files
 *     "draft-blog": "resourceLangId == markdown", // Suggest for Markdown files
 *     "debug": false                           // Never suggest
 *   }
 * }
 * ```
 */
export var PromptsConfig;
(function (PromptsConfig) {
    /**
     * Configuration key for the locations of reusable prompt files.
     */
    PromptsConfig.PROMPT_LOCATIONS_KEY = 'chat.promptFilesLocations';
    /**
     * Configuration key for the locations of instructions files.
     */
    PromptsConfig.INSTRUCTIONS_LOCATION_KEY = 'chat.instructionsFilesLocations';
    /**
     * Configuration key for the locations of mode files.
     */
    PromptsConfig.MODE_LOCATION_KEY = 'chat.modeFilesLocations';
    /**
     * Configuration key for prompt file suggestions.
     */
    PromptsConfig.PROMPT_FILES_SUGGEST_KEY = 'chat.promptFilesRecommendations';
    /**
     * Configuration key for use of the copilot instructions file.
     */
    PromptsConfig.USE_COPILOT_INSTRUCTION_FILES = 'github.copilot.chat.codeGeneration.useInstructionFiles';
    /**
     * Configuration key for the AGENTS.md.
     */
    PromptsConfig.USE_AGENT_MD = 'chat.useAgentsMdFile';
    /**
     * Configuration key for nested AGENTS.md files.
     */
    PromptsConfig.USE_NESTED_AGENT_MD = 'chat.useNestedAgentsMdFiles';
    /**
     * Configuration key for claude skills usage.
     */
    PromptsConfig.USE_CLAUDE_SKILLS = 'chat.useClaudeSkills';
    /**
     * Get value of the `reusable prompt locations` configuration setting.
     * @see {@link PROMPT_LOCATIONS_CONFIG_KEY}, {@link INSTRUCTIONS_LOCATIONS_CONFIG_KEY}, {@link MODE_LOCATIONS_CONFIG_KEY}.
     */
    function getLocationsValue(configService, type) {
        const key = getPromptFileLocationsConfigKey(type);
        const configValue = configService.getValue(key);
        if (configValue === undefined || configValue === null || Array.isArray(configValue)) {
            return undefined;
        }
        // note! this would be also true for `null` and `array`,
        // 		 but those cases are already handled above
        if (typeof configValue === 'object') {
            const paths = {};
            for (const [path, value] of Object.entries(configValue)) {
                const cleanPath = path.trim();
                const booleanValue = asBoolean(value);
                // if value can be mapped to a boolean, and the clean
                // path is not empty, add it to the map
                if ((booleanValue !== undefined) && cleanPath) {
                    paths[cleanPath] = booleanValue;
                }
            }
            return paths;
        }
        return undefined;
    }
    PromptsConfig.getLocationsValue = getLocationsValue;
    /**
     * Gets list of source folders for prompt files.
     * Defaults to {@link PROMPT_DEFAULT_SOURCE_FOLDER}, {@link INSTRUCTIONS_DEFAULT_SOURCE_FOLDER} or {@link MODE_DEFAULT_SOURCE_FOLDER}.
     */
    function promptSourceFolders(configService, type) {
        const value = getLocationsValue(configService, type);
        const defaultSourceFolder = getPromptFileDefaultLocation(type);
        // note! the `value &&` part handles the `undefined`, `null`, and `false` cases
        if (value && (typeof value === 'object')) {
            const paths = [];
            // if the default source folder is not explicitly disabled, add it
            if (value[defaultSourceFolder] !== false) {
                paths.push(defaultSourceFolder);
            }
            // copy all the enabled paths to the result list
            for (const [path, enabledValue] of Object.entries(value)) {
                // we already added the default source folder, so skip it
                if ((enabledValue === false) || (path === defaultSourceFolder)) {
                    continue;
                }
                paths.push(path);
            }
            return paths;
        }
        // `undefined`, `null`, and `false` cases
        return [];
    }
    PromptsConfig.promptSourceFolders = promptSourceFolders;
    /**
     * Get value of the prompt file recommendations configuration setting.
     * @param configService Configuration service instance
     * @param resource Optional resource URI to get workspace folder-specific settings
     * @see {@link PROMPT_FILES_SUGGEST_KEY}.
     */
    function getPromptFilesRecommendationsValue(configService, resource) {
        // Get the merged configuration value (VS Code automatically merges all levels: default → user → workspace → folder)
        const configValue = configService.getValue(PromptsConfig.PROMPT_FILES_SUGGEST_KEY, { resource });
        if (!configValue || typeof configValue !== 'object' || Array.isArray(configValue)) {
            return undefined;
        }
        const suggestions = {};
        for (const [promptName, value] of Object.entries(configValue)) {
            const cleanPromptName = promptName.trim();
            // Skip empty prompt names
            if (!cleanPromptName) {
                continue;
            }
            // Accept boolean values directly
            if (typeof value === 'boolean') {
                suggestions[cleanPromptName] = value;
                continue;
            }
            // Accept string values as when clauses
            if (typeof value === 'string') {
                const cleanValue = value.trim();
                if (cleanValue) {
                    suggestions[cleanPromptName] = cleanValue;
                }
                continue;
            }
            // Convert other truthy/falsy values to boolean
            const booleanValue = asBoolean(value);
            if (booleanValue !== undefined) {
                suggestions[cleanPromptName] = booleanValue;
            }
        }
        // Return undefined if no valid suggestions were found
        return Object.keys(suggestions).length > 0 ? suggestions : undefined;
    }
    PromptsConfig.getPromptFilesRecommendationsValue = getPromptFilesRecommendationsValue;
})(PromptsConfig || (PromptsConfig = {}));
export function getPromptFileLocationsConfigKey(type) {
    switch (type) {
        case PromptsType.instructions:
            return PromptsConfig.INSTRUCTIONS_LOCATION_KEY;
        case PromptsType.prompt:
            return PromptsConfig.PROMPT_LOCATIONS_KEY;
        case PromptsType.agent:
            return PromptsConfig.MODE_LOCATION_KEY;
        default:
            throw new Error('Unknown prompt type');
    }
}
/**
 * Helper to parse an input value of `any` type into a boolean.
 *
 * @param value - input value to parse
 * @returns `true` if the value is the boolean `true` value or a string that can
 * 			be clearly mapped to a boolean (e.g., `"true"`, `"TRUE"`, `"FaLSe"`, etc.),
 * 			`undefined` for rest of the values
 */
export function asBoolean(value) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        const cleanValue = value.trim().toLowerCase();
        if (cleanValue === 'true') {
            return true;
        }
        if (cleanValue === 'false') {
            return false;
        }
        return undefined;
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvY29tbW9uL3Byb21wdFN5bnRheC9jb25maWcvY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBSWhHLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUNoRCxPQUFPLEVBQW9FLDRCQUE0QixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFMUk7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FrQ0c7QUFDSCxNQUFNLEtBQVcsYUFBYSxDQThKN0I7QUE5SkQsV0FBaUIsYUFBYTtJQUM3Qjs7T0FFRztJQUNVLGtDQUFvQixHQUFHLDJCQUEyQixDQUFDO0lBRWhFOztPQUVHO0lBQ1UsdUNBQXlCLEdBQUcsaUNBQWlDLENBQUM7SUFDM0U7O09BRUc7SUFDVSwrQkFBaUIsR0FBRyx5QkFBeUIsQ0FBQztJQUUzRDs7T0FFRztJQUNVLHNDQUF3QixHQUFHLGlDQUFpQyxDQUFDO0lBRTFFOztPQUVHO0lBQ1UsMkNBQTZCLEdBQUcsd0RBQXdELENBQUM7SUFFdEc7O09BRUc7SUFDVSwwQkFBWSxHQUFHLHNCQUFzQixDQUFDO0lBRW5EOztPQUVHO0lBQ1UsaUNBQW1CLEdBQUcsNkJBQTZCLENBQUM7SUFFakU7O09BRUc7SUFDVSwrQkFBaUIsR0FBRyxzQkFBc0IsQ0FBQztJQUV4RDs7O09BR0c7SUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxhQUFvQyxFQUFFLElBQWlCO1FBQ3hGLE1BQU0sR0FBRyxHQUFHLCtCQUErQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xELE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFaEQsSUFBSSxXQUFXLEtBQUssU0FBUyxJQUFJLFdBQVcsS0FBSyxJQUFJLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ3JGLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCx3REFBd0Q7UUFDeEQsK0NBQStDO1FBQy9DLElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDckMsTUFBTSxLQUFLLEdBQTRCLEVBQUUsQ0FBQztZQUUxQyxLQUFLLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO2dCQUN6RCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQzlCLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFFdEMscURBQXFEO2dCQUNyRCx1Q0FBdUM7Z0JBQ3ZDLElBQUksQ0FBQyxZQUFZLEtBQUssU0FBUyxDQUFDLElBQUksU0FBUyxFQUFFLENBQUM7b0JBQy9DLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxZQUFZLENBQUM7Z0JBQ2pDLENBQUM7WUFDRixDQUFDO1lBRUQsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQTVCZSwrQkFBaUIsb0JBNEJoQyxDQUFBO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsbUJBQW1CLENBQUMsYUFBb0MsRUFBRSxJQUFpQjtRQUMxRixNQUFNLEtBQUssR0FBRyxpQkFBaUIsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDckQsTUFBTSxtQkFBbUIsR0FBRyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUvRCwrRUFBK0U7UUFDL0UsSUFBSSxLQUFLLElBQUksQ0FBQyxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzFDLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztZQUUzQixrRUFBa0U7WUFDbEUsSUFBSSxLQUFLLENBQUMsbUJBQW1CLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQztnQkFDMUMsS0FBSyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQ2pDLENBQUM7WUFFRCxnREFBZ0Q7WUFDaEQsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDMUQseURBQXlEO2dCQUN6RCxJQUFJLENBQUMsWUFBWSxLQUFLLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLG1CQUFtQixDQUFDLEVBQUUsQ0FBQztvQkFDaEUsU0FBUztnQkFDVixDQUFDO2dCQUVELEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEIsQ0FBQztZQUVELE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELHlDQUF5QztRQUN6QyxPQUFPLEVBQUUsQ0FBQztJQUNYLENBQUM7SUE1QmUsaUNBQW1CLHNCQTRCbEMsQ0FBQTtJQUVEOzs7OztPQUtHO0lBQ0gsU0FBZ0Isa0NBQWtDLENBQUMsYUFBb0MsRUFBRSxRQUFjO1FBQ3RHLG9IQUFvSDtRQUNwSCxNQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFFakcsSUFBSSxDQUFDLFdBQVcsSUFBSSxPQUFPLFdBQVcsS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ25GLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBcUMsRUFBRSxDQUFDO1FBRXpELEtBQUssTUFBTSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDL0QsTUFBTSxlQUFlLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO1lBRTFDLDBCQUEwQjtZQUMxQixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3RCLFNBQVM7WUFDVixDQUFDO1lBRUQsaUNBQWlDO1lBQ2pDLElBQUksT0FBTyxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ2hDLFdBQVcsQ0FBQyxlQUFlLENBQUMsR0FBRyxLQUFLLENBQUM7Z0JBQ3JDLFNBQVM7WUFDVixDQUFDO1lBRUQsdUNBQXVDO1lBQ3ZDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQy9CLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxVQUFVLEVBQUUsQ0FBQztvQkFDaEIsV0FBVyxDQUFDLGVBQWUsQ0FBQyxHQUFHLFVBQVUsQ0FBQztnQkFDM0MsQ0FBQztnQkFDRCxTQUFTO1lBQ1YsQ0FBQztZQUVELCtDQUErQztZQUMvQyxNQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDdEMsSUFBSSxZQUFZLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ2hDLFdBQVcsQ0FBQyxlQUFlLENBQUMsR0FBRyxZQUFZLENBQUM7WUFDN0MsQ0FBQztRQUNGLENBQUM7UUFFRCxzREFBc0Q7UUFDdEQsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQ3RFLENBQUM7SUExQ2UsZ0RBQWtDLHFDQTBDakQsQ0FBQTtBQUVGLENBQUMsRUE5SmdCLGFBQWEsS0FBYixhQUFhLFFBOEo3QjtBQUVELE1BQU0sVUFBVSwrQkFBK0IsQ0FBQyxJQUFpQjtJQUNoRSxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2QsS0FBSyxXQUFXLENBQUMsWUFBWTtZQUM1QixPQUFPLGFBQWEsQ0FBQyx5QkFBeUIsQ0FBQztRQUNoRCxLQUFLLFdBQVcsQ0FBQyxNQUFNO1lBQ3RCLE9BQU8sYUFBYSxDQUFDLG9CQUFvQixDQUFDO1FBQzNDLEtBQUssV0FBVyxDQUFDLEtBQUs7WUFDckIsT0FBTyxhQUFhLENBQUMsaUJBQWlCLENBQUM7UUFDeEM7WUFDQyxNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDekMsQ0FBQztBQUNGLENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxVQUFVLFNBQVMsQ0FBQyxLQUFjO0lBQ3ZDLElBQUksT0FBTyxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDaEMsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBRUQsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMvQixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDOUMsSUFBSSxVQUFVLEtBQUssTUFBTSxFQUFFLENBQUM7WUFDM0IsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsSUFBSSxVQUFVLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDNUIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELE9BQU8sU0FBUyxDQUFDO0FBQ2xCLENBQUMifQ==