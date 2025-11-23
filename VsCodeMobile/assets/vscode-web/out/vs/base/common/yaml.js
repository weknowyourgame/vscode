/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Parses a simplified YAML-like input from a single string.
 * Supports objects, arrays, primitive types (string, number, boolean, null).
 * Tracks positions for error reporting and node locations.
 *
 * Limitations:
 * - No multi-line strings or block literals
 * - No anchors or references
 * - No complex types (dates, binary)
 * - No special handling for escape sequences in strings
 * - Indentation must be consistent (spaces only, no tabs)
 *
 * Notes:
 * - New line separators can be either "\n" or "\r\n". The input string is split into lines internally.
 *
 * @param input A string containing the YAML-like input
 * @param errors Array to collect parsing errors
 * @param options Parsing options
 * @returns The parsed representation (ObjectNode, ArrayNode, or primitive node)
 */
export function parse(input, errors = [], options = {}) {
    // Normalize both LF and CRLF by splitting on either; CR characters are not retained as part of line text.
    // This keeps the existing line/character based lexer logic intact.
    const lines = input.length === 0 ? [] : input.split(/\r\n|\n/);
    const parser = new YamlParser(lines, errors, options);
    return parser.parse();
}
// Helper functions for position and node creation
function createPosition(line, character) {
    return { line, character };
}
// Specialized node creation functions using a more concise approach
function createStringNode(value, start, end) {
    return { type: 'string', value, start, end };
}
function createNumberNode(value, start, end) {
    return { type: 'number', value, start, end };
}
function createBooleanNode(value, start, end) {
    return { type: 'boolean', value, start, end };
}
function createNullNode(start, end) {
    return { type: 'null', value: null, start, end };
}
function createObjectNode(properties, start, end) {
    return { type: 'object', start, end, properties };
}
function createArrayNode(items, start, end) {
    return { type: 'array', start, end, items };
}
// Utility functions for parsing
function isWhitespace(char) {
    return char === ' ' || char === '\t';
}
// Simplified number validation using regex
function isValidNumber(value) {
    return /^-?\d*\.?\d+$/.test(value);
}
// Lexer/Tokenizer for YAML content
class YamlLexer {
    constructor(lines) {
        this.currentLine = 0;
        this.currentChar = 0;
        this.lines = lines;
    }
    getCurrentPosition() {
        return createPosition(this.currentLine, this.currentChar);
    }
    getCurrentLineNumber() {
        return this.currentLine;
    }
    getCurrentCharNumber() {
        return this.currentChar;
    }
    getCurrentLineText() {
        return this.currentLine < this.lines.length ? this.lines[this.currentLine] : '';
    }
    savePosition() {
        return { line: this.currentLine, char: this.currentChar };
    }
    restorePosition(pos) {
        this.currentLine = pos.line;
        this.currentChar = pos.char;
    }
    isAtEnd() {
        return this.currentLine >= this.lines.length;
    }
    getCurrentChar() {
        if (this.isAtEnd() || this.currentChar >= this.lines[this.currentLine].length) {
            return '';
        }
        return this.lines[this.currentLine][this.currentChar];
    }
    peek(offset = 1) {
        const newChar = this.currentChar + offset;
        if (this.currentLine >= this.lines.length || newChar >= this.lines[this.currentLine].length) {
            return '';
        }
        return this.lines[this.currentLine][newChar];
    }
    advance() {
        const char = this.getCurrentChar();
        if (this.currentChar >= this.lines[this.currentLine].length && this.currentLine < this.lines.length - 1) {
            this.currentLine++;
            this.currentChar = 0;
        }
        else {
            this.currentChar++;
        }
        return char;
    }
    advanceLine() {
        this.currentLine++;
        this.currentChar = 0;
    }
    skipWhitespace() {
        while (!this.isAtEnd() && this.currentChar < this.lines[this.currentLine].length && isWhitespace(this.getCurrentChar())) {
            this.advance();
        }
    }
    skipToEndOfLine() {
        this.currentChar = this.lines[this.currentLine].length;
    }
    getIndentation() {
        if (this.isAtEnd()) {
            return 0;
        }
        let indent = 0;
        for (let i = 0; i < this.lines[this.currentLine].length; i++) {
            if (this.lines[this.currentLine][i] === ' ') {
                indent++;
            }
            else if (this.lines[this.currentLine][i] === '\t') {
                indent += 4; // Treat tab as 4 spaces
            }
            else {
                break;
            }
        }
        return indent;
    }
    moveToNextNonEmptyLine() {
        while (this.currentLine < this.lines.length) {
            // First check current line from current position
            if (this.currentChar < this.lines[this.currentLine].length) {
                const remainingLine = this.lines[this.currentLine].substring(this.currentChar).trim();
                if (remainingLine.length > 0 && !remainingLine.startsWith('#')) {
                    this.skipWhitespace();
                    return;
                }
            }
            // Move to next line and check from beginning
            this.currentLine++;
            this.currentChar = 0;
            if (this.currentLine < this.lines.length) {
                const line = this.lines[this.currentLine].trim();
                if (line.length > 0 && !line.startsWith('#')) {
                    this.skipWhitespace();
                    return;
                }
            }
        }
    }
}
// Parser class for handling YAML parsing
class YamlParser {
    constructor(lines, errors, options) {
        // Track nesting level of flow (inline) collections '[' ']' '{' '}'
        this.flowLevel = 0;
        this.lexer = new YamlLexer(lines);
        this.errors = errors;
        this.options = options;
    }
    addError(message, code, start, end) {
        this.errors.push({ message, code, start, end });
    }
    parseValue(expectedIndent) {
        this.lexer.skipWhitespace();
        if (this.lexer.isAtEnd()) {
            const pos = this.lexer.getCurrentPosition();
            return createStringNode('', pos, pos);
        }
        const char = this.lexer.getCurrentChar();
        // Handle quoted strings
        if (char === '"' || char === `'`) {
            return this.parseQuotedString(char);
        }
        // Handle inline arrays
        if (char === '[') {
            return this.parseInlineArray();
        }
        // Handle inline objects
        if (char === '{') {
            return this.parseInlineObject();
        }
        // Handle unquoted values
        return this.parseUnquotedValue();
    }
    parseQuotedString(quote) {
        const start = this.lexer.getCurrentPosition();
        this.lexer.advance(); // Skip opening quote
        let value = '';
        while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '' && this.lexer.getCurrentChar() !== quote) {
            value += this.lexer.advance();
        }
        if (this.lexer.getCurrentChar() === quote) {
            this.lexer.advance(); // Skip closing quote
        }
        const end = this.lexer.getCurrentPosition();
        return createStringNode(value, start, end);
    }
    parseUnquotedValue() {
        const start = this.lexer.getCurrentPosition();
        let value = '';
        let endPos = start;
        // Helper function to check for value terminators
        const isTerminator = (char) => {
            if (char === '#') {
                return true;
            }
            // Comma, ']' and '}' only terminate inside flow collections
            if (this.flowLevel > 0 && (char === ',' || char === ']' || char === '}')) {
                return true;
            }
            return false;
        };
        // Handle opening quote that might not be closed
        const firstChar = this.lexer.getCurrentChar();
        if (firstChar === '"' || firstChar === `'`) {
            value += this.lexer.advance();
            endPos = this.lexer.getCurrentPosition();
            while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '') {
                const char = this.lexer.getCurrentChar();
                if (char === firstChar || isTerminator(char)) {
                    break;
                }
                value += this.lexer.advance();
                endPos = this.lexer.getCurrentPosition();
            }
        }
        else {
            while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '') {
                const char = this.lexer.getCurrentChar();
                if (isTerminator(char)) {
                    break;
                }
                value += this.lexer.advance();
                endPos = this.lexer.getCurrentPosition();
            }
        }
        const trimmed = value.trimEnd();
        const diff = value.length - trimmed.length;
        if (diff) {
            endPos = createPosition(start.line, endPos.character - diff);
        }
        const finalValue = (firstChar === '"' || firstChar === `'`) ? trimmed.substring(1) : trimmed;
        return this.createValueNode(finalValue, start, endPos);
    }
    createValueNode(value, start, end) {
        if (value === '') {
            return createStringNode('', start, start);
        }
        // Boolean values
        if (value === 'true') {
            return createBooleanNode(true, start, end);
        }
        if (value === 'false') {
            return createBooleanNode(false, start, end);
        }
        // Null values
        if (value === 'null' || value === '~') {
            return createNullNode(start, end);
        }
        // Number values
        const numberValue = Number(value);
        if (!isNaN(numberValue) && isFinite(numberValue) && isValidNumber(value)) {
            return createNumberNode(numberValue, start, end);
        }
        // Default to string
        return createStringNode(value, start, end);
    }
    parseInlineArray() {
        const start = this.lexer.getCurrentPosition();
        this.lexer.advance(); // Skip '['
        this.flowLevel++;
        const items = [];
        while (!this.lexer.isAtEnd()) {
            this.lexer.skipWhitespace();
            // Handle end of array
            if (this.lexer.getCurrentChar() === ']') {
                this.lexer.advance();
                break;
            }
            // Handle end of line - continue to next line for multi-line arrays
            if (this.lexer.getCurrentChar() === '') {
                this.lexer.advanceLine();
                continue;
            }
            // Handle comments - comments should terminate the array parsing
            if (this.lexer.getCurrentChar() === '#') {
                // Skip the rest of the line (comment)
                this.lexer.skipToEndOfLine();
                this.lexer.advanceLine();
                continue;
            }
            // Save position before parsing to detect if we're making progress
            const positionBefore = this.lexer.savePosition();
            // Parse array item
            const item = this.parseValue();
            // Skip implicit empty items that arise from a leading comma at the beginning of a new line
            // (e.g. a line starting with ",foo" after a comment). A legitimate empty string element
            // would have quotes and thus a non-zero span. We only filter zero-length spans.
            if (!(item.type === 'string' && item.value === '' && item.start.line === item.end.line && item.start.character === item.end.character)) {
                items.push(item);
            }
            // Check if we made progress - if not, we're likely stuck
            const positionAfter = this.lexer.savePosition();
            if (positionBefore.line === positionAfter.line && positionBefore.char === positionAfter.char) {
                // No progress made, advance at least one character to prevent infinite loop
                if (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '') {
                    this.lexer.advance();
                }
                else {
                    break;
                }
            }
            this.lexer.skipWhitespace();
            // Handle comma separator
            if (this.lexer.getCurrentChar() === ',') {
                this.lexer.advance();
            }
        }
        const end = this.lexer.getCurrentPosition();
        this.flowLevel--;
        return createArrayNode(items, start, end);
    }
    parseInlineObject() {
        const start = this.lexer.getCurrentPosition();
        this.lexer.advance(); // Skip '{'
        this.flowLevel++;
        const properties = [];
        while (!this.lexer.isAtEnd()) {
            this.lexer.skipWhitespace();
            // Handle end of object
            if (this.lexer.getCurrentChar() === '}') {
                this.lexer.advance();
                break;
            }
            // Handle comments - comments should terminate the object parsing
            if (this.lexer.getCurrentChar() === '#') {
                // Skip the rest of the line (comment)
                this.lexer.skipToEndOfLine();
                this.lexer.advanceLine();
                continue;
            }
            // Save position before parsing to detect if we're making progress
            const positionBefore = this.lexer.savePosition();
            // Parse key - read until colon
            const keyStart = this.lexer.getCurrentPosition();
            let keyValue = '';
            // Handle quoted keys
            if (this.lexer.getCurrentChar() === '"' || this.lexer.getCurrentChar() === `'`) {
                const quote = this.lexer.getCurrentChar();
                this.lexer.advance(); // Skip opening quote
                while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '' && this.lexer.getCurrentChar() !== quote) {
                    keyValue += this.lexer.advance();
                }
                if (this.lexer.getCurrentChar() === quote) {
                    this.lexer.advance(); // Skip closing quote
                }
            }
            else {
                // Handle unquoted keys - read until colon
                while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '' && this.lexer.getCurrentChar() !== ':') {
                    keyValue += this.lexer.advance();
                }
            }
            keyValue = keyValue.trim();
            const keyEnd = this.lexer.getCurrentPosition();
            const key = createStringNode(keyValue, keyStart, keyEnd);
            this.lexer.skipWhitespace();
            // Expect colon
            if (this.lexer.getCurrentChar() === ':') {
                this.lexer.advance();
            }
            this.lexer.skipWhitespace();
            // Parse value
            const value = this.parseValue();
            properties.push({ key, value });
            // Check if we made progress - if not, we're likely stuck
            const positionAfter = this.lexer.savePosition();
            if (positionBefore.line === positionAfter.line && positionBefore.char === positionAfter.char) {
                // No progress made, advance at least one character to prevent infinite loop
                if (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '') {
                    this.lexer.advance();
                }
                else {
                    break;
                }
            }
            this.lexer.skipWhitespace();
            // Handle comma separator
            if (this.lexer.getCurrentChar() === ',') {
                this.lexer.advance();
            }
        }
        const end = this.lexer.getCurrentPosition();
        this.flowLevel--;
        return createObjectNode(properties, start, end);
    }
    parseBlockArray(baseIndent) {
        const start = this.lexer.getCurrentPosition();
        const items = [];
        while (!this.lexer.isAtEnd()) {
            this.lexer.moveToNextNonEmptyLine();
            if (this.lexer.isAtEnd()) {
                break;
            }
            const currentIndent = this.lexer.getIndentation();
            // If indentation is less than expected, we're done with this array
            if (currentIndent < baseIndent) {
                break;
            }
            this.lexer.skipWhitespace();
            // Check for array item marker
            if (this.lexer.getCurrentChar() === '-') {
                this.lexer.advance(); // Skip '-'
                this.lexer.skipWhitespace();
                const itemStart = this.lexer.getCurrentPosition();
                // Check if this is a nested structure
                if (this.lexer.getCurrentChar() === '' || this.lexer.getCurrentChar() === '#') {
                    // Empty item - check if next lines form a nested structure
                    this.lexer.advanceLine();
                    if (!this.lexer.isAtEnd()) {
                        const nextIndent = this.lexer.getIndentation();
                        if (nextIndent > currentIndent) {
                            // Check if the next line starts with a dash (nested array) or has properties (nested object)
                            this.lexer.skipWhitespace();
                            if (this.lexer.getCurrentChar() === '-') {
                                // It's a nested array
                                const nestedArray = this.parseBlockArray(nextIndent);
                                items.push(nestedArray);
                            }
                            else {
                                // Check if it looks like an object property (has a colon)
                                const currentLine = this.lexer.getCurrentLineText();
                                const currentPos = this.lexer.getCurrentCharNumber();
                                const remainingLine = currentLine.substring(currentPos);
                                if (remainingLine.includes(':') && !remainingLine.trim().startsWith('#')) {
                                    // It's a nested object
                                    const nestedObject = this.parseBlockObject(nextIndent, this.lexer.getCurrentCharNumber());
                                    items.push(nestedObject);
                                }
                                else {
                                    // Not a nested structure, create empty string
                                    items.push(createStringNode('', itemStart, itemStart));
                                }
                            }
                        }
                        else {
                            // No nested content, empty item
                            items.push(createStringNode('', itemStart, itemStart));
                        }
                    }
                    else {
                        // End of input, empty item
                        items.push(createStringNode('', itemStart, itemStart));
                    }
                }
                else {
                    // Parse the item value
                    // Check if this is a multi-line object by looking for a colon and checking next lines
                    const currentLine = this.lexer.getCurrentLineText();
                    const currentPos = this.lexer.getCurrentCharNumber();
                    const remainingLine = currentLine.substring(currentPos);
                    // Check if there's a colon on this line (indicating object properties)
                    const hasColon = remainingLine.includes(':');
                    if (hasColon) {
                        // Any line with a colon should be treated as an object
                        // Parse as an object with the current item's indentation as the base
                        const item = this.parseBlockObject(itemStart.character, itemStart.character);
                        items.push(item);
                    }
                    else {
                        // No colon, parse as regular value
                        const item = this.parseValue();
                        items.push(item);
                        // Skip to end of line
                        while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '' && this.lexer.getCurrentChar() !== '#') {
                            this.lexer.advance();
                        }
                        this.lexer.advanceLine();
                    }
                }
            }
            else {
                // No dash found at expected indent level, break
                break;
            }
        }
        // Calculate end position based on the last item
        let end = start;
        if (items.length > 0) {
            const lastItem = items[items.length - 1];
            end = lastItem.end;
        }
        else {
            // If no items, end is right after the start
            end = createPosition(start.line, start.character + 1);
        }
        return createArrayNode(items, start, end);
    }
    parseBlockObject(baseIndent, baseCharPosition) {
        const start = this.lexer.getCurrentPosition();
        const properties = [];
        const localKeysSeen = new Set();
        // For parsing from current position (inline object parsing)
        const fromCurrentPosition = baseCharPosition !== undefined;
        let firstIteration = true;
        while (!this.lexer.isAtEnd()) {
            if (!firstIteration || !fromCurrentPosition) {
                this.lexer.moveToNextNonEmptyLine();
            }
            firstIteration = false;
            if (this.lexer.isAtEnd()) {
                break;
            }
            const currentIndent = this.lexer.getIndentation();
            if (fromCurrentPosition) {
                // For current position parsing, check character position alignment
                this.lexer.skipWhitespace();
                const currentCharPosition = this.lexer.getCurrentCharNumber();
                if (currentCharPosition < baseCharPosition) {
                    break;
                }
            }
            else {
                // For normal block parsing, check indentation level
                if (currentIndent < baseIndent) {
                    break;
                }
                // Check for incorrect indentation
                if (currentIndent > baseIndent) {
                    const lineStart = createPosition(this.lexer.getCurrentLineNumber(), 0);
                    const lineEnd = createPosition(this.lexer.getCurrentLineNumber(), this.lexer.getCurrentLineText().length);
                    this.addError('Unexpected indentation', 'indentation', lineStart, lineEnd);
                    // Try to recover by treating it as a property anyway
                    this.lexer.skipWhitespace();
                }
                else {
                    this.lexer.skipWhitespace();
                }
            }
            // Parse key
            const keyStart = this.lexer.getCurrentPosition();
            let keyValue = '';
            while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '' && this.lexer.getCurrentChar() !== ':') {
                keyValue += this.lexer.advance();
            }
            keyValue = keyValue.trim();
            const keyEnd = this.lexer.getCurrentPosition();
            const key = createStringNode(keyValue, keyStart, keyEnd);
            // Check for duplicate keys
            if (!this.options.allowDuplicateKeys && localKeysSeen.has(keyValue)) {
                this.addError(`Duplicate key '${keyValue}'`, 'duplicateKey', keyStart, keyEnd);
            }
            localKeysSeen.add(keyValue);
            // Expect colon
            if (this.lexer.getCurrentChar() === ':') {
                this.lexer.advance();
            }
            this.lexer.skipWhitespace();
            // Determine if value is on same line or next line(s)
            let value;
            const valueStart = this.lexer.getCurrentPosition();
            if (this.lexer.getCurrentChar() === '' || this.lexer.getCurrentChar() === '#') {
                // Value is on next line(s) or empty
                this.lexer.advanceLine();
                // Check next line for nested content
                if (!this.lexer.isAtEnd()) {
                    const nextIndent = this.lexer.getIndentation();
                    if (nextIndent > currentIndent) {
                        // Nested content - determine if it's an object, array, or just a scalar value
                        this.lexer.skipWhitespace();
                        if (this.lexer.getCurrentChar() === '-') {
                            value = this.parseBlockArray(nextIndent);
                        }
                        else {
                            // Check if this looks like an object property (has a colon)
                            const currentLine = this.lexer.getCurrentLineText();
                            const currentPos = this.lexer.getCurrentCharNumber();
                            const remainingLine = currentLine.substring(currentPos);
                            if (remainingLine.includes(':') && !remainingLine.trim().startsWith('#')) {
                                // It's a nested object
                                value = this.parseBlockObject(nextIndent);
                            }
                            else {
                                // It's just a scalar value on the next line
                                value = this.parseValue();
                            }
                        }
                    }
                    else if (!fromCurrentPosition && nextIndent === currentIndent) {
                        // Same indentation level - check if it's an array item
                        this.lexer.skipWhitespace();
                        if (this.lexer.getCurrentChar() === '-') {
                            value = this.parseBlockArray(currentIndent);
                        }
                        else {
                            value = createStringNode('', valueStart, valueStart);
                        }
                    }
                    else {
                        value = createStringNode('', valueStart, valueStart);
                    }
                }
                else {
                    value = createStringNode('', valueStart, valueStart);
                }
            }
            else {
                // Value is on the same line
                value = this.parseValue();
                // Skip any remaining content on this line (comments, etc.)
                while (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() !== '' && this.lexer.getCurrentChar() !== '#') {
                    if (isWhitespace(this.lexer.getCurrentChar())) {
                        this.lexer.advance();
                    }
                    else {
                        break;
                    }
                }
                // Skip to end of line if we hit a comment
                if (this.lexer.getCurrentChar() === '#') {
                    this.lexer.skipToEndOfLine();
                }
                // Move to next line for next iteration
                if (!this.lexer.isAtEnd() && this.lexer.getCurrentChar() === '') {
                    this.lexer.advanceLine();
                }
            }
            properties.push({ key, value });
        }
        // Calculate the end position based on the last property
        let end = start;
        if (properties.length > 0) {
            const lastProperty = properties[properties.length - 1];
            end = lastProperty.value.end;
        }
        return createObjectNode(properties, start, end);
    }
    parse() {
        if (this.lexer.isAtEnd()) {
            return undefined;
        }
        this.lexer.moveToNextNonEmptyLine();
        if (this.lexer.isAtEnd()) {
            return undefined;
        }
        // Determine the root structure type
        this.lexer.skipWhitespace();
        if (this.lexer.getCurrentChar() === '-') {
            // Check if this is an array item or a negative number
            // Look at the character after the dash
            const nextChar = this.lexer.peek();
            if (nextChar === ' ' || nextChar === '\t' || nextChar === '' || nextChar === '#') {
                // It's an array item (dash followed by whitespace/end/comment)
                return this.parseBlockArray(0);
            }
            else {
                // It's likely a negative number or other value, treat as single value
                return this.parseValue();
            }
        }
        else if (this.lexer.getCurrentChar() === '[') {
            // Root is an inline array
            return this.parseInlineArray();
        }
        else if (this.lexer.getCurrentChar() === '{') {
            // Root is an inline object
            return this.parseInlineObject();
        }
        else {
            // Check if this looks like a key-value pair by looking for a colon
            // For single values, there shouldn't be a colon
            const currentLine = this.lexer.getCurrentLineText();
            const currentPos = this.lexer.getCurrentCharNumber();
            const remainingLine = currentLine.substring(currentPos);
            // Check if there's a colon that's not inside quotes
            let hasColon = false;
            let inQuotes = false;
            let quoteChar = '';
            for (let i = 0; i < remainingLine.length; i++) {
                const char = remainingLine[i];
                if (!inQuotes && (char === '"' || char === `'`)) {
                    inQuotes = true;
                    quoteChar = char;
                }
                else if (inQuotes && char === quoteChar) {
                    inQuotes = false;
                    quoteChar = '';
                }
                else if (!inQuotes && char === ':') {
                    hasColon = true;
                    break;
                }
                else if (!inQuotes && char === '#') {
                    // Comment starts, stop looking
                    break;
                }
            }
            if (hasColon) {
                // Root is an object
                return this.parseBlockObject(0);
            }
            else {
                // Root is a single value
                return this.parseValue();
            }
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieWFtbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi95YW1sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJHO0FBQ0gsTUFBTSxVQUFVLEtBQUssQ0FBQyxLQUFhLEVBQUUsU0FBMkIsRUFBRSxFQUFFLFVBQXdCLEVBQUU7SUFDN0YsMEdBQTBHO0lBQzFHLG1FQUFtRTtJQUNuRSxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQy9ELE1BQU0sTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdEQsT0FBTyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDdkIsQ0FBQztBQThERCxrREFBa0Q7QUFDbEQsU0FBUyxjQUFjLENBQUMsSUFBWSxFQUFFLFNBQWlCO0lBQ3RELE9BQU8sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLENBQUM7QUFDNUIsQ0FBQztBQUVELG9FQUFvRTtBQUNwRSxTQUFTLGdCQUFnQixDQUFDLEtBQWEsRUFBRSxLQUFlLEVBQUUsR0FBYTtJQUN0RSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQzlDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLEtBQWEsRUFBRSxLQUFlLEVBQUUsR0FBYTtJQUN0RSxPQUFPLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQzlDLENBQUM7QUFFRCxTQUFTLGlCQUFpQixDQUFDLEtB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