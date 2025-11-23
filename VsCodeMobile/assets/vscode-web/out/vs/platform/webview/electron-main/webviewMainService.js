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
import { webContents } from 'electron';
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { WebviewProtocolProvider } from './webviewProtocolProvider.js';
import { IWindowsMainService } from '../../windows/electron-main/windows.js';
import { IFileService } from '../../files/common/files.js';
let WebviewMainService = class WebviewMainService extends Disposable {
    constructor(fileService, windowsMainService) {
        super();
        this.windowsMainService = windowsMainService;
        this._onFoundInFrame = this._register(new Emitter());
        this.onFoundInFrame = this._onFoundInFrame.event;
        this._register(new WebviewProtocolProvider(fileService));
    }
    async setIgnoreMenuShortcuts(id, enabled) {
        let contents;
        if (typeof id.windowId === 'number') {
            const { windowId } = id;
            const window = this.windowsMainService.getWindowById(windowId);
            if (!window?.win) {
                throw new Error(`Invalid windowId: ${windowId}`);
            }
            contents = window.win.webContents;
        }
        else {
            const { webContentsId } = id;
            contents = webContents.fromId(webContentsId);
            if (!contents) {
                throw new Error(`Invalid webContentsId: ${webContentsId}`);
            }
        }
        if (!contents.isDestroyed()) {
            contents.setIgnoreMenuShortcuts(enabled);
        }
    }
    async findInFrame(windowId, frameName, text, options) {
        const initialFrame = this.getFrameByName(windowId, frameName);
        const frame = initialFrame;
        if (typeof frame.findInFrame === 'function') {
            frame.findInFrame(text, {
                findNext: options.findNext,
                forward: options.forward,
            });
            const foundInFrameHandler = (_, result) => {
                if (result.finalUpdate) {
                    this._onFoundInFrame.fire(result);
                    frame.removeListener('found-in-frame', foundInFrameHandler);
                }
            };
            frame.on('found-in-frame', foundInFrameHandler);
        }
    }
    async stopFindInFrame(windowId, frameName, options) {
        const initialFrame = this.getFrameByName(windowId, frameName);
        const frame = initialFrame;
        if (typeof frame.stopFindInFrame === 'function') {
            frame.stopFindInFrame(options.keepSelection ? 'keepSelection' : 'clearSelection');
        }
    }
    getFrameByName(windowId, frameName) {
        const window = this.windowsMainService.getWindowById(windowId.windowId);
        if (!window?.win) {
            throw new Error(`Invalid windowId: ${windowId}`);
        }
        const frame = window.win.webContents.mainFrame.framesInSubtree.find(frame => {
            return frame.name === frameName;
        });
        if (!frame) {
            throw new Error(`Unknown frame: ${frameName}`);
        }
        return frame;
    }
};
WebviewMainService = __decorate([
    __param(0, IFileService),
    __param(1, IWindowsMainService)
], WebviewMainService);
export { WebviewMainService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2Vidmlld01haW5TZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3dlYnZpZXcvZWxlY3Ryb24tbWFpbi93ZWJ2aWV3TWFpblNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFlLFdBQVcsRUFBZ0IsTUFBTSxVQUFVLENBQUM7QUFDbEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUUvRCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN2RSxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUM3RSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFcEQsSUFBTSxrQkFBa0IsR0FBeEIsTUFBTSxrQkFBbUIsU0FBUSxVQUFVO0lBT2pELFlBQ2UsV0FBeUIsRUFDbEIsa0JBQXdEO1FBRTdFLEtBQUssRUFBRSxDQUFDO1FBRjhCLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBcUI7UUFMN0Qsb0JBQWUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFzQixDQUFDLENBQUM7UUFDckUsbUJBQWMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztRQU8zRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksdUJBQXVCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRU0sS0FBSyxDQUFDLHNCQUFzQixDQUFDLEVBQTBDLEVBQUUsT0FBZ0I7UUFDL0YsSUFBSSxRQUFpQyxDQUFDO1FBRXRDLElBQUksT0FBUSxFQUFzQixDQUFDLFFBQVEsS0FBSyxRQUFRLEVBQUUsQ0FBQztZ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