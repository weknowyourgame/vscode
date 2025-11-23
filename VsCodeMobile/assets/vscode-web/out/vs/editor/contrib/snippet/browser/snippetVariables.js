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
import { normalizeDriveLetter } from '../../../../base/common/labels.js';
import * as path from '../../../../base/common/path.js';
import { dirname } from '../../../../base/common/resources.js';
import { commonPrefixLength, getLeadingWhitespace, isFalsyOrWhitespace, splitLines } from '../../../../base/common/strings.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { ILanguageConfigurationService } from '../../../common/languages/languageConfigurationRegistry.js';
import { Text } from './snippetParser.js';
import * as nls from '../../../../nls.js';
import { WORKSPACE_EXTENSION, isSingleFolderWorkspaceIdentifier, toWorkspaceIdentifier, isEmptyWorkspaceIdentifier } from '../../../../platform/workspace/common/workspace.js';
export const KnownSnippetVariableNames = Object.freeze({
    'CURRENT_YEAR': true,
    'CURRENT_YEAR_SHORT': true,
    'CURRENT_MONTH': true,
    'CURRENT_DATE': true,
    'CURRENT_HOUR': true,
    'CURRENT_MINUTE': true,
    'CURRENT_SECOND': true,
    'CURRENT_DAY_NAME': true,
    'CURRENT_DAY_NAME_SHORT': true,
    'CURRENT_MONTH_NAME': true,
    'CURRENT_MONTH_NAME_SHORT': true,
    'CURRENT_SECONDS_UNIX': true,
    'CURRENT_TIMEZONE_OFFSET': true,
    'SELECTION': true,
    'CLIPBOARD': true,
    'TM_SELECTED_TEXT': true,
    'TM_CURRENT_LINE': true,
    'TM_CURRENT_WORD': true,
    'TM_LINE_INDEX': true,
    'TM_LINE_NUMBER': true,
    'TM_FILENAME': true,
    'TM_FILENAME_BASE': true,
    'TM_DIRECTORY': true,
    'TM_DIRECTORY_BASE': true,
    'TM_FILEPATH': true,
    'CURSOR_INDEX': true, // 0-offset
    'CURSOR_NUMBER': true, // 1-offset
    'RELATIVE_FILEPATH': true,
    'BLOCK_COMMENT_START': true,
    'BLOCK_COMMENT_END': true,
    'LINE_COMMENT': true,
    'WORKSPACE_NAME': true,
    'WORKSPACE_FOLDER': true,
    'RANDOM': true,
    'RANDOM_HEX': true,
    'UUID': true
});
export class CompositeSnippetVariableResolver {
    constructor(_delegates) {
        this._delegates = _delegates;
        //
    }
    resolve(variable) {
        for (const delegate of this._delegates) {
            const value = delegate.resolve(variable);
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }
}
export class SelectionBasedVariableResolver {
    constructor(_model, _selection, _selectionIdx, _overtypingCapturer) {
        this._model = _model;
        this._selection = _selection;
        this._selectionIdx = _selectionIdx;
        this._overtypingCapturer = _overtypingCapturer;
        //
    }
    resolve(variable) {
        const { name } = variable;
        if (name === 'SELECTION' || name === 'TM_SELECTED_TEXT') {
            let value = this._model.getValueInRange(this._selection) || undefined;
            let isMultiline = this._selection.startLineNumber !== this._selection.endLineNumber;
            // If there was no selected text, try to get last overtyped text
            if (!value && this._overtypingCapturer) {
                const info = this._overtypingCapturer.getLastOvertypedInfo(this._selectionIdx);
                if (info) {
                    value = info.value;
                    isMultiline = info.multiline;
                }
            }
            if (value && isMultiline && variable.snippet) {
                // Selection is a multiline string which we indentation we now
                // need to adjust. We compare the indentation of this variable
                // with the indentation at the editor position and add potential
                // extra indentation to the value
                const line = this._model.getLineContent(this._selection.startLineNumber);
                const lineLeadingWhitespace = getLeadingWhitespace(line, 0, this._selection.startColumn - 1);
                let varLeadingWhitespace = lineLeadingWhitespace;
                variable.snippet.walk(marker => {
                    if (marker === variable) {
                        return false;
                    }
                    if (marker instanceof Text) {
                        varLeadingWhitespace = getLeadingWhitespace(splitLines(marker.value).pop());
                    }
                    return true;
                });
                const whitespaceCommonLength = commonPrefixLength(varLeadingWhitespace, lineLeadingWhitespace);
                value = value.replace(/(\r\n|\r|\n)(.*)/g, (m, newline, rest) => `${newline}${varLeadingWhitespace.substr(whitespaceCommonLength)}${rest}`);
            }
            return value;
        }
        else if (name === 'TM_CURRENT_LINE') {
            return this._model.getLineContent(this._selection.positionLineNumber);
        }
        else if (name === 'TM_CURRENT_WORD') {
            const info = this._model.getWordAtPosition({
                lineNumber: this._selection.positionLineNumber,
                column: this._selection.positionColumn
            });
            return info && info.word || undefined;
        }
        else if (name === 'TM_LINE_INDEX') {
            return String(this._selection.positionLineNumber - 1);
        }
        else if (name === 'TM_LINE_NUMBER') {
            return String(this._selection.positionLineNumber);
        }
        else if (name === 'CURSOR_INDEX') {
            return String(this._selectionIdx);
        }
        else if (name === 'CURSOR_NUMBER') {
            return String(this._selectionIdx + 1);
        }
        return undefined;
    }
}
export class ModelBasedVariableResolver {
    constructor(_labelService, _model) {
        this._labelService = _labelService;
        this._model = _model;
        //
    }
    resolve(variable) {
        const { name } = variable;
        if (name === 'TM_FILENAME') {
            return path.basename(this._model.uri.fsPath);
        }
        else if (name === 'TM_FILENAME_BASE') {
            const name = path.basename(this._model.uri.fsPath);
            const idx = name.lastIndexOf('.');
            if (idx <= 0) {
                return name;
            }
            else {
                return name.slice(0, idx);
            }
        }
        else if (name === 'TM_DIRECTORY') {
            if (path.dirname(this._model.uri.fsPath) === '.') {
                return '';
            }
            return this._labelService.getUriLabel(dirname(this._model.uri));
        }
        else if (name === 'TM_DIRECTORY_BASE') {
            if (path.dirname(this._model.uri.fsPath) === '.') {
                return '';
            }
            return path.basename(path.dirname(this._model.uri.fsPath));
        }
        else if (name === 'TM_FILEPATH') {
            return this._labelService.getUriLabel(this._model.uri);
        }
        else if (name === 'RELATIVE_FILEPATH') {
            return this._labelService.getUriLabel(this._model.uri, { relative: true, noPrefix: true });
        }
        return undefined;
    }
}
export class ClipboardBasedVariableResolver {
    constructor(_readClipboardText, _selectionIdx, _selectionCount, _spread) {
        this._readClipboardText = _readClipboardText;
        this._selectionIdx = _selectionIdx;
        this._selectionCount = _selectionCount;
        this._spread = _spread;
        //
    }
    resolve(variable) {
        if (variable.name !== 'CLIPBOARD') {
            return undefined;
        }
        const clipboardText = this._readClipboardText();
        if (!clipboardText) {
            return undefined;
        }
        // `spread` is assigning each cursor a line of the clipboard
        // text whenever there the line count equals the cursor count
        // and when enabled
        if (this._spread) {
            const lines = clipboardText.split(/\r\n|\n|\r/).filter(s => !isFalsyOrWhitespace(s));
            if (lines.length === this._selectionCount) {
                return lines[this._selectionIdx];
            }
        }
        return clipboardText;
    }
}
let CommentBasedVariableResolver = class CommentBasedVariableResolver {
    constructor(_model, _selection, _languageConfigurationService) {
        this._model = _model;
        this._selection = _selection;
        this._languageConfigurationService = _languageConfigurationService;
        //
    }
    resolve(variable) {
        const { name } = variable;
        const langId = this._model.getLanguageIdAtPosition(this._selection.selectionStartLineNumber, this._selection.selectionStartColumn);
        const config = this._languageConfigurationService.getLanguageConfiguration(langId).comments;
        if (!config) {
            return undefined;
        }
        if (name === 'LINE_COMMENT') {
            return config.lineCommentToken || undefined;
        }
        else if (name === 'BLOCK_COMMENT_START') {
            return config.blockCommentStartToken || undefined;
        }
        else if (name === 'BLOCK_COMMENT_END') {
            return config.blockCommentEndToken || undefined;
        }
        return undefined;
    }
};
CommentBasedVariableResolver = __decorate([
    __param(2, ILanguageConfigurationService)
], CommentBasedVariableResolver);
export { CommentBasedVariableResolver };
export class TimeBasedVariableResolver {
    constructor() {
        this._date = new Date();
    }
    static { this.dayNames = [nls.localize('Sunday', "Sunday"), nls.localize('Monday', "Monday"), nls.localize('Tuesday', "Tuesday"), nls.localize('Wednesday', "Wednesday"), nls.localize('Thursday', "Thursday"), nls.localize('Friday', "Friday"), nls.localize('Saturday', "Saturday")]; }
    static { this.dayNamesShort = [nls.localize('SundayShort', "Sun"), nls.localize('MondayShort', "Mon"), nls.localize('TuesdayShort', "Tue"), nls.localize('WednesdayShort', "Wed"), nls.localize('ThursdayShort', "Thu"), nls.localize('FridayShort', "Fri"), nls.localize('SaturdayShort', "Sat")]; }
    static { this.monthNames = [nls.localize('January', "January"), nls.localize('February', "February"), nls.localize('March', "March"), nls.localize('April', "April"), nls.localize('May', "May"), nls.localize('June', "June"), nls.localize('July', "July"), nls.localize('August', "August"), nls.localize('September', "September"), nls.localize('October', "October"), nls.localize('November', "November"), nls.localize('December', "December")]; }
    static { this.monthNamesShort = [nls.localize('JanuaryShort', "Jan"), nls.localize('FebruaryShort', "Feb"), nls.localize('MarchShort', "Mar"), nls.localize('AprilShort', "Apr"), nls.localize('MayShort', "May"), nls.localize('JuneShort', "Jun"), nls.localize('JulyShort', "Jul"), nls.localize('AugustShort', "Aug"), nls.localize('SeptemberShort', "Sep"), nls.localize('OctoberShort', "Oct"), nls.localize('NovemberShort', "Nov"), nls.localize('DecemberShort', "Dec")]; }
    resolve(variable) {
        const { name } = variable;
        if (name === 'CURRENT_YEAR') {
            return String(this._date.getFullYear());
        }
        else if (name === 'CURRENT_YEAR_SHORT') {
            return String(this._date.getFullYear()).slice(-2);
        }
        else if (name === 'CURRENT_MONTH') {
            return String(this._date.getMonth().valueOf() + 1).padStart(2, '0');
        }
        else if (name === 'CURRENT_DATE') {
            return String(this._date.getDate().valueOf()).padStart(2, '0');
        }
        else if (name === 'CURRENT_HOUR') {
            return String(this._date.getHours().valueOf()).padStart(2, '0');
        }
        else if (name === 'CURRENT_MINUTE') {
            return String(this._date.getMinutes().valueOf()).padStart(2, '0');
        }
        else if (name === 'CURRENT_SECOND') {
            return String(this._date.getSeconds().valueOf()).padStart(2, '0');
        }
        else if (name === 'CURRENT_DAY_NAME') {
            return TimeBasedVariableResolver.dayNames[this._date.getDay()];
        }
        else if (name === 'CURRENT_DAY_NAME_SHORT') {
            return TimeBasedVariableResolver.dayNamesShort[this._date.getDay()];
        }
        else if (name === 'CURRENT_MONTH_NAME') {
            return TimeBasedVariableResolver.monthNames[this._date.getMonth()];
        }
        else if (name === 'CURRENT_MONTH_NAME_SHORT') {
            return TimeBasedVariableResolver.monthNamesShort[this._date.getMonth()];
        }
        else if (name === 'CURRENT_SECONDS_UNIX') {
            return String(Math.floor(this._date.getTime() / 1000));
        }
        else if (name === 'CURRENT_TIMEZONE_OFFSET') {
            const rawTimeOffset = this._date.getTimezoneOffset();
            const sign = rawTimeOffset > 0 ? '-' : '+';
            const hours = Math.trunc(Math.abs(rawTimeOffset / 60));
            const hoursString = (hours < 10 ? '0' + hours : hours);
            const minutes = Math.abs(rawTimeOffset) - hours * 60;
            const minutesString = (minutes < 10 ? '0' + minutes : minutes);
            return sign + hoursString + ':' + minutesString;
        }
        return undefined;
    }
}
export class WorkspaceBasedVariableResolver {
    constructor(_workspaceService) {
        this._workspaceService = _workspaceService;
        //
    }
    resolve(variable) {
        if (!this._workspaceService) {
            return undefined;
        }
        const workspaceIdentifier = toWorkspaceIdentifier(this._workspaceService.getWorkspace());
        if (isEmptyWorkspaceIdentifier(workspaceIdentifier)) {
            return undefined;
        }
        if (variable.name === 'WORKSPACE_NAME') {
            return this._resolveWorkspaceName(workspaceIdentifier);
        }
        else if (variable.name === 'WORKSPACE_FOLDER') {
            return this._resoveWorkspacePath(workspaceIdentifier);
        }
        return undefined;
    }
    _resolveWorkspaceName(workspaceIdentifier) {
        if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
            return path.basename(workspaceIdentifier.uri.path);
        }
        let filename = path.basename(workspaceIdentifier.configPath.path);
        if (filename.endsWith(WORKSPACE_EXTENSION)) {
            filename = filename.substr(0, filename.length - WORKSPACE_EXTENSION.length - 1);
        }
        return filename;
    }
    _resoveWorkspacePath(workspaceIdentifier) {
        if (isSingleFolderWorkspaceIdentifier(workspaceIdentifier)) {
            return normalizeDriveLetter(workspaceIdentifier.uri.fsPath);
        }
        const filename = path.basename(workspaceIdentifier.configPath.path);
        let folderpath = workspaceIdentifier.configPath.fsPath;
        if (folderpath.endsWith(filename)) {
            folderpath = folderpath.substr(0, folderpath.length - filename.length - 1);
        }
        return (folderpath ? normalizeDriveLetter(folderpath) : '/');
    }
}
export class RandomBasedVariableResolver {
    resolve(variable) {
        const { name } = variable;
        if (name === 'RANDOM') {
            return Math.random().toString().slice(-6);
        }
        else if (name === 'RANDOM_HEX') {
            return Math.random().toString(16).slice(-6);
        }
        else if (name === 'UUID') {
            return generateUuid();
        }
        return undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic25pcHBldFZhcmlhYmxlcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldFZhcmlhYmxlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN6RSxPQUFPLEtBQUssSUFBSSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUMvRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsb0JBQW9CLEVBQUUsbUJBQW1CLEVBQUUsVUFBVSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDL0gsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRy9ELE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQzNHLE9BQU8sRUFBRSxJQUFJLEVBQThCLE1BQU0sb0JBQW9CLENBQUM7QUFFdEUsT0FBTyxLQUFLLEdBQUcsTUFBTSxvQkFBb0IsQ0FBQztBQUUxQyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsaUNBQWlDLEVBQUUscUJBQXFCLEVBQW9GLDBCQUEwQixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFalEsTUFBTSxDQUFDLE1BQU0seUJBQXlCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBMEI7SUFDL0UsY0FBYyxFQUFFLElBQUk7SUFDcEIsb0JBQW9CLEVBQUUsSUFBSTtJQUMxQixlQUFlLEVBQUUsSUFBSTtJQUNyQixjQUFjLEVBQUUsSUFBSTtJQUNwQixjQUFjLEVBQUUsSUFBSTtJQUNwQixnQkFBZ0IsRUFBRSxJQUFJO0lBQ3RCLGdCQUFnQixFQUFFLElBQUk7SUFDdEIsa0JBQWtCLEVBQUUsSUFBSTtJQUN4Qix3QkFB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