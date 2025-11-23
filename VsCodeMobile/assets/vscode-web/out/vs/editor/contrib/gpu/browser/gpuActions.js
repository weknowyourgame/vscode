/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getActiveWindow } from '../../../../base/browser/dom.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { EditorAction, registerEditorAction } from '../../../browser/editorExtensions.js';
import { ensureNonNullable } from '../../../browser/gpu/gpuUtils.js';
import { GlyphRasterizer } from '../../../browser/gpu/raster/glyphRasterizer.js';
import { ViewGpuContext } from '../../../browser/gpu/viewGpuContext.js';
class DebugEditorGpuRendererAction extends EditorAction {
    constructor() {
        super({
            id: 'editor.action.debugEditorGpuRenderer',
            label: localize2('gpuDebug.label', "Developer: Debug Editor GPU Renderer"),
            // TODO: Why doesn't `ContextKeyExpr.equals('config:editor.experimentalGpuAcceleration', 'on')` work?
            precondition: ContextKeyExpr.true(),
        });
    }
    async run(accessor, editor) {
        const instantiationService = accessor.get(IInstantiationService);
        const quickInputService = accessor.get(IQuickInputService);
        const choice = await quickInputService.pick([
            {
                label: localize('logTextureAtlasStats.label', "Log Texture Atlas Stats"),
                id: 'logTextureAtlasStats',
            },
            {
                label: localize('saveTextureAtlas.label', "Save Texture Atlas"),
                id: 'saveTextureAtlas',
            },
            {
                label: localize('drawGlyph.label', "Draw Glyph"),
                id: 'drawGlyph',
            },
        ], { canPickMany: false });
        if (!choice) {
            return;
        }
        switch (choice.id) {
            case 'logTextureAtlasStats':
                instantiationService.invokeFunction(accessor => {
                    const logService = accessor.get(ILogService);
                    const atlas = ViewGpuContext.atlas;
                    if (!ViewGpuContext.atlas) {
                        logService.error('No texture atlas found');
                        return;
                    }
                    const stats = atlas.getStats();
                    logService.info(['Texture atlas stats', ...stats].join('\n\n'));
                });
                break;
            case 'saveTextureAtlas':
                instantiationService.invokeFunction(async (accessor) => {
                    const workspaceContextService = accessor.get(IWorkspaceContextService);
                    const fileService = accessor.get(IFileService);
                    const folders = workspaceContextService.getWorkspace().folders;
                    if (folders.length > 0) {
                        const atlas = ViewGpuContext.atlas;
                        const promises = [];
                        for (const [layerIndex, page] of atlas.pages.entries()) {
                            promises.push(...[
                                fileService.writeFile(URI.joinPath(folders[0].uri, `textureAtlasPage${layerIndex}_actual.png`), VSBuffer.wrap(new Uint8Array(await (await page.source.convertToBlob()).arrayBuffer()))),
                                fileService.writeFile(URI.joinPath(folders[0].uri, `textureAtlasPage${layerIndex}_usage.png`), VSBuffer.wrap(new Uint8Array(await (await page.getUsagePreview()).arrayBuffer()))),
                            ]);
                        }
                        await Promise.all(promises);
                    }
                });
                break;
            case 'drawGlyph':
                instantiationService.invokeFunction(async (accessor) => {
                    const configurationService = accessor.get(IConfigurationService);
                    const fileService = accessor.get(IFileService);
                    const quickInputService = accessor.get(IQuickInputService);
                    const workspaceContextService = accessor.get(IWorkspaceContextService);
                    const folders = workspaceContextService.getWorkspace().folders;
                    if (folders.length === 0) {
                        return;
                    }
                    const atlas = ViewGpuContext.atlas;
                    const fontFamily = configurationService.getValue('editor.fontFamily');
                    const fontSize = configurationService.getValue('editor.fontSize');
                    const rasterizer = new GlyphRasterizer(fontSize, fontFamily, getActiveWindow().devicePixelRatio, ViewGpuContext.decorationStyleCache);
                    let chars = await quickInputService.input({
                        prompt: 'Enter a character to draw (prefix with 0x for code point))'
                    });
                    if (!chars) {
                        return;
                    }
                    const codePoint = chars.match(/0x(?<codePoint>[0-9a-f]+)/i)?.groups?.codePoint;
                    if (codePoint !== undefined) {
                        chars = String.fromCodePoint(parseInt(codePoint, 16));
                    }
                    const tokenMetadata = 0;
                    const charMetadata = 0;
                    const rasterizedGlyph = atlas.getGlyph(rasterizer, chars, tokenMetadata, charMetadata, 0);
                    if (!rasterizedGlyph) {
                        return;
                    }
                    const imageData = atlas.pages[rasterizedGlyph.pageIndex].source.getContext('2d')?.getImageData(rasterizedGlyph.x, rasterizedGlyph.y, rasterizedGlyph.w, rasterizedGlyph.h);
                    if (!imageData) {
                        return;
                    }
                    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
                    const ctx = ensureNonNullable(canvas.getContext('2d'));
                    ctx.putImageData(imageData, 0, 0);
                    const blob = await canvas.convertToBlob({ type: 'image/png' });
                    const resource = URI.joinPath(folders[0].uri, `glyph_${chars}_${tokenMetadata}_${fontSize}px_${fontFamily.replaceAll(/[,\\\/\.'\s]/g, '_')}.png`);
                    await fileService.writeFile(resource, VSBuffer.wrap(new Uint8Array(await blob.arrayBuffer())));
                });
                break;
        }
    }
}
registerEditorAction(DebugEditorGpuRendererAction);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3B1QWN0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9ncHUvYnJvd3Nlci9ncHVBY3Rpb25zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUNsRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sb0JBQW9CLENBQUM7QUFDekQsT0FBTyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sNERBQTRELENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMxRSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDckUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sc0RBQXNELENBQUM7QUFDMUYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sb0RBQW9ELENBQUM7QUFFOUYsT0FBTyxFQUFFLFlBQVksRUFBRSxvQkFBb0IsRUFBeUIsTUFBTSxzQ0FBc0MsQ0FBQztBQUNqSCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDakYsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXhFLE1BQU0sNEJBQTZCLFNBQVEsWUFBWTtJQUV0RDtRQUNDLEtBQUss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