/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { ResourceMap } from '../../../../../base/common/map.js';
import { cloneAndChange } from '../../../../../base/common/objects.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { TestEnvironmentService } from '../../../../test/browser/workbenchTestServices.js';
import { ChatEditingSessionStorage } from '../../browser/chatEditing/chatEditingSessionStorage.js';
import { ChatEditingSnapshotTextModelContentProvider } from '../../browser/chatEditing/chatEditingTextModelContentProviders.js';
suite('ChatEditingSessionStorage', () => {
    const ds = ensureNoDisposablesAreLeakedInTestSuite();
    const sessionResource = URI.parse('chat://test-session');
    let fs;
    let storage;
    class TestChatEditingSessionStorage extends ChatEditingSessionStorage {
        get storageLocation() {
            return super._getStorageLocation();
        }
    }
    setup(() => {
        fs = ds.add(new FileService(new NullLogService()));
        ds.add(fs.registerProvider(TestEnvironmentService.workspaceStorageHome.scheme, ds.add(new InMemoryFileSystemProvider())));
        storage = new TestChatEditingSessionStorage(sessionResource, fs, TestEnvironmentService, new NullLogService(), 
        // eslint-disable-next-line local/code-no-any-casts
        { getWorkspace: () => ({ id: 'workspaceId' }) });
    });
    function makeStop(requestId, before, after) {
        const stopId = generateUuid();
        const resource = URI.file('/foo.js');
        return {
            stopId,
            entries: new ResourceMap([
                [resource, { resource, languageId: 'javascript', snapshotUri: ChatEditingSnapshotTextModelContentProvider.getSnapshotFileURI(sessionResource, requestId, stopId, resource.path), original: `contents${before}}`, current: `contents${after}`, state: 0 /* ModifiedFileEntryState.Modified */, telemetryInfo: { agentId: 'agentId', command: 'cmd', requestId: generateUuid(), result: undefined, sessionResource: sessionResource, modelId: undefined, modeId: undefined, applyCodeBlockSuggestionId: undefined, feature: undefined } }],
            ]),
        };
    }
    function generateState() {
        const initialFileContents = new ResourceMap();
        for (let i = 0; i < 10; i++) {
            initialFileContents.set(URI.file(`/foo${i}.js`), `fileContents${Math.floor(i / 2)}`);
        }
        return {
            initialFileContents,
            recentSnapshot: makeStop(undefined, 'd', 'e'),
            timeline: undefined,
        };
    }
    test('state is empty initially', async () => {
        const s = await storage.restoreState();
        assert.strictEqual(s, undefined);
    });
    test('round trips state', async () => {
        const original = generateState();
        await storage.storeState(original);
        const changer = (x) => {
            return URI.isUri(x) ? x.toString() : x instanceof Map ? cloneAndChange([...x.values()], changer) : undefined;
        };
        const restored = await storage.restoreState();
        assert.deepStrictEqual(cloneAndChange(restored, changer), cloneAndChange(original, changer));
    });
    test('clears state', async () => {
        await storage.storeState(generateState());
        await storage.clearState();
        const s = await storage.restoreState();
        assert.strictEqual(s, undefined);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdEVkaXRpbmdTZXNzaW9uU3RvcmFnZS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2NoYXQvdGVzdC9icm93c2VyL2NoYXRFZGl0aW5nU2Vzc2lvblN0b3JhZ2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUNqQyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDaEUsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ3ZFLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDbEUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ2xGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLG9FQUFvRSxDQUFDO0FBQ2hILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUMzRixPQUFPLEVBQUUseUJBQXlCLEVBQStDLE1BQU0sd0RBQXdELENBQUM7QUFDaEosT0FBTyxFQUFFLDJDQUEyQyxFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFHaEksS0FBSyxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRTtJQUN2QyxNQUFNLEVBQUUsR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBQ3JELE1BQU0sZUFBZSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUN6RCxJQUFJLEVBQWUsQ0FB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