/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { decodeBase64, VSBuffer } from '../../../base/common/buffer.js';
import { joinPath } from '../../../base/common/resources.js';
import { registerSingleton } from '../../instantiation/common/extensions.js';
import { IImageResizeService } from '../common/imageResizeService.js';
export class ImageResizeService {
    /**
     * Resizes an image provided as a UInt8Array string. Resizing is based on Open AI's algorithm for tokenzing images.
     * https://platform.openai.com/docs/guides/vision#calculating-costs
     * @param data - The UInt8Array string of the image to resize.
     * @returns A promise that resolves to the UInt8Array string of the resized image.
     */
    async resizeImage(data, mimeType) {
        const isGif = mimeType === 'image/gif';
        if (typeof data === 'string') {
            data = this.convertStringToUInt8Array(data);
        }
        return new Promise((resolve, reject) => {
            const blob = new Blob([data], { type: mimeType });
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.src = url;
            img.onload = () => {
                URL.revokeObjectURL(url);
                let { width, height } = img;
                if ((width <= 768 || height <= 768) && !isGif) {
                    resolve(data);
                    return;
                }
                // Calculate the new dimensions while maintaining the aspect ratio
                if (width > 2048 || height > 2048) {
                    const scaleFactor = 2048 / Math.max(width, height);
                    width = Math.round(width * scaleFactor);
                    height = Math.round(height * scaleFactor);
                }
                const scaleFactor = 768 / Math.min(width, height);
                width = Math.round(width * scaleFactor);
                height = Math.round(height * scaleFactor);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const jpegTypes = ['image/jpeg', 'image/jpg'];
                    const outputMimeType = mimeType && jpegTypes.includes(mimeType) ? 'image/jpeg' : 'image/png';
                    canvas.toBlob(blob => {
                        if (blob) {
                            const reader = new FileReader();
                            reader.onload = () => {
                                resolve(new Uint8Array(reader.result));
                            };
                            reader.onerror = (error) => reject(error);
                            reader.readAsArrayBuffer(blob);
                        }
                        else {
                            reject(new Error('Failed to create blob from canvas'));
                        }
                    }, outputMimeType);
                }
                else {
                    reject(new Error('Failed to get canvas context'));
                }
            };
            img.onerror = (error) => {
                URL.revokeObjectURL(url);
                reject(error);
            };
        });
    }
    convertStringToUInt8Array(data) {
        const base64Data = data.includes(',') ? data.split(',')[1] : data;
        if (this.isValidBase64(base64Data)) {
            return decodeBase64(base64Data).buffer;
        }
        return new TextEncoder().encode(data);
    }
    // Only used for URLs
    convertUint8ArrayToString(data) {
        try {
            const decoder = new TextDecoder();
            const decodedString = decoder.decode(data);
            return decodedString;
        }
        catch {
            return '';
        }
    }
    isValidBase64(str) {
        try {
            decodeBase64(str);
            return true;
        }
        catch {
            return false;
        }
    }
    async createFileForMedia(fileService, imagesFolder, dataTransfer, mimeType) {
        const exists = await fileService.exists(imagesFolder);
        if (!exists) {
            await fileService.createFolder(imagesFolder);
        }
        const ext = mimeType.split('/')[1] || 'png';
        const filename = `image-${Date.now()}.${ext}`;
        const fileUri = joinPath(imagesFolder, filename);
        const buffer = VSBuffer.wrap(dataTransfer);
        await fileService.writeFile(fileUri, buffer);
        return fileUri;
    }
    async cleanupOldImages(fileService, logService, imagesFolder) {
        const exists = await fileService.exists(imagesFolder);
        if (!exists) {
            return;
        }
        const duration = 7 * 24 * 60 * 60 * 1000; // 7 days
        const files = await fileService.resolve(imagesFolder);
        if (!files.children) {
            return;
        }
        await Promise.all(files.children.map(async (file) => {
            try {
                const timestamp = this.getTimestampFromFilename(file.name);
                if (timestamp && (Date.now() - timestamp > duration)) {
                    await fileService.del(file.resource);
                }
            }
            catch (err) {
                logService.error('Failed to clean up old images', err);
            }
        }));
    }
    getTimestampFromFilename(filename) {
        const match = filename.match(/image-(\d+)\./);
        if (match) {
            return parseInt(match[1], 10);
        }
        return undefined;
    }
}
registerSingleton(IImageResizeService, ImageResizeService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2VSZXNpemVTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL2ltYWdlUmVzaXplL2Jyb3dzZXIvaW1hZ2VSZXNpemVTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDeEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBRzdELE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVoRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUd0RSxNQUFNLE9BQU8sa0JBQWtCO0lBSTlCOzs7OztPQUtHO0lBRUgsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUF5QixFQUFFLFFBQWlCO1FBQzdELE1BQU0sS0FBSyxHQUFHLFFBQVEsS0FBSyxXQUFXLENBQUM7UUFFdkMsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM5QixJQUFJLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFFRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3RDLE1BQU0sSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLENBQUMsSUFBK0IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDN0UsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUN4QixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1lBRWQsR0FBRyxD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