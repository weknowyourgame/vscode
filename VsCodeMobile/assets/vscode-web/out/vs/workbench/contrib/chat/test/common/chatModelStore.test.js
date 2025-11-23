/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { ChatModelStore } from '../../common/chatModelStore.js';
import { ChatAgentLocation } from '../../common/constants.js';
import { MockChatModel } from './mockChatModel.js';
suite('ChatModelStore', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let testObject;
    let createdModels;
    let willDisposePromises;
    setup(() => {
        createdModels = [];
        willDisposePromises = [];
        testObject = store.add(new ChatModelStore({
            createModel: (props) => {
                const model = new MockChatModel(props.sessionResource);
                createdModels.push(model);
                return model;
            },
            willDisposeModel: async (model) => {
                const p = new DeferredPromise();
                willDisposePromises.push(p);
                await p.p;
            }
        }, new NullLogService()));
    });
    test('create and dispose', async () => {
        const uri = URI.parse('test://session');
        const props = {
            sessionResource: uri,
            location: ChatAgentLocation.Chat,
            token: CancellationToken.None,
            canUseTools: true
        };
        const ref = testObject.acquireOrCreate(props);
        assert.strictEqual(createdModels.length, 1);
        assert.strictEqual(ref.object, createdModels[0]);
        ref.dispose();
        assert.strictEqual(willDisposePromises.length, 1);
        willDisposePromises[0].complete();
        await testObject.waitForModelDisposals();
        assert.strictEqual(testObject.get(uri), undefined);
    });
    test('resurrection', async () => {
        const uri = URI.parse('test://session');
        const props = {
            sessionResource: uri,
            location: ChatAgentLocation.Chat,
            token: CancellationToken.None,
            canUseTools: true
        };
        const ref1 = testObject.acquireOrCreate(props);
        const model1 = ref1.object;
        ref1.dispose();
        // Model is pending disposal
        assert.strictEqual(willDisposePromises.length, 1);
        assert.strictEqual(testObject.get(uri), model1);
        // Acquire again - should be resurrected
        const ref2 = testObject.acquireOrCreate(props);
        assert.strictEqual(ref2.object, model1);
        assert.strictEqual(createdModels.length, 1);
        // Finish disposal of the first ref
        willDisposePromises[0].complete();
        await testObject.waitForModelDisposals();
        // Model should still exist because ref2 holds it
        assert.strictEqual(testObject.get(uri), model1);
        ref2.dispose();
    });
    test('get and has', async () => {
        const uri = URI.parse('test://session');
        const props = {
            sessionResource: uri,
            location: ChatAgentLocation.Chat,
            token: CancellationToken.None,
            canUseTools: true
        };
        const ref = testObject.acquireOrCreate(props);
        assert.strictEqual(testObject.get(uri), ref.object);
        assert.strictEqual(testObject.has(uri), true);
        ref.dispose();
        willDisposePromises[0].complete();
        await testObject.waitForModelDisposals();
        assert.strictEqual(testObject.get(uri), undefined);
        assert.strictEqual(testObject.has(uri), false);
    });
    test('acquireExisting', async () => {
        const uri = URI.parse('test://session');
        const props = {
            sessionResource: uri,
            location: ChatAgentLocation.Chat,
            token: CancellationToken.None,
            canUseTools: true
        };
        assert.strictEqual(testObject.acquireExisting(uri), undefined);
        const ref1 = testObject.acquireOrCreate(props);
        const ref2 = testObject.acquireExisting(uri);
        assert.ok(ref2);
        assert.strictEqual(ref2.object, ref1.object);
        ref1.dispose();
        ref2.dispose();
        willDisposePromises[0].complete();
        await testObject.waitForModelDisposals();
    });
    test('values', async () => {
        const uri1 = URI.parse('test://session1');
        const uri2 = URI.parse('test://session2');
        const props1 = {
            sessionResource: uri1,
            location: ChatAgentLocation.Chat,
            token: CancellationToken.None,
            canUseTools: true
        };
        const props2 = {
            sessionResource: uri2,
            location: ChatAgentLocation.Chat,
            token: CancellationToken.None,
            canUseTools: true
        };
        const ref1 = testObject.acquireOrCreate(props1);
        const ref2 = testObject.acquireOrCreate(props2);
        const values = Array.from(testObject.values());
        assert.strictEqual(values.length, 2);
        assert.ok(values.includes(ref1.object));
        assert.ok(values.includes(ref2.object));
        ref1.dispose();
        ref2.dispose();
        willDisposePromises[0].complete();
        willDisposePromises[1].complete();
        await testObject.waitForModelDisposals();
    });
    test('dispose store', async () => {
        const uri = URI.parse('test://session');
        const props = {
            sessionResource: uri,
            location: ChatAgentLocation.Chat,
            token: CancellationToken.None,
            canUseTools: true
        };
        const ref = testObject.acquireOrCreate(props);
        const model = ref.object;
        testObject.dispose();
        assert.strictEqual(model.isDisposed, true);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdE1vZGVsU3RvcmUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL2NoYXRNb2RlbFN0b3JlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN0RSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUMvRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBRTNFLE9BQU8sRUFBRSxjQUFjLEVBQXNCLE1BQU0sZ0NBQWdDLENBQUM7QUFDcEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDOUQsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBRW5ELEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUU7SUFDNUIsTUFBTSxLQUFLLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUV4RCxJQUFJLFVBQTBCLENBQUM7SUFDL0IsSUFBSSxhQUE4QixDQUFDO0lBQ25DLElBQUksbUJBQTRDLENBQUM7SUFFakQsS0FBSyxDQUFDLEdBQUcsRUFBRTtRQUNWLGFBQWEsR0FBRyxFQUFFLENBQUM7UUFDbkIsbUJBQW1CLEdBQUcsRUFBRSxDQUFDO1FBQ3pCLFVBQVUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksY0FBYyxDQUFDO1lBQ3pDLFdBQVcsRUFBRSxDQUFDLEtBQXlCLEVBQUUsRUFBRTtnQkFD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