/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { importAMDNodeModule } from '../../../amdX.js';
import { onUnexpectedError } from '../../../base/common/errors.js';
import { mixin } from '../../../base/common/objects.js';
import { isWeb } from '../../../base/common/platform.js';
import { validateTelemetryData } from './telemetryUtils.js';
const endpointUrl = 'https://mobile.events.data.microsoft.com/OneCollector/1.0';
const endpointHealthUrl = 'https://mobile.events.data.microsoft.com/ping';
async function getClient(instrumentationKey, addInternalFlag, xhrOverride) {
    // eslint-disable-next-line local/code-amd-node-module
    const oneDs = isWeb ? await importAMDNodeModule('@microsoft/1ds-core-js', 'bundle/ms.core.min.js') : await import('@microsoft/1ds-core-js');
    // eslint-disable-next-line local/code-amd-node-module
    const postPlugin = isWeb ? await importAMDNodeModule('@microsoft/1ds-post-js', 'bundle/ms.post.min.js') : await import('@microsoft/1ds-post-js');
    const appInsightsCore = new oneDs.AppInsightsCore();
    const collectorChannelPlugin = new postPlugin.PostChannel();
    // Configure the app insights core to send to collector++ and disable logging of debug info
    const coreConfig = {
        instrumentationKey,
        endpointUrl,
        loggingLevelTelemetry: 0,
        loggingLevelConsole: 0,
        disableCookiesUsage: true,
        disableDbgExt: true,
        disableInstrumentationKeyValidation: true,
        channels: [[
                collectorChannelPlugin
            ]]
    };
    if (xhrOverride) {
        coreConfig.extensionConfig = {};
        // Configure the channel to use a XHR Request override since it's not available in node
        const channelConfig = {
            alwaysUseXhrOverride: true,
            ignoreMc1Ms0CookieProcessing: true,
            httpXHROverride: xhrOverride
        };
        coreConfig.extensionConfig[collectorChannelPlugin.identifier] = channelConfig;
    }
    appInsightsCore.initialize(coreConfig, []);
    appInsightsCore.addTelemetryInitializer((envelope) => {
        // Opt the user out of 1DS data sharing
        envelope['ext'] = envelope['ext'] ?? {};
        envelope['ext']['web'] = envelope['ext']['web'] ?? {};
        envelope['ext']['web']['consentDetails'] = '{"GPC_DataSharingOptIn":false}';
        if (addInternalFlag) {
            envelope['ext']['utc'] = envelope['ext']['utc'] ?? {};
            // Sets it to be internal only based on Windows UTC flagging
            envelope['ext']['utc']['flags'] = 0x0000811ECD;
        }
    });
    return appInsightsCore;
}
// TODO @lramos15 maybe make more in line with src/vs/platform/telemetry/browser/appInsightsAppender.ts with caching support
export class AbstractOneDataSystemAppender {
    constructor(_isInternalTelemetry, _eventPrefix, _defaultData, iKeyOrClientFactory, // allow factory function for testing
    _xhrOverride) {
        this._isInternalTelemetry = _isInternalTelemetry;
        this._eventPrefix = _eventPrefix;
        this._defaultData = _defaultData;
        this._xhrOverride = _xhrOverride;
        this.endPointUrl = endpointUrl;
        this.endPointHealthUrl = endpointHealthUrl;
        if (!this._defaultData) {
            this._defaultData = {};
        }
        if (typeof iKeyOrClientFactory === 'function') {
            this._aiCoreOrKey = iKeyOrClientFactory();
        }
        else {
            this._aiCoreOrKey = iKeyOrClientFactory;
        }
        this._asyncAiCore = null;
    }
    _withAIClient(callback) {
        if (!this._aiCoreOrKey) {
            return;
        }
        if (typeof this._aiCoreOrKey !== 'string') {
            callback(this._aiCoreOrKey);
            return;
        }
        if (!this._asyncAiCore) {
            this._asyncAiCore = getClient(this._aiCoreOrKey, this._isInternalTelemetry, this._xhrOverride);
        }
        this._asyncAiCore.then((aiClient) => {
            callback(aiClient);
        }, (err) => {
            onUnexpectedError(err);
            console.error(err);
        });
    }
    log(eventName, data) {
        if (!this._aiCoreOrKey) {
            return;
        }
        data = mixin(data, this._defaultData);
        const validatedData = validateTelemetryData(data);
        const name = this._eventPrefix + '/' + eventName;
        try {
            this._withAIClient((aiClient) => {
                aiClient.pluginVersionString = validatedData?.properties.version ?? 'Unknown';
                aiClient.track({
                    name,
                    baseData: { name, properties: validatedData?.properties, measurements: validatedData?.measurements }
                });
            });
        }
        catch { }
    }
    flush() {
        if (this._aiCoreOrKey) {
            return new Promise(resolve => {
                this._withAIClient((aiClient) => {
                    aiClient.unload(true, () => {
                        this._aiCoreOrKey = undefined;
                        resolve(undefined);
                    });
                });
            });
        }
        return Promise.resolve(undefined);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMWRzQXBwZW5kZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi8xZHNBcHBlbmRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxPQUFPLEVBQUUsbUJBQW1CLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUN2RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDeEQsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3pELE9BQU8sRUFBc0IscUJBQXFCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQVVoRixNQUFNLFdBQVcsR0FBRywyREFBMkQsQ0FBQztBQUNoRixNQUFNLGlCQUFpQixHQUFHLCtDQUErQyxDQUFDO0FBRTFFLEtBQUssVUFBVSxTQUFTLENBQUMsa0JBQTBCLEVBQUUsZUFBeUIsRUFBRSxXQUEwQjtJQUN6RyxzREFBc0Q7SUFDdEQsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLG1CQUFtQixDQUEwQyx3QkFBd0IsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0lBQ3JMLHNEQUFzRDtJQUN0RCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLE1BQU0sbUJBQW1CLENBQTBDLHdCQUF3QixFQUFFLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sTUFBTSxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFFMUwsTUFBTSxlQUFlLEdBQUcsSUFBSSxLQUFLLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDcEQsTUFBTSxzQkFBc0IsR0FBZ0IsSUFBSSxVQUFVLENBQUMs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