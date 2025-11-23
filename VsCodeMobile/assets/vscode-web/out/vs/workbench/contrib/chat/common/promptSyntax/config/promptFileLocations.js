/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { basename, dirname } from '../../../../../../base/common/path.js';
import { PromptsType } from '../promptTypes.js';
/**
 * File extension for the reusable prompt files.
 */
export const PROMPT_FILE_EXTENSION = '.prompt.md';
/**
 * File extension for the reusable instruction files.
 */
export const INSTRUCTION_FILE_EXTENSION = '.instructions.md';
/**
 * File extension for the modes files.
 */
export const LEGACY_MODE_FILE_EXTENSION = '.chatmode.md';
/**
 * File extension for the agent files.
 */
export const AGENT_FILE_EXTENSION = '.agent.md';
/**
 * Copilot custom instructions file name.
 */
export const COPILOT_CUSTOM_INSTRUCTIONS_FILENAME = 'copilot-instructions.md';
/**
 * Default reusable prompt files source folder.
 */
export const PROMPT_DEFAULT_SOURCE_FOLDER = '.github/prompts';
/**
 * Default reusable instructions files source folder.
 */
export const INSTRUCTIONS_DEFAULT_SOURCE_FOLDER = '.github/instructions';
/**
 * Default modes source folder.
 */
export const LEGACY_MODE_DEFAULT_SOURCE_FOLDER = '.github/chatmodes';
/**
 * Agents folder.
 */
export const AGENTS_SOURCE_FOLDER = '.github/agents';
/**
 * Helper function to check if a file is directly in the .github/agents/ folder (not in subfolders).
 */
function isInAgentsFolder(fileUri) {
    const dir = dirname(fileUri.path);
    return dir.endsWith('/' + AGENTS_SOURCE_FOLDER) || dir === AGENTS_SOURCE_FOLDER;
}
/**
 * Gets the prompt file type from the provided path.
 */
export function getPromptFileType(fileUri) {
    const filename = basename(fileUri.path);
    if (filename.endsWith(PROMPT_FILE_EXTENSION)) {
        return PromptsType.prompt;
    }
    if (filename.endsWith(INSTRUCTION_FILE_EXTENSION) || (filename === COPILOT_CUSTOM_INSTRUCTIONS_FILENAME)) {
        return PromptsType.instructions;
    }
    if (filename.endsWith(LEGACY_MODE_FILE_EXTENSION) || filename.endsWith(AGENT_FILE_EXTENSION)) {
        return PromptsType.agent;
    }
    // Check if it's a .md file in the .github/agents/ folder
    if (filename.endsWith('.md') && isInAgentsFolder(fileUri)) {
        return PromptsType.agent;
    }
    return undefined;
}
/**
 * Check if provided URI points to a file that with prompt file extension.
 */
export function isPromptOrInstructionsFile(fileUri) {
    return getPromptFileType(fileUri) !== undefined;
}
export function getPromptFileExtension(type) {
    switch (type) {
        case PromptsType.instructions:
            return INSTRUCTION_FILE_EXTENSION;
        case PromptsType.prompt:
            return PROMPT_FILE_EXTENSION;
        case PromptsType.agent:
            return AGENT_FILE_EXTENSION;
        default:
            throw new Error('Unknown prompt type');
    }
}
export function getPromptFileDefaultLocation(type) {
    switch (type) {
        case PromptsType.instructions:
            return INSTRUCTIONS_DEFAULT_SOURCE_FOLDER;
        case PromptsType.prompt:
            return PROMPT_DEFAULT_SOURCE_FOLDER;
        case PromptsType.agent:
            return AGENTS_SOURCE_FOLDER;
        default:
            throw new Error('Unknown prompt type');
    }
}
/**
 * Gets clean prompt name without file extension.
 */
export function getCleanPromptName(fileUri) {
    const fileName = basename(fileUri.path);
    const extensions = [
        PROMPT_FILE_EXTENSION,
        INSTRUCTION_FILE_EXTENSION,
        LEGACY_MODE_FILE_EXTENSION,
        AGENT_FILE_EXTENSION,
    ];
    for (const ext of extensions) {
        if (fileName.endsWith(ext)) {
            return basename(fileUri.path, ext);
        }
    }
    if (fileName === COPILOT_CUSTOM_INSTRUCTIONS_FILENAME) {
        return basename(fileUri.path, '.md');
    }
    // For .md files in .github/agents/ folder, treat them as agent files
    if (fileName.endsWith('.md') && isInAgentsFolder(fileUri)) {
        return basename(fileUri.path, '.md');
    }
    // because we now rely on the `prompt` language ID that can be explicitly
    // set for any document in the editor, any file can be a "prompt" file, so
    // to account for that, we return the full file name including the file
    // extension for all other cases
    return basename(fileUri.path);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0RmlsZUxvY2F0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvY29uZmlnL3Byb21wdEZpbGVMb2NhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFaEQ7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxZQUFZLENBQUM7QUFFbEQ7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSwwQkFBMEIsR0FBRyxrQkFBa0IsQ0FBQztBQUU3RDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLDBCQUEwQixHQUFHLGNBQWMsQ0FBQztBQUV6RDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLG9CQUFvQixHQUFHLFdBQVcsQ0FBQztBQUVoRDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLG9DQUFvQyxHQUFHLHlCQUF5QixDQUFDO0FBRzlFOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sNEJBQTRCLEdBQUcsaUJBQWlCLENBQUM7QUFFOUQ7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxrQ0FBa0MsR0FBRyxzQkFBc0IsQ0FBQztBQUV6RTs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLGlDQUFpQyxHQUFHLG1CQUFtQixDQUFDO0FBRXJFOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQUcsZ0JBQWdCLENBQUM7QUFFckQ7O0dBRUc7QUFDSCxTQUFTLGdCQUFnQixDQUFDLE9BQVk7SUFDckMsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENB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