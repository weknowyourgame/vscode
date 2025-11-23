/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { streamToBuffer } from '../../../base/common/buffer.js';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { AbstractOneDataSystemAppender } from '../common/1dsAppender.js';
/**
 * Completes a request to submit telemetry to the server utilizing the request service
 * @param options The options which will be used to make the request
 * @param requestService The request service
 * @returns An object containing the headers, statusCode, and responseData
 */
async function makeTelemetryRequest(options, requestService) {
    const response = await requestService.request(options, CancellationToken.None);
    const responseData = (await streamToBuffer(response.stream)).toString();
    const statusCode = response.res.statusCode ?? 200;
    const headers = response.res.headers;
    return {
        headers,
        statusCode,
        responseData
    };
}
/**
 * Complete a request to submit telemetry to the server utilizing the https module. Only used when the request service is not available
 * @param options The options which will be used to make the request
 * @returns An object containing the headers, statusCode, and responseData
 */
async function makeLegacyTelemetryRequest(options) {
    const https = await import('https'); // Lazy due to https://github.com/nodejs/node/issues/59686
    const httpsOptions = {
        method: options.type,
        headers: options.headers
    };
    const responsePromise = new Promise((resolve, reject) => {
        const req = https.request(options.url ?? '', httpsOptions, res => {
            res.on('data', function (responseData) {
                resolve({
                    headers: res.headers,
                    statusCode: res.statusCode ?? 200,
                    responseData: responseData.toString()
                });
            });
            // On response with error send status of 0 and a blank response to oncomplete so we can retry events
            res.on('error', function (err) {
                reject(err);
            });
        });
        req.write(options.data, (err) => {
            if (err) {
                reject(err);
            }
        });
        req.end();
    });
    return responsePromise;
}
async function sendPostAsync(requestService, payload, oncomplete) {
    const telemetryRequestData = typeof payload.data === 'string' ? payload.data : new TextDecoder().decode(payload.data);
    const requestOptions = {
        type: 'POST',
        headers: {
            ...payload.headers,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload.data).toString()
        },
        url: payload.urlString,
        data: telemetryRequestData
    };
    try {
        const responseData = requestService ? await makeTelemetryRequest(requestOptions, requestService) : await makeLegacyTelemetryRequest(requestOptions);
        oncomplete(responseData.statusCode, responseData.headers, responseData.responseData);
    }
    catch {
        // If it errors out, send status of 0 and a blank response to oncomplete so we can retry events
        oncomplete(0, {});
    }
}
export class OneDataSystemAppender extends AbstractOneDataSystemAppender {
    constructor(requestService, isInternalTelemetry, eventPrefix, defaultData, iKeyOrClientFactory) {
        // Override the way events get sent since node doesn't have XHTMLRequest
        const customHttpXHROverride = {
            sendPOST: (payload, oncomplete) => {
                // Fire off the async request without awaiting it
                sendPostAsync(requestService, payload, oncomplete);
            }
        };
        super(isInternalTelemetry, eventPrefix, defaultData, iKeyOrClientFactory, customHttpXHROverride);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiMWRzQXBwZW5kZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGVsZW1ldHJ5L25vZGUvMWRzQXBwZW5kZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBR3pFLE9BQU8sRUFBRSw2QkFBNkIsRUFBb0IsTUFBTSwwQkFBMEIsQ0FBQztBQVUzRjs7Ozs7R0FLRztBQUNILEtBQUssVUFBVSxvQkFBb0IsQ0FBQyxPQUF3QixFQUFFLGNBQStCO0lBQzVGLE1BQU0sUUFBUSxHQUFHLE1BQU0sY0FBYyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0UsTUFBTSxZQUFZLEdBQUcsQ0FBQyxNQUFNLGNBQWMsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUN4RSxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQVUsSUFBSSxHQUFHLENBQUM7SUFDbEQsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFpQyxDQUFDO0lBQy9ELE9BQU87UUFDTixPQUFPO1FBQ1AsVUFBVTtRQUNWLFlBQVk7S0FDWixDQUFDO0FBQ0gsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxLQUFLLFVBQVUsMEJBQTBCLENBQUMsT0FBd0I7SUFDakUsTUFBTSxLQUFLLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQywwREFBMEQ7SUFDL0YsTUFBTSxZQUFZLEdBQUc7UUFDcEIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxJQUFJO1FBQ3BCLE9BQU8sRUFBRSxPQUFPLENBQUMs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