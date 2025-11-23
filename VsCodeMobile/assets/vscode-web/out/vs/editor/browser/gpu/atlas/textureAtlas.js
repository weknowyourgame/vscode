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
var TextureAtlas_1;
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { BugIndicatingError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, dispose, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { NKeyMap } from '../../../../base/common/map.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { GlyphRasterizer } from '../raster/glyphRasterizer.js';
import { IdleTaskQueue } from '../taskQueue.js';
import { TextureAtlasPage } from './textureAtlasPage.js';
let TextureAtlas = class TextureAtlas extends Disposable {
    static { TextureAtlas_1 = this; }
    /**
     * The maximum number of texture atlas pages. This is currently a hard static cap that must not
     * be reached.
     */
    static { this.maximumPageCount = 16; }
    get pages() { return this._pages; }
    constructor(
    /** The maximum texture size supported by the GPU. */
    _maxTextureSize, options, _decorationStyleCache, _themeService, _instantiationService) {
        super();
        this._maxTextureSize = _maxTextureSize;
        this._decorationStyleCache = _decorationStyleCache;
        this._themeService = _themeService;
        this._instantiationService = _instantiationService;
        this._warmUpTask = this._register(new MutableDisposable());
        this._warmedUpRasterizers = new Set();
        /**
         * The main texture atlas pages which are both larger textures and more efficiently packed
         * relative to the scratch page. The idea is the main pages are drawn to and uploaded to the GPU
         * much less frequently so as to not drop frames.
         */
        this._pages = [];
        /**
         * A maps of glyph keys to the page to start searching for the glyph. This is set before
         * searching to have as little runtime overhead (branching, intermediate variables) as possible,
         * so it is not guaranteed to be the actual page the glyph is on. But it is guaranteed that all
         * pages with a lower index do not contain the glyph.
         */
        this._glyphPageIndex = new NKeyMap();
        this._onDidDeleteGlyphs = this._register(new Emitter());
        this.onDidDeleteGlyphs = this._onDidDeleteGlyphs.event;
        this._allocatorType = options?.allocatorType ?? 'slab';
        this._register(Event.runAndSubscribe(this._themeService.onDidColorThemeChange, () => {
            if (this._colorMap) {
                this.clear();
            }
            this._colorMap = this._themeService.getColorTheme().tokenColorMap;
        }));
        const dprFactor = Math.max(1, Math.floor(getActiveWindow().devicePixelRatio));
        this.pageSize = Math.min(1024 * dprFactor, this._maxTextureSize);
        this._initFirstPage();
        this._register(toDisposable(() => dispose(this._pages)));
    }
    _initFirstPage() {
        const firstPage = this._instantiationService.createInstance(TextureAtlasPage, 0, this.pageSize, this._allocatorType);
        this._pages.push(firstPage);
        // IMPORTANT: The first glyph on the first page must be an empty glyph such that zeroed out
        // cells end up rendering nothing
        // TODO: This currently means the first slab is for 0x0 glyphs and is wasted
        const nullRasterizer = new GlyphRasterizer(1, '', 1, this._decorationStyleCache);
        firstPage.getGlyph(nullRasterizer, '', 0, 0);
        nullRasterizer.dispose();
    }
    clear() {
        // Clear all pages
        for (const page of this._pages) {
            page.dispose();
        }
        this._pages.length = 0;
        this._glyphPageIndex.clear();
        this._warmedUpRasterizers.clear();
        this._warmUpTask.clear();
        // Recreate first
        this._initFirstPage();
        // Tell listeners
        this._onDidDeleteGlyphs.fire();
    }
    getGlyph(rasterizer, chars, tokenMetadata, decorationStyleSetId, x) {
        // TODO: Encode font size and family into key
        // Ignore metadata that doesn't affect the glyph
        tokenMetadata &= ~(255 /* MetadataConsts.LANGUAGEID_MASK */ | 768 /* MetadataConsts.TOKEN_TYPE_MASK */ | 1024 /* MetadataConsts.BALANCED_BRACKETS_MASK */);
        // Add x offset for sub-pixel rendering to the unused portion or tokenMetadata. This
        // converts the decimal part of the x to a range from 0 to 9, where 0 = 0.0px x offset,
        // 9 = 0.9px x offset
        tokenMetadata |= Math.floor((x % 1) * 10);
        // Warm up common glyphs
        if (!this._warmedUpRasterizers.has(rasterizer.id)) {
            this._warmUpAtlas(rasterizer);
            this._warmedUpRasterizers.add(rasterizer.id);
        }
        // Try get the glyph, overflowing to a new page if necessary
        return this._tryGetGlyph(this._glyphPageIndex.get(chars, tokenMetadata, decorationStyleSetId, rasterizer.cacheKey) ?? 0, rasterizer, chars, tokenMetadata, decorationStyleSetId);
    }
    _tryGetGlyph(pageIndex, rasterizer, chars, tokenMetadata, decorationStyleSetId) {
        this._glyphPageIndex.set(pageIndex, chars, tokenMetadata, decorationStyleSetId, rasterizer.cacheKey);
        return (this._pages[pageIndex].getGlyph(rasterizer, chars, tokenMetadata, decorationStyleSetId)
            ?? (pageIndex + 1 < this._pages.length
                ? this._tryGetGlyph(pageIndex + 1, rasterizer, chars, tokenMetadata, decorationStyleSetId)
                : undefined)
            ?? this._getGlyphFromNewPage(rasterizer, chars, tokenMetadata, decorationStyleSetId));
    }
    _getGlyphFromNewPage(rasterizer, chars, tokenMetadata, decorationStyleSetId) {
        if (this._pages.length >= TextureAtlas_1.maximumPageCount) {
            throw new Error(`Attempt to create a texture atlas page past the limit ${TextureAtlas_1.maximumPageCount}`);
        }
        this._pages.push(this._instantiationService.createInstance(TextureAtlasPage, this._pages.length, this.pageSize, this._allocatorType));
        this._glyphPageIndex.set(this._pages.length - 1, chars, tokenMetadata, decorationStyleSetId, rasterizer.cacheKey);
        return this._pages[this._pages.length - 1].getGlyph(rasterizer, chars, tokenMetadata, decorationStyleSetId);
    }
    getUsagePreview() {
        return Promise.all(this._pages.map(e => e.getUsagePreview()));
    }
    getStats() {
        return this._pages.map(e => e.getStats());
    }
    /**
     * Warms up the atlas by rasterizing all printable ASCII characters for each token color. This
     * is distrubuted over multiple idle callbacks to avoid blocking the main thread.
     */
    _warmUpAtlas(rasterizer) {
        const colorMap = this._colorMap;
        if (!colorMap) {
            throw new BugIndicatingError('Cannot warm atlas without color map');
        }
        this._warmUpTask.value?.clear();
        const taskQueue = this._warmUpTask.value = this._instantiationService.createInstance(IdleTaskQueue);
        // Warm up using roughly the larger glyphs first to help optimize atlas allocation
        // A-Z
        for (let code = 65 /* CharCode.A */; code <= 90 /* CharCode.Z */; code++) {
            for (const fgColor of colorMap.keys()) {
                taskQueue.enqueue(() => {
                    for (let x = 0; x < 1; x += 0.1) {
                        this.getGlyph(rasterizer, String.fromCharCode(code), (fgColor << 15 /* MetadataConsts.FOREGROUND_OFFSET */) & 16744448 /* MetadataConsts.FOREGROUND_MASK */, 0, x);
                    }
                });
            }
        }
        // a-z
        for (let code = 97 /* CharCode.a */; code <= 122 /* CharCode.z */; code++) {
            for (const fgColor of colorMap.keys()) {
                taskQueue.enqueue(() => {
                    for (let x = 0; x < 1; x += 0.1) {
                        this.getGlyph(rasterizer, String.fromCharCode(code), (fgColor << 15 /* MetadataConsts.FOREGROUND_OFFSET */) & 16744448 /* MetadataConsts.FOREGROUND_MASK */, 0, x);
                    }
                });
            }
        }
        // Remaining ascii
        for (let code = 33 /* CharCode.ExclamationMark */; code <= 126 /* CharCode.Tilde */; code++) {
            for (const fgColor of colorMap.keys()) {
                taskQueue.enqueue(() => {
                    for (let x = 0; x < 1; x += 0.1) {
                        this.getGlyph(rasterizer, String.fromCharCode(code), (fgColor << 15 /* MetadataConsts.FOREGROUND_OFFSET */) & 16744448 /* MetadataConsts.FOREGROUND_MASK */, 0, x);
                    }
                });
            }
        }
    }
};
TextureAtlas = TextureAtlas_1 = __decorate([
    __param(3, IThemeService),
    __param(4, IInstantiationService)
], TextureAtlas);
export { TextureAtlas };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZUF0bGFzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9icm93c2VyL2dwdS9hdGxhcy90ZXh0dXJlQXRsYXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUVsRSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN2RSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQzVHLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUN6RCxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFHbEYsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRS9ELE9BQU8sRUFBRSxhQUFhLEVBQW1CLE1BQU0saUJBQWlCLENBQUM7QUFFakUsT0FBTyxFQUFpQixnQkFBZ0IsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBTWpFLElBQU0sWUFBWSxHQUFsQixNQUFNLFlBQWEsU0FBUSxVQUFVOztJQU0zQzs7O09BR0c7YUFDYSxxQkFBZ0IsR0FBRyxFQUFFLEFBQUwsQ0FBTTtJQVF0QyxJQUFJLEtBQUssS0FBa0MsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQWVoRTtJQUNDLHFEQUFxRDtJQUNwQyxlQUF1QixFQUN4QyxPQUF5QyxFQUN4QixxQkFBMkMsRUFDN0MsYUFBNkMsRUFDckMscUJBQTZEO1FBRXBGLEtBQUssRUFBRSxDQUFDO1FBTlMsb0JBQWUsR0FBZixlQUFlLENBQVE7UUFFdkIsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUFzQjtRQUM1QixrQkFBYSxHQUFiLGFBQWEsQ0FBZTtRQUNwQiwwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBckNwRSxnQkFBVyxHQUFrQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLHlCQUFvQixHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7UUFTMUQ7Ozs7V0FJRztRQUNjLFdBQU0sR0FBdUIsRUFBRSxDQUFDO1FBS2pEOzs7OztXQUtHO1FBQ2Msb0JBQWUsR0FBcUIsSUFBSSxPQUFPLEVBQUUsQ0FBQztRQUVsRCx1QkFBa0IsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksT0FBTyxFQUFRLENBQUMsQ0FBQztRQUNqRSxzQkFBaUIsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDO1FBWTFELElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxFQUFFLGFBQWEsSUFBSSxNQUFNLENBQUM7UUFFdkQsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMscUJBQXFCLEVBQUUsR0FBRyxFQUFFO1lBQ25GLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNwQixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDZCxDQUFDO1lBQ0QsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsRUFBRSxDQUFDLGFBQWEsQ0FBQztRQUNuRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRUosTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7UUFFOUUsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksR0FBRyxTQUFTLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUV0QixJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRU8sY0FBYztRQUNyQixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsY0FBYyxDQUFDLGdCQUFnQixFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNySCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUU1QiwyRkFBMkY7UUFDM0YsaUNBQWlDO1FBQ2pDLDRFQUE0RTtRQUM1RSxNQUFNLGNBQWMsR0FBRyxJQUFJLGVBQWUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUNqRixTQUFTLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzdDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRUQsS0FBSztRQUNKLGtCQUFrQjtRQUNsQixLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDaEIsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUN2QixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNsQyxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRXpCLGlCQUFpQjtRQUNqQixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFdEIsaUJBQWlCO1FBQ2pCLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNoQyxDQUFDO0lBRUQsUUFBUSxDQUFDLFVBQTRCLEVBQUUsS0FBYSxFQUFFLGFBQXFCLEVBQUUsb0JBQTRCLEVBQUUsQ0FBUztRQUNuSCw2Q0FBNkM7UUFDN0MsZ0RBQWdEO1FBQ2hELGFBQWEsSUFBSSxDQUFDLENBQUMsbUZBQStELG1EQUF3QyxDQUFDLENBQUM7UUFFNUgsb0ZBQW9GO1FBQ3BGLHVGQUF1RjtRQUN2RixxQkFBcUI7UUFDckIsYUFBYSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFFMUMsd0JBQXdCO1FBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ25ELElBQUksQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUVELDREQUE0RDtRQUM1RCxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLGFBQWEsRUFBRSxvQkFBb0IsRUFBRSxVQUFVLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLG9CQUFvQixDQUFDLENBQUM7SUFDbEwsQ0FBQztJQUVPLFlBQVksQ0FBQyxTQUFpQixFQUFFLFVBQTRCLEVBQUUsS0FBYSxFQUFFLGFBQXFCLEVBQUUsb0JBQTRCO1FBQ3ZJLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNyRyxPQUFPLENBQ04sSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsb0JBQW9CLENBQUM7ZUFDcEYsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTTtnQkFDckMsQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxvQkFBb0IsQ0FBQztnQkFDMUYsQ0FBQyxDQUFDLFNBQVMsQ0FBQztlQUNWLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxvQkFBb0IsQ0FBQyxDQUNwRixDQUFDO0lBQ0gsQ0FBQztJQUVPLG9CQUFvQixDQUFDLFVBQTRCLEVBQUUsS0FBYSxFQUFFLGFBQXFCLEVBQUUsb0JBQTRCO1FBQzVILElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLElBQUksY0FBWSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDekQsTUFBTSxJQUFJLEtBQUssQ0FBQyx5REFBeUQsY0FBWSxDQUFDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztRQUMzRyxDQUFDO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO1FBQ3RJLElBQUksQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNsSCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsYUFBYSxFQUFFLG9CQUFvQixDQUFFLENBQUM7SUFDOUcsQ0FBQztJQUVNLGVBQWU7UUFDckIsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRU0sUUFBUTtRQUNkLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssWUFBWSxDQUFDLFVBQTRCO1FBQ2hELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDaEMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2YsTUFBTSxJQUFJLGtCQUFrQixDQUFDLHFDQUFxQyxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQ2hDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDcEcsa0ZBQWtGO1FBQ2xGLE1BQU07UUFDTixLQUFLLElBQUksSUFBSSxzQkFBYSxFQUFFLElBQUksdUJBQWMsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ3hELEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7Z0JBQ3ZDLFNBQVMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO29CQUN0QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQzt3QkFDakMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sNkNBQW9DLENBQUMsZ0RBQWlDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUM1SSxDQUFDO2dCQUNGLENBQUMsQ0FBQyxDQUFDO1lBQ0osQ0FBQztRQUNGLENBQUM7UUFDRCxNQUFNO1FBQ04sS0FBSyxJQUFJLElBQUksc0JBQWEsRUFBRSxJQUFJLHdCQUFjLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUN4RCxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUN2QyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtvQkFDdEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7d0JBQ2pDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLDZDQUFvQyxDQUFDLGdEQUFpQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDNUksQ0FBQztnQkFDRixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7UUFDRixDQUFDO1FBQ0Qsa0JBQWtCO1FBQ2xCLEtBQUssSUFBSSxJQUFJLG9DQUEyQixFQUFFLElBQUksNEJBQWtCLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUMxRSxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUN2QyxTQUFTLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtvQkFDdEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7d0JBQ2pDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLDZDQUFvQyxDQUFDLGdEQUFpQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztvQkFDNUksQ0FBQztnQkFDRixDQUFDLENBQUMsQ0FBQztZQUNKLENBQUM7UUFDRixDQUFDO0lBQ0YsQ0FBQzs7QUFuTFcsWUFBWTtJQXNDdEIsV0FBQSxhQUFhLENBQUE7SUFDYixXQUFBLHFCQUFxQixDQUFBO0dBdkNYLFlBQVksQ0FvTHhCIn0=