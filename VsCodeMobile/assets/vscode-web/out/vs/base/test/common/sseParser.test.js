/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { SSEParser } from '../../common/sseParser.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
// Helper function to convert string to Uint8Array for testing
function toUint8Array(str) {
    return new TextEncoder().encode(str);
}
suite('SSEParser', () => {
    let receivedEvents;
    let parser;
    ensureNoDisposablesAreLeakedInTestSuite();
    setup(() => {
        receivedEvents = [];
        parser = new SSEParser((event) => receivedEvents.push(event));
    });
    test('handles basic events', () => {
        parser.feed(toUint8Array('data: hello world\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].type, 'message');
        assert.strictEqual(receivedEvents[0].data, 'hello world');
    });
    test('handles events with multiple data fields', () => {
        parser.feed(toUint8Array('data: first line\ndata: second line\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'first line\nsecond line');
    });
    test('handles events with explicit event type', () => {
        parser.feed(toUint8Array('event: custom\ndata: hello world\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].type, 'custom');
        assert.strictEqual(receivedEvents[0].data, 'hello world');
    });
    test('handles events with explicit event type (CRLF)', () => {
        parser.feed(toUint8Array('event: custom\r\ndata: hello world\r\n\r\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].type, 'custom');
        assert.strictEqual(receivedEvents[0].data, 'hello world');
    });
    test('stream processing chunks', () => {
        for (const lf of ['\n', '\r\n', '\r']) {
            const message = toUint8Array(`event: custom${lf}data: hello world${lf}${lf}event: custom2${lf}data: hello world2${lf}${lf}`);
            for (let chunkSize = 1; chunkSize < 5; chunkSize++) {
                receivedEvents.length = 0;
                for (let i = 0; i < message.length; i += chunkSize) {
                    const chunk = message.slice(i, i + chunkSize);
                    parser.feed(chunk);
                }
                assert.deepStrictEqual(receivedEvents, [
                    { type: 'custom', data: 'hello world' },
                    { type: 'custom2', data: 'hello world2' }
                ], `Failed for chunk size ${chunkSize} and line ending ${JSON.stringify(lf)}`);
            }
        }
    });
    test('handles events with ID', () => {
        parser.feed(toUint8Array('event: custom\ndata: hello\nid: 123\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].type, 'custom');
        assert.strictEqual(receivedEvents[0].data, 'hello');
        assert.strictEqual(receivedEvents[0].id, '123');
        assert.strictEqual(parser.getLastEventId(), '123');
    });
    test('ignores comments', () => {
        parser.feed(toUint8Array('event: custom\n:this is a comment\ndata: hello\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'hello');
    });
    test('handles retry field', () => {
        parser.feed(toUint8Array('retry: 5000\ndata: hello\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'hello');
        assert.strictEqual(receivedEvents[0].retry, 5000);
        assert.strictEqual(parser.getReconnectionTime(), 5000);
    });
    test('handles invalid retry field', () => {
        parser.feed(toUint8Array('retry: invalid\ndata: hello\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'hello');
        assert.strictEqual(receivedEvents[0].retry, undefined);
        assert.strictEqual(parser.getReconnectionTime(), undefined);
    });
    test('ignores fields with NULL character in ID', () => {
        parser.feed(toUint8Array('id: 12\0 3\ndata: hello\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].id, undefined);
        assert.strictEqual(parser.getLastEventId(), undefined);
    });
    test('handles fields with no value', () => {
        parser.feed(toUint8Array('data\nid\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, '');
        assert.strictEqual(receivedEvents[0].id, '');
    });
    test('handles fields with space after colon', () => {
        parser.feed(toUint8Array('data: hello\nevent: custom\nid: 123\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'hello');
        assert.strictEqual(receivedEvents[0].type, 'custom');
        assert.strictEqual(receivedEvents[0].id, '123');
    });
    test('handles different line endings (LF)', () => {
        parser.feed(toUint8Array('data: hello\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'hello');
    });
    test('handles different line endings (CR)', () => {
        parser.feed(toUint8Array('data: hello\r\r'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'hello');
    });
    test('handles different line endings (CRLF)', () => {
        parser.feed(toUint8Array('data: hello\r\n\r\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'hello');
    });
    test('handles empty data with blank line', () => {
        parser.feed(toUint8Array('data:\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, '');
    });
    test('ignores events with no data after blank line', () => {
        parser.feed(toUint8Array('event: custom\n\n'));
        assert.strictEqual(receivedEvents.length, 0);
    });
    test('supports chunked data', () => {
        parser.feed(toUint8Array('event: cus'));
        parser.feed(toUint8Array('tom\nda'));
        parser.feed(toUint8Array('ta: hello\n'));
        parser.feed(toUint8Array('\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].type, 'custom');
        assert.strictEqual(receivedEvents[0].data, 'hello');
    });
    test('supports spec example', () => {
        // Example from the spec
        parser.feed(toUint8Array(':This is a comment\ndata: first event\nid: 1\n\n'));
        parser.feed(toUint8Array('data:second event\nid\n\n'));
        parser.feed(toUint8Array('data:  third event\n\n'));
        assert.strictEqual(receivedEvents.length, 3);
        assert.strictEqual(receivedEvents[0].data, 'first event');
        assert.strictEqual(receivedEvents[0].id, '1');
        assert.strictEqual(receivedEvents[1].data, 'second event');
        assert.strictEqual(receivedEvents[1].id, '');
        assert.strictEqual(receivedEvents[2].data, ' third event');
    });
    test('resets correctly', () => {
        parser.feed(toUint8Array('data: hello\n'));
        parser.reset();
        parser.feed(toUint8Array('data: world\n\n'));
        assert.strictEqual(receivedEvents.length, 1);
        assert.strictEqual(receivedEvents[0].data, 'world');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NlUGFyc2VyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS90ZXN0L2NvbW1vbi9zc2VQYXJzZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEVBQWEsU0FBUyxFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDakUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXJFLDhEQUE4RDtBQUM5RCxTQUFTLFlBQVksQ0FBQyxHQUFXO0lBQ2hDLE9BQU8sSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdEMsQ0FBQztBQUVELEtBQUssQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO0lBQ3ZCLElBQUksY0FBMkIsQ0FBQztJQUNoQyxJQUFJLE1BQWlCLENBQUM7SUFFdEIsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsR0FBRyxFQUFFO1FBQ1YsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUNwQixNQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMvRCxDQUFDLENBQUMsQ0FBQztJQUNILElBQUksQ0FBQyxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7UUFDakMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDO1FBRW5ELE1BQU0sQ0FBQyxXQUFXLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM3QyxNQUFNLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFD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