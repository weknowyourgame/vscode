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
import { assertNever } from '../../../../../base/common/assert.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { Iterable } from '../../../../../base/common/iterator.js';
import { ResourceSet } from '../../../../../base/common/map.js';
import { extname } from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { localize } from '../../../../../nls.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IWebContentExtractorService } from '../../../../../platform/webContentExtractor/common/webContentExtractor.js';
import { detectEncodingFromBuffer } from '../../../../services/textfile/common/encoding.js';
import { ITrustedDomainService } from '../../../url/browser/trustedDomainService.js';
import { IChatService } from '../../common/chatService.js';
import { LocalChatSessionUri } from '../../common/chatUri.js';
import { ChatImageMimeType } from '../../common/languageModels.js';
import { ToolDataSource } from '../../common/languageModelToolsService.js';
import { InternalFetchWebPageToolId } from '../../common/tools/tools.js';
export const FetchWebPageToolData = {
    id: InternalFetchWebPageToolId,
    displayName: 'Fetch Web Page',
    canBeReferencedInPrompt: false,
    modelDescription: 'Fetches the main content from a web page. This tool is useful for summarizing or analyzing the content of a webpage.',
    source: ToolDataSource.Internal,
    canRequestPostApproval: true,
    canRequestPreApproval: true,
    inputSchema: {
        type: 'object',
        properties: {
            urls: {
                type: 'array',
                items: {
                    type: 'string',
                },
                description: localize('fetchWebPage.urlsDescription', 'An array of URLs to fetch content from.')
            }
        },
        required: ['urls']
    }
};
let FetchWebPageTool = class FetchWebPageTool {
    constructor(_readerModeService, _fileService, _trustedDomainService, _chatService) {
        this._readerModeService = _readerModeService;
        this._fileService = _fileService;
        this._trustedDomainService = _trustedDomainService;
        this._chatService = _chatService;
    }
    async invoke(invocation, _countTokens, _progress, token) {
        const urls = invocation.parameters.urls || [];
        const { webUris, fileUris, invalidUris } = this._parseUris(urls);
        const allValidUris = [...webUris.values(), ...fileUris.values()];
        if (!allValidUris.length && invalidUris.size === 0) {
            return {
                content: [{ kind: 'text', value: localize('fetchWebPage.noValidUrls', 'No valid URLs provided.') }]
            };
        }
        // Get contents from web URIs
        const webContents = webUris.size > 0 ? await this._readerModeService.extract([...webUris.values()]) : [];
        // Get contents from file URIs
        const fileContents = [];
        const successfulFileUris = [];
        for (const uri of fileUris.values()) {
            try {
                const fileContent = await this._fileService.readFile(uri, undefined, token);
                // Check if this is a supported image type first
                const imageMimeType = this._getSupportedImageMimeType(uri);
                if (imageMimeType) {
                    // For supported image files, return as IToolResultDataPart
                    fileContents.push({
                        type: 'tooldata',
                        value: {
                            kind: 'data',
                            value: {
                                mimeType: imageMimeType,
                                data: fileContent.value
                            }
                        }
                    });
                }
                else {
                    // Check if the content is binary
                    const detected = detectEncodingFromBuffer({ buffer: fileContent.value, bytesRead: fileContent.value.byteLength });
                    if (detected.seemsBinary) {
                        // For binary files, return a message indicating they're not supported
                        // We do this for now until the tools that leverage this internal tool can support binary content
                        fileContents.push(localize('fetchWebPage.binaryNotSupported', 'Binary files are not supported at the moment.'));
                    }
                    else {
                        // For text files, convert to string
                        fileContents.push(fileContent.value.toString());
                    }
                }
                successfulFileUris.push(uri);
            }
            catch (error) {
                // If file service can't read it, treat as invalid
                fileContents.push(undefined);
            }
        }
        // Build results array in original order
        const results = [];
        let webIndex = 0;
        let fileIndex = 0;
        for (const url of urls) {
            if (invalidUris.has(url)) {
                results.push(undefined);
            }
            else if (webUris.has(url)) {
                results.push({ type: 'extracted', value: webContents[webIndex] });
                webIndex++;
            }
            else if (fileUris.has(url)) {
                results.push(fileContents[fileIndex]);
                fileIndex++;
            }
            else {
                results.push(undefined);
            }
        }
        // Skip confirming any results if every web content we got was an error or redirect
        let confirmResults;
        if (webContents.every(e => e.status === 'error' || e.status === 'redirect')) {
            confirmResults = false;
        }
        // Only include URIs that actually had content successfully fetched
        const actuallyValidUris = [...webUris.values(), ...successfulFileUris];
        return {
            content: this._getPromptPartsForResults(results),
            toolResultDetails: actuallyValidUris,
            confirmResults,
        };
    }
    async prepareToolInvocation(context, token) {
        const { webUris, fileUris, invalidUris } = this._parseUris(context.parameters.urls);
        // Check which file URIs can actually be read
        const validFileUris = [];
        const additionalInvalidUrls = [];
        for (const [originalUrl, uri] of fileUris.entries()) {
            try {
                await this._fileService.stat(uri);
                validFileUris.push(uri);
            }
            catch (error) {
                // If file service can't stat it, treat as invalid
                additionalInvalidUrls.push(originalUrl);
            }
        }
        const invalid = [...Array.from(invalidUris), ...additionalInvalidUrls];
        const urlsNeedingConfirmation = new ResourceSet([...webUris.values(), ...validFileUris]);
        const pastTenseMessage = invalid.length
            ? invalid.length > 1
                // If there are multiple invalid URLs, show them all
                ? new MarkdownString(localize('fetchWebPage.pastTenseMessage.plural', 'Fetched {0} resources, but the following were invalid URLs:\n\n{1}\n\n', urlsNeedingConfirmation.size, invalid.map(url => `- ${url}`).join('\n')))
                // If there is only one invalid URL, show it
                : new MarkdownString(localize('fetchWebPage.pastTenseMessage.singular', 'Fetched resource, but the following was an invalid URL:\n\n{0}\n\n', invalid[0]))
            // No invalid URLs
            : new MarkdownString();
        const invocationMessage = new MarkdownString();
        if (urlsNeedingConfirmation.size > 1) {
            pastTenseMessage.appendMarkdown(localize('fetchWebPage.pastTenseMessageResult.plural', 'Fetched {0} resources', urlsNeedingConfirmation.size));
            invocationMessage.appendMarkdown(localize('fetchWebPage.invocationMessage.plural', 'Fetching {0} resources', urlsNeedingConfirmation.size));
        }
        else if (urlsNeedingConfirmation.size === 1) {
            const url = Iterable.first(urlsNeedingConfirmation).toString();
            // If the URL is too long or it's a file url, show it as a link... otherwise, show it as plain text
            if (url.length > 400 || validFileUris.length === 1) {
                pastTenseMessage.appendMarkdown(localize({
                    key: 'fetchWebPage.pastTenseMessageResult.singularAsLink',
                    comment: [
                        // Make sure the link syntax is correct
                        '{Locked="]({0})"}',
                    ]
                }, 'Fetched [resource]({0})', url));
                invocationMessage.appendMarkdown(localize({
                    key: 'fetchWebPage.invocationMessage.singularAsLink',
                    comment: [
                        // Make sure the link syntax is correct
                        '{Locked="]({0})"}',
                    ]
                }, 'Fetching [resource]({0})', url));
            }
            else {
                pastTenseMessage.appendMarkdown(localize('fetchWebPage.pastTenseMessageResult.singular', 'Fetched {0}', url));
                invocationMessage.appendMarkdown(localize('fetchWebPage.invocationMessage.singular', 'Fetching {0}', url));
            }
        }
        if (context.chatSessionId) {
            const model = this._chatService.getSession(LocalChatSessionUri.forSession(context.chatSessionId));
            const userMessages = model?.getRequests().map(r => r.message.text.toLowerCase());
            for (const uri of urlsNeedingConfirmation) {
                // Normalize to lowercase and remove any trailing slash
                const toToCheck = uri.toString(true).toLowerCase().replace(/\/$/, '');
                if (userMessages?.some(m => m.includes(toToCheck))) {
                    urlsNeedingConfirmation.delete(uri);
                }
            }
        }
        const result = { invocationMessage, pastTenseMessage };
        const allDomainsTrusted = Iterable.every(urlsNeedingConfirmation, u => this._trustedDomainService.isValid(u));
        let confirmationTitle;
        let confirmationMessage;
        if (urlsNeedingConfirmation.size && !allDomainsTrusted) {
            if (urlsNeedingConfirmation.size === 1) {
                confirmationTitle = localize('fetchWebPage.confirmationTitle.singular', 'Fetch web page?');
                confirmationMessage = new MarkdownString(Iterable.first(urlsNeedingConfirmation).toString(), { supportThemeIcons: true });
            }
            else {
                confirmationTitle = localize('fetchWebPage.confirmationTitle.plural', 'Fetch web pages?');
                confirmationMessage = new MarkdownString([...urlsNeedingConfirmation].map(uri => `- ${uri.toString()}`).join('\n'), { supportThemeIcons: true });
            }
        }
        result.confirmationMessages = {
            title: confirmationTitle,
            message: confirmationMessage,
            confirmResults: urlsNeedingConfirmation.size > 0,
            allowAutoConfirm: true,
            disclaimer: new MarkdownString('$(info) ' + localize('fetchWebPage.confirmationMessage.plural', 'Web content may contain malicious code or attempt prompt injection attacks.'), { supportThemeIcons: true })
        };
        return result;
    }
    _parseUris(urls) {
        const webUris = new Map();
        const fileUris = new Map();
        const invalidUris = new Set();
        urls?.forEach(url => {
            try {
                const uriObj = URI.parse(url);
                if (uriObj.scheme === 'http' || uriObj.scheme === 'https') {
                    webUris.set(url, uriObj);
                }
                else {
                    // Try to handle other schemes via file service
                    fileUris.set(url, uriObj);
                }
            }
            catch (e) {
                invalidUris.add(url);
            }
        });
        return { webUris, fileUris, invalidUris };
    }
    _getPromptPartsForResults(results) {
        return results.map(value => {
            if (!value) {
                return {
                    kind: 'text',
                    value: localize('fetchWebPage.invalidUrl', 'Invalid URL')
                };
            }
            else if (typeof value === 'string') {
                return {
                    kind: 'text',
                    value: value
                };
            }
            else if (value.type === 'tooldata') {
                return value.value;
            }
            else if (value.type === 'extracted') {
                switch (value.value.status) {
                    case 'ok':
                        return { kind: 'text', value: value.value.result };
                    case 'redirect':
                        return { kind: 'text', value: `The webpage has redirected to "${value.value.toURI.toString(true)}". Use the ${InternalFetchWebPageToolId} again to get its contents.` };
                    case 'error':
                        return { kind: 'text', value: `An error occurred retrieving the fetch result: ${value.value.error}` };
                    default:
                        assertNever(value.value);
                }
            }
            else {
                throw new Error('unreachable');
            }
        });
    }
    _getSupportedImageMimeType(uri) {
        const ext = extname(uri.path).toLowerCase();
        switch (ext) {
            case '.png':
                return ChatImageMimeType.PNG;
            case '.jpg':
            case '.jpeg':
                return ChatImageMimeType.JPEG;
            case '.gif':
                return ChatImageMimeType.GIF;
            case '.webp':
                return ChatImageMimeType.WEBP;
            case '.bmp':
                return ChatImageMimeType.BMP;
            default:
                return undefined;
        }
    }
};
FetchWebPageTool = __decorate([
    __param(0, IWebContentExtractorService),
    __param(1, IFileService),
    __param(2, ITrustedDomainService),
    __param(3, IChatService)
], FetchWebPageTool);
export { FetchWebPageTool };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmV0Y2hQYWdlVG9vbC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2VsZWN0cm9uLWJyb3dzZXIvdG9vbHMvZmV0Y2hQYWdlVG9vbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFFbkUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDakQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQzdFLE9BQU8sRUFBRSwyQkFBMkIsRUFBMkIsTUFBTSwyRUFBMkUsQ0FBQztBQUNqSixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM1RixPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUNyRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDM0QsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDOUQsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDbkUsT0FBTyxFQUFpTCxjQUFjLEVBQWdCLE1BQU0sMkNBQTJDLENBQUM7QUFDeFEsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1B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