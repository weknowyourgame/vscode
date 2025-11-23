/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getMonacoEnvironment } from '../../../../base/browser/browser.js';
import { WebWorkerService } from '../../../../platform/webWorker/browser/webWorkerServiceImpl.js';
export class StandaloneWebWorkerService extends WebWorkerService {
    _createWorker(descriptor) {
        const monacoEnvironment = getMonacoEnvironment();
        if (monacoEnvironment) {
            if (typeof monacoEnvironment.getWorker === 'function') {
                const worker = monacoEnvironment.getWorker('workerMain.js', descriptor.label);
                if (worker !== undefined) {
                    return Promise.resolve(worker);
                }
            }
        }
        return super._createWorker(descriptor);
    }
    getWorkerUrl(descriptor) {
        const monacoEnvironment = getMonacoEnvironment();
        if (monacoEnvironment) {
            if (typeof monacoEnvironment.getWorkerUrl === 'function') {
                const workerUrl = monacoEnvironment.getWorkerUrl('workerMain.js', descriptor.label);
                if (workerUrl !== undefined) {
                    const absoluteUrl = new URL(workerUrl, document.baseURI).toString();
                    return absoluteUrl;
                }
            }
        }
        if (!descriptor.esmModuleLocationBundler) {
            throw new Error(`You must define a function MonacoEnvironment.getWorkerUrl or MonacoEnvironment.getWorker for the worker label: ${descriptor.label}`);
        }
        const url = typeof descriptor.esmModuleLocationBundler === 'function' ? descriptor.esmModuleLocationBundler() : descriptor.esmModuleLocationBundler;
        const urlStr = url.toString();
        return urlStr;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhbG9uZVdlYldvcmtlclNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL3N0YW5kYWxvbmUvYnJvd3Nlci9zZXJ2aWNlcy9zdGFuZGFsb25lV2ViV29ya2VyU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUzRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUVsRyxNQUFNLE9BQU8sMEJBQTJCLFNBQVEsZ0JBQWdCO0lBQzVDLGFBQWEsQ0FBQyxVQUErQjtRQUMvRCxNQUFNLGlCQUFpQixHQUFHLG9CQUFvQixFQUFFLENBQUM7UUFDakQsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3ZCLElBQUksT0FBTyxpQkFBaUIsQ0FBQyxTQUFTLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQ3ZELE1BQU0sTUFBTSxHQUFHLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUM5RSxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDMUIsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNoQyxDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVRLFlBQVksQ0FBQyxVQUErQjtRQUNwRCxNQUFNLGlCQUFpQixHQUFHLG9CQUFvQixFQUFFLENBQUM7UUFDakQsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3ZCLElBQUksT0FBTyxpQkFBaUIsQ0FBQyxZQUFZLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQzFELE1BQU0sU0FBUyxHQUFHLGlCQUFpQixDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNwRixJQUFJLFNBQVMsS0FBSyxTQUFTLEVBQUUsQ0FBQztvQkFDN0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDcEUsT0FBTyxXQUFXLENBQUM7Z0JBQ3BCLENBQUM7WUFDRixDQUFDO1FBQ0YsQ0FBQztRQUVELElBQUksQ0FBQyxVQUFVLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUMxQyxNQUFNLElBQUksS0FBSyxDQUFDLGtIQUFrSCxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUN2SixDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsT0FBTyxVQUFVLENBQUMsd0JBQXdCLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsd0JBQXdCLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLHdCQUF3QixDQUFDO1FBQ3BKLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM5QixPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7Q0FDRCJ9