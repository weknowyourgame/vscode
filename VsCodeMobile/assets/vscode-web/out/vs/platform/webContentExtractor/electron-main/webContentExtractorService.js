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
import { BrowserWindow } from 'electron';
import { URI } from '../../../base/common/uri.js';
import { convertAXTreeToMarkdown } from './cdpAccessibilityDomain.js';
import { Limiter } from '../../../base/common/async.js';
import { ResourceMap } from '../../../base/common/map.js';
import { ILogService } from '../../log/common/log.js';
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { CancellationError } from '../../../base/common/errors.js';
import { generateUuid } from '../../../base/common/uuid.js';
let NativeWebContentExtractorService = class NativeWebContentExtractorService {
    constructor(_logger) {
        this._logger = _logger;
        // Only allow 3 windows to be opened at a time
        // to avoid overwhelming the system with too many processes.
        this._limiter = new Limiter(3);
        this._webContentsCache = new ResourceMap();
        this._cacheDuration = 24 * 60 * 60 * 1000; // 1 day in milliseconds
    }
    isExpired(entry) {
        return Date.now() - entry.timestamp > this._cacheDuration;
    }
    extract(uris, options) {
        if (uris.length === 0) {
            this._logger.info('[NativeWebContentExtractorService] No URIs provided for extraction');
            return Promise.resolve([]);
        }
        this._logger.info(`[NativeWebContentExtractorService] Extracting content from ${uris.length} URIs`);
        return Promise.all(uris.map((uri) => this._limiter.queue(() => this.doExtract(uri, options))));
    }
    async doExtract(uri, options) {
        const cached = this._webContentsCache.get(uri);
        if (cached) {
            this._logger.info(`[NativeWebContentExtractorService] Found cached content for ${uri}`);
            if (this.isExpired(cached)) {
                this._logger.info(`[NativeWebContentExtractorService] Cache expired for ${uri}, removing entry...`);
                this._webContentsCache.delete(uri);
            }
            else if (!options?.followRedirects && cached.finalURI.authority !== uri.authority) {
                return { status: 'redirect', toURI: cached.finalURI };
            }
            else {
                return { status: 'ok', result: cached.result };
            }
        }
        this._logger.info(`[NativeWebContentExtractorService] Extracting content from ${uri}...`);
        const store = new DisposableStore();
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            show: false,
            webPreferences: {
                partition: generateUuid(), // do not share any state with the default renderer session
                javascript: true,
                offscreen: true,
                sandbox: true,
                webgl: false
            }
        });
        store.add(toDisposable(() => win.destroy()));
        try {
            const result = options?.followRedirects
                ? await this.extractAX(win, uri)
                : await Promise.race([this.interceptRedirects(win, uri, store), this.extractAX(win, uri)]);
            if (result.status === 'ok') {
                this._webContentsCache.set(uri, { result: result.result, timestamp: Date.now(), finalURI: URI.parse(win.webContents.getURL()) });
            }
            return result;
        }
        catch (err) {
            this._logger.error(`[NativeWebContentExtractorService] Error extracting content from ${uri}: ${err}`);
            return { status: 'error', error: String(err) };
        }
        finally {
            store.dispose();
        }
    }
    async extractAX(win, uri) {
        await win.loadURL(uri.toString(true));
        win.webContents.debugger.attach('1.1');
        const result = await win.webContents.debugger.sendCommand('Accessibility.getFullAXTree');
        const str = convertAXTreeToMarkdown(uri, result.nodes);
        this._logger.info(`[NativeWebContentExtractorService] Content extracted from ${uri}`);
        this._logger.trace(`[NativeWebContentExtractorService] Extracted content: ${str}`);
        return { status: 'ok', result: str };
    }
    interceptRedirects(win, uri, store) {
        return new Promise((resolve, reject) => {
            const onNavigation = (e) => {
                const newURI = URI.parse(e.url);
                if (newURI.authority !== uri.authority) {
                    e.preventDefault();
                    resolve({ status: 'redirect', toURI: newURI });
                }
            };
            win.webContents.on('will-navigate', onNavigation);
            win.webContents.on('will-redirect', onNavigation);
            store.add(toDisposable(() => {
                reject(new CancellationError());
            }));
        });
    }
};
NativeWebContentExtractorService = __decorate([
    __param(0, ILogService)
], NativeWebContentExtractorService);
export { NativeWebContentExtractorService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViQ29udGVudEV4dHJhY3RvclNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vd2ViQ29udGVudEV4dHJhY3Rvci9lbGVjdHJvbi1tYWluL3dlYkNvbnRlbnRFeHRyYWN0b3JTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxhQUFhLEVBQWtHLE1BQU0sVUFBVSxDQUFDO0FBRXpJLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQVUsdUJBQXVCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUM5RSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDeEQsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQzFELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2xGLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQVFyRCxJQUFNLGdDQUFnQyxHQUF0QyxNQUFNLGdDQUFnQztJQVM1QyxZQUF5QixPQUFxQztRQUFwQixZQUFPLEdBQVAsT0FBTyxDQUFhO1FBTjlELDhDQUE4QztRQUM5Qyw0REFBNEQ7UUFDcEQsYUFBUSxHQUFHLElBQUksT0FBTyxDQUEwQixDQUFDLENBQUMsQ0FBQztRQUNuRCxzQkFBaUIsR0FBRyxJQUFJLFdBQVcsRUFBYyxDQUFDO1FBQ3pDLG1CQUFjLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsd0JBQXdCO0lBRWIs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