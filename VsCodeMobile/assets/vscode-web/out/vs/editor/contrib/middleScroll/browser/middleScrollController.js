/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getWindow, addDisposableListener, n } from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun, derived, disposableObservableValue, observableValue } from '../../../../base/common/observable.js';
import { observableCodeEditor } from '../../../browser/observableCodeEditor.js';
import { Point } from '../../../common/core/2d/point.js';
import { AnimationFrameScheduler } from '../../inlineCompletions/browser/model/animation.js';
import { appendRemoveOnDispose } from '../../../browser/widget/diffEditor/utils.js';
import './middleScroll.css';
export class MiddleScrollController extends Disposable {
    static { this.ID = 'editor.contrib.middleScroll'; }
    static get(editor) {
        return editor.getContribution(MiddleScrollController.ID);
    }
    constructor(_editor) {
        super();
        this._editor = _editor;
        const obsEditor = observableCodeEditor(this._editor);
        const scrollOnMiddleClick = obsEditor.getOption(171 /* EditorOption.scrollOnMiddleClick */);
        this._register(autorun(reader => {
            if (!scrollOnMiddleClick.read(reader)) {
                return;
            }
            const editorDomNode = obsEditor.domNode.read(reader);
            if (!editorDomNode) {
                return;
            }
            const scrollingSession = reader.store.add(disposableObservableValue('scrollingSession', undefined));
            reader.store.add(this._editor.onMouseDown(e => {
                const session = scrollingSession.read(undefined);
                if (session) {
                    scrollingSession.set(undefined, undefined);
                    return;
                }
                if (!e.event.middleButton) {
                    return;
                }
                e.event.stopPropagation();
                e.event.preventDefault();
                const store = new DisposableStore();
                const initialPos = new Point(e.event.posx, e.event.posy);
                const mousePos = observeWindowMousePos(getWindow(editorDomNode), initialPos, store);
                const mouseDeltaAfterThreshold = mousePos.map(v => v.subtract(initialPos).withThreshold(5));
                const editorDomNodeRect = editorDomNode.getBoundingClientRect();
                const initialMousePosInEditor = new Point(initialPos.x - editorDomNodeRect.left, initialPos.y - editorDomNodeRect.top);
                scrollingSession.set({
                    mouseDeltaAfterThreshold,
                    initialMousePosInEditor,
                    didScroll: false,
                    dispose: () => store.dispose(),
                }, undefined);
                store.add(this._editor.onMouseUp(e => {
                    const session = scrollingSession.read(undefined);
                    if (session && session.didScroll) {
                        // Only cancel session on release if the user scrolled during it
                        scrollingSession.set(undefined, undefined);
                    }
                }));
                store.add(this._editor.onKeyDown(e => {
                    scrollingSession.set(undefined, undefined);
                }));
            }));
            reader.store.add(autorun(reader => {
                const session = scrollingSession.read(reader);
                if (!session) {
                    return;
                }
                let lastTime = Date.now();
                reader.store.add(autorun(reader => {
                    AnimationFrameScheduler.instance.invalidateOnNextAnimationFrame(reader);
                    const curTime = Date.now();
                    const frameDurationMs = curTime - lastTime;
                    lastTime = curTime;
                    const mouseDelta = session.mouseDeltaAfterThreshold.read(undefined);
                    // scroll by mouse delta every 32ms
                    const factor = frameDurationMs / 32;
                    const scrollDelta = mouseDelta.scale(factor);
                    const scrollPos = new Point(this._editor.getScrollLeft(), this._editor.getScrollTop());
                    this._editor.setScrollPosition(toScrollPosition(scrollPos.add(scrollDelta)));
                    if (!scrollDelta.isZero()) {
                        session.didScroll = true;
                    }
                }));
                const directionAttr = derived(reader => {
                    const delta = session.mouseDeltaAfterThreshold.read(reader);
                    let direction = '';
                    direction += (delta.y < 0 ? 'n' : (delta.y > 0 ? 's' : ''));
                    direction += (delta.x < 0 ? 'w' : (delta.x > 0 ? 'e' : ''));
                    return direction;
                });
                reader.store.add(autorun(reader => {
                    editorDomNode.setAttribute('data-scroll-direction', directionAttr.read(reader));
                }));
            }));
            const dotDomElem = reader.store.add(n.div({
                class: ['scroll-editor-on-middle-click-dot', scrollingSession.map(session => session ? '' : 'hidden')],
                style: {
                    left: scrollingSession.map((session) => session ? session.initialMousePosInEditor.x : 0),
                    top: scrollingSession.map((session) => session ? session.initialMousePosInEditor.y : 0),
                }
            }).toDisposableLiveElement());
            reader.store.add(appendRemoveOnDispose(editorDomNode, dotDomElem.element));
            reader.store.add(autorun(reader => {
                const session = scrollingSession.read(reader);
                editorDomNode.classList.toggle('scroll-editor-on-middle-click-editor', !!session);
            }));
        }));
    }
}
function observeWindowMousePos(window, initialPos, store) {
    const val = observableValue('pos', initialPos);
    store.add(addDisposableListener(window, 'mousemove', (e) => {
        val.set(new Point(e.pageX, e.pageY), undefined);
    }));
    return val;
}
function toScrollPosition(p) {
    return {
        scrollLeft: p.x,
        scrollTop: p.y,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxlU2Nyb2xsQ29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9taWRkbGVTY3JvbGwvYnJvd3Nlci9taWRkbGVTY3JvbGxDb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUscUJBQXFCLEVBQUUsQ0FBQyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEYsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQWUsTUFBTSxzQ0FBc0MsQ0FBQztBQUloRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSx5QkFBeUIsRUFBZSxlQUFlLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNsSSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRixPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDekQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFDN0YsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDcEYsT0FBTyxvQkFBb0IsQ0FBQztBQUU1QixNQUFNLE9BQU8sc0JBQXVCLFNBQVEsVUFBVTthQUM5QixPQUFFLEdBQUcsNkJBQTZCLENBQUM7SUFFMUQsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFtQjtRQUM3QixPQUFPLE1BQU0sQ0FBQyxlQUFlLENBQXlCLHNCQUFzQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFFRCxZQUNrQixPQUFvQjtRQUVyQyxLQUFLLEVBQUUsQ0FBQztRQUZTLFlBQU8sR0FBUCxPQUFPLENBQWE7UUFJckMsTUFBTSxTQUFTLEdBQUcsb0JBQW9CLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JELE1BQU0s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