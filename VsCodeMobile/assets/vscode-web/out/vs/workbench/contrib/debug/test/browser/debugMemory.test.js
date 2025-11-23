/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { decodeBase64, encodeBase64, VSBuffer } from '../../../../../base/common/buffer.js';
import { Emitter } from '../../../../../base/common/event.js';
import { mockObject } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MemoryRegion } from '../../common/debugModel.js';
suite('Debug - Memory', () => {
    const dapResponseCommon = {
        command: 'someCommand',
        type: 'response',
        seq: 1,
        request_seq: 1,
        success: true,
    };
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('MemoryRegion', () => {
        let memory;
        let unreadable;
        let invalidateMemoryEmitter;
        let session;
        let region;
        setup(() => {
            const memoryBuf = new Uint8Array(1024);
            for (let i = 0; i < memoryBuf.length; i++) {
                memoryBuf[i] = i; // will be 0-255
            }
            memory = VSBuffer.wrap(memoryBuf);
            invalidateMemoryEmitter = new Emitter();
            unreadable = 0;
            session = mockObject()({
                onDidInvalidateMemory: invalidateMemoryEmitter.event
            });
            session.readMemory.callsFake((ref, fromOffset, count) => {
                const res = ({
                    ...dapResponseCommon,
                    body: {
                        address: '0',
                        data: encodeBase64(memory.slice(fromOffset, fromOffset + Math.max(0, count - unreadable))),
                        unreadableBytes: unreadable
                    }
                });
                unreadable = 0;
                return Promise.resolve(res);
            });
            session.writeMemory.callsFake((ref, fromOffset, data) => {
                const decoded = decodeBase64(data);
                for (let i = 0; i < decoded.byteLength; i++) {
                    memory.buffer[fromOffset + i] = decoded.buffer[i];
                }
                return ({
                    ...dapResponseCommon,
                    body: {
                        bytesWritten: decoded.byteLength,
                        offset: fromOffset,
                    }
                });
            });
            // eslint-disable-next-line local/code-no-any-casts
            region = new MemoryRegion('ref', session);
        });
        teardown(() => {
            region.dispose();
        });
        test('reads a simple range', async () => {
            assert.deepStrictEqual(await region.read(10, 14), [
                { type: 0 /* MemoryRangeType.Valid */, offset: 10, length: 4, data: VSBuffer.wrap(new Uint8Array([10, 11, 12, 13])) }
            ]);
        });
        test('reads a non-contiguous range', async () => {
            unreadable = 3;
            assert.deepStrictEqual(await region.read(10, 14), [
                { type: 0 /* MemoryRangeType.Valid */, offset: 10, length: 1, data: VSBuffer.wrap(new Uint8Array([10])) },
                { type: 1 /* MemoryRangeType.Unreadable */, offset: 11, length: 3 },
            ]);
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdNZW1vcnkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2Jyb3dzZXIvZGVidWdNZW1vcnkudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDNUYsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxVQUFVLEVBQWMsTUFBTSx5Q0FBeUMsQ0FBQztBQUNqRixPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFHMUQsS0FBSyxDQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRTtJQUM1QixNQUFNLGlCQUFpQixHQUFHO1FBQ3pCLE9BQU8sRUFBRSxhQUFhO1FBQ3RCLElBQUksRUFBRSxVQUFVO1FBQ2hCLEdBQUcsRUFBRSxDQUFDO1FBQ04sV0FBVyxFQUFFLENBQUM7UUFDZCxPQUFPLEVBQUUsSUFBSTtLQUNiLENBQUM7SUFFRix1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLEtBQUssQ0FBQyxjQUFjLEVBQUUsR0FBRyxFQUFFO1FBQzFCLElBQUksTUFBZ0IsQ0FBQztRQUNyQixJQUFJLFVBQWtCLENBQUM7UUFDdkIsSUFBSSx1QkFBMkQsQ0FBQztRQUNoRSxJQUFJLE9BQXlELENBQUM7UUFDOUQsSUFBSSxNQUFvQixDQUFDO1FBRXpCLEtBQUssQ0FBQyxHQUFHLEVBQUU7WUFDVixNQUFNLFNBQVMsR0FBRyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN2QyxLQUFLLElB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