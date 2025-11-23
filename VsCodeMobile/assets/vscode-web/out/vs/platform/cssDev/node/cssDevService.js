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
import { spawn } from 'child_process';
import { relative } from '../../../base/common/path.js';
import { FileAccess } from '../../../base/common/network.js';
import { StopWatch } from '../../../base/common/stopwatch.js';
import { IEnvironmentService } from '../../environment/common/environment.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ILogService } from '../../log/common/log.js';
export const ICSSDevelopmentService = createDecorator('ICSSDevelopmentService');
let CSSDevelopmentService = class CSSDevelopmentService {
    constructor(envService, logService) {
        this.envService = envService;
        this.logService = logService;
    }
    get isEnabled() {
        return !this.envService.isBuilt;
    }
    getCssModules() {
        this._cssModules ??= this.computeCssModules();
        return this._cssModules;
    }
    async computeCssModules() {
        if (!this.isEnabled) {
            return [];
        }
        const rg = await import('@vscode/ripgrep');
        return await new Promise((resolve) => {
            const sw = StopWatch.create();
            const chunks = [];
            const basePath = FileAccess.asFileUri('').fsPath;
            const process = spawn(rg.rgPath, ['-g', '**/*.css', '--files', '--no-ignore', basePath], {});
            process.stdout.on('data', data => {
                chunks.push(data);
            });
            process.on('error', err => {
                this.logService.error('[CSS_DEV] FAILED to compute CSS data', err);
                resolve([]);
            });
            process.on('close', () => {
                const data = Buffer.concat(chunks).toString('utf8');
                const result = data.split('\n').filter(Boolean).map(path => relative(basePath, path).replace(/\\/g, '/')).filter(Boolean).sort();
                if (result.some(path => path.indexOf('vs/') !== 0)) {
                    this.logService.error(`[CSS_DEV] Detected invalid paths in css modules, raw output: ${data}`);
                }
                resolve(result);
                this.logService.info(`[CSS_DEV] DONE, ${result.length} css modules (${Math.round(sw.elapsed())}ms)`);
            });
        });
    }
};
CSSDevelopmentService = __decorate([
    __param(0, IEnvironmentService),
    __param(1, ILogService)
], CSSDevelopmentService);
export { CSSDevelopmentService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3NzRGV2U2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9jc3NEZXYvbm9kZS9jc3NEZXZTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7Ozs7O0FBRWhHLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDdEMsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3hELE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUM3RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDOUQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDOUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUV0RCxNQUFNLENBQUMsTUFBTSxzQkFBc0IsR0FBRyxlQUFlLENBQXlCLHdCQUF3QixDQUFDLENBQUM7QUFRakcsSUFBTSxxQkFBcUIsR0FBM0IsTUFBTSxxQkFBcUI7SUFNakMsWUFDdUMsVUFBK0IsRUFDdkMsVUFBdUI7UUFEZixlQUFVLEdBQVYsVUFBVSxDQUFxQjtRQUN2QyxlQUFVLEdBQVYsVUFBVSxDQUFhO0lBQ2xELENBQUM7SUFFTCxJQUFJLFNBQVM7UUFDWixPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7SUFDakMsQ0FBQztJQUVELGFBQWE7UUFDWixJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQzlDLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUN6QixDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQjtRQUM5QixJQUFJLENBQUMsSUFBSSxDQUFD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