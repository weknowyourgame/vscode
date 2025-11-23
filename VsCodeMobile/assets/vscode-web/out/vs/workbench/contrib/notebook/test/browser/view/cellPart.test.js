/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { CodeCellLayout } from '../../../browser/view/cellParts/codeCell.js';
suite('CellPart', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('CodeCellLayout editor visibility states', () => {
        /**
         * We construct a very small mock around the parts that `CodeCellLayout` touches. The goal
         * is to validate the branching logic that sets `_editorVisibility` without mutating any
         * production code. Each scenario sets up geometry & scroll values then invokes
         * `layoutEditor()` and asserts the resulting visibility classification.
         */
        const DEFAULT_ELEMENT_TOP = 100; // absolute top of the cell in notebook coordinates
        const DEFAULT_ELEMENT_HEIGHT = 900; // arbitrary, large enough not to constrain
        const STATUSBAR = 22;
        const TOP_MARGIN = 6; // mirrors layoutInfo.topMargin usage
        const OUTLINE = 1;
        const scenarios = [
            {
                name: 'Full',
                scrollTop: 0,
                viewportHeight: 400,
                editorContentHeight: 300,
                editorHeight: 300,
                outputContainerOffset: 300, // editorBottom = 100 + 300 = 400, fully inside viewport (scrollBottom=400)
                expected: 'Full',
                elementTop: DEFAULT_ELEMENT_TOP,
                elementHeight: DEFAULT_ELEMENT_HEIGHT,
                expectedTop: 0,
                expectedEditorScrollTop: 0,
            },
            {
                name: 'Bottom Clipped',
                scrollTop: 0,
                viewportHeight: 350, // scrollBottom=350 < editorBottom(400)
                editorContentHeight: 300,
                editorHeight: 300,
                outputContainerOffset: 300,
                expected: 'Bottom Clipped',
                elementTop: DEFAULT_ELEMENT_TOP,
                elementHeight: DEFAULT_ELEMENT_HEIGHT,
                expectedTop: 0,
                expectedEditorScrollTop: 0,
            },
            {
                name: 'Full (Small Viewport)',
                scrollTop: DEFAULT_ELEMENT_TOP + TOP_MARGIN + 20, // scrolled into the cell body
                viewportHeight: 220, // small vs content
                editorContentHeight: 500, // larger than viewport so we clamp
                editorHeight: 500,
                outputContainerOffset: 600, // editorBottom=700 > scrollBottom
                expected: 'Full (Small Viewport)',
                elementTop: DEFAULT_ELEMENT_TOP,
                elementHeight: DEFAULT_ELEMENT_HEIGHT,
                expectedTop: 19, // (scrollTop - elementTop - topMargin - outlineWidth) = (100+6+20 -100 -6 -1)
                expectedEditorScrollTop: 19,
            },
            {
                name: 'Top Clipped',
                scrollTop: DEFAULT_ELEMENT_TOP + TOP_MARGIN + 40, // scrolled further down but not past bottom
                viewportHeight: 600, // larger than content height below (forces branch for Top Clipped)
                editorContentHeight: 200,
                editorHeight: 200,
                outputContainerOffset: 450, // editorBottom=550; scrollBottom= scrollTop+viewportHeight = > 550?  (540+600=1140) but we only need scrollTop < editorBottom
                expected: 'Top Clipped',
                elementTop: DEFAULT_ELEMENT_TOP,
                elementHeight: DEFAULT_ELEMENT_HEIGHT,
                expectedTop: 39, // (100+6+40 -100 -6 -1)
                expectedEditorScrollTop: 40, // contentHeight(200) - computed height(160)
            },
            {
                name: 'Invisible',
                scrollTop: DEFAULT_ELEMENT_TOP + 1000, // well below editor bottom
                viewportHeight: 400,
                editorContentHeight: 300,
                editorHeight: 300,
                outputContainerOffset: 300, // editorBottom=400 < scrollTop
                expected: 'Invisible',
                elementTop: DEFAULT_ELEMENT_TOP,
                elementHeight: DEFAULT_ELEMENT_HEIGHT,
                expectedTop: 278, // adjusted after ensuring minimum line height when possibleEditorHeight < LINE_HEIGHT
                expectedEditorScrollTop: 279, // contentHeight(300) - clamped height(21)
            },
        ];
        for (const s of scenarios) {
            // Fresh stub objects per scenario
            const editorScrollState = { scrollTop: 0 };
            const stubEditor = {
                layoutCalls: [],
                _lastScrollTopSet: -1,
                getLayoutInfo: () => ({ width: 600, height: s.editorHeight }),
                getContentHeight: () => s.editorContentHeight,
                layout: (dim) => {
                    stubEditor.layoutCalls.push(dim);
                },
                setScrollTop: (v) => {
                    editorScrollState.scrollTop = v;
                    stubEditor._lastScrollTopSet = v;
                },
                hasModel: () => true,
            };
            const editorPart = { style: { top: '' } };
            const template = {
                editor: stubEditor,
                editorPart: editorPart,
            };
            // viewCell stub with only needed pieces
            const viewCell = {
                isInputCollapsed: false,
                layoutInfo: {
                    // values referenced in layout logic
                    statusBarHeight: STATUSBAR,
                    topMargin: TOP_MARGIN,
                    outlineWidth: OUTLINE,
                    editorHeight: s.editorHeight,
                    outputContainerOffset: s.outputContainerOffset,
                },
            };
            // notebook editor stub
            let scrollBottom = s.scrollTop + s.viewportHeight;
            const notebookEditor = {
                scrollTop: s.scrollTop,
                get scrollBottom() {
                    return scrollBottom;
                },
                setScrollTop: (v) => {
                    notebookEditor.scrollTop = v;
                    scrollBottom = v + s.viewportHeight;
                },
                getLayoutInfo: () => ({
                    fontInfo: { lineHeight: 21 },
                    height: s.viewportHeight,
                    stickyHeight: 0,
                }),
                getAbsoluteTopOfElement: () => s.elementTop,
                getAbsoluteBottomOfElement: () => s.elementTop + s.outputContainerOffset,
                getHeightOfElement: () => s.elementHeight,
                notebookOptions: {
                    getLayoutConfiguration: () => ({ editorTopPadding: 6 }),
                },
            };
            const layout = new CodeCellLayout(
            /* enabled */ true, notebookEditor, viewCell, template, {
                debug: () => {
                    /* no-op */
                },
            }, { width: 600, height: s.editorHeight });
            layout.layoutEditor('init');
            assert.strictEqual(layout.editorVisibility, s.expected, `Scenario '${s.name}' (scrollTop=${s.scrollTop}) expected visibility ${s.expected} but got ${layout.editorVisibility}`);
            const actualTop = parseInt((editorPart.style.top || '0').replace(/px$/, '')); // style.top always like 'NNNpx'
            assert.strictEqual(actualTop, s.expectedTop, `Scenario '${s.name}' (scrollTop=${s.scrollTop}) expected top ${s.expectedTop}px but got ${editorPart.style.top}`);
            assert.strictEqual(stubEditor._lastScrollTopSet, s.expectedEditorScrollTop, `Scenario '${s.name}' (scrollTop=${s.scrollTop}) expected editor.setScrollTop(${s.expectedEditorScrollTop}) but got ${stubEditor._lastScrollTopSet}`);
            // Basic sanity: style.top should always be set when visible states other than Full (handled) or Invisible.
            if (s.expected !== 'Invisible') {
                assert.notStrictEqual(editorPart.style.top, '', `Scenario '${s.name}' should set a top style value`);
            }
            else {
                // Invisible still sets a top; just ensure layout ran
                assert.ok(editorPart.style.top !== undefined, 'Invisible scenario still performs a layout');
            }
        }
    });
    test('Scrolling', () => {
        /**
         * Pixel-by-pixel scroll test to validate `CodeCellLayout` calculations for:
         *  - editorPart.style.top
         *  - editorVisibility classification
         *  - editor internal scrollTop passed to setScrollTop
         *
         * We intentionally mirror the production math in a helper (duplication acceptable in test) so
         * that any divergence is caught. Constants chosen to exercise all state transitions.
         */
        const LINE_HEIGHT = 21; // from getLayoutInfo().fontInfo.lineHeight in stubs
        const CELL_TOP_MARGIN = 6;
        const CELL_OUTLINE_WIDTH = 1;
        const STATUSBAR_HEIGHT = 22;
        const VIEWPORT_HEIGHT = 300; // notebook viewport height
        const ELEMENT_TOP = 100; // absolute top
        const EDITOR_CONTENT_HEIGHT = 800; // tall content so we get clipping and small viewport states
        const EDITOR_HEIGHT = EDITOR_CONTENT_HEIGHT; // initial layoutInfo.editorHeight
        const OUTPUT_CONTAINER_OFFSET = 800; // bottom of editor region relative to elementTop
        const ELEMENT_HEIGHT = 1200; // large container
        function clamp(v, min, max) {
            return Math.min(Math.max(v, min), max);
        }
        function computeExpected(scrollTop) {
            const scrollBottom = scrollTop + VIEWPORT_HEIGHT;
            const viewportHeight = VIEWPORT_HEIGHT;
            const editorBottom = ELEMENT_TOP + OUTPUT_CONTAINER_OFFSET;
            let top = Math.max(0, scrollTop - ELEMENT_TOP - CELL_TOP_MARGIN - CELL_OUTLINE_WIDTH);
            const possibleEditorHeight = EDITOR_HEIGHT - top;
            if (possibleEditorHeight < LINE_HEIGHT) {
                top = top - (LINE_HEIGHT - possibleEditorHeight) - CELL_OUTLINE_WIDTH;
            }
            let height = EDITOR_CONTENT_HEIGHT;
            let visibility = 'Full';
            let editorScrollTop = 0;
            if (scrollTop <= ELEMENT_TOP + CELL_TOP_MARGIN) {
                const minimumEditorHeight = LINE_HEIGHT + 6; // editorTopPadding from configuration stub (6)
                if (scrollBottom >= editorBottom) {
                    height = clamp(EDITOR_CONTENT_HEIGHT, minimumEditorHeight, EDITOR_CONTENT_HEIGHT);
                    visibility = 'Full';
                }
                else {
                    height =
                        clamp(scrollBottom - (ELEMENT_TOP + CELL_TOP_MARGIN) - STATUSBAR_HEIGHT, minimumEditorHeight, EDITOR_CONTENT_HEIGHT) +
                            2 * CELL_OUTLINE_WIDTH;
                    visibility = 'Bottom Clipped';
                    editorScrollTop = 0;
                }
            }
            else {
                if (viewportHeight <= EDITOR_CONTENT_HEIGHT &&
                    scrollBottom <= editorBottom) {
                    const minimumEditorHeight = LINE_HEIGHT + 6; // editorTopPadding
                    height =
                        clamp(viewportHeight - STATUSBAR_HEIGHT, minimumEditorHeight, EDITOR_CONTENT_HEIGHT - STATUSBAR_HEIGHT) +
                            2 * CELL_OUTLINE_WIDTH;
                    visibility = 'Full (Small Viewport)';
                    editorScrollTop = top;
                }
                else {
                    const minimumEditorHeight = LINE_HEIGHT;
                    height = clamp(EDITOR_CONTENT_HEIGHT -
                        (scrollTop - (ELEMENT_TOP + CELL_TOP_MARGIN)), minimumEditorHeight, EDITOR_CONTENT_HEIGHT);
                    if (scrollTop > editorBottom) {
                        visibility = 'Invisible';
                    }
                    else {
                        visibility = 'Top Clipped';
                    }
                    editorScrollTop = EDITOR_CONTENT_HEIGHT - height;
                }
            }
            return { top, visibility, editorScrollTop };
        }
        // Shared stubs (we'll mutate scrollTop each iteration) – we re-create layout each iteration to reset internal state changes
        for (let scrollTop = 0; scrollTop <= VIEWPORT_HEIGHT + OUTPUT_CONTAINER_OFFSET + 20; scrollTop++) {
            const expected = computeExpected(scrollTop);
            const scrollBottom = scrollTop + VIEWPORT_HEIGHT;
            const stubEditor = {
                _lastScrollTopSet: -1,
                getLayoutInfo: () => ({ width: 600, height: EDITOR_HEIGHT }),
                getContentHeight: () => EDITOR_CONTENT_HEIGHT,
                layout: () => {
                    /* no-op */
                },
                setScrollTop: (v) => {
                    stubEditor._lastScrollTopSet = v;
                },
                hasModel: () => true,
            };
            const editorPart = { style: { top: '' } };
            const template = {
                editor: stubEditor,
                editorPart: editorPart,
            };
            const viewCell = {
                isInputCollapsed: false,
                layoutInfo: {
                    statusBarHeight: STATUSBAR_HEIGHT,
                    topMargin: CELL_TOP_MARGIN,
                    outlineWidth: CELL_OUTLINE_WIDTH,
                    editorHeight: EDITOR_HEIGHT,
                    outputContainerOffset: OUTPUT_CONTAINER_OFFSET,
                },
            };
            const notebookEditor = {
                scrollTop,
                get scrollBottom() {
                    return scrollBottom;
                },
                setScrollTop: (v) => {
                    /* notebook scroll changes are not the focus here */
                },
                getLayoutInfo: () => ({
                    fontInfo: { lineHeight: LINE_HEIGHT },
                    height: VIEWPORT_HEIGHT,
                    stickyHeight: 0,
                }),
                getAbsoluteTopOfElement: () => ELEMENT_TOP,
                getAbsoluteBottomOfElement: () => ELEMENT_TOP + OUTPUT_CONTAINER_OFFSET,
                getHeightOfElement: () => ELEMENT_HEIGHT,
                notebookOptions: {
                    getLayoutConfiguration: () => ({ editorTopPadding: 6 }),
                },
            };
            const layout = new CodeCellLayout(true, notebookEditor, viewCell, template, { debug: () => { } }, { width: 600, height: EDITOR_HEIGHT });
            layout.layoutEditor('nbDidScroll');
            const actualTop = parseInt((editorPart.style.top || '0').replace(/px$/, ''));
            assert.strictEqual(actualTop, expected.top, `scrollTop=${scrollTop}: expected top ${expected.top}, got ${actualTop}`);
            assert.strictEqual(layout.editorVisibility, expected.visibility, `scrollTop=${scrollTop}: expected visibility ${expected.visibility}, got ${layout.editorVisibility}`);
            assert.strictEqual(stubEditor._lastScrollTopSet, expected.editorScrollTop, `scrollTop=${scrollTop}: expected editorScrollTop ${expected.editorScrollTop}, got ${stubEditor._lastScrollTopSet}`);
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2VsbFBhcnQudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvdmlldy9jZWxsUGFydC50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSw2Q0FBNkMsQ0FBQztBQUd0RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFJN0UsS0FBSyxDQUFDLFVBQVUsRUFBRSxHQUFHLEVBQUU7SUFDdEIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxJQUFJLENBQUMseUNBQXlDLEVBQUUsR0FBRyxFQUFFO1FBQ3BEOzs7OztXQUtHO1FBaUJILE1BQU0sbUJBQW1CLEdBQUcsR0FBRyxDQUFDLENBQUMsbURBQW1EO1FBQ3BGLE1BQU0sc0JBQXNCLEdBQUcsR0FBRyxDQUFDLENBQUMsMkNBQTJDO1FBQy9FLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNyQixNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQyxxQ0FBcUM7UUFDM0QsTUFBTSxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBRWxCLE1BQU0sU0FBUyxHQUFtQjtZQUNqQztnQkFDQyxJQUFJLEVBQUUsTUFBTTtnQkFDWixTQUFTLEVBQUUsQ0FBQztnQkFDWixjQUFjLEVBQUUsR0FBRztnQkFDbkIsbUJBQW1CLEVBQUUsR0FBRztnQkFDeEIsWUFBWSxFQUFFLEdBQUc7Z0JBQ2pCLHFCQUFxQixFQUFFLEdBQUcsRUFBRSwyRUFBMkU7Z0JBQ3ZHLFFBQVEsRUFBRSxNQUFNO2dCQUNoQixVQUFVLEVBQUUsbUJBQW1CO2dCQUMvQixhQUFhLEVBQUUsc0JBQXNCO2dCQUNyQyxXQUFXLEVBQUUsQ0FBQztnQkFDZCx1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