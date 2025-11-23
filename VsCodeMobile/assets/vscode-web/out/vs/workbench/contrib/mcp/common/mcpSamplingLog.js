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
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { observableMemento } from '../../../../platform/observable/common/observableMemento.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
var Constants;
(function (Constants) {
    Constants[Constants["SamplingRetentionDays"] = 7] = "SamplingRetentionDays";
    Constants[Constants["MsPerDay"] = 86400000] = "MsPerDay";
    Constants[Constants["SamplingRetentionMs"] = 604800000] = "SamplingRetentionMs";
    Constants[Constants["SamplingLastNMessage"] = 30] = "SamplingLastNMessage";
})(Constants || (Constants = {}));
const samplingMemento = observableMemento({
    defaultValue: new Map(),
    key: 'mcp.sampling.logs',
    toStorage: v => JSON.stringify(Array.from(v.entries())),
    fromStorage: v => new Map(JSON.parse(v)),
});
let McpSamplingLog = class McpSamplingLog extends Disposable {
    constructor(_storageService) {
        super();
        this._storageService = _storageService;
        this._logs = {};
    }
    has(server) {
        const storage = this._getLogStorageForServer(server);
        return storage.get().has(server.definition.id);
    }
    get(server) {
        const storage = this._getLogStorageForServer(server);
        return storage.get().get(server.definition.id);
    }
    getAsText(server) {
        const storage = this._getLogStorageForServer(server);
        const record = storage.get().get(server.definition.id);
        if (!record) {
            return '';
        }
        const parts = [];
        const total = record.bins.reduce((sum, value) => sum + value, 0);
        parts.push(localize('mcp.sampling.rpd', '{0} total requests in the last 7 days.', total));
        parts.push(this._formatRecentRequests(record));
        return parts.join('\n');
    }
    _formatRecentRequests(data) {
        if (!data.lastReqs.length) {
            return '\nNo recent requests.';
        }
        const result = [];
        for (let i = 0; i < data.lastReqs.length; i++) {
            const { request, response, at, model } = data.lastReqs[i];
            result.push(`\n[${i + 1}] ${new Date(at).toISOString()} ${model}`);
            result.push('  Request:');
            for (const msg of request) {
                const role = msg.role.padEnd(9);
                let content = '';
                if ('text' in msg.content && msg.content.type === 'text') {
                    content = msg.content.text;
                }
                else if ('data' in msg.content) {
                    content = `[${msg.content.type} data: ${msg.content.mimeType}]`;
                }
                result.push(`    ${role}: ${content}`);
            }
            result.push('  Response:');
            result.push(`    ${response}`);
        }
        return result.join('\n');
    }
    async add(server, request, response, model) {
        const now = Date.now();
        const utcOrdinal = Math.floor(now / 86400000 /* Constants.MsPerDay */);
        const storage = this._getLogStorageForServer(server);
        const next = new Map(storage.get());
        let record = next.get(server.definition.id);
        if (!record) {
            record = {
                head: utcOrdinal,
                bins: Array.from({ length: 7 /* Constants.SamplingRetentionDays */ }, () => 0),
                lastReqs: [],
            };
        }
        else {
            // Shift bins back by daysSinceHead, dropping old days
            for (let i = 0; i < (utcOrdinal - record.head) && i < 7 /* Constants.SamplingRetentionDays */; i++) {
                record.bins.pop();
                record.bins.unshift(0);
            }
            record.head = utcOrdinal;
        }
        // Increment the current day's bin (head)
        record.bins[0]++;
        record.lastReqs.unshift({ request, response, at: now, model });
        while (record.lastReqs.length > 30 /* Constants.SamplingLastNMessage */) {
            record.lastReqs.pop();
        }
        next.set(server.definition.id, record);
        storage.set(next, undefined);
    }
    _getLogStorageForServer(server) {
        const scope = server.readDefinitions().get().collection?.scope ?? 1 /* StorageScope.WORKSPACE */;
        return this._logs[scope] ??= this._register(samplingMemento(scope, 1 /* StorageTarget.MACHINE */, this._storageService));
    }
};
McpSamplingLog = __decorate([
    __param(0, IStorageService)
], McpSamplingLog);
export { McpSamplingLog };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU2FtcGxpbmdMb2cuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tY3BTYW1wbGluZ0xvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQzlDLE9BQU8sRUFBcUIsaUJBQWlCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUNuSCxPQUFPLEVBQUUsZUFBZSxFQUErQixNQUFNLGdEQUFnRCxDQUFDO0FBSTlHLElBQVcsU0FLVjtBQUxELFdBQVcsU0FBUztJQUNuQiwyRUFBeUIsQ0FBQTtJQUN6Qix3REFBOEIsQ0FBQTtJQUM5QiwrRUFBc0QsQ0FBQTtJQUN0RCwwRUFBeUIsQ0FBQTtBQUMxQixDQUFDLEVBTFUsU0FBUyxLQUFULFNBQVMsUUFLbkI7QUFXRCxNQUFNLGVBQWUsR0FBRyxpQkFBaUIsQ0FBMkM7SUFDbkYsWUFBWSxFQUFFLElBQUksR0FBRyxFQUFFO0lBQ3ZCLEdBQUcsRUFBRSxtQkFBbUI7SUFDeEIsU0FBUyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELFdBQVcsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDeEMsQ0FBQyxDQUFDO0FBRUksSUFBTSxjQUFjLEdBQXBCLE1BQU0sY0FBZSxTQUFRLFVBQVU7SUFHN0MsWUFDa0IsZUFBaUQ7UUFFbEUsS0FBSyxFQUFFLENBQUM7UUFGMEIsb0JBQWUs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