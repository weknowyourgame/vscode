/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { timeout } from '../../common/async.js';
import { bufferedStreamToBuffer, bufferToReadable, bufferToStream, decodeBase64, decodeHex, encodeBase64, encodeHex, newWriteableBufferStream, readableToBuffer, streamToBuffer, VSBuffer } from '../../common/buffer.js';
import { peekStream } from '../../common/stream.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
suite('Buffer', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('issue #71993 - VSBuffer#toString returns numbers', () => {
        const data = new Uint8Array([1, 2, 3, 'h'.charCodeAt(0), 'i'.charCodeAt(0), 4, 5]).buffer;
        const buffer = VSBuffer.wrap(new Uint8Array(data, 3, 2));
        assert.deepStrictEqual(buffer.toString(), 'hi');
    });
    test('issue #251527 - VSBuffer#toString preserves BOM character in filenames', () => {
        // BOM character (U+FEFF) is a zero-width character that was being stripped
        // when deserializing messages in the IPC layer. This test verifies that
        // the BOM character is preserved when using VSBuffer.toString().
        const bomChar = '\uFEFF';
        const filename = `${bomChar}c.txt`;
        const buffer = VSBuffer.fromString(filename);
        const result = buffer.toString();
        // Verify the BOM character is preserved
        assert.strictEqual(result, filename);
        assert.strictEqual(result.charCodeAt(0), 0xFEFF);
    });
    test('bufferToReadable / readableToBuffer', () => {
        const content = 'Hello World';
        const readable = bufferToReadable(VSBuffer.fromString(content));
        assert.strictEqual(readableToBuffer(readable).toString(), content);
    });
    test('bufferToStream / streamToBuffer', async () => {
        const content = 'Hello World';
        const stream = bufferToStream(VSBuffer.fromString(content));
        assert.strictEqual((await streamToBuffer(stream)).toString(), content);
    });
    test('bufferedStreamToBuffer', async () => {
        const content = 'Hello World';
        const stream = await peekStream(bufferToStream(VSBuffer.fromString(content)), 1);
        assert.strictEqual((await bufferedStreamToBuffer(stream)).toString(), content);
    });
    test('bufferWriteableStream - basics (no error)', async () => {
        const stream = newWriteableBufferStream();
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        assert.strictEqual(chunks.length, 2);
        assert.strictEqual(chunks[0].toString(), 'Hello');
        assert.strictEqual(chunks[1].toString(), 'World');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 0);
    });
    test('bufferWriteableStream - basics (error)', async () => {
        const stream = newWriteableBufferStream();
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.error(new Error());
        stream.end();
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].toString(), 'Hello');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 1);
    });
    test('bufferWriteableStream - buffers data when no listener', async () => {
        const stream = newWriteableBufferStream();
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].toString(), 'HelloWorld');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 0);
    });
    test('bufferWriteableStream - buffers errors when no listener', async () => {
        const stream = newWriteableBufferStream();
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.error(new Error());
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        stream.end();
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].toString(), 'Hello');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 1);
    });
    test('bufferWriteableStream - buffers end when no listener', async () => {
        const stream = newWriteableBufferStream();
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].toString(), 'HelloWorld');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 0);
    });
    test('bufferWriteableStream - nothing happens after end()', async () => {
        const stream = newWriteableBufferStream();
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        let dataCalledAfterEnd = false;
        stream.on('data', data => {
            dataCalledAfterEnd = true;
        });
        let errorCalledAfterEnd = false;
        stream.on('error', error => {
            errorCalledAfterEnd = true;
        });
        let endCalledAfterEnd = false;
        stream.on('end', () => {
            endCalledAfterEnd = true;
        });
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.error(new Error());
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        assert.strictEqual(dataCalledAfterEnd, false);
        assert.strictEqual(errorCalledAfterEnd, false);
        assert.strictEqual(endCalledAfterEnd, false);
        assert.strictEqual(chunks.length, 2);
        assert.strictEqual(chunks[0].toString(), 'Hello');
        assert.strictEqual(chunks[1].toString(), 'World');
    });
    test('bufferWriteableStream - pause/resume (simple)', async () => {
        const stream = newWriteableBufferStream();
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        stream.pause();
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        assert.strictEqual(chunks.length, 0);
        assert.strictEqual(errors.length, 0);
        assert.strictEqual(ended, false);
        stream.resume();
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].toString(), 'HelloWorld');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 0);
    });
    test('bufferWriteableStream - pause/resume (pause after first write)', async () => {
        const stream = newWriteableBufferStream();
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        stream.pause();
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].toString(), 'Hello');
        assert.strictEqual(errors.length, 0);
        assert.strictEqual(ended, false);
        stream.resume();
        assert.strictEqual(chunks.length, 2);
        assert.strictEqual(chunks[0].toString(), 'Hello');
        assert.strictEqual(chunks[1].toString(), 'World');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 0);
    });
    test('bufferWriteableStream - pause/resume (error)', async () => {
        const stream = newWriteableBufferStream();
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        stream.pause();
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.error(new Error());
        stream.end();
        assert.strictEqual(chunks.length, 0);
        assert.strictEqual(ended, false);
        assert.strictEqual(errors.length, 0);
        stream.resume();
        assert.strictEqual(chunks.length, 1);
        assert.strictEqual(chunks[0].toString(), 'Hello');
        assert.strictEqual(ended, true);
        assert.strictEqual(errors.length, 1);
    });
    test('bufferWriteableStream - destroy', async () => {
        const stream = newWriteableBufferStream();
        const chunks = [];
        stream.on('data', data => {
            chunks.push(data);
        });
        let ended = false;
        stream.on('end', () => {
            ended = true;
        });
        const errors = [];
        stream.on('error', error => {
            errors.push(error);
        });
        stream.destroy();
        await timeout(0);
        stream.write(VSBuffer.fromString('Hello'));
        await timeout(0);
        stream.end(VSBuffer.fromString('World'));
        assert.strictEqual(chunks.length, 0);
        assert.strictEqual(ended, false);
        assert.strictEqual(errors.length, 0);
    });
    test('Performance issue with VSBuffer#slice #76076', function () {
        // Buffer#slice creates a view
        if (typeof Buffer !== 'undefined') {
            const buff = Buffer.from([10, 20, 30, 40]);
            const b2 = buff.slice(1, 3);
            assert.strictEqual(buff[1], 20);
            assert.strictEqual(b2[0], 20);
            buff[1] = 17; // modify buff AND b2
            assert.strictEqual(buff[1], 17);
            assert.strictEqual(b2[0], 17);
        }
        // TypedArray#slice creates a copy
        {
            const unit = new Uint8Array([10, 20, 30, 40]);
            const u2 = unit.slice(1, 3);
            assert.strictEqual(unit[1], 20);
            assert.strictEqual(u2[0], 20);
            unit[1] = 17; // modify unit, NOT b2
            assert.strictEqual(unit[1], 17);
            assert.strictEqual(u2[0], 20);
        }
        // TypedArray#subarray creates a view
        {
            const unit = new Uint8Array([10, 20, 30, 40]);
            const u2 = unit.subarray(1, 3);
            assert.strictEqual(unit[1], 20);
            assert.strictEqual(u2[0], 20);
            unit[1] = 17; // modify unit AND b2
            assert.strictEqual(unit[1], 17);
            assert.strictEqual(u2[0], 17);
        }
    });
    test('indexOf', () => {
        const haystack = VSBuffer.fromString('abcaabbccaaabbbccc');
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('')), 0);
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('a'.repeat(100))), -1);
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('a')), 0);
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('c')), 2);
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('abcaa')), 0);
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('caaab')), 8);
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('ccc')), 15);
        assert.strictEqual(haystack.indexOf(VSBuffer.fromString('cccb')), -1);
    });
    test('wrap', () => {
        const actual = new Uint8Array([1, 2, 3]);
        const wrapped = VSBuffer.wrap(actual);
        assert.strictEqual(wrapped.byteLength, 3);
        assert.deepStrictEqual(Array.from(wrapped.buffer), [1, 2, 3]);
    });
    test('fromString', () => {
        const value = 'Hello World';
        const buff = VSBuffer.fromString(value);
        assert.strictEqual(buff.toString(), value);
    });
    test('fromByteArray', () => {
        const array = [1, 2, 3, 4, 5];
        const buff = VSBuffer.fromByteArray(array);
        assert.strictEqual(buff.byteLength, array.length);
        assert.deepStrictEqual(Array.from(buff.buffer), array);
    });
    test('concat', () => {
        const chunks = [
            VSBuffer.fromString('abc'),
            VSBuffer.fromString('def'),
            VSBuffer.fromString('ghi')
        ];
        // Test without total length
        const result1 = VSBuffer.concat(chunks);
        assert.strictEqual(result1.toString(), 'abcdefghi');
        // Test with total length
        const result2 = VSBuffer.concat(chunks, 9);
        assert.strictEqual(result2.toString(), 'abcdefghi');
    });
    test('clone', () => {
        const original = VSBuffer.fromString('test');
        const clone = original.clone();
        assert.notStrictEqual(original.buffer, clone.buffer);
        assert.deepStrictEqual(Array.from(original.buffer), Array.from(clone.buffer));
    });
    test('slice', () => {
        const buff = VSBuffer.fromString('Hello World');
        const slice1 = buff.slice(0, 5);
        assert.strictEqual(slice1.toString(), 'Hello');
        const slice2 = buff.slice(6);
        assert.strictEqual(slice2.toString(), 'World');
    });
    test('set', () => {
        const buff = VSBuffer.alloc(5);
        // Test setting from VSBuffer
        buff.set(VSBuffer.fromString('ab'), 0);
        assert.strictEqual(buff.toString().substring(0, 2), 'ab');
        // Test setting from Uint8Array
        buff.set(new Uint8Array([99, 100]), 2); // 'cd'
        assert.strictEqual(buff.toString().substring(2, 4), 'cd');
        // Test invalid input
        assert.throws(() => {
            // eslint-disable-next-line local/code-no-any-casts
            buff.set({});
        });
    });
    test('equals', () => {
        const buff1 = VSBuffer.fromString('test');
        const buff2 = VSBuffer.fromString('test');
        const buff3 = VSBuffer.fromString('different');
        const buff4 = VSBuffer.fromString('tes1');
        assert.strictEqual(buff1.equals(buff1), true);
        assert.strictEqual(buff1.equals(buff2), true);
        assert.strictEqual(buff1.equals(buff3), false);
        assert.strictEqual(buff1.equals(buff4), false);
    });
    test('read/write methods', () => {
        const buff = VSBuffer.alloc(8);
        // Test UInt32BE
        buff.writeUInt32BE(0x12345678, 0);
        assert.strictEqual(buff.readUInt32BE(0), 0x12345678);
        // Test UInt32LE
        buff.writeUInt32LE(0x12345678, 4);
        assert.strictEqual(buff.readUInt32LE(4), 0x12345678);
        // Test UInt8
        const buff2 = VSBuffer.alloc(1);
        buff2.writeUInt8(123, 0);
        assert.strictEqual(buff2.readUInt8(0), 123);
    });
    suite('encoding', () => {
        /*
        Generated with:

        const crypto = require('crypto');

        for (let i = 0; i < 16; i++) {
            const buf =  crypto.randomBytes(i);
            console.log(`[new Uint8Array([${Array.from(buf).join(', ')}]), '${buf.toString('base64')}'],`)
        }

        */
        const testCases = [
            [new Uint8Array([]), '', ''],
            [new Uint8Array([77]), 'TQ==', '4d'],
            [new Uint8Array([230, 138]), '5oo=', 'e68a'],
            [new Uint8Array([104, 98, 82]), 'aGJS', '686252'],
            [new Uint8Array([92, 114, 57, 209]), 'XHI50Q==', '5c7239d1'],
            [new Uint8Array([238, 51, 1, 240, 124]), '7jMB8Hw=', 'ee3301f07c'],
            [new Uint8Array([96, 54, 130, 79, 47, 179]), 'YDaCTy+z', '6036824f2fb3'],
            [new Uint8Array([91, 22, 68, 217, 68, 117, 116]), 'WxZE2UR1dA==', '5b1644d9447574'],
            [new Uint8Array([184, 227, 214, 171, 244, 175, 141, 53]), 'uOPWq/SvjTU=', 'b8e3d6abf4af8d35'],
            [new Uint8Array([53, 98, 93, 130, 71, 117, 191, 137, 156]), 'NWJdgkd1v4mc', '35625d824775bf899c'],
            [new Uint8Array([154, 156, 60, 102, 232, 197, 92, 25, 124, 98]), 'mpw8ZujFXBl8Yg==', '9a9c3c66e8c55c197c62'],
            [new Uint8Array([152, 131, 106, 234, 17, 183, 164, 245, 252, 67, 26]), 'mINq6hG3pPX8Qxo=', '98836aea11b7a4f5fc431a'],
            [new Uint8Array([232, 254, 194, 234, 16, 42, 86, 135, 117, 61, 179, 4]), '6P7C6hAqVod1PbME', 'e8fec2ea102a5687753db304'],
            [new Uint8Array([4, 199, 85, 172, 125, 171, 172, 219, 61, 47, 78, 155, 127]), 'BMdVrH2rrNs9L06bfw==', '04c755ac7dabacdb3d2f4e9b7f'],
            [new Uint8Array([189, 67, 62, 189, 87, 171, 27, 164, 87, 142, 126, 113, 23, 182]), 'vUM+vVerG6RXjn5xF7Y=', 'bd433ebd57ab1ba4578e7e7117b6'],
            [new Uint8Array([153, 156, 145, 240, 228, 200, 199, 158, 40, 167, 97, 52, 217, 148, 43]), 'mZyR8OTIx54op2E02ZQr', '999c91f0e4c8c79e28a76134d9942b'],
        ];
        test('encodes base64', () => {
            for (const [bytes, expected] of testCases) {
                assert.strictEqual(encodeBase64(VSBuffer.wrap(bytes)), expected);
            }
        });
        test('decodes, base64', () => {
            for (const [expected, encoded] of testCases) {
                assert.deepStrictEqual(new Uint8Array(decodeBase64(encoded).buffer), expected);
            }
        });
        test('encodes hex', () => {
            for (const [bytes, , expected] of testCases) {
                assert.strictEqual(encodeHex(VSBuffer.wrap(bytes)), expected);
            }
        });
        test('decodes, hex', () => {
            for (const [expected, , encoded] of testCases) {
                assert.deepStrictEqual(new Uint8Array(decodeHex(encoded).buffer), expected);
            }
        });
        test('throws error on invalid encoding', () => {
            assert.throws(() => decodeBase64('invalid!'));
            assert.throws(() => decodeHex('invalid!'));
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVmZmVyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS90ZXN0L2NvbW1vbi9idWZmZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2hELE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLHdCQUF3QixFQUFFLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUMxTixPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDcEQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRXJFLEtBQUssQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO0lBRXBCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLGtEQUFrRCxFQUFFLEdBQUcsRUFBRTtRQUM3RCxNQUFNLElBQUksR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDMUYsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFF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QUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsRSxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRWxFLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDdEUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN0RSxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRXJFLE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxFQUFFO1FBQ2pCLE1BQU0sTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sT0FBTyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENB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