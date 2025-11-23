/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { createFastDomNode } from '../../../base/browser/fastDomNode.js';
import { createTrustedTypesPolicy } from '../../../base/browser/trustedTypes.js';
import { BugIndicatingError } from '../../../base/common/errors.js';
import { StringBuilder } from '../../common/core/stringBuilder.js';
export class RenderedLinesCollection {
    constructor(_lineFactory) {
        this._lineFactory = _lineFactory;
        this._set(1, []);
    }
    flush() {
        this._set(1, []);
    }
    _set(rendLineNumberStart, lines) {
        this._lines = lines;
        this._rendLineNumberStart = rendLineNumberStart;
    }
    _get() {
        return {
            rendLineNumberStart: this._rendLineNumberStart,
            lines: this._lines
        };
    }
    /**
     * @returns Inclusive line number that is inside this collection
     */
    getStartLineNumber() {
        return this._rendLineNumberStart;
    }
    /**
     * @returns Inclusive line number that is inside this collection
     */
    getEndLineNumber() {
        return this._rendLineNumberStart + this._lines.length - 1;
    }
    getCount() {
        return this._lines.length;
    }
    getLine(lineNumber) {
        const lineIndex = lineNumber - this._rendLineNumberStart;
        if (lineIndex < 0 || lineIndex >= this._lines.length) {
            throw new BugIndicatingError('Illegal value for lineNumber');
        }
        return this._lines[lineIndex];
    }
    /**
     * @returns Lines that were removed from this collection
     */
    onLinesDeleted(deleteFromLineNumber, deleteToLineNumber) {
        if (this.getCount() === 0) {
            // no lines
            return null;
        }
        const startLineNumber = this.getStartLineNumber();
        const endLineNumber = this.getEndLineNumber();
        if (deleteToLineNumber < startLineNumber) {
            // deleting above the viewport
            const deleteCnt = deleteToLineNumber - deleteFromLineNumber + 1;
            this._rendLineNumberStart -= deleteCnt;
            return null;
        }
        if (deleteFromLineNumber > endLineNumber) {
            // deleted below the viewport
            return null;
        }
        // Record what needs to be deleted
        let deleteStartIndex = 0;
        let deleteCount = 0;
        for (let lineNumber = startLineNumber; lineNumber <= endLineNumber; lineNumber++) {
            const lineIndex = lineNumber - this._rendLineNumberStart;
            if (deleteFromLineNumber <= lineNumber && lineNumber <= deleteToLineNumber) {
                // this is a line to be deleted
                if (deleteCount === 0) {
                    // this is the first line to be deleted
                    deleteStartIndex = lineIndex;
                    deleteCount = 1;
                }
                else {
                    deleteCount++;
                }
            }
        }
        // Adjust this._rendLineNumberStart for lines deleted above
        if (deleteFromLineNumber < startLineNumber) {
            // Something was deleted above
            let deleteAboveCount = 0;
            if (deleteToLineNumber < startLineNumber) {
                // the entire deleted lines are above
                deleteAboveCount = deleteToLineNumber - deleteFromLineNumber + 1;
            }
            else {
                deleteAboveCount = startLineNumber - deleteFromLineNumber;
            }
            this._rendLineNumberStart -= deleteAboveCount;
        }
        const deleted = this._lines.splice(deleteStartIndex, deleteCount);
        return deleted;
    }
    onLinesChanged(changeFromLineNumber, changeCount) {
        const changeToLineNumber = changeFromLineNumber + changeCount - 1;
        if (this.getCount() === 0) {
            // no lines
            return false;
        }
        const startLineNumber = this.getStartLineNumber();
        const endLineNumber = this.getEndLineNumber();
        let someoneNotified = false;
        for (let changedLineNumber = changeFromLineNumber; changedLineNumber <= changeToLineNumber; changedLineNumber++) {
            if (changedLineNumber >= startLineNumber && changedLineNumber <= endLineNumber) {
                // Notify the line
                this._lines[changedLineNumber - this._rendLineNumberStart].onContentChanged();
                someoneNotified = true;
            }
        }
        return someoneNotified;
    }
    onLinesInserted(insertFromLineNumber, insertToLineNumber) {
        if (this.getCount() === 0) {
            // no lines
            return null;
        }
        const insertCnt = insertToLineNumber - insertFromLineNumber + 1;
        const startLineNumber = this.getStartLineNumber();
        const endLineNumber = this.getEndLineNumber();
        if (insertFromLineNumber <= startLineNumber) {
            // inserting above the viewport
            this._rendLineNumberStart += insertCnt;
            return null;
        }
        if (insertFromLineNumber > endLineNumber) {
            // inserting below the viewport
            return null;
        }
        if (insertCnt + insertFromLineNumber > endLineNumber) {
            // insert inside the viewport in such a way that all remaining lines are pushed outside
            const deleted = this._lines.splice(insertFromLineNumber - this._rendLineNumberStart, endLineNumber - insertFromLineNumber + 1);
            return deleted;
        }
        // insert inside the viewport, push out some lines, but not all remaining lines
        const newLines = [];
        for (let i = 0; i < insertCnt; i++) {
            newLines[i] = this._lineFactory.createLine();
        }
        const insertIndex = insertFromLineNumber - this._rendLineNumberStart;
        const beforeLines = this._lines.slice(0, insertIndex);
        const afterLines = this._lines.slice(insertIndex, this._lines.length - insertCnt);
        const deletedLines = this._lines.slice(this._lines.length - insertCnt, this._lines.length);
        this._lines = beforeLines.concat(newLines).concat(afterLines);
        return deletedLines;
    }
    onTokensChanged(ranges) {
        if (this.getCount() === 0) {
            // no lines
            return false;
        }
        const startLineNumber = this.getStartLineNumber();
        const endLineNumber = this.getEndLineNumber();
        let notifiedSomeone = false;
        for (let i = 0, len = ranges.length; i < len; i++) {
            const rng = ranges[i];
            if (rng.toLineNumber < startLineNumber || rng.fromLineNumber > endLineNumber) {
                // range outside viewport
                continue;
            }
            const from = Math.max(startLineNumber, rng.fromLineNumber);
            const to = Math.min(endLineNumber, rng.toLineNumber);
            for (let lineNumber = from; lineNumber <= to; lineNumber++) {
                const lineIndex = lineNumber - this._rendLineNumberStart;
                this._lines[lineIndex].onTokensChanged();
                notifiedSomeone = true;
            }
        }
        return notifiedSomeone;
    }
}
export class VisibleLinesCollection {
    constructor(_viewContext, _lineFactory) {
        this._viewContext = _viewContext;
        this._lineFactory = _lineFactory;
        this.domNode = this._createDomNode();
        this._linesCollection = new RenderedLinesCollection(this._lineFactory);
    }
    _createDomNode() {
        const domNode = createFastDomNode(document.createElement('div'));
        domNode.setClassName('view-layer');
        domNode.setPosition('absolute');
        domNode.domNode.setAttribute('role', 'presentation');
        domNode.domNode.setAttribute('aria-hidden', 'true');
        return domNode;
    }
    // ---- begin view event handlers
    onConfigurationChanged(e) {
        if (e.hasChanged(165 /* EditorOption.layoutInfo */)) {
            return true;
        }
        return false;
    }
    onFlushed(e, flushDom) {
        // No need to clear the dom node because a full .innerHTML will occur in
        // ViewLayerRenderer._render, however the fallback mechanism in the
        // GPU renderer may cause this to be necessary as the .innerHTML call
        // may not happen depending on the new state, leaving stale DOM nodes
        // around.
        if (flushDom) {
            const start = this._linesCollection.getStartLineNumber();
            const end = this._linesCollection.getEndLineNumber();
            for (let i = start; i <= end; i++) {
                this._linesCollection.getLine(i).getDomNode()?.remove();
            }
        }
        this._linesCollection.flush();
        return true;
    }
    onLinesChanged(e) {
        return this._linesCollection.onLinesChanged(e.fromLineNumber, e.count);
    }
    onLinesDeleted(e) {
        const deleted = this._linesCollection.onLinesDeleted(e.fromLineNumber, e.toLineNumber);
        if (deleted) {
            // Remove from DOM
            for (let i = 0, len = deleted.length; i < len; i++) {
                const lineDomNode = deleted[i].getDomNode();
                lineDomNode?.remove();
            }
        }
        return true;
    }
    onLinesInserted(e) {
        const deleted = this._linesCollection.onLinesInserted(e.fromLineNumber, e.toLineNumber);
        if (deleted) {
            // Remove from DOM
            for (let i = 0, len = deleted.length; i < len; i++) {
                const lineDomNode = deleted[i].getDomNode();
                lineDomNode?.remove();
            }
        }
        return true;
    }
    onScrollChanged(e) {
        return e.scrollTopChanged;
    }
    onTokensChanged(e) {
        return this._linesCollection.onTokensChanged(e.ranges);
    }
    onZonesChanged(e) {
        return true;
    }
    // ---- end view event handlers
    getStartLineNumber() {
        return this._linesCollection.getStartLineNumber();
    }
    getEndLineNumber() {
        return this._linesCollection.getEndLineNumber();
    }
    getVisibleLine(lineNumber) {
        return this._linesCollection.getLine(lineNumber);
    }
    renderLines(viewportData) {
        const inp = this._linesCollection._get();
        const renderer = new ViewLayerRenderer(this.domNode.domNode, this._lineFactory, viewportData, this._viewContext);
        const ctx = {
            rendLineNumberStart: inp.rendLineNumberStart,
            lines: inp.lines,
            linesLength: inp.lines.length
        };
        // Decide if this render will do a single update (single large .innerHTML) or many updates (inserting/removing dom nodes)
        const resCtx = renderer.render(ctx, viewportData.startLineNumber, viewportData.endLineNumber, viewportData.relativeVerticalOffset);
        this._linesCollection._set(resCtx.rendLineNumberStart, resCtx.lines);
    }
}
class ViewLayerRenderer {
    static { this._ttPolicy = createTrustedTypesPolicy('editorViewLayer', { createHTML: value => value }); }
    constructor(_domNode, _lineFactory, _viewportData, _viewContext) {
        this._domNode = _domNode;
        this._lineFactory = _lineFactory;
        this._viewportData = _viewportData;
        this._viewContext = _viewContext;
    }
    render(inContext, startLineNumber, stopLineNumber, deltaTop) {
        const ctx = {
            rendLineNumberStart: inContext.rendLineNumberStart,
            lines: inContext.lines.slice(0),
            linesLength: inContext.linesLength
        };
        if ((ctx.rendLineNumberStart + ctx.linesLength - 1 < startLineNumber) || (stopLineNumber < ctx.rendLineNumberStart)) {
            // There is no overlap whatsoever
            ctx.rendLineNumberStart = startLineNumber;
            ctx.linesLength = stopLineNumber - startLineNumber + 1;
            ctx.lines = [];
            for (let x = startLineNumber; x <= stopLineNumber; x++) {
                ctx.lines[x - startLineNumber] = this._lineFactory.createLine();
            }
            this._finishRendering(ctx, true, deltaTop);
            return ctx;
        }
        // Update lines which will remain untouched
        this._renderUntouchedLines(ctx, Math.max(startLineNumber - ctx.rendLineNumberStart, 0), Math.min(stopLineNumber - ctx.rendLineNumberStart, ctx.linesLength - 1), deltaTop, startLineNumber);
        if (ctx.rendLineNumberStart > startLineNumber) {
            // Insert lines before
            const fromLineNumber = startLineNumber;
            const toLineNumber = Math.min(stopLineNumber, ctx.rendLineNumberStart - 1);
            if (fromLineNumber <= toLineNumber) {
                this._insertLinesBefore(ctx, fromLineNumber, toLineNumber, deltaTop, startLineNumber);
                ctx.linesLength += toLineNumber - fromLineNumber + 1;
            }
        }
        else if (ctx.rendLineNumberStart < startLineNumber) {
            // Remove lines before
            const removeCnt = Math.min(ctx.linesLength, startLineNumber - ctx.rendLineNumberStart);
            if (removeCnt > 0) {
                this._removeLinesBefore(ctx, removeCnt);
                ctx.linesLength -= removeCnt;
            }
        }
        ctx.rendLineNumberStart = startLineNumber;
        if (ctx.rendLineNumberStart + ctx.linesLength - 1 < stopLineNumber) {
            // Insert lines after
            const fromLineNumber = ctx.rendLineNumberStart + ctx.linesLength;
            const toLineNumber = stopLineNumber;
            if (fromLineNumber <= toLineNumber) {
                this._insertLinesAfter(ctx, fromLineNumber, toLineNumber, deltaTop, startLineNumber);
                ctx.linesLength += toLineNumber - fromLineNumber + 1;
            }
        }
        else if (ctx.rendLineNumberStart + ctx.linesLength - 1 > stopLineNumber) {
            // Remove lines after
            const fromLineNumber = Math.max(0, stopLineNumber - ctx.rendLineNumberStart + 1);
            const toLineNumber = ctx.linesLength - 1;
            const removeCnt = toLineNumber - fromLineNumber + 1;
            if (removeCnt > 0) {
                this._removeLinesAfter(ctx, removeCnt);
                ctx.linesLength -= removeCnt;
            }
        }
        this._finishRendering(ctx, false, deltaTop);
        return ctx;
    }
    _renderUntouchedLines(ctx, startIndex, endIndex, deltaTop, deltaLN) {
        const rendLineNumberStart = ctx.rendLineNumberStart;
        const lines = ctx.lines;
        for (let i = startIndex; i <= endIndex; i++) {
            const lineNumber = rendLineNumberStart + i;
            lines[i].layoutLine(lineNumber, deltaTop[lineNumber - deltaLN], this._lineHeightForLineNumber(lineNumber));
        }
    }
    _insertLinesBefore(ctx, fromLineNumber, toLineNumber, deltaTop, deltaLN) {
        const newLines = [];
        let newLinesLen = 0;
        for (let lineNumber = fromLineNumber; lineNumber <= toLineNumber; lineNumber++) {
            newLines[newLinesLen++] = this._lineFactory.createLine();
        }
        ctx.lines = newLines.concat(ctx.lines);
    }
    _removeLinesBefore(ctx, removeCount) {
        for (let i = 0; i < removeCount; i++) {
            const lineDomNode = ctx.lines[i].getDomNode();
            lineDomNode?.remove();
        }
        ctx.lines.splice(0, removeCount);
    }
    _insertLinesAfter(ctx, fromLineNumber, toLineNumber, deltaTop, deltaLN) {
        const newLines = [];
        let newLinesLen = 0;
        for (let lineNumber = fromLineNumber; lineNumber <= toLineNumber; lineNumber++) {
            newLines[newLinesLen++] = this._lineFactory.createLine();
        }
        ctx.lines = ctx.lines.concat(newLines);
    }
    _removeLinesAfter(ctx, removeCount) {
        const removeIndex = ctx.linesLength - removeCount;
        for (let i = 0; i < removeCount; i++) {
            const lineDomNode = ctx.lines[removeIndex + i].getDomNode();
            lineDomNode?.remove();
        }
        ctx.lines.splice(removeIndex, removeCount);
    }
    _finishRenderingNewLines(ctx, domNodeIsEmpty, newLinesHTML, wasNew) {
        if (ViewLayerRenderer._ttPolicy) {
            newLinesHTML = ViewLayerRenderer._ttPolicy.createHTML(newLinesHTML);
        }
        const lastChild = this._domNode.lastChild;
        if (domNodeIsEmpty || !lastChild) {
            this._domNode.innerHTML = newLinesHTML; // explains the ugly casts -> https://github.com/microsoft/vscode/issues/106396#issuecomment-692625393;
        }
        else {
            lastChild.insertAdjacentHTML('afterend', newLinesHTML);
        }
        let currChild = this._domNode.lastChild;
        for (let i = ctx.linesLength - 1; i >= 0; i--) {
            const line = ctx.lines[i];
            if (wasNew[i]) {
                line.setDomNode(currChild);
                currChild = currChild.previousSibling;
            }
        }
    }
    _finishRenderingInvalidLines(ctx, invalidLinesHTML, wasInvalid) {
        const hugeDomNode = document.createElement('div');
        if (ViewLayerRenderer._ttPolicy) {
            invalidLinesHTML = ViewLayerRenderer._ttPolicy.createHTML(invalidLinesHTML);
        }
        hugeDomNode.innerHTML = invalidLinesHTML;
        for (let i = 0; i < ctx.linesLength; i++) {
            const line = ctx.lines[i];
            if (wasInvalid[i]) {
                const source = hugeDomNode.firstChild;
                const lineDomNode = line.getDomNode();
                lineDomNode.replaceWith(source);
                line.setDomNode(source);
            }
        }
    }
    static { this._sb = new StringBuilder(100000); }
    _finishRendering(ctx, domNodeIsEmpty, deltaTop) {
        const sb = ViewLayerRenderer._sb;
        const linesLength = ctx.linesLength;
        const lines = ctx.lines;
        const rendLineNumberStart = ctx.rendLineNumberStart;
        const wasNew = [];
        {
            sb.reset();
            let hadNewLine = false;
            for (let i = 0; i < linesLength; i++) {
                const line = lines[i];
                wasNew[i] = false;
                const lineDomNode = line.getDomNode();
                if (lineDomNode) {
                    // line is not new
                    continue;
                }
                const renderedLineNumber = i + rendLineNumberStart;
                const renderResult = line.renderLine(renderedLineNumber, deltaTop[i], this._lineHeightForLineNumber(renderedLineNumber), this._viewportData, sb);
                if (!renderResult) {
                    // line does not need rendering
                    continue;
                }
                wasNew[i] = true;
                hadNewLine = true;
            }
            if (hadNewLine) {
                this._finishRenderingNewLines(ctx, domNodeIsEmpty, sb.build(), wasNew);
            }
        }
        {
            sb.reset();
            let hadInvalidLine = false;
            const wasInvalid = [];
            for (let i = 0; i < linesLength; i++) {
                const line = lines[i];
                wasInvalid[i] = false;
                if (wasNew[i]) {
                    // line was new
                    continue;
                }
                const renderedLineNumber = i + rendLineNumberStart;
                const renderResult = line.renderLine(renderedLineNumber, deltaTop[i], this._lineHeightForLineNumber(renderedLineNumber), this._viewportData, sb);
                if (!renderResult) {
                    // line does not need rendering
                    continue;
                }
                wasInvalid[i] = true;
                hadInvalidLine = true;
            }
            if (hadInvalidLine) {
                this._finishRenderingInvalidLines(ctx, sb.build(), wasInvalid);
            }
        }
    }
    _lineHeightForLineNumber(lineNumber) {
        return this._viewContext.viewLayout.getLineHeightForLineNumber(lineNumber);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0xheWVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL3ZpZXcvdmlld0xheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBZSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ3RGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBRXBFLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQWlDbkUsTUFBTSxPQUFPLHVCQUF1QjtJQUluQyxZQUNrQixZQUE2QjtRQUE3QixpQkFBWSxHQUFaLFlBQVksQ0FBaUI7UUFFOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbEIsQ0FBQztJQUVNLEtBQUs7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNsQixDQUFDO0lBRUQsSUFBSSxDQUFDLG1CQUEyQixFQUFFLEtBQVU7UUFDM0MsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUM7UUFDcEIsSUFBSSxDQUFDLG9CQUFvQixHQUFHLG1CQUFtQixDQUFDO0lBQ2pELENBQUM7SUFFRCxJQUFJO1FBQ0gsT0FBTztZQUNOLG1CQUFtQixFQUFFLElBQUksQ0FBQyxvQkFBb0I7WUFDOUMsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNO1NBQ2xCLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxrQkFBa0I7UUFDeEIsT0FBTyxJQUFJLENBQUMsb0JBQW9CLENBQUM7SUFDbEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ksZ0JBQWdCO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRU0sUUFBUTtRQUNkLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDM0IsQ0FBQztJQUVNLE9BQU8sQ0FBQyxVQUFrQjtRQUNoQyxNQUFNLFNBQVMsR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDO1FBQ3pELElBQUksU0FBUyxHQUFHLENBQUMsSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0RCxNQUFNLElBQUksa0JBQWtCLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUM5RCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRDs7T0FFRztJQUNJLGNBQWMsQ0FBQyxvQkFBNEIsRUFBRSxrQkFBMEI7UUFDN0UsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0IsV0FBVztZQUNYLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQ2xELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRTlDLElBQUksa0JBQWtCLEdBQUcsZUFBZSxFQUFFLENBQUM7WUFDMUMsOEJBQThCO1lBQzlCLE1BQU0sU0FBUyxHQUFHLGtCQUFrQixHQUFHLG9CQUFvQixHQUFHLENBQUMsQ0FBQztZQUNoRSxJQUFJLENBQUMsb0JBQW9CLElBQUksU0FBUyxDQUFDO1lBQ3ZDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELElBQUksb0JBQW9CLEdBQUcsYUFBYSxFQUFFLENBQUM7WUFDMUMsNkJBQTZCO1lBQzdCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUVELGtDQUFrQztRQUNsQyxJQUFJLGdCQUFnQixHQUFHLENBQUMsQ0FBQztRQUN6QixJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDcEIsS0FBSyxJQUFJLFVBQVUsR0FBRyxlQUFlLEVBQUUsVUFBVSxJQUFJLGFBQWEsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ2xGLE1BQU0sU0FBUyxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUM7WUFFekQsSUFBSSxvQkFBb0IsSUFBSSxVQUFVLElBQUksVUFBVSxJQUFJLGtCQUFrQixFQUFFLENBQUM7Z0JBQzVFLCtCQUErQjtnQkFDL0IsSUFBSSxXQUFXLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3ZCLHVDQUF1QztvQkFDdkMsZ0JBQWdCLEdBQUcsU0FBUyxDQUFDO29CQUM3QixXQUFXLEdBQUcsQ0FBQyxDQUFDO2dCQUNqQixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsV0FBVyxFQUFFLENBQUM7Z0JBQ2YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsMkRBQTJEO1FBQzNELElBQUksb0JBQW9CLEdBQUcsZUFBZSxFQUFFLENBQUM7WUFDNUMsOEJBQThCO1lBQzlCLElBQUksZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDO1lBRXpCLElBQUksa0JBQWtCLEdBQUcsZUFBZSxFQUFFLENBQUM7Z0JBQzFDLHFDQUFxQztnQkFDckMsZ0JBQWdCLEdBQUcsa0JBQWtCLEdBQUcsb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO1lBQ2xFLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxnQkFBZ0IsR0FBRyxlQUFlLEdBQUcsb0JBQW9CLENBQUM7WUFDM0QsQ0FBQztZQUVELElBQUksQ0FBQyxvQkFBb0IsSUFBSSxnQkFBZ0IsQ0FBQztRQUMvQyxDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbEUsT0FBTyxPQUFPLENBQUM7SUFDaEIsQ0FBQztJQUVNLGNBQWMsQ0FBQyxvQkFBNEIsRUFBRSxXQUFtQjtRQUN0RSxNQUFNLGtCQUFrQixHQUFHLG9CQUFvQixHQUFHLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDbEUsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDM0IsV0FBVztZQUNYLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUVELE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQ2xELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBRTlDLElBQUksZUFBZSxHQUFHLEtBQUssQ0FBQztRQUU1QixLQUFLLElBQUksaUJBQWlCLEdBQUcsb0JBQW9CLEVBQUUsaUJBQWlCLElBQUksa0JBQWtCLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxDQUFDO1lBQ2pILElBQUksaUJBQWlCLElBQUksZUFBZSxJQUFJLGlCQUFpQixJQUFJLGFBQWEsRUFBRSxDQUFDO2dCQUNoRixrQkFBa0I7Z0JBQ2xCLElBQUksQ0FBQyxNQUFNLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDOUUsZUFBZSxHQUFHLElBQUksQ0FBQztZQUN4QixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sZUFBZSxDQUFDO0lBQ3hCLENBQUM7SUFFTSxlQUFlLENBQUMsb0JBQTRCLEVBQUUsa0JBQTBCO1FBQzlFLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzNCLFdBQVc7WUFDWCxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxrQkFBa0IsR0FBRyxvQkFBb0IsR0FBRyxDQUFDLENBQUM7UUFDaEUsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDbEQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFOUMsSUFBSSxvQkFBb0IsSUFBSSxlQUFlLEVBQUUsQ0FBQztZQUM3QywrQkFBK0I7WUFDL0IsSUFBSSxDQUFDLG9CQUFvQixJQUFJLFNBQVMsQ0FBQztZQUN2QyxPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLG9CQUFvQixHQUFHLGFBQWEsRUFBRSxDQUFDO1lBQzFDLCtCQUErQjtZQUMvQixPQUFPLElBQUksQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLFNBQVMsR0FBRyxvQkFBb0IsR0FBRyxhQUFhLEVBQUUsQ0FBQztZQUN0RCx1RkFBdUY7WUFDdkYsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixFQUFFLGFBQWEsR0FBRyxvQkFBb0IsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMvSCxPQUFPLE9BQU8sQ0FBQztRQUNoQixDQUFDO1FBRUQsK0VBQStFO1FBQy9FLE1BQU0sUUFBUSxHQUFRLEVBQUUsQ0FBQztRQUN6QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDcEMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDOUMsQ0FBQztRQUNELE1BQU0sV0FBVyxHQUFHLG9CQUFvQixHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztRQUNyRSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDdEQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQyxDQUFDO1FBQ2xGLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTNGLElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7UUFFOUQsT0FBTyxZQUFZLENBQUM7SUFDckIsQ0FBQztJQUVNLGVBQWUsQ0FBQyxNQUEwRDtRQUNoRixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUMzQixXQUFXO1lBQ1gsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDbEQsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFOUMsSUFBSSxlQUFlLEdBQUcsS0FBSyxDQUFDO1FBQzVCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNuRCxNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFdEIsSUFBSSxHQUFHLENBQUMsWUFBWSxHQUFHLGVBQWUsSUFBSSxHQUFHLENBQUMsY0FBYyxHQUFHLGFBQWEsRUFBRSxDQUFDO2dCQUM5RSx5QkFBeUI7Z0JBQ3pCLFNBQVM7WUFDVixDQUFDO1lBRUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQzNELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVyRCxLQUFLLElBQUksVUFBVSxHQUFHLElBQUksRUFBRSxVQUFVLElBQUksRUFBRSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUM7Z0JBQzVELE1BQU0sU0FBUyxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUM7Z0JBQ3pELElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3pDLGVBQWUsR0FBRyxJQUFJLENBQUM7WUFDeEIsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLGVBQWUsQ0FBQztJQUN4QixDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sc0JBQXNCO0lBS2xDLFlBQ2tCLFlBQXlCLEVBQ3pCLFlBQTZCO1FBRDdCLGlCQUFZLEdBQVosWUFBWSxDQUFhO1FBQ3pCLGlCQUFZLEdBQVosWUFBWSxDQUFpQjtRQUU5QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNyQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSx1QkFBdUIsQ0FBSSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDM0UsQ0FBQztJQUVPLGNBQWM7UUFDckIsTUFBTSxPQUFPLEdBQUcsaUJBQWlCLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ2pFLE9BQU8sQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoQyxPQUFPLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDckQsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsYUFBYSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELE9BQU8sT0FBTyxDQUFDO0lBQ2hCLENBQUM7SUFFRCxpQ0FBaUM7SUFFMUIsc0JBQXNCLENBQUMsQ0FBMkM7UUFDeEUsSUFBSSxDQUFDLENBQUMsVUFBVSxtQ0FBeUIsRUFBRSxDQUFDO1lBQzNDLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVNLFNBQVMsQ0FBQyxDQUE4QixFQUFFLFFBQWtCO1FBQ2xFLHdFQUF3RTtRQUN4RSxtRUFBbUU7UUFDbkUscUVBQXFFO1FBQ3JFLHFFQUFxRTtRQUNyRSxVQUFVO1FBQ1YsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNkLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ3pELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3JELEtBQUssSUFBSSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDbkMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQztZQUN6RCxDQUFDO1FBQ0YsQ0FBQztRQUNELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUM5QixPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFTSxjQUFjLENBQUMsQ0FBbUM7UUFDeEQsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3hFLENBQUM7SUFFTSxjQUFjLENBQUMsQ0FBbUM7UUFDeEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN2RixJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2Isa0JBQWtCO1lBQ2xCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUM1QyxXQUFXLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDdkIsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFTSxlQUFlLENBQUMsQ0FBb0M7UUFDMUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsY0FBYyxFQUFFLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN4RixJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ2Isa0JBQWtCO1lBQ2xCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDcEQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUM1QyxXQUFXLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDdkIsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNiLENBQUM7SUFFTSxlQUFlLENBQUMsQ0FBb0M7UUFDMUQsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7SUFDM0IsQ0FBQztJQUVNLGVBQWUsQ0FBQyxDQUFvQztRQUMxRCxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFFTSxjQUFjLENBQUMsQ0FBbUM7UUFDeEQsT0FBTyxJQUFJLENBQUM7SUFDYixDQUFDO0lBRUQsK0JBQStCO0lBRXhCLGtCQUFrQjtRQUN4QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQ25ELENBQUM7SUFFTSxnQkFBZ0I7UUFDdEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUNqRCxDQUFDO0lBRU0sY0FBYyxDQUFDLFVBQWtCO1FBQ3ZDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRU0sV0FBVyxDQUFDLFlBQTBCO1FBRTVDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUV6QyxNQUFNLFFBQVEsR0FBRyxJQUFJLGlCQUFpQixDQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVwSCxNQUFNLEdBQUcsR0FBd0I7WUFDaEMsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLG1CQUFtQjtZQUM1QyxLQUFLLEVBQUUsR0FBRyxDQUFDLEtBQUs7WUFDaEIsV0FBVyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTTtTQUM3QixDQUFDO1FBRUYseUhBQXlIO1FBQ3pILE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLFlBQVksQ0FBQyxlQUFlLEVBQUUsWUFBWSxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUVuSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxtQkFBbUIsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEUsQ0FBQztDQUNEO0FBUUQsTUFBTSxpQkFBaUI7YUFFUCxjQUFTLEdBQUcsd0JBQXdCLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBRXZHLFlBQ2tCLFFBQXFCLEVBQ3JCLFlBQTZCLEVBQzdCLGFBQTJCLEVBQzNCLFlBQXlCO1FBSHpCLGFBQVEsR0FBUixRQUFRLENBQWE7UUFDckIsaUJBQVksR0FBWixZQUFZLENBQWlCO1FBQzdCLGtCQUFhLEdBQWIsYUFBYSxDQUFjO1FBQzNCLGlCQUFZLEdBQVosWUFBWSxDQUFhO0lBRTNDLENBQUM7SUFFTSxNQUFNLENBQUMsU0FBOEIsRUFBRSxlQUF1QixFQUFFLGNBQXNCLEVBQUUsUUFBa0I7UUFFaEgsTUFBTSxHQUFHLEdBQXdCO1lBQ2hDLG1CQUFtQixFQUFFLFNBQVMsQ0FBQyxtQkFBbUI7WUFDbEQsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUMvQixXQUFXLEVBQUUsU0FBUyxDQUFDLFdBQVc7U0FDbEMsQ0FBQztRQUVGLElBQUksQ0FBQyxHQUFHLENBQUMsbUJBQW1CLEdBQUcsR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxjQUFjLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQztZQUNySCxpQ0FBaUM7WUFDakMsR0FBRyxDQUFDLG1CQUFtQixHQUFHLGVBQWUsQ0FBQztZQUMxQyxHQUFHLENBQUMsV0FBVyxHQUFHLGNBQWMsR0FBRyxlQUFlLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZELEdBQUcsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO1lBQ2YsS0FBSyxJQUFJLENBQUMsR0FBRyxlQUFlLEVBQUUsQ0FBQyxJQUFJLGNBQWMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUN4RCxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2pFLENBQUM7WUFDRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztZQUMzQyxPQUFPLEdBQUcsQ0FBQztRQUNaLENBQUM7UUFFRCwyQ0FBMkM7UUFDM0MsSUFBSSxDQUFDLHFCQUFxQixDQUN6QixHQUFHLEVBQ0gsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixFQUFFLENBQUMsQ0FBQyxFQUN0RCxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsR0FBRyxHQUFHLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUMsRUFDdkUsUUFBUSxFQUNSLGVBQWUsQ0FDZixDQUFDO1FBRUYsSUFBSSxHQUFHLENBQUMsbUJBQW1CLEdBQUcsZUFBZSxFQUFFLENBQUM7WUFDL0Msc0JBQXNCO1lBQ3RCLE1BQU0sY0FBYyxHQUFHLGVBQWUsQ0FBQztZQUN2QyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxHQUFHLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDM0UsSUFBSSxjQUFjLElBQUksWUFBWSxFQUFFLENBQUM7Z0JBQ3BDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUM7Z0JBQ3RGLEdBQUcsQ0FBQyxXQUFXLElBQUksWUFBWSxHQUFHLGNBQWMsR0FBRyxDQUFDLENBQUM7WUFDdEQsQ0FBQztRQUNGLENBQUM7YUFBTSxJQUFJLEdBQUcsQ0FBQyxtQkFBbUIsR0FBRyxlQUFlLEVBQUUsQ0FBQztZQUN0RCxzQkFBc0I7WUFDdEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLGVBQWUsR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUN2RixJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDbkIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDeEMsR0FBRyxDQUFDLFdBQVcsSUFBSSxTQUFTLENBQUM7WUFDOUIsQ0FBQztRQUNGLENBQUM7UUFFRCxHQUFHLENBQUMsbUJBQW1CLEdBQUcsZUFBZSxDQUFDO1FBRTFDLElBQUksR0FBRyxDQUFDLG1CQUFtQixHQUFHLEdBQUcsQ0FBQyxXQUFXLEdBQUcsQ0FBQyxHQUFHLGNBQWMsRUFBRSxDQUFDO1lBQ3BFLHFCQUFxQjtZQUNyQixNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsbUJBQW1CLEdBQUcsR0FBRyxDQUFDLFdBQVcsQ0FBQztZQUNqRSxNQUFNLFlBQVksR0FBRyxjQUFjLENBQUM7WUFFcEMsSUFBSSxjQUFjLElBQUksWUFBWSxFQUFFLENBQUM7Z0JBQ3BDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLEVBQUUsY0FBYyxFQUFFLFlBQVksRUFBRSxRQUFRLEVBQUUsZUFBZSxDQUFDLENBQUM7Z0JBQ3JGLEdBQUcsQ0FBQyxXQUFXLElBQUksWUFBWSxHQUFHLGNBQWMsR0FBRyxDQUFDLENBQUM7WUFDdEQsQ0FBQztRQUVGLENBQUM7YUFBTSxJQUFJLEdBQUcsQ0FBQyxtQkFBbUIsR0FBRyxHQUFHLENBQUMsV0FBVyxHQUFHLENBQUMsR0FBRyxjQUFjLEVBQUUsQ0FBQztZQUMzRSxxQkFBcUI7WUFDckIsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsY0FBYyxHQUFHLEdBQUcsQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNqRixNQUFNLFlBQVksR0FBRyxHQUFHLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQztZQUN6QyxNQUFNLFNBQVMsR0FBRyxZQUFZLEdBQUcsY0FBYyxHQUFHLENBQUMsQ0FBQztZQUVwRCxJQUFJLFNBQVMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDbkIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDdkMsR0FBRyxDQUFDLFdBQVcsSUFBSSxTQUFTLENBQUM7WUFDOUIsQ0FBQztRQUNGLENBQUM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUU1QyxPQUFPLEdBQUcsQ0FBQztJQUNaLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxHQUF3QixFQUFFLFVBQWtCLEVBQUUsUUFBZ0IsRUFBRSxRQUFrQixFQUFFLE9BQWU7UUFDaEksTUFBTSxtQkFBbUIsR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUM7UUFDcEQsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztRQUV4QixLQUFLLElBQUksQ0FBQyxHQUFHLFVBQVUsRUFBRSxDQUFDLElBQUksUUFBUSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDN0MsTUFBTSxVQUFVLEdBQUcsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO1lBQzNDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDNUcsQ0FBQztJQUNGLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxHQUF3QixFQUFFLGNBQXNCLEVBQUUsWUFBb0IsRUFBRSxRQUFrQixFQUFFLE9BQWU7UUFDckksTUFBTSxRQUFRLEdBQVEsRUFBRSxDQUFDO1FBQ3pCLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztRQUNwQixLQUFLLElBQUksVUFBVSxHQUFHLGNBQWMsRUFBRSxVQUFVLElBQUksWUFBWSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUM7WUFDaEYsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMxRCxDQUFDO1FBQ0QsR0FBRyxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRU8sa0JBQWtCLENBQUMsR0FBd0IsRUFBRSxXQUFtQjtRQUN2RSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdEMsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUM5QyxXQUFXLEVBQUUsTUFBTSxFQUFFLENBQUM7UUFDdkIsQ0FBQztRQUNELEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRU8saUJBQWlCLENBQUMsR0FBd0IsRUFBRSxjQUFzQixFQUFFLFlBQW9CLEVBQUUsUUFBa0IsRUFBRSxPQUFlO1FBQ3BJLE1BQU0sUUFBUSxHQUFRLEVBQUUsQ0FBQztRQUN6QixJQUFJLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDcEIsS0FBSyxJQUFJLFVBQVUsR0FBRyxjQUFjLEVBQUUsVUFBVSxJQUFJLFlBQVksRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDO1lBQ2hGLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDMUQsQ0FBQztRQUNELEdBQUcsQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVPLGlCQUFpQixDQUFDLEdBQXdCLEVBQUUsV0FBbUI7UUFDdEUsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7UUFFbEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3RDLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQzVELFdBQVcsRUFBRSxNQUFNLEVBQUUsQ0FBQztRQUN2QixDQUFDO1FBQ0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxHQUF3QixFQUFFLGNBQXVCLEVBQUUsWUFBa0MsRUFBRSxNQUFpQjtRQUN4SSxJQUFJLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2pDLFlBQVksR0FBRyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFlBQXNCLENBQUMsQ0FBQztRQUMvRSxDQUFDO1FBQ0QsTUFBTSxTQUFTLEdBQWdCLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDO1FBQ3ZELElBQUksY0FBYyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEdBQUcsWUFBc0IsQ0FBQyxDQUFDLHVHQUF1RztRQUMxSixDQUFDO2FBQU0sQ0FBQztZQUNQLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxVQUFVLEVBQUUsWUFBc0IsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCxJQUFJLFNBQVMsR0FBZ0IsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUM7UUFDckQsS0FBSyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsV0FBVyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDL0MsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQixJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUNmLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzNCLFNBQVMsR0FBZ0IsU0FBUyxDQUFDLGVBQWUsQ0FBQztZQUNwRCxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyw0QkFBNEIsQ0FBQyxHQUF3QixFQUFFLGdCQUFzQyxFQUFFLFVBQXFCO1FBQzNILE1BQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFbEQsSUFBSSxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNqQyxnQkFBZ0IsR0FBRyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLGdCQUEwQixDQUFDLENBQUM7UUFDdkYsQ0FBQztRQUNELFdBQVcsQ0FBQyxTQUFTLEdBQUcsZ0JBQTBCLENBQUM7UUFFbkQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUMxQyxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzFCLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ25CLE1BQU0sTUFBTSxHQUFnQixXQUFXLENBQUMsVUFBVSxDQUFDO2dCQUNuRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFHLENBQUM7Z0JBQ3ZDLFdBQVcsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDekIsQ0FBQztRQUNGLENBQUM7SUFDRixDQUFDO2FBRXVCLFFBQUcsR0FBRyxJQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUVoRCxnQkFBZ0IsQ0FBQyxHQUF3QixFQUFFLGNBQXVCLEVBQUUsUUFBa0I7UUFFN0YsTUFBTSxFQUFFLEdBQUcsaUJBQWlCLENBQUMsR0FBRyxDQUFDO1FBQ2pDLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxXQUFXLENBQUM7UUFDcEMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztRQUN4QixNQUFNLG1CQUFtQixHQUFHLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQztRQUVwRCxNQUFNLE1BQU0sR0FBYyxFQUFFLENBQUM7UUFDN0IsQ0FBQztZQUNBLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNYLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztZQUV2QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3RDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEIsTUFBTSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFFbEIsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUN0QyxJQUFJLFdBQVcsRUFBRSxDQUFDO29CQUNqQixrQkFBa0I7b0JBQ2xCLFNBQVM7Z0JBQ1YsQ0FBQztnQkFFRCxNQUFNLGtCQUFrQixHQUFHLENBQUMsR0FBRyxtQkFBbUIsQ0FBQztnQkFDbkQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLGtCQUFrQixDQUFDLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDakosSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO29CQUNuQiwrQkFBK0I7b0JBQy9CLFNBQVM7Z0JBQ1YsQ0FBQztnQkFFRCxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixVQUFVLEdBQUcsSUFBSSxDQUFDO1lBQ25CLENBQUM7WUFFRCxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNoQixJQUFJLENBQUMsd0JBQXdCLENBQUMsR0FBRyxFQUFFLGNBQWMsRUFBRSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDeEUsQ0FBQztRQUNGLENBQUM7UUFFRCxDQUFDO1lBQ0EsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBRVgsSUFBSSxjQUFjLEdBQUcsS0FBSyxDQUFDO1lBQzNCLE1BQU0sVUFBVSxHQUFjLEVBQUUsQ0FBQztZQUVqQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3RDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEIsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztnQkFFdEIsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDZixlQUFlO29CQUNmLFNBQVM7Z0JBQ1YsQ0FBQztnQkFFRCxNQUFNLGtCQUFrQixHQUFHLENBQUMsR0FBRyxtQkFBbUIsQ0FBQztnQkFDbkQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLHdCQUF3QixDQUFDLGtCQUFrQixDQUFDLEVBQUUsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDakosSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO29CQUNuQiwrQkFBK0I7b0JBQy9CLFNBQVM7Z0JBQ1YsQ0FBQztnQkFFRCxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO2dCQUNyQixjQUFjLEdBQUcsSUFBSSxDQUFDO1lBQ3ZCLENBQUM7WUFFRCxJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUNwQixJQUFJLENBQUMsNEJBQTRCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUNoRSxDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFFTyx3QkFBd0IsQ0FBQyxVQUFrQjtRQUNsRCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLDBCQUEwQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzVFLENBQUMifQ==