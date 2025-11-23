/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../../base/common/event.js';
import severity from '../../../../base/common/severity.js';
import { isObject, isString } from '../../../../base/common/types.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import * as nls from '../../../../nls.js';
import { ExpressionContainer } from './debugModel.js';
let topReplElementCounter = 0;
const getUniqueId = () => `topReplElement:${topReplElementCounter++}`;
/**
 * General case of data from DAP the `output` event. {@link ReplVariableElement}
 * is used instead only if there is a `variablesReference` with no `output` text.
 */
export class ReplOutputElement {
    constructor(session, id, value, severity, sourceData, expression) {
        this.session = session;
        this.id = id;
        this.value = value;
        this.severity = severity;
        this.sourceData = sourceData;
        this.expression = expression;
        this._count = 1;
        this._onDidChangeCount = new Emitter();
    }
    toString(includeSource = false) {
        let valueRespectCount = this.value;
        for (let i = 1; i < this.count; i++) {
            valueRespectCount += (valueRespectCount.endsWith('\n') ? '' : '\n') + this.value;
        }
        const sourceStr = (this.sourceData && includeSource) ? ` ${this.sourceData.source.name}` : '';
        return valueRespectCount + sourceStr;
    }
    getId() {
        return this.id;
    }
    getChildren() {
        return this.expression?.getChildren() || Promise.resolve([]);
    }
    set count(value) {
        this._count = value;
        this._onDidChangeCount.fire();
    }
    get count() {
        return this._count;
    }
    get onDidChangeCount() {
        return this._onDidChangeCount.event;
    }
    get hasChildren() {
        return !!this.expression?.hasChildren;
    }
}
/** Top-level variable logged via DAP output when there's no `output` string */
export class ReplVariableElement {
    constructor(session, expression, severity, sourceData) {
        this.session = session;
        this.expression = expression;
        this.severity = severity;
        this.sourceData = sourceData;
        this.id = generateUuid();
        this.hasChildren = expression.hasChildren;
    }
    getSession() {
        return this.session;
    }
    getChildren() {
        return this.expression.getChildren();
    }
    toString() {
        return this.expression.toString();
    }
    getId() {
        return this.id;
    }
}
export class RawObjectReplElement {
    static { this.MAX_CHILDREN = 1000; } // upper bound of children per value
    constructor(id, name, valueObj, sourceData, annotation) {
        this.id = id;
        this.name = name;
        this.valueObj = valueObj;
        this.sourceData = sourceData;
        this.annotation = annotation;
    }
    getId() {
        return this.id;
    }
    getSession() {
        return undefined;
    }
    get value() {
        if (this.valueObj === null) {
            return 'null';
        }
        else if (Array.isArray(this.valueObj)) {
            return `Array[${this.valueObj.length}]`;
        }
        else if (isObject(this.valueObj)) {
            return 'Object';
        }
        else if (isString(this.valueObj)) {
            return `"${this.valueObj}"`;
        }
        return String(this.valueObj) || '';
    }
    get hasChildren() {
        return (Array.isArray(this.valueObj) && this.valueObj.length > 0) || (isObject(this.valueObj) && Object.getOwnPropertyNames(this.valueObj).length > 0);
    }
    evaluateLazy() {
        throw new Error('Method not implemented.');
    }
    getChildren() {
        let result = [];
        if (Array.isArray(this.valueObj)) {
            result = this.valueObj.slice(0, RawObjectReplElement.MAX_CHILDREN)
                .map((v, index) => new RawObjectReplElement(`${this.id}:${index}`, String(index), v));
        }
        else if (isObject(this.valueObj)) {
            result = Object.getOwnPropertyNames(this.valueObj).slice(0, RawObjectReplElement.MAX_CHILDREN)
                .map((key, index) => new RawObjectReplElement(`${this.id}:${index}`, key, this.valueObj[key]));
        }
        return Promise.resolve(result);
    }
    toString() {
        return `${this.name}\n${this.value}`;
    }
}
export class ReplEvaluationInput {
    constructor(value) {
        this.value = value;
        this.id = generateUuid();
    }
    toString() {
        return this.value;
    }
    getId() {
        return this.id;
    }
}
export class ReplEvaluationResult extends ExpressionContainer {
    get available() {
        return this._available;
    }
    constructor(originalExpression) {
        super(undefined, undefined, 0, generateUuid());
        this.originalExpression = originalExpression;
        this._available = true;
    }
    async evaluateExpression(expression, session, stackFrame, context) {
        const result = await super.evaluateExpression(expression, session, stackFrame, context);
        this._available = result;
        return result;
    }
    toString() {
        return `${this.value}`;
    }
}
export class ReplGroup {
    static { this.COUNTER = 0; }
    constructor(session, name, autoExpand, sourceData) {
        this.session = session;
        this.name = name;
        this.autoExpand = autoExpand;
        this.sourceData = sourceData;
        this.children = [];
        this.ended = false;
        this.id = `replGroup:${ReplGroup.COUNTER++}`;
    }
    get hasChildren() {
        return true;
    }
    getId() {
        return this.id;
    }
    toString(includeSource = false) {
        const sourceStr = (includeSource && this.sourceData) ? ` ${this.sourceData.source.name}` : '';
        return this.name + sourceStr;
    }
    addChild(child) {
        const lastElement = this.children.length ? this.children[this.children.length - 1] : undefined;
        if (lastElement instanceof ReplGroup && !lastElement.hasEnded) {
            lastElement.addChild(child);
        }
        else {
            this.children.push(child);
        }
    }
    getChildren() {
        return this.children;
    }
    end() {
        const lastElement = this.children.length ? this.children[this.children.length - 1] : undefined;
        if (lastElement instanceof ReplGroup && !lastElement.hasEnded) {
            lastElement.end();
        }
        else {
            this.ended = true;
        }
    }
    get hasEnded() {
        return this.ended;
    }
}
function areSourcesEqual(first, second) {
    if (!first && !second) {
        return true;
    }
    if (first && second) {
        return first.column === second.column && first.lineNumber === second.lineNumber && first.source.uri.toString() === second.source.uri.toString();
    }
    return false;
}
export class ReplModel {
    constructor(configurationService) {
        this.configurationService = configurationService;
        this.replElements = [];
        this._onDidChangeElements = new Emitter();
        this.onDidChangeElements = this._onDidChangeElements.event;
    }
    getReplElements() {
        return this.replElements;
    }
    async addReplExpression(session, stackFrame, expression) {
        this.addReplElement(new ReplEvaluationInput(expression));
        const result = new ReplEvaluationResult(expression);
        await result.evaluateExpression(expression, session, stackFrame, 'repl');
        this.addReplElement(result);
    }
    appendToRepl(session, { output, expression, sev, source }) {
        const clearAnsiSequence = '\u001b[2J';
        const clearAnsiIndex = output.lastIndexOf(clearAnsiSequence);
        if (clearAnsiIndex !== -1) {
            // [2J is the ansi escape sequence for clearing the display http://ascii-table.com/ansi-escape-sequences.php
            this.removeReplExpressions();
            this.appendToRepl(session, { output: nls.localize('consoleCleared', "Console was cleared"), sev: severity.Ignore });
            output = output.substring(clearAnsiIndex + clearAnsiSequence.length);
        }
        if (expression) {
            // if there is an output string, prefer to show that, since the DA could
            // have formatted it nicely e.g. with ANSI color codes.
            this.addReplElement(output
                ? new ReplOutputElement(session, getUniqueId(), output, sev, source, expression)
                : new ReplVariableElement(session, expression, sev, source));
            return;
        }
        this.appendOutputToRepl(session, output, sev, source);
    }
    appendOutputToRepl(session, output, sev, source) {
        const config = this.configurationService.getValue('debug');
        const previousElement = this.replElements.length ? this.replElements[this.replElements.length - 1] : undefined;
        // Handle concatenation of incomplete lines first
        if (previousElement instanceof ReplOutputElement && previousElement.severity === sev && areSourcesEqual(previousElement.sourceData, source)) {
            if (!previousElement.value.endsWith('\n') && !previousElement.value.endsWith('\r\n') && previousElement.count === 1) {
                // Concatenate with previous incomplete line
                const combinedOutput = previousElement.value + output;
                this.replElements[this.replElements.length - 1] = new ReplOutputElement(session, getUniqueId(), combinedOutput, sev, source);
                this._onDidChangeElements.fire(undefined);
                // If the combined output now forms a complete line and collapsing is enabled,
                // check if it can be collapsed with previous elements
                if (config.console.collapseIdenticalLines && combinedOutput.endsWith('\n')) {
                    this.tryCollapseCompleteLine(sev, source);
                }
                // If the combined output contains multiple lines, apply line-level collapsing
                if (config.console.collapseIdenticalLines && combinedOutput.includes('\n')) {
                    const lines = this.splitIntoLines(combinedOutput);
                    if (lines.length > 1) {
                        this.applyLineLevelCollapsing(session, sev, source);
                    }
                }
                return;
            }
        }
        // If collapsing is enabled and the output contains line breaks, parse and collapse at line level
        if (config.console.collapseIdenticalLines && output.includes('\n')) {
            this.processMultiLineOutput(session, output, sev, source);
        }
        else {
            // For simple output without line breaks, use the original logic
            if (previousElement instanceof ReplOutputElement && previousElement.severity === sev && areSourcesEqual(previousElement.sourceData, source)) {
                if (previousElement.value === output && config.console.collapseIdenticalLines) {
                    previousElement.count++;
                    // No need to fire an event, just the count updates and badge will adjust automatically
                    return;
                }
            }
            const element = new ReplOutputElement(session, getUniqueId(), output, sev, source);
            this.addReplElement(element);
        }
    }
    tryCollapseCompleteLine(sev, source) {
        // Try to collapse the last element with the second-to-last if they are identical complete lines
        if (this.replElements.length < 2) {
            return;
        }
        const lastElement = this.replElements[this.replElements.length - 1];
        const secondToLastElement = this.replElements[this.replElements.length - 2];
        if (lastElement instanceof ReplOutputElement &&
            secondToLastElement instanceof ReplOutputElement &&
            lastElement.severity === sev &&
            secondToLastElement.severity === sev &&
            areSourcesEqual(lastElement.sourceData, source) &&
            areSourcesEqual(secondToLastElement.sourceData, source) &&
            lastElement.value === secondToLastElement.value &&
            lastElement.count === 1 &&
            lastElement.value.endsWith('\n')) {
            // Collapse the last element into the second-to-last
            secondToLastElement.count += lastElement.count;
            this.replElements.pop();
            this._onDidChangeElements.fire(undefined);
        }
    }
    processMultiLineOutput(session, output, sev, source) {
        // Split output into lines, preserving line endings
        const lines = this.splitIntoLines(output);
        for (const line of lines) {
            if (line.length === 0) {
                continue;
            }
            const previousElement = this.replElements.length ? this.replElements[this.replElements.length - 1] : undefined;
            // Check if this line can be collapsed with the previous one
            if (previousElement instanceof ReplOutputElement &&
                previousElement.severity === sev &&
                areSourcesEqual(previousElement.sourceData, source) &&
                previousElement.value === line) {
                previousElement.count++;
                // No need to fire an event, just the count updates and badge will adjust automatically
            }
            else {
                const element = new ReplOutputElement(session, getUniqueId(), line, sev, source);
                this.addReplElement(element);
            }
        }
    }
    splitIntoLines(text) {
        // Split text into lines while preserving line endings, using indexOf for efficiency
        const lines = [];
        let start = 0;
        while (start < text.length) {
            const nextLF = text.indexOf('\n', start);
            if (nextLF === -1) {
                lines.push(text.substring(start));
                break;
            }
            lines.push(text.substring(start, nextLF + 1));
            start = nextLF + 1;
        }
        return lines;
    }
    applyLineLevelCollapsing(session, sev, source) {
        // Apply line-level collapsing to the last element if it contains multiple lines
        const lastElement = this.replElements[this.replElements.length - 1];
        if (!(lastElement instanceof ReplOutputElement) || lastElement.severity !== sev || !areSourcesEqual(lastElement.sourceData, source)) {
            return;
        }
        const lines = this.splitIntoLines(lastElement.value);
        if (lines.length <= 1) {
            return; // No multiple lines to collapse
        }
        // Remove the last element and reprocess it as multiple lines
        this.replElements.pop();
        // Process each line and try to collapse with existing elements
        for (const line of lines) {
            if (line.length === 0) {
                continue;
            }
            const previousElement = this.replElements.length ? this.replElements[this.replElements.length - 1] : undefined;
            // Check if this line can be collapsed with the previous one
            if (previousElement instanceof ReplOutputElement &&
                previousElement.severity === sev &&
                areSourcesEqual(previousElement.sourceData, source) &&
                previousElement.value === line) {
                previousElement.count++;
            }
            else {
                const element = new ReplOutputElement(session, getUniqueId(), line, sev, source);
                this.addReplElement(element);
            }
        }
        this._onDidChangeElements.fire(undefined);
    }
    startGroup(session, name, autoExpand, sourceData) {
        const group = new ReplGroup(session, name, autoExpand, sourceData);
        this.addReplElement(group);
    }
    endGroup() {
        const lastElement = this.replElements[this.replElements.length - 1];
        if (lastElement instanceof ReplGroup) {
            lastElement.end();
        }
    }
    addReplElement(newElement) {
        const lastElement = this.replElements.length ? this.replElements[this.replElements.length - 1] : undefined;
        if (lastElement instanceof ReplGroup && !lastElement.hasEnded) {
            lastElement.addChild(newElement);
        }
        else {
            this.replElements.push(newElement);
            const config = this.configurationService.getValue('debug');
            if (this.replElements.length > config.console.maximumLines) {
                this.replElements.splice(0, this.replElements.length - config.console.maximumLines);
            }
        }
        this._onDidChangeElements.fire(newElement);
    }
    removeReplExpressions() {
        if (this.replElements.length > 0) {
            this.replElements = [];
            this._onDidChangeElements.fire(undefined);
        }
    }
    /** Returns a new REPL model that's a copy of this one. */
    clone() {
        const newRepl = new ReplModel(this.configurationService);
        newRepl.replElements = this.replElements.slice();
        return newRepl;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwbE1vZGVsLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2RlYnVnL2NvbW1vbi9yZXBsTW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE9BQU8sRUFBUyxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sUUFBUSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDdEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQy9ELE9BQU8sS0FBSyxHQUFHLE1BQU0sb0JBQW9CLENBQUM7QUFHMUMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFFdEQsSUFBSSxxQkFBcUIsR0FBRyxDQUFDLENBQUM7QUFDOUIsTUFBTSxXQUFXLEdBQUcsR0FBRyxFQUFFLENBQUMsa0JBQWtCLHFCQUFxQixFQUFFLEVBQUUsQ0FBQztBQUV0RTs7O0dBR0c7QUFDSCxNQUFNLE9BQU8saUJBQWlCO0lBSzdCLFlBQ1EsT0FBc0IsRUFDckIsRUFBVSxFQUNYLEtBQWEsRUFDYixRQUFrQixFQUNsQixVQUErQixFQUN0QixVQUF3QjtRQUxqQyxZQUFPLEdBQVAsT0FBTyxDQUFlO1FBQ3JCLE9BQUUsR0FBRixFQUFFLENBQVE7UUFDWCxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQ2IsYUFBUSxHQUFSLFFBQVEsQ0FBVTtRQUNsQixlQUFVLEdBQVYsVUFBVSxDQUFxQjtRQUN0QixlQUFVLEdBQVYsVUFBVSxDQUFjO1FBVGpDLFdBQU0sR0FBRyxDQUFDLENBQUM7UUFDWCxzQkFBaUIsR0FBRyxJQUFJLE9BQU8sRUFBUSxDQUFDO0lBVWhELENBQUM7SUFFRCxRQUFRLENBQUMsYUFBYSxHQUFHLEtBQUs7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