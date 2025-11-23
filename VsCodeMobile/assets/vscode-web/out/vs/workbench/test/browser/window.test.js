/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { mainWindow } from '../../../base/browser/window.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { runWithFakedTimers } from '../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { BaseWindow } from '../../browser/window.js';
import { TestContextMenuService, TestEnvironmentService, TestHostService, TestLayoutService } from './workbenchTestServices.js';
suite('Window', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    class TestWindow extends BaseWindow {
        constructor(window, dom) {
            super(window, dom, new TestHostService(), TestEnvironmentService, new TestContextMenuService(), new TestLayoutService());
        }
        enableWindowFocusOnElementFocus() { }
    }
    test('multi window aware setTimeout()', async function () {
        return runWithFakedTimers({ useFakeTimers: true }, async () => {
            const disposables = new DisposableStore();
            let windows = [];
            const dom = {
                getWindowsCount: () => windows.length,
                getWindows: () => windows
            };
            const setTimeoutCalls = [];
            const clearTimeoutCalls = [];
            function createWindow(id, slow) {
                // eslint-disable-next-line local/code-no-any-casts
                const res = {
                    setTimeout: function (callback, delay, ...args) {
                        setTimeoutCalls.push(id);
                        return mainWindow.setTimeout(() => callback(id), slow ? delay * 2 : delay, ...args);
                    },
                    clearTimeout: function (timeoutId) {
                        clearTimeoutCalls.push(id);
                        return mainWindow.clearTimeout(timeoutId);
                    }
                };
                disposables.add(new TestWindow(res, dom));
                return res;
            }
            const window1 = createWindow(1);
            windows = [{ window: window1, disposables }];
            // Window Count: 1
            let called = false;
            await new Promise((resolve, reject) => {
                window1.setTimeout(() => {
                    if (!called) {
                        called = true;
                        resolve();
                    }
                    else {
                        reject(new Error('timeout called twice'));
                    }
                }, 1);
            });
            assert.strictEqual(called, true);
            assert.deepStrictEqual(setTimeoutCalls, [1]);
            assert.deepStrictEqual(clearTimeoutCalls, []);
            called = false;
            setTimeoutCalls.length = 0;
            clearTimeoutCalls.length = 0;
            await new Promise((resolve, reject) => {
                window1.setTimeout(() => {
                    if (!called) {
                        called = true;
                        resolve();
                    }
                    else {
                        reject(new Error('timeout called twice'));
                    }
                }, 0);
            });
            assert.strictEqual(called, true);
            assert.deepStrictEqual(setTimeoutCalls, [1]);
            assert.deepStrictEqual(clearTimeoutCalls, []);
            called = false;
            setTimeoutCalls.length = 0;
            clearTimeoutCalls.length = 0;
            // Window Count: 3
            let window2 = createWindow(2);
            const window3 = createWindow(3);
            windows = [
                { window: window2, disposables },
                { window: window1, disposables },
                { window: window3, disposables }
            ];
            await new Promise((resolve, reject) => {
                window1.setTimeout(() => {
                    if (!called) {
                        called = true;
                        resolve();
                    }
                    else {
                        reject(new Error('timeout called twice'));
                    }
                }, 1);
            });
            assert.strictEqual(called, true);
            assert.deepStrictEqual(setTimeoutCalls, [2, 1, 3]);
            assert.deepStrictEqual(clearTimeoutCalls, [2, 1, 3]);
            called = false;
            setTimeoutCalls.length = 0;
            clearTimeoutCalls.length = 0;
            // Window Count: 2 (1 fast, 1 slow)
            window2 = createWindow(2, true);
            windows = [
                { window: window2, disposables },
                { window: window1, disposables },
            ];
            await new Promise((resolve, reject) => {
                window1.setTimeout((windowId) => {
                    if (!called && windowId === 1) {
                        called = true;
                        resolve();
                    }
                    else if (called) {
                        reject(new Error('timeout called twice'));
                    }
                    else {
                        reject(new Error('timeout called for wrong window'));
                    }
                }, 1);
            });
            assert.strictEqual(called, true);
            assert.deepStrictEqual(setTimeoutCalls, [2, 1]);
            assert.deepStrictEqual(clearTimeoutCalls, [2, 1]);
            called = false;
            setTimeoutCalls.length = 0;
            clearTimeoutCalls.length = 0;
            disposables.dispose();
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2luZG93LnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3Rlc3QvYnJvd3Nlci93aW5kb3cudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFFNUIsT0FBTyxFQUFjLFVBQVUsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUN0RixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM3RixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDckQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLHNCQUFzQixFQUFFLGVBQWUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBRWhJLEtBQUssQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO0lBRXBCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsTUFBTSxVQUFXLFNBQVEsVUFBVTtRQUVsQyxZQUFZLE1BQWtCLEVBQUUsR0FBeUY7WUFDeEgsS0FBSyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxlQUFlLEVBQUUsRUFBRSxzQkFBc0IsRUFBRSxJQUFJLHNCQUFzQixFQUFFLEVBQUUsSUFBSSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFDMUgsQ0FBQztRQUVrQiwrQkFBK0IsS0FBVyxDQUFDO0tBQzlEO0lBRUQsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLEtBQUs7UUFDNUMsT0FBTyxrQkFBa0IsQ0FBQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM3RCxNQUFNLFdBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBRTFDLElBQUksT0FBTyxHQUE0QixFQUFFLENBQUM7WUFDMUMsTUFBTSxHQUFHLEdBQUc7Z0JBQ1gsZUFBZSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNO2dCQUNyQyxVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTzthQUN6QixDQUFDO1lBRUYsTUFBTSxlQUFlLEdBQWEsRUFBRSxDQUFDO1lBQ3JDLE1BQU0saUJBQWlCLEdBQWEsRUFBRSxDQUFDO1lBRXZDLFNBQVMsWUFBWSxDQUFDLEVBQVUsRUFBRSxJQUFjO2dCQUMvQyxtREFBbUQ7Z0JBQ25ELE1BQU0sR0FBRyxHQUFHO29CQUNYLFVBQVUsRUFBRSxVQUFVLFFBQWtCLEVBQUUsS0FBYSxFQUFFLEdBQUcsSUFBVzt3QkFDdEUsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQzt3QkFFekIsT0FBTyxVQUFVLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO29CQUNyRixDQUFDO29CQUNELFlBQVksRUFBRSxVQUFVLFNBQWlCO3dCQUN4QyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7d0JBRTNCLE9BQU8sVUFBVSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDM0MsQ0FBQztpQkFDTSxDQUFDO2dCQUVULFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBRTFDLE9BQU8sR0FBRyxDQUFDO1lBQ1osQ0FBQztZQUVELE1BQU0sT0FBTyxHQUFHLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoQyxPQUFPLEdBQUcsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUU3QyxrQkFBa0I7WUFFbEIsSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO1lBQ25CLE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQzNDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFO29CQUN2QixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQ2IsTUFBTSxHQUFHLElBQUksQ0FBQzt3QkFDZCxPQUFPLEVBQUUsQ0FBQztvQkFDWCxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztvQkFDM0MsQ0FBQztnQkFDRixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQztZQUVILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pDLE1BQU0sQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QyxNQUFNLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLE1BQU0sR0FBRyxLQUFLLENBQUM7WUFDZixlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUMzQixpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBRTdCLE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQzNDLE9BQU8sQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFO29CQUN2QixJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7d0JBQ2IsTUFBTSxHQUFHLElBQUksQ0FBQzt3QkFDZCxPQUFPLEVBQUUsQ0FBQztvQkFDWCxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztvQkFDM0MsQ0FBQztnQkFDRixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQztZQUVILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pDLE1BQU0sQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM3QyxNQUFNLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLE1BQU0sR0FBRyxLQUFLLENBQUM7WUFDZixlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUMzQixpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBRTdCLGtCQUFrQjtZQUVsQixJQUFJLE9BQU8sR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUIsTUFBTSxPQUFPLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLE9BQU8sR0FBRztnQkFDVCxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFO2dCQUNoQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFO2dCQUNoQyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFO2FBQ2hDLENBQUM7WUFFRixNQUFNLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO2dCQUMzQyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRTtvQkFDdkIsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUNiLE1BQU0sR0FBRyxJQUFJLENBQUM7d0JBQ2QsT0FBTyxFQUFFLENBQUM7b0JBQ1gsQ0FBQzt5QkFBTSxDQUFDO3dCQUNQLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7b0JBQzNDLENBQUM7Z0JBQ0YsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUM7WUFFSCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNqQyxNQUFNLENBQUMsZUFBZSxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuRCxNQUFNLENBQUMsZUFBZSxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3JELE1BQU0sR0FBRyxLQUFLLENBQUM7WUFDZixlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUMzQixpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBRTdCLG1DQUFtQztZQUVuQyxPQUFPLEdBQUcsWUFBWSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNoQyxPQUFPLEdBQUc7Z0JBQ1QsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRTtnQkFDaEMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRTthQUNoQyxDQUFDO1lBRUYsTUFBTSxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtnQkFDM0MsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDLFFBQWdCLEVBQUUsRUFBRTtvQkFDdkMsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQy9CLE1BQU0sR0FBRyxJQUFJLENBQUM7d0JBQ2QsT0FBTyxFQUFFLENBQUM7b0JBQ1gsQ0FBQzt5QkFBTSxJQUFJLE1BQU0sRUFBRSxDQUFDO3dCQUNuQixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDO29CQUMzQyxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGlDQUFpQyxDQUFDLENBQUMsQ0FBQztvQkFDdEQsQ0FBQztnQkFDRixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQztZQUVILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pDLE1BQU0sQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xELE1BQU0sR0FBRyxLQUFLLENBQUM7WUFDZixlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUMzQixpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBRTdCLFdBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUMifQ==