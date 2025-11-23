/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { h } from '../../../../../base/browser/dom.js';
import { ActionBar } from '../../../../../base/browser/ui/actionbar/actionbar.js';
import { Action } from '../../../../../base/common/actions.js';
import { booleanComparator, compareBy, numberComparator, tieBreakComparators } from '../../../../../base/common/arrays.js';
import { findMaxIdx } from '../../../../../base/common/arraysFind.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, autorunHandleChanges, autorunWithStore, constObservable, derived, observableFromEvent, observableSignalFromEvent, observableValue, recomputeInitiallyAndOnChange } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { PlaceholderViewZone, ViewZoneOverlayWidget, applyStyle, applyViewZones } from '../utils.js';
import { OffsetRange, OffsetRangeSet } from '../../../../common/core/ranges/offsetRange.js';
import { localize } from '../../../../../nls.js';
export class MovedBlocksLinesFeature extends Disposable {
    static { this.movedCodeBlockPadding = 4; }
    constructor(_rootElement, _diffModel, _originalEditorLayoutInfo, _modifiedEditorLayoutInfo, _editors) {
        super();
        this._rootElement = _rootElement;
        this._diffModel = _diffModel;
        this._originalEditorLayoutInfo = _originalEditorLayoutInfo;
        this._modifiedEditorLayoutInfo = _modifiedEditorLayoutInfo;
        this._editors = _editors;
        this._originalScrollTop = observableFromEvent(this, this._editors.original.onDidScrollChange, () => this._editors.original.getScrollTop());
        this._modifiedScrollTop = observableFromEvent(this, this._editors.modified.onDidScrollChange, () => this._editors.modified.getScrollTop());
        this._viewZonesChanged = observableSignalFromEvent('onDidChangeViewZones', this._editors.modified.onDidChangeViewZones);
        this.width = observableValue(this, 0);
        this._modifiedViewZonesChangedSignal = observableSignalFromEvent('modified.onDidChangeViewZones', this._editors.modified.onDidChangeViewZones);
        this._originalViewZonesChangedSignal = observableSignalFromEvent('original.onDidChangeViewZones', this._editors.original.onDidChangeViewZones);
        this._state = derived(this, (reader) => {
            /** @description state */
            this._element.replaceChildren();
            const model = this._diffModel.read(reader);
            const moves = model?.diff.read(reader)?.movedTexts;
            if (!moves || moves.length === 0) {
                this.width.set(0, undefined);
                return;
            }
            this._viewZonesChanged.read(reader);
            const infoOrig = this._originalEditorLayoutInfo.read(reader);
            const infoMod = this._modifiedEditorLayoutInfo.read(reader);
            if (!infoOrig || !infoMod) {
                this.width.set(0, undefined);
                return;
            }
            this._modifiedViewZonesChangedSignal.read(reader);
            this._originalViewZonesChangedSignal.read(reader);
            const lines = moves.map((move) => {
                function computeLineStart(range, editor) {
                    const t1 = editor.getTopForLineNumber(range.startLineNumber, true);
                    const t2 = editor.getTopForLineNumber(range.endLineNumberExclusive, true);
                    return (t1 + t2) / 2;
                }
                const start = computeLineStart(move.lineRangeMapping.original, this._editors.original);
                const startOffset = this._originalScrollTop.read(reader);
                const end = computeLineStart(move.lineRangeMapping.modified, this._editors.modified);
                const endOffset = this._modifiedScrollTop.read(reader);
                const from = start - startOffset;
                const to = end - endOffset;
                const top = Math.min(start, end);
                const bottom = Math.max(start, end);
                return { range: new OffsetRange(top, bottom), from, to, fromWithoutScroll: start, toWithoutScroll: end, move };
            });
            lines.sort(tieBreakComparators(compareBy(l => l.fromWithoutScroll > l.toWithoutScroll, booleanComparator), compareBy(l => l.fromWithoutScroll > l.toWithoutScroll ? l.fromWithoutScroll : -l.toWithoutScroll, numberComparator)));
            const layout = LinesLayout.compute(lines.map(l => l.range));
            const padding = 10;
            const lineAreaLeft = infoOrig.verticalScrollbarWidth;
            const lineAreaWidth = (layout.getTrackCount() - 1) * 10 + padding * 2;
            const width = lineAreaLeft + lineAreaWidth + (infoMod.contentLeft - MovedBlocksLinesFeature.movedCodeBlockPadding);
            let idx = 0;
            for (const line of lines) {
                const track = layout.getTrack(idx);
                const verticalY = lineAreaLeft + padding + track * 10;
                const arrowHeight = 15;
                const arrowWidth = 15;
                const right = width;
                const rectWidth = infoMod.glyphMarginWidth + infoMod.lineNumbersWidth;
                const rectHeight = 18;
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.classList.add('arrow-rectangle');
                rect.setAttribute('x', `${right - rectWidth}`);
                rect.setAttribute('y', `${line.to - rectHeight / 2}`);
                rect.setAttribute('width', `${rectWidth}`);
                rect.setAttribute('height', `${rectHeight}`);
                this._element.appendChild(rect);
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${0} ${line.from} L ${verticalY} ${line.from} L ${verticalY} ${line.to} L ${right - arrowWidth} ${line.to}`);
                path.setAttribute('fill', 'none');
                g.appendChild(path);
                const arrowRight = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                arrowRight.classList.add('arrow');
                reader.store.add(autorun(reader => {
                    path.classList.toggle('currentMove', line.move === model.activeMovedText.read(reader));
                    arrowRight.classList.toggle('currentMove', line.move === model.activeMovedText.read(reader));
                }));
                arrowRight.setAttribute('points', `${right - arrowWidth},${line.to - arrowHeight / 2} ${right},${line.to} ${right - arrowWidth},${line.to + arrowHeight / 2}`);
                g.appendChild(arrowRight);
                this._element.appendChild(g);
                /*
                TODO@hediet
                path.addEventListener('mouseenter', () => {
                    model.setHoveredMovedText(line.move);
                });
                path.addEventListener('mouseleave', () => {
                    model.setHoveredMovedText(undefined);
                });*/
                idx++;
            }
            this.width.set(lineAreaWidth, undefined);
        });
        this._element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this._element.setAttribute('class', 'moved-blocks-lines');
        this._rootElement.appendChild(this._element);
        this._register(toDisposable(() => this._element.remove()));
        this._register(autorun(reader => {
            /** @description update moved blocks lines positioning */
            const info = this._originalEditorLayoutInfo.read(reader);
            const info2 = this._modifiedEditorLayoutInfo.read(reader);
            if (!info || !info2) {
                return;
            }
            this._element.style.left = `${info.width - info.verticalScrollbarWidth}px`;
            this._element.style.height = `${info.height}px`;
            this._element.style.width = `${info.verticalScrollbarWidth + info.contentLeft - MovedBlocksLinesFeature.movedCodeBlockPadding + this.width.read(reader)}px`;
        }));
        this._register(recomputeInitiallyAndOnChange(this._state));
        const movedBlockViewZones = derived(reader => {
            const model = this._diffModel.read(reader);
            const d = model?.diff.read(reader);
            if (!d) {
                return [];
            }
            return d.movedTexts.map(move => ({
                move,
                original: new PlaceholderViewZone(constObservable(move.lineRangeMapping.original.startLineNumber - 1), 18),
                modified: new PlaceholderViewZone(constObservable(move.lineRangeMapping.modified.startLineNumber - 1), 18),
            }));
        });
        this._register(applyViewZones(this._editors.original, movedBlockViewZones.map(zones => /** @description movedBlockViewZones.original */ zones.map(z => z.original))));
        this._register(applyViewZones(this._editors.modified, movedBlockViewZones.map(zones => /** @description movedBlockViewZones.modified */ zones.map(z => z.modified))));
        this._register(autorunWithStore((reader, store) => {
            const blocks = movedBlockViewZones.read(reader);
            for (const b of blocks) {
                store.add(new MovedBlockOverlayWidget(this._editors.original, b.original, b.move, 'original', this._diffModel.get()));
                store.add(new MovedBlockOverlayWidget(this._editors.modified, b.modified, b.move, 'modified', this._diffModel.get()));
            }
        }));
        const originalHasFocus = observableSignalFromEvent('original.onDidFocusEditorWidget', e => this._editors.original.onDidFocusEditorWidget(() => setTimeout(() => e(undefined), 0)));
        const modifiedHasFocus = observableSignalFromEvent('modified.onDidFocusEditorWidget', e => this._editors.modified.onDidFocusEditorWidget(() => setTimeout(() => e(undefined), 0)));
        let lastChangedEditor = 'modified';
        this._register(autorunHandleChanges({
            changeTracker: {
                createChangeSummary: () => undefined,
                handleChange: (ctx, summary) => {
                    if (ctx.didChange(originalHasFocus)) {
                        lastChangedEditor = 'original';
                    }
                    if (ctx.didChange(modifiedHasFocus)) {
                        lastChangedEditor = 'modified';
                    }
                    return true;
                }
            }
        }, reader => {
            /** @description MovedBlocksLines.setActiveMovedTextFromCursor */
            originalHasFocus.read(reader);
            modifiedHasFocus.read(reader);
            const m = this._diffModel.read(reader);
            if (!m) {
                return;
            }
            const diff = m.diff.read(reader);
            let movedText = undefined;
            if (diff && lastChangedEditor === 'original') {
                const originalPos = this._editors.originalCursor.read(reader);
                if (originalPos) {
                    movedText = diff.movedTexts.find(m => m.lineRangeMapping.original.contains(originalPos.lineNumber));
                }
            }
            if (diff && lastChangedEditor === 'modified') {
                const modifiedPos = this._editors.modifiedCursor.read(reader);
                if (modifiedPos) {
                    movedText = diff.movedTexts.find(m => m.lineRangeMapping.modified.contains(modifiedPos.lineNumber));
                }
            }
            if (movedText !== m.movedTextToCompare.read(undefined)) {
                m.movedTextToCompare.set(undefined, undefined);
            }
            m.setActiveMovedText(movedText);
        }));
    }
}
class LinesLayout {
    static compute(lines) {
        const setsPerTrack = [];
        const trackPerLineIdx = [];
        for (const line of lines) {
            let trackIdx = setsPerTrack.findIndex(set => !set.intersectsStrict(line));
            if (trackIdx === -1) {
                const maxTrackCount = 6;
                if (setsPerTrack.length >= maxTrackCount) {
                    trackIdx = findMaxIdx(setsPerTrack, compareBy(set => set.intersectWithRangeLength(line), numberComparator));
                }
                else {
                    trackIdx = setsPerTrack.length;
                    setsPerTrack.push(new OffsetRangeSet());
                }
            }
            setsPerTrack[trackIdx].addRange(line);
            trackPerLineIdx.push(trackIdx);
        }
        return new LinesLayout(setsPerTrack.length, trackPerLineIdx);
    }
    constructor(_trackCount, trackPerLineIdx) {
        this._trackCount = _trackCount;
        this.trackPerLineIdx = trackPerLineIdx;
    }
    getTrack(lineIdx) {
        return this.trackPerLineIdx[lineIdx];
    }
    getTrackCount() {
        return this._trackCount;
    }
}
class MovedBlockOverlayWidget extends ViewZoneOverlayWidget {
    constructor(_editor, _viewZone, _move, _kind, _diffModel) {
        const root = h('div.diff-hidden-lines-widget');
        super(_editor, _viewZone, root.root);
        this._editor = _editor;
        this._move = _move;
        this._kind = _kind;
        this._diffModel = _diffModel;
        this._nodes = h('div.diff-moved-code-block', { style: { marginRight: '4px' } }, [
            h('div.text-content@textContent'),
            h('div.action-bar@actionBar'),
        ]);
        root.root.appendChild(this._nodes.root);
        const editorLayout = observableFromEvent(this._editor.onDidLayoutChange, () => this._editor.getLayoutInfo());
        this._register(applyStyle(this._nodes.root, {
            paddingRight: editorLayout.map(l => l.verticalScrollbarWidth)
        }));
        let text;
        if (_move.changes.length > 0) {
            text = this._kind === 'original' ? localize('codeMovedToWithChanges', 'Code moved with changes to line {0}-{1}', this._move.lineRangeMapping.modified.startLineNumber, this._move.lineRangeMapping.modified.endLineNumberExclusive - 1) : localize('codeMovedFromWithChanges', 'Code moved with changes from line {0}-{1}', this._move.lineRangeMapping.original.startLineNumber, this._move.lineRangeMapping.original.endLineNumberExclusive - 1);
        }
        else {
            text = this._kind === 'original' ? localize('codeMovedTo', 'Code moved to line {0}-{1}', this._move.lineRangeMapping.modified.startLineNumber, this._move.lineRangeMapping.modified.endLineNumberExclusive - 1) : localize('codeMovedFrom', 'Code moved from line {0}-{1}', this._move.lineRangeMapping.original.startLineNumber, this._move.lineRangeMapping.original.endLineNumberExclusive - 1);
        }
        const actionBar = this._register(new ActionBar(this._nodes.actionBar, {
            highlightToggledItems: true,
        }));
        const caption = new Action('', text, '', false);
        actionBar.push(caption, { icon: false, label: true });
        const actionCompare = new Action('', 'Compare', ThemeIcon.asClassName(Codicon.compareChanges), true, () => {
            this._editor.focus();
            this._diffModel.movedTextToCompare.set(this._diffModel.movedTextToCompare.get() === _move ? undefined : this._move, undefined);
        });
        this._register(autorun(reader => {
            const isActive = this._diffModel.movedTextToCompare.read(reader) === _move;
            actionCompare.checked = isActive;
        }));
        actionBar.push(actionCompare, { icon: false, label: true });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW92ZWRCbG9ja3NMaW5lc0ZlYXR1cmUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZmVhdHVyZXMvbW92ZWRCbG9ja3NMaW5lc0ZlYXR1cmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ3ZELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUNsRixPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzNILE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNuRixPQUFPLEVBQWUsT0FBTyxFQUFFLG9CQUFvQixFQUFFLGdCQUFnQixFQUFFLGVBQWUsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUseUJBQXlCLEVBQUUsZUFBZSxFQUFFLDZCQUE2QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbFAsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBSXBFLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxxQkFBcUIsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBR3JHLE9BQU8sRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFFNUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFN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