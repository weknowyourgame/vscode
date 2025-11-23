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
var NativeClipboardService_1;
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { URI } from '../../../../base/common/uri.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { ILogService } from '../../../../platform/log/common/log.js';
let NativeClipboardService = class NativeClipboardService {
    static { NativeClipboardService_1 = this; }
    static { this.FILE_FORMAT = 'code/file-list'; } // Clipboard format for files
    constructor(nativeHostService, logService) {
        this.nativeHostService = nativeHostService;
        this.logService = logService;
    }
    async triggerPaste(targetWindowId) {
        this.logService.trace('NativeClipboardService#triggerPaste called');
        return this.nativeHostService.triggerPaste({ targetWindowId });
    }
    async readImage() {
        return this.nativeHostService.readImage();
    }
    async writeText(text, type) {
        this.logService.trace('NativeClipboardService#writeText called with type:', type, ' with text.length:', text.length);
        return this.nativeHostService.writeClipboardText(text, type);
    }
    async readText(type) {
        this.logService.trace('NativeClipboardService#readText called with type:', type);
        return this.nativeHostService.readClipboardText(type);
    }
    async readFindText() {
        if (isMacintosh) {
            return this.nativeHostService.readClipboardFindText();
        }
        return '';
    }
    async writeFindText(text) {
        if (isMacintosh) {
            return this.nativeHostService.writeClipboardFindText(text);
        }
    }
    async writeResources(resources) {
        if (resources.length) {
            return this.nativeHostService.writeClipboardBuffer(NativeClipboardService_1.FILE_FORMAT, this.resourcesToBuffer(resources));
        }
    }
    async readResources() {
        return this.bufferToResources(await this.nativeHostService.readClipboardBuffer(NativeClipboardService_1.FILE_FORMAT));
    }
    async hasResources() {
        return this.nativeHostService.hasClipboard(NativeClipboardService_1.FILE_FORMAT);
    }
    resourcesToBuffer(resources) {
        return VSBuffer.fromString(resources.map(r => r.toString()).join('\n'));
    }
    bufferToResources(buffer) {
        if (!buffer) {
            return [];
        }
        const bufferValue = buffer.toString();
        if (!bufferValue) {
            return [];
        }
        try {
            return bufferValue.split('\n').map(f => URI.parse(f));
        }
        catch (error) {
            return []; // do not trust clipboard data
        }
    }
};
NativeClipboardService = NativeClipboardService_1 = __decorate([
    __param(0, INativeHostService),
    __param(1, ILogService)
], NativeClipboardService);
export { NativeClipboardService };
registerSingleton(IClipboardService, NativeClipboardService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpcGJvYXJkU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvY2xpcGJvYXJkL2VsZWN0cm9uLWJyb3dzZXIvY2xpcGJvYXJkU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkRBQTJELENBQUM7QUFDOUYsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUNsRSxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDbEYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUU5RCxJQUFNLHNCQUFzQixHQUE1QixNQUFNLHNCQUFzQjs7YUFFVixnQkFBVyxHQUFHLGdCQUFnQixBQUFuQixDQUFvQixHQUFDLDZCQUE2QjtJQUlyRixZQUNzQyxpQkFBcUMsRUFDNUMsVUFBdUI7UUFEaEIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFvQjtRQUM1QyxlQUFVLEdBQVYsVUFBVSxDQUFhO0lBQ2xELENBQUM7SUFFTCxLQUFLLENBQUMsWUFBWSxDQUFDLGNBQXNCO1FBQ3hDLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLDRDQUE0QyxDQUFDLENBQUM7UUFDcEUsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVM7UUFDZCxP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