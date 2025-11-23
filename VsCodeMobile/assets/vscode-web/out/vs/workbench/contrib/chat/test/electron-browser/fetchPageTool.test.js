/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { ResourceMap } from '../../../../../base/common/map.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FetchWebPageTool } from '../../electron-browser/tools/fetchPageTool.js';
import { TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { MockTrustedDomainService } from '../../../url/test/browser/mockTrustedDomainService.js';
import { InternalFetchWebPageToolId } from '../../common/tools/tools.js';
import { MockChatService } from '../common/mockChatService.js';
import { upcastDeepPartial } from '../../../../../base/test/common/mock.js';
class TestWebContentExtractorService {
    constructor(uriToContentMap) {
        this.uriToContentMap = uriToContentMap;
    }
    async extract(uris) {
        return uris.map(uri => {
            const content = this.uriToContentMap.get(uri);
            if (content === undefined) {
                throw new Error(`No content configured for URI: ${uri.toString()}`);
            }
            return { status: 'ok', result: content };
        });
    }
}
class ExtendedTestFileService extends TestFileService {
    constructor(uriToContentMap) {
        super();
        this.uriToContentMap = uriToContentMap;
    }
    async readFile(resource, options) {
        const content = this.uriToContentMap.get(resource);
        if (content === undefined) {
            throw new Error(`File not found: ${resource.toString()}`);
        }
        const buffer = typeof content === 'string' ? VSBuffer.fromString(content) : content;
        return {
            resource,
            value: buffer,
            name: '',
            size: buffer.byteLength,
            etag: '',
            mtime: 0,
            ctime: 0,
            readonly: false,
            locked: false
        };
    }
    async stat(resource) {
        // Check if the resource exists in our map
        if (!this.uriToContentMap.has(resource)) {
            throw new Error(`File not found: ${resource.toString()}`);
        }
        return super.stat(resource);
    }
}
suite('FetchWebPageTool', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('should handle http/https via web content extractor and other schemes via file service', async () => {
        const webContentMap = new ResourceMap([
            [URI.parse('https://example.com'), 'HTTPS content'],
            [URI.parse('http://example.com'), 'HTTP content']
        ]);
        const fileContentMap = new ResourceMap([
            [URI.parse('test://static/resource/50'), 'MCP resource content'],
            [URI.parse('mcp-resource://746573742D736572766572/custom/hello/world.txt'), 'Custom MCP content']
        ]);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(webContentMap), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const testUrls = [
            'https://example.com',
            'http://example.com',
            'test://static/resource/50',
            'mcp-resource://746573742D736572766572/custom/hello/world.txt',
            'file:///path/to/nonexistent',
            'ftp://example.com',
            'invalid-url'
        ];
        const result = await tool.invoke({ callId: 'test-call-1', toolId: 'fetch-page', parameters: { urls: testUrls }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        // Should have 7 results (one for each input URL)
        assert.strictEqual(result.content.length, 7, 'Should have result for each input URL');
        // HTTP and HTTPS URLs should have their content from web extractor
        assert.strictEqual(result.content[0].value, 'HTTPS content', 'HTTPS URL should return content');
        assert.strictEqual(result.content[1].value, 'HTTP content', 'HTTP URL should return content');
        // MCP resources should have their content from file service
        assert.strictEqual(result.content[2].value, 'MCP resource content', 'test:// URL should return content from file service');
        assert.strictEqual(result.content[3].value, 'Custom MCP content', 'mcp-resource:// URL should return content from file service');
        // Nonexistent file should be marked as invalid
        assert.strictEqual(result.content[4].value, 'Invalid URL', 'Nonexistent file should be invalid');
        // Unsupported scheme (ftp) should be marked as invalid since file service can't handle it
        assert.strictEqual(result.content[5].value, 'Invalid URL', 'ftp:// URL should be invalid');
        // Invalid URL should be marked as invalid
        assert.strictEqual(result.content[6].value, 'Invalid URL', 'Invalid URL should be invalid');
        // All successfully fetched URLs should be in toolResultDetails
        assert.strictEqual(Array.isArray(result.toolResultDetails) ? result.toolResultDetails.length : 0, 4, 'Should have 4 valid URLs in toolResultDetails');
    });
    test('should handle empty and undefined URLs', async () => {
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(new ResourceMap()), new MockTrustedDomainService([]), new MockChatService());
        // Test empty array
        const emptyResult = await tool.invoke({ callId: 'test-call-2', toolId: 'fetch-page', parameters: { urls: [] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        assert.strictEqual(emptyResult.content.length, 1, 'Empty array should return single message');
        assert.strictEqual(emptyResult.content[0].value, 'No valid URLs provided.', 'Should indicate no valid URLs');
        // Test undefined
        const undefinedResult = await tool.invoke({ callId: 'test-call-3', toolId: 'fetch-page', parameters: {}, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        assert.strictEqual(undefinedResult.content.length, 1, 'Undefined URLs should return single message');
        assert.strictEqual(undefinedResult.content[0].value, 'No valid URLs provided.', 'Should indicate no valid URLs');
        // Test array with invalid URLs
        const invalidResult = await tool.invoke({ callId: 'test-call-4', toolId: 'fetch-page', parameters: { urls: ['', ' ', 'invalid-scheme-that-fileservice-cannot-handle://test'] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        assert.strictEqual(invalidResult.content.length, 3, 'Should have result for each invalid URL');
        assert.strictEqual(invalidResult.content[0].value, 'Invalid URL', 'Empty string should be invalid');
        assert.strictEqual(invalidResult.content[1].value, 'Invalid URL', 'Space-only string should be invalid');
        assert.strictEqual(invalidResult.content[2].value, 'Invalid URL', 'Unhandleable scheme should be invalid');
    });
    test('should provide correct past tense messages for mixed valid/invalid URLs', async () => {
        const webContentMap = new ResourceMap([
            [URI.parse('https://valid.com'), 'Valid content']
        ]);
        const fileContentMap = new ResourceMap([
            [URI.parse('test://valid/resource'), 'Valid MCP content']
        ]);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(webContentMap), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const preparation = await tool.prepareToolInvocation({ parameters: { urls: ['https://valid.com', 'test://valid/resource', 'invalid://invalid'] } }, CancellationToken.None);
        assert.ok(preparation, 'Should return prepared invocation');
        assert.ok(preparation.pastTenseMessage, 'Should have past tense message');
        const messageText = typeof preparation.pastTenseMessage === 'string' ? preparation.pastTenseMessage : preparation.pastTenseMessage.value;
        assert.ok(messageText.includes('Fetched'), 'Should mention fetched resources');
        assert.ok(messageText.includes('invalid://invalid'), 'Should mention invalid URL');
    });
    test('should approve when all URLs were mentioned in chat', async () => {
        const webContentMap = new ResourceMap([
            [URI.parse('https://valid.com'), 'Valid content']
        ]);
        const fileContentMap = new ResourceMap([
            [URI.parse('test://valid/resource'), 'Valid MCP content']
        ]);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(webContentMap), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), upcastDeepPartial({
            getSession: () => {
                return {
                    getRequests: () => [{
                            message: {
                                text: 'fetch https://example.com'
                            }
                        }],
                };
            },
        }));
        const preparation1 = await tool.prepareToolInvocation({ parameters: { urls: ['https://example.com'] }, chatSessionId: 'a' }, CancellationToken.None);
        assert.ok(preparation1, 'Should return prepared invocation');
        assert.strictEqual(preparation1.confirmationMessages?.title, undefined);
        const preparation2 = await tool.prepareToolInvocation({ parameters: { urls: ['https://other.com'] }, chatSessionId: 'a' }, CancellationToken.None);
        assert.ok(preparation2, 'Should return prepared invocation');
        assert.ok(preparation2.confirmationMessages?.title);
    });
    test('should return message for binary files indicating they are not supported', async () => {
        // Create binary content (a simple PNG-like header with null bytes)
        const binaryContent = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
        const binaryBuffer = VSBuffer.wrap(binaryContent);
        const fileContentMap = new ResourceMap([
            [URI.parse('file:///path/to/binary.dat'), binaryBuffer],
            [URI.parse('file:///path/to/text.txt'), 'This is text content']
        ]);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const result = await tool.invoke({
            callId: 'test-call-binary',
            toolId: 'fetch-page',
            parameters: { urls: ['file:///path/to/binary.dat', 'file:///path/to/text.txt'] },
            context: undefined
        }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        // Should have 2 results
        assert.strictEqual(result.content.length, 2, 'Should have 2 results');
        // First result should be a text part with binary not supported message
        assert.strictEqual(result.content[0].kind, 'text', 'Binary file should return text part');
        if (result.content[0].kind === 'text') {
            assert.strictEqual(result.content[0].value, 'Binary files are not supported at the moment.', 'Should return not supported message');
        }
        // Second result should be a text part for the text file
        assert.strictEqual(result.content[1].kind, 'text', 'Text file should return text part');
        if (result.content[1].kind === 'text') {
            assert.strictEqual(result.content[1].value, 'This is text content', 'Should return text content');
        }
        // Both files should be in toolResultDetails since they were successfully fetched
        assert.strictEqual(Array.isArray(result.toolResultDetails) ? result.toolResultDetails.length : 0, 2, 'Should have 2 valid URLs in toolResultDetails');
    });
    test('PNG files are now supported as image data parts (regression test)', async () => {
        // This test ensures that PNG files that previously returned "not supported"
        // messages now return proper image data parts
        const binaryContent = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
        const binaryBuffer = VSBuffer.wrap(binaryContent);
        const fileContentMap = new ResourceMap([
            [URI.parse('file:///path/to/image.png'), binaryBuffer]
        ]);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const result = await tool.invoke({
            callId: 'test-png-support',
            toolId: 'fetch-page',
            parameters: { urls: ['file:///path/to/image.png'] },
            context: undefined
        }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        // Should have 1 result
        assert.strictEqual(result.content.length, 1, 'Should have 1 result');
        // PNG file should now be returned as a data part, not a "not supported" message
        assert.strictEqual(result.content[0].kind, 'data', 'PNG file should return data part');
        if (result.content[0].kind === 'data') {
            assert.strictEqual(result.content[0].value.mimeType, 'image/png', 'Should have PNG MIME type');
            assert.strictEqual(result.content[0].value.data, binaryBuffer, 'Should have correct binary data');
        }
    });
    test('should correctly distinguish between binary and text content', async () => {
        // Create content that might be ambiguous
        const jsonData = '{"name": "test", "value": 123}';
        // Create definitely binary data - some random bytes with null bytes that don't follow UTF-16 pattern
        const realBinaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x0D, 0xFF, 0x00, 0xAB]); // More clearly binary
        const fileContentMap = new ResourceMap([
            [URI.parse('file:///data.json'), jsonData], // Should be detected as text
            [URI.parse('file:///binary.dat'), VSBuffer.wrap(realBinaryData)] // Should be detected as binary
        ]);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const result = await tool.invoke({
            callId: 'test-distinguish',
            toolId: 'fetch-page',
            parameters: { urls: ['file:///data.json', 'file:///binary.dat'] },
            context: undefined
        }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        // JSON should be returned as text
        assert.strictEqual(result.content[0].kind, 'text', 'JSON should be detected as text');
        if (result.content[0].kind === 'text') {
            assert.strictEqual(result.content[0].value, jsonData, 'Should return JSON as text');
        }
        // Binary data should be returned as not supported message
        assert.strictEqual(result.content[1].kind, 'text', 'Binary content should return text part with message');
        if (result.content[1].kind === 'text') {
            assert.strictEqual(result.content[1].value, 'Binary files are not supported at the moment.', 'Should return not supported message');
        }
    });
    test('Supported image files are returned as data parts', async () => {
        // Test data for different supported image formats
        const pngData = VSBuffer.fromString('fake PNG data');
        const jpegData = VSBuffer.fromString('fake JPEG data');
        const gifData = VSBuffer.fromString('fake GIF data');
        const webpData = VSBuffer.fromString('fake WebP data');
        const bmpData = VSBuffer.fromString('fake BMP data');
        const fileContentMap = new ResourceMap();
        fileContentMap.set(URI.parse('file:///image.png'), pngData);
        fileContentMap.set(URI.parse('file:///photo.jpg'), jpegData);
        fileContentMap.set(URI.parse('file:///animation.gif'), gifData);
        fileContentMap.set(URI.parse('file:///modern.webp'), webpData);
        fileContentMap.set(URI.parse('file:///bitmap.bmp'), bmpData);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const result = await tool.invoke({
            callId: 'test-images',
            toolId: 'fetch-page',
            parameters: { urls: ['file:///image.png', 'file:///photo.jpg', 'file:///animation.gif', 'file:///modern.webp', 'file:///bitmap.bmp'] },
            context: undefined
        }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        // All images should be returned as data parts
        assert.strictEqual(result.content.length, 5, 'Should have 5 results');
        // Check PNG
        assert.strictEqual(result.content[0].kind, 'data', 'PNG should be data part');
        if (result.content[0].kind === 'data') {
            assert.strictEqual(result.content[0].value.mimeType, 'image/png', 'PNG should have correct MIME type');
            assert.strictEqual(result.content[0].value.data, pngData, 'PNG should have correct data');
        }
        // Check JPEG
        assert.strictEqual(result.content[1].kind, 'data', 'JPEG should be data part');
        if (result.content[1].kind === 'data') {
            assert.strictEqual(result.content[1].value.mimeType, 'image/jpeg', 'JPEG should have correct MIME type');
            assert.strictEqual(result.content[1].value.data, jpegData, 'JPEG should have correct data');
        }
        // Check GIF
        assert.strictEqual(result.content[2].kind, 'data', 'GIF should be data part');
        if (result.content[2].kind === 'data') {
            assert.strictEqual(result.content[2].value.mimeType, 'image/gif', 'GIF should have correct MIME type');
            assert.strictEqual(result.content[2].value.data, gifData, 'GIF should have correct data');
        }
        // Check WebP
        assert.strictEqual(result.content[3].kind, 'data', 'WebP should be data part');
        if (result.content[3].kind === 'data') {
            assert.strictEqual(result.content[3].value.mimeType, 'image/webp', 'WebP should have correct MIME type');
            assert.strictEqual(result.content[3].value.data, webpData, 'WebP should have correct data');
        }
        // Check BMP
        assert.strictEqual(result.content[4].kind, 'data', 'BMP should be data part');
        if (result.content[4].kind === 'data') {
            assert.strictEqual(result.content[4].value.mimeType, 'image/bmp', 'BMP should have correct MIME type');
            assert.strictEqual(result.content[4].value.data, bmpData, 'BMP should have correct data');
        }
    });
    test('Mixed image and text files work correctly', async () => {
        const textData = 'This is some text content';
        const imageData = VSBuffer.fromString('fake image data');
        const fileContentMap = new ResourceMap();
        fileContentMap.set(URI.parse('file:///text.txt'), textData);
        fileContentMap.set(URI.parse('file:///image.png'), imageData);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const result = await tool.invoke({
            callId: 'test-mixed',
            toolId: 'fetch-page',
            parameters: { urls: ['file:///text.txt', 'file:///image.png'] },
            context: undefined
        }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        // Text should be returned as text part
        assert.strictEqual(result.content[0].kind, 'text', 'Text file should be text part');
        if (result.content[0].kind === 'text') {
            assert.strictEqual(result.content[0].value, textData, 'Text should have correct content');
        }
        // Image should be returned as data part
        assert.strictEqual(result.content[1].kind, 'data', 'Image file should be data part');
        if (result.content[1].kind === 'data') {
            assert.strictEqual(result.content[1].value.mimeType, 'image/png', 'Image should have correct MIME type');
            assert.strictEqual(result.content[1].value.data, imageData, 'Image should have correct data');
        }
    });
    test('Case insensitive image extensions work', async () => {
        const imageData = VSBuffer.fromString('fake image data');
        const fileContentMap = new ResourceMap();
        fileContentMap.set(URI.parse('file:///image.PNG'), imageData);
        fileContentMap.set(URI.parse('file:///photo.JPEG'), imageData);
        const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
        const result = await tool.invoke({
            callId: 'test-case',
            toolId: 'fetch-page',
            parameters: { urls: ['file:///image.PNG', 'file:///photo.JPEG'] },
            context: undefined
        }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
        // Both should be returned as data parts despite uppercase extensions
        assert.strictEqual(result.content[0].kind, 'data', 'PNG with uppercase extension should be data part');
        if (result.content[0].kind === 'data') {
            assert.strictEqual(result.content[0].value.mimeType, 'image/png', 'Should have correct MIME type');
        }
        assert.strictEqual(result.content[1].kind, 'data', 'JPEG with uppercase extension should be data part');
        if (result.content[1].kind === 'data') {
            assert.strictEqual(result.content[1].value.mimeType, 'image/jpeg', 'Should have correct MIME type');
        }
    });
    // Comprehensive tests for toolResultDetails
    suite('toolResultDetails', () => {
        test('should include only successfully fetched URIs in correct order', async () => {
            const webContentMap = new ResourceMap([
                [URI.parse('https://success1.com'), 'Content 1'],
                [URI.parse('https://success2.com'), 'Content 2']
            ]);
            const fileContentMap = new ResourceMap([
                [URI.parse('file:///success.txt'), 'File content'],
                [URI.parse('mcp-resource://server/file.txt'), 'MCP content']
            ]);
            const tool = new FetchWebPageTool(new TestWebContentExtractorService(webContentMap), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
            const testUrls = [
                'https://success1.com', // index 0 - should be in toolResultDetails
                'invalid-url', // index 1 - should NOT be in toolResultDetails
                'file:///success.txt', // index 2 - should be in toolResultDetails
                'https://success2.com', // index 3 - should be in toolResultDetails
                'file:///nonexistent.txt', // index 4 - should NOT be in toolResultDetails
                'mcp-resource://server/file.txt' // index 5 - should be in toolResultDetails
            ];
            const result = await tool.invoke({ callId: 'test-details', toolId: 'fetch-page', parameters: { urls: testUrls }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            // Verify toolResultDetails contains exactly the successful URIs
            assert.ok(Array.isArray(result.toolResultDetails), 'toolResultDetails should be an array');
            assert.strictEqual(result.toolResultDetails.length, 4, 'Should have 4 successful URIs');
            // Check that all entries are URI objects
            const uriDetails = result.toolResultDetails;
            assert.ok(uriDetails.every(uri => uri instanceof URI), 'All toolResultDetails entries should be URI objects');
            // Check specific URIs are included (web URIs first, then successful file URIs)
            const expectedUris = [
                'https://success1.com/',
                'https://success2.com/',
                'file:///success.txt',
                'mcp-resource://server/file.txt'
            ];
            const actualUriStrings = uriDetails.map(uri => uri.toString());
            assert.deepStrictEqual(actualUriStrings.sort(), expectedUris.sort(), 'Should contain exactly the expected successful URIs');
            // Verify content array matches input order (including failures)
            assert.strictEqual(result.content.length, 6, 'Content should have result for each input URL');
            assert.strictEqual(result.content[0].value, 'Content 1', 'First web URI content');
            assert.strictEqual(result.content[1].value, 'Invalid URL', 'Invalid URL marked as invalid');
            assert.strictEqual(result.content[2].value, 'File content', 'File URI content');
            assert.strictEqual(result.content[3].value, 'Content 2', 'Second web URI content');
            assert.strictEqual(result.content[4].value, 'Invalid URL', 'Nonexistent file marked as invalid');
            assert.strictEqual(result.content[5].value, 'MCP content', 'MCP resource content');
        });
        test('should exclude failed web requests from toolResultDetails', async () => {
            // Set up web content extractor that will throw for some URIs
            const webContentMap = new ResourceMap([
                [URI.parse('https://success.com'), 'Success content']
                // https://failure.com not in map - will throw error
            ]);
            const tool = new FetchWebPageTool(new TestWebContentExtractorService(webContentMap), new ExtendedTestFileService(new ResourceMap()), new MockTrustedDomainService([]), new MockChatService());
            const testUrls = [
                'https://success.com', // Should succeed
                'https://failure.com' // Should fail (not in content map)
            ];
            try {
                await tool.invoke({ callId: 'test-web-failure', toolId: 'fetch-page', parameters: { urls: testUrls }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
                // If the web extractor throws, it should be handled gracefully
                // But in this test setup, the TestWebContentExtractorService throws for missing content
                assert.fail('Expected test web content extractor to throw for missing URI');
            }
            catch (error) {
                // This is expected behavior with the current test setup
                // The TestWebContentExtractorService throws when content is not found
                assert.ok(error.message.includes('No content configured for URI'), 'Should throw for unconfigured URI');
            }
        });
        test('should exclude failed file reads from toolResultDetails', async () => {
            const fileContentMap = new ResourceMap([
                [URI.parse('file:///existing.txt'), 'File exists']
                // file:///missing.txt not in map - will throw error
            ]);
            const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
            const testUrls = [
                'file:///existing.txt', // Should succeed
                'file:///missing.txt' // Should fail (not in file map)
            ];
            const result = await tool.invoke({ callId: 'test-file-failure', toolId: 'fetch-page', parameters: { urls: testUrls }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            // Verify only successful file URI is in toolResultDetails
            assert.ok(Array.isArray(result.toolResultDetails), 'toolResultDetails should be an array');
            assert.strictEqual(result.toolResultDetails.length, 1, 'Should have only 1 successful URI');
            const uriDetails = result.toolResultDetails;
            assert.strictEqual(uriDetails[0].toString(), 'file:///existing.txt', 'Should contain only the successful file URI');
            // Verify content reflects both attempts
            assert.strictEqual(result.content.length, 2, 'Should have results for both input URLs');
            assert.strictEqual(result.content[0].value, 'File exists', 'First file should have content');
            assert.strictEqual(result.content[1].value, 'Invalid URL', 'Second file should be marked invalid');
        });
        test('should handle mixed success and failure scenarios', async () => {
            const webContentMap = new ResourceMap([
                [URI.parse('https://web-success.com'), 'Web success']
            ]);
            const fileContentMap = new ResourceMap([
                [URI.parse('file:///file-success.txt'), 'File success'],
                [URI.parse('mcp-resource://good/file.txt'), VSBuffer.fromString('MCP binary content')]
            ]);
            const tool = new FetchWebPageTool(new TestWebContentExtractorService(webContentMap), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
            const testUrls = [
                'invalid-scheme://bad', // Invalid URI
                'https://web-success.com', // Web success
                'file:///file-missing.txt', // File failure
                'file:///file-success.txt', // File success
                'completely-invalid-url', // Invalid URL format
                'mcp-resource://good/file.txt' // MCP success
            ];
            const result = await tool.invoke({ callId: 'test-mixed', toolId: 'fetch-page', parameters: { urls: testUrls }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            // Should have 3 successful URIs: web-success, file-success, mcp-success
            assert.ok(Array.isArray(result.toolResultDetails), 'toolResultDetails should be an array');
            assert.strictEqual(result.toolResultDetails.length, 3, 'Should have 3 successful URIs');
            const uriDetails = result.toolResultDetails;
            const actualUriStrings = uriDetails.map(uri => uri.toString());
            const expectedSuccessful = [
                'https://web-success.com/',
                'file:///file-success.txt',
                'mcp-resource://good/file.txt'
            ];
            assert.deepStrictEqual(actualUriStrings.sort(), expectedSuccessful.sort(), 'Should contain exactly the successful URIs');
            // Verify content array reflects all inputs in original order
            assert.strictEqual(result.content.length, 6, 'Should have results for all input URLs');
            assert.strictEqual(result.content[0].value, 'Invalid URL', 'Invalid scheme marked as invalid');
            assert.strictEqual(result.content[1].value, 'Web success', 'Web success content');
            assert.strictEqual(result.content[2].value, 'Invalid URL', 'Missing file marked as invalid');
            assert.strictEqual(result.content[3].value, 'File success', 'File success content');
            assert.strictEqual(result.content[4].value, 'Invalid URL', 'Invalid URL marked as invalid');
            assert.strictEqual(result.content[5].value, 'MCP binary content', 'MCP success content');
        });
        test('should return empty toolResultDetails when all requests fail', async () => {
            const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), // Empty - all web requests fail
            new ExtendedTestFileService(new ResourceMap()), // Empty - all file ,
            new MockTrustedDomainService([]), new MockChatService());
            const testUrls = [
                'https://nonexistent.com',
                'file:///missing.txt',
                'invalid-url',
                'bad://scheme'
            ];
            try {
                const result = await tool.invoke({ callId: 'test-all-fail', toolId: 'fetch-page', parameters: { urls: testUrls }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
                // If web extractor doesn't throw, check the results
                assert.ok(Array.isArray(result.toolResultDetails), 'toolResultDetails should be an array');
                assert.strictEqual(result.toolResultDetails.length, 0, 'Should have no successful URIs');
                assert.strictEqual(result.content.length, 4, 'Should have results for all input URLs');
                assert.ok(result.content.every(content => content.value === 'Invalid URL'), 'All content should be marked as invalid');
            }
            catch (error) {
                // Expected with TestWebContentExtractorService when no content is configured
                assert.ok(error.message.includes('No content configured for URI'), 'Should throw for unconfigured URI');
            }
        });
        test('should handle empty URL array', async () => {
            const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(new ResourceMap()), new MockTrustedDomainService([]), new MockChatService());
            const result = await tool.invoke({ callId: 'test-empty', toolId: 'fetch-page', parameters: { urls: [] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            assert.strictEqual(result.content.length, 1, 'Should have one content item for empty URLs');
            assert.strictEqual(result.content[0].value, 'No valid URLs provided.', 'Should indicate no valid URLs');
            assert.ok(!result.toolResultDetails, 'toolResultDetails should not be present for empty URLs');
        });
        test('should handle image files in toolResultDetails', async () => {
            const imageBuffer = VSBuffer.fromString('fake-png-data');
            const fileContentMap = new ResourceMap([
                [URI.parse('file:///image.png'), imageBuffer],
                [URI.parse('file:///document.txt'), 'Text content']
            ]);
            const tool = new FetchWebPageTool(new TestWebContentExtractorService(new ResourceMap()), new ExtendedTestFileService(fileContentMap), new MockTrustedDomainService(), new MockChatService());
            const result = await tool.invoke({ callId: 'test-images', toolId: 'fetch-page', parameters: { urls: ['file:///image.png', 'file:///document.txt'] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            // Both files should be successful and in toolResultDetails
            assert.ok(Array.isArray(result.toolResultDetails), 'toolResultDetails should be an array');
            assert.strictEqual(result.toolResultDetails.length, 2, 'Should have 2 successful file URIs');
            const uriDetails = result.toolResultDetails;
            assert.strictEqual(uriDetails[0].toString(), 'file:///image.png', 'Should include image file');
            assert.strictEqual(uriDetails[1].toString(), 'file:///document.txt', 'Should include text file');
            // Check content types
            assert.strictEqual(result.content[0].kind, 'data', 'Image should be data part');
            assert.strictEqual(result.content[1].kind, 'text', 'Text file should be text part');
        });
        test('confirmResults is false when all web contents are errors or redirects', async () => {
            const webContentMap = new ResourceMap();
            const tool = new FetchWebPageTool(new class extends TestWebContentExtractorService {
                constructor() {
                    super(webContentMap);
                }
                async extract(uris) {
                    return uris.map(() => ({ status: 'error', error: 'Failed to fetch' }));
                }
            }(), new ExtendedTestFileService(new ResourceMap()), new MockTrustedDomainService(), new MockChatService());
            const result = await tool.invoke({ callId: 'test-call', toolId: 'fetch-page', parameters: { urls: ['https://example.com'] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            assert.strictEqual(result.confirmResults, false, 'confirmResults should be false when all results are errors');
        });
        test('confirmResults is false when all web contents are redirects', async () => {
            const webContentMap = new ResourceMap();
            const tool = new FetchWebPageTool(new class extends TestWebContentExtractorService {
                constructor() {
                    super(webContentMap);
                }
                async extract(uris) {
                    return uris.map(() => ({ status: 'redirect', toURI: URI.parse('https://redirected.com') }));
                }
            }(), new ExtendedTestFileService(new ResourceMap()), new MockTrustedDomainService(), new MockChatService());
            const result = await tool.invoke({ callId: 'test-call', toolId: 'fetch-page', parameters: { urls: ['https://example.com'] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            assert.strictEqual(result.confirmResults, false, 'confirmResults should be false when all results are redirects');
        });
        test('confirmResults is undefined when at least one web content succeeds', async () => {
            const webContentMap = new ResourceMap([
                [URI.parse('https://success.com'), 'Success content']
            ]);
            const tool = new FetchWebPageTool(new class extends TestWebContentExtractorService {
                constructor() {
                    super(webContentMap);
                }
                async extract(uris) {
                    return [
                        { status: 'ok', result: 'Success content' },
                        { status: 'error', error: 'Failed' }
                    ];
                }
            }(), new ExtendedTestFileService(new ResourceMap()), new MockTrustedDomainService(), new MockChatService());
            const result = await tool.invoke({ callId: 'test-call', toolId: 'fetch-page', parameters: { urls: ['https://success.com', 'https://error.com'] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            assert.strictEqual(result.confirmResults, undefined, 'confirmResults should be undefined when at least one result succeeds');
        });
        test('redirect result provides correct message with new URL', async () => {
            const redirectURI = URI.parse('https://redirected.com/page');
            const tool = new FetchWebPageTool(new class extends TestWebContentExtractorService {
                constructor() {
                    super(new ResourceMap());
                }
                async extract(uris) {
                    return [{ status: 'redirect', toURI: redirectURI }];
                }
            }(), new ExtendedTestFileService(new ResourceMap()), new MockTrustedDomainService(), new MockChatService());
            const result = await tool.invoke({ callId: 'test-call', toolId: 'fetch-page', parameters: { urls: ['https://example.com'] }, context: undefined }, () => Promise.resolve(0), { report: () => { } }, CancellationToken.None);
            assert.strictEqual(result.content.length, 1);
            assert.strictEqual(result.content[0].kind, 'text');
            if (result.content[0].kind === 'text') {
                assert.ok(result.content[0].value.includes(redirectURI.toString(true)), 'Redirect message should include target URL');
                assert.ok(result.content[0].value.includes(InternalFetchWebPageToolId), 'Redirect message should suggest using tool again');
            }
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmV0Y2hQYWdlVG9vbC50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9lbGVjdHJvbi1icm93c2VyL2ZldGNoUGFnZVRvb2wudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDaEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUduRyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUNqRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbkYsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDakcsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFDekUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQy9ELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRzVFLE1BQU0sOEJBQThCO0lBR25DLFlBQW9CLGVBQW9DO1FBQXBDLG9CQUFlLEdBQWYsZUFBZSxDQUFxQjtJQUFJLENBQUM7SUFFN0QsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFXO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNyQixNQUFNLE9BQU8s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