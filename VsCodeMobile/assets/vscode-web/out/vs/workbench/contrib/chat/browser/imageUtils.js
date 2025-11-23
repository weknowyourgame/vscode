/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { decodeBase64, VSBuffer } from '../../../../base/common/buffer.js';
import { joinPath } from '../../../../base/common/resources.js';
/**
 * Resizes an image provided as a UInt8Array string. Resizing is based on Open AI's algorithm for tokenzing images.
 * https://platform.openai.com/docs/guides/vision#calculating-costs
 * @param data - The UInt8Array string of the image to resize.
 * @returns A promise that resolves to the UInt8Array string of the resized image.
 */
export async function resizeImage(data, mimeType) {
    const isGif = mimeType === 'image/gif';
    if (typeof data === 'string') {
        data = convertStringToUInt8Array(data);
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
export function convertStringToUInt8Array(data) {
    const base64Data = data.includes(',') ? data.split(',')[1] : data;
    if (isValidBase64(base64Data)) {
        return decodeBase64(base64Data).buffer;
    }
    return new TextEncoder().encode(data);
}
// Only used for URLs
export function convertUint8ArrayToString(data) {
    try {
        const decoder = new TextDecoder();
        const decodedString = decoder.decode(data);
        return decodedString;
    }
    catch {
        return '';
    }
}
function isValidBase64(str) {
    // checks if the string is a valid base64 string that is NOT encoded
    return /^[A-Za-z0-9+/]*={0,2}$/.test(str) && (() => {
        try {
            atob(str);
            return true;
        }
        catch {
            return false;
        }
    })();
}
export async function createFileForMedia(fileService, imagesFolder, dataTransfer, mimeType) {
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
export async function cleanupOldImages(fileService, logService, imagesFolder) {
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
            const timestamp = getTimestampFromFilename(file.name);
            if (timestamp && (Date.now() - timestamp > duration)) {
                await fileService.del(file.resource);
            }
        }
        catch (err) {
            logService.error('Failed to clean up old images', err);
        }
    }));
}
function getTimestampFromFilename(filename) {
    const match = filename.match(/image-(\d+)\./);
    if (match) {
        return parseInt(match[1], 10);
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1hZ2VVdGlscy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvaW1hZ2VVdGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUtoRTs7Ozs7R0FLRztBQUVILE1BQU0sQ0FBQyxLQUFLLFVBQVUsV0FBVyxDQUFDLElBQXlCLEVBQUUsUUFBaUI7SUFDN0UsTUFBTSxLQUFLLEdBQUcsUUFBUSxLQUFLLFdBQVcsQ0FBQztJQUV2QyxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzlCLElBQUksR0FBRyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxDQUFDLElBQStCLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLE1BQU0sR0FBRyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7UUFDeEIsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUVkLEdBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFFO1lBQ2pCLEdBQUcsQ0FBQyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDekIsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUM7WUFFNUIsSUFBSSxD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