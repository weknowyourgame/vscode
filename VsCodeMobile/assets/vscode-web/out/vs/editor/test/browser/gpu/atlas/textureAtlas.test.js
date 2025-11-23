/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual, throws } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ensureNonNullable } from '../../../../browser/gpu/gpuUtils.js';
import { TextureAtlas } from '../../../../browser/gpu/atlas/textureAtlas.js';
import { createCodeEditorServices } from '../../testCodeEditor.js';
import { assertIsValidGlyph } from './testUtil.js';
import { TextureAtlasSlabAllocator } from '../../../../browser/gpu/atlas/textureAtlasSlabAllocator.js';
import { DecorationStyleCache } from '../../../../browser/gpu/css/decorationStyleCache.js';
const blackInt = 0x000000FF;
const nullCharMetadata = 0x0;
let lastUniqueGlyph;
function getUniqueGlyphId() {
    if (!lastUniqueGlyph) {
        lastUniqueGlyph = 'a';
    }
    else {
        lastUniqueGlyph = String.fromCharCode(lastUniqueGlyph.charCodeAt(0) + 1);
    }
    return [lastUniqueGlyph, blackInt, nullCharMetadata, 0];
}
class TestGlyphRasterizer {
    constructor() {
        this.id = 0;
        this.cacheKey = '';
        this.nextGlyphColor = [0, 0, 0, 0];
        this.nextGlyphDimensions = [0, 0];
    }
    rasterizeGlyph(chars, tokenMetadata, charMetadata, colorMap) {
        const w = this.nextGlyphDimensions[0];
        const h = this.nextGlyphDimensions[1];
        if (w === 0 || h === 0) {
            throw new Error('TestGlyphRasterizer.nextGlyphDimensions must be set to a non-zero value before calling rasterizeGlyph');
        }
        const imageData = new ImageData(w, h);
        let i = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const [r, g, b, a] = this.nextGlyphColor;
                i = (y * w + x) * 4;
                imageData.data[i + 0] = r;
                imageData.data[i + 1] = g;
                imageData.data[i + 2] = b;
                imageData.data[i + 3] = a;
            }
        }
        const canvas = new OffscreenCanvas(w, h);
        const ctx = ensureNonNullable(canvas.getContext('2d'));
        ctx.putImageData(imageData, 0, 0);
        return {
            source: canvas,
            boundingBox: { top: 0, left: 0, bottom: h - 1, right: w - 1 },
            originOffset: { x: 0, y: 0 },
            fontBoundingBoxAscent: 0,
            fontBoundingBoxDescent: 0,
        };
    }
    getTextMetrics(text) {
        return null;
    }
}
suite('TextureAtlas', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    suiteSetup(() => {
        lastUniqueGlyph = undefined;
    });
    let instantiationService;
    let atlas;
    let glyphRasterizer;
    setup(() => {
        instantiationService = createCodeEditorServices(store);
        atlas = store.add(instantiationService.createInstance(TextureAtlas, 2, undefined, new DecorationStyleCache()));
        glyphRasterizer = new TestGlyphRasterizer();
        glyphRasterizer.nextGlyphDimensions = [1, 1];
        glyphRasterizer.nextGlyphColor = [0, 0, 0, 0xFF];
    });
    test('get single glyph', () => {
        assertIsValidGlyph(atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), atlas);
    });
    test('get multiple glyphs', () => {
        atlas = store.add(instantiationService.createInstance(TextureAtlas, 32, undefined, new DecorationStyleCache()));
        for (let i = 0; i < 10; i++) {
            assertIsValidGlyph(atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), atlas);
        }
    });
    test('adding glyph to full page creates new page', () => {
        let pageCount;
        for (let i = 0; i < 4; i++) {
            assertIsValidGlyph(atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), atlas);
            if (pageCount === undefined) {
                pageCount = atlas.pages.length;
            }
            else {
                strictEqual(atlas.pages.length, pageCount, 'the number of pages should not change when the page is being filled');
            }
        }
        assertIsValidGlyph(atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), atlas);
        strictEqual(atlas.pages.length, pageCount + 1, 'the 5th glyph should overflow to a new page');
    });
    test('adding a glyph larger than the atlas', () => {
        glyphRasterizer.nextGlyphDimensions = [3, 2];
        throws(() => atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), 'should throw when the glyph is too large, this should not happen in practice');
    });
    test('adding a glyph larger than the standard slab size', () => {
        glyphRasterizer.nextGlyphDimensions = [2, 2];
        atlas = store.add(instantiationService.createInstance(TextureAtlas, 32, {
            allocatorType: (canvas, textureIndex) => new TextureAtlasSlabAllocator(canvas, textureIndex, { slabW: 1, slabH: 1 })
        }, new DecorationStyleCache()));
        assertIsValidGlyph(atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), atlas);
    });
    test('adding a non-first glyph larger than the standard slab size, causing an overflow to a new page', () => {
        atlas = store.add(instantiationService.createInstance(TextureAtlas, 2, {
            allocatorType: (canvas, textureIndex) => new TextureAtlasSlabAllocator(canvas, textureIndex, { slabW: 1, slabH: 1 })
        }, new DecorationStyleCache()));
        assertIsValidGlyph(atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), atlas);
        strictEqual(atlas.pages.length, 1);
        glyphRasterizer.nextGlyphDimensions = [2, 2];
        assertIsValidGlyph(atlas.getGlyph(glyphRasterizer, ...getUniqueGlyphId()), atlas);
        strictEqual(atlas.pages.length, 2, 'the 2nd glyph should overflow to a new page with a larger slab size');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dHVyZUF0bGFzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL3Rlc3QvYnJvd3Nlci9ncHUvYXRsYXMvdGV4dHVyZUF0bGFzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDN0MsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFeEUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHlCQUF5QixDQUFDO0FBQ25FLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUNuRCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUN2RyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUUzRixNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUM7QUFDNUIsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7QUFFN0IsSUFBSSxlQUFtQyxDQUFDO0FBQ3hDLFNBQVMsZ0JBQWdCO0lBQ3hCLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN0QixlQUFlLEdBQUcsR0FBRyxDQUFDO0lBQ3ZCLENBQUM7U0FBTSxDQUFDO1FBQ1AsZUFBZSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBQ0QsT0FBTyxDQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFD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