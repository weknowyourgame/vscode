/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { IEnvironmentService } from '../../../environment/common/environment.js';
import { IFileService } from '../../../files/common/files.js';
import { IStorageService } from '../../../storage/common/storage.js';
import { IUserDataProfilesService } from '../../../userDataProfile/common/userDataProfile.js';
import { IUserDataSyncStoreService } from '../../common/userDataSync.js';
import { IUserDataProfileStorageService } from '../../../userDataProfile/common/userDataProfileStorageService.js';
import { UserDataSyncClient, UserDataSyncTestServer } from './userDataSyncClient.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
suite('GlobalStateSync', () => {
    const server = new UserDataSyncTestServer();
    let testClient;
    let client2;
    let testObject;
    teardown(async () => {
        await testClient.instantiationService.get(IUserDataSyncStoreService).clear();
    });
    const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
    setup(async () => {
        testClient = disposableStore.add(new UserDataSyncClient(server));
        await testClient.setUp(true);
        testObject = testClient.getSynchronizer("globalState" /* SyncResource.GlobalState */);
        client2 = disposableStore.add(new UserDataSyncClient(server));
        await client2.setUp(true);
    });
    test('when global state does not exist', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
        let manifest = await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */);
        server.reset();
        await testObject.sync(manifest);
        assert.deepStrictEqual(server.requests, []);
        const lastSyncUserData = await testObject.getLastSyncUserData();
        const remoteUserData = await testObject.getRemoteUserData(null);
        assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
        assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
        assert.strictEqual(lastSyncUserData.syncData, null);
        manifest = await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */);
        server.reset();
        await testObject.sync(manifest);
        assert.deepStrictEqual(server.requests, []);
        manifest = await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */);
        server.reset();
        await testObject.sync(manifest);
        assert.deepStrictEqual(server.requests, []);
    }));
    test('when global state is created after first sync', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        updateUserStorage('a', 'value1', testClient);
        let lastSyncUserData = await testObject.getLastSyncUserData();
        const manifest = await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */);
        server.reset();
        await testObject.sync(manifest);
        assert.deepStrictEqual(server.requests, [
            { type: 'POST', url: `${server.url}/v1/resource/${testObject.resource}`, headers: { 'If-Match': lastSyncUserData?.ref } },
        ]);
        lastSyncUserData = await testObject.getLastSyncUserData();
        const remoteUserData = await testObject.getRemoteUserData(null);
        assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
        assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
        assert.deepStrictEqual(JSON.parse(lastSyncUserData.syncData.content).storage, { 'a': { version: 1, value: 'value1' } });
    }));
    test('first time sync - outgoing to server (no state)', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        updateUserStorage('a', 'value1', testClient);
        updateMachineStorage('b', 'value1', testClient);
        await updateLocale(testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        assert.strictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
        assert.deepStrictEqual(testObject.conflicts.conflicts, []);
        const { content } = await testClient.read(testObject.resource);
        assert.ok(content !== null);
        const actual = parseGlobalState(content);
        assert.deepStrictEqual(actual.storage, { 'globalState.argv.locale': { version: 1, value: 'en' }, 'a': { version: 1, value: 'value1' } });
    }));
    test('first time sync - incoming from server (no state)', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        updateUserStorage('a', 'value1', client2);
        await updateLocale(client2);
        await client2.sync();
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        assert.strictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
        assert.deepStrictEqual(testObject.conflicts.conflicts, []);
        assert.strictEqual(readStorage('a', testClient), 'value1');
        assert.strictEqual(await readLocale(testClient), 'en');
    }));
    test('first time sync when storage exists', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        updateUserStorage('a', 'value1', client2);
        await client2.sync();
        updateUserStorage('b', 'value2', testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        assert.strictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
        assert.deepStrictEqual(testObject.conflicts.conflicts, []);
        assert.strictEqual(readStorage('a', testClient), 'value1');
        assert.strictEqual(readStorage('b', testClient), 'value2');
        const { content } = await testClient.read(testObject.resource);
        assert.ok(content !== null);
        const actual = parseGlobalState(content);
        assert.deepStrictEqual(actual.storage, { 'a': { version: 1, value: 'value1' }, 'b': { version: 1, value: 'value2' } });
    }));
    test('first time sync when storage exists - has conflicts', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        updateUserStorage('a', 'value1', client2);
        await client2.sync();
        updateUserStorage('a', 'value2', client2);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        assert.strictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
        assert.deepStrictEqual(testObject.conflicts.conflicts, []);
        assert.strictEqual(readStorage('a', testClient), 'value1');
        const { content } = await testClient.read(testObject.resource);
        assert.ok(content !== null);
        const actual = parseGlobalState(content);
        assert.deepStrictEqual(actual.storage, { 'a': { version: 1, value: 'value1' } });
    }));
    test('sync adding a storage value', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        updateUserStorage('a', 'value1', testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        updateUserStorage('b', 'value2', testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        assert.strictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
        assert.deepStrictEqual(testObject.conflicts.conflicts, []);
        assert.strictEqual(readStorage('a', testClient), 'value1');
        assert.strictEqual(readStorage('b', testClient), 'value2');
        const { content } = await testClient.read(testObject.resource);
        assert.ok(content !== null);
        const actual = parseGlobalState(content);
        assert.deepStrictEqual(actual.storage, { 'a': { version: 1, value: 'value1' }, 'b': { version: 1, value: 'value2' } });
    }));
    test('sync updating a storage value', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        updateUserStorage('a', 'value1', testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        updateUserStorage('a', 'value2', testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        assert.strictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
        assert.deepStrictEqual(testObject.conflicts.conflicts, []);
        assert.strictEqual(readStorage('a', testClient), 'value2');
        const { content } = await testClient.read(testObject.resource);
        assert.ok(content !== null);
        const actual = parseGlobalState(content);
        assert.deepStrictEqual(actual.storage, { 'a': { version: 1, value: 'value2' } });
    }));
    test('sync removing a storage value', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        updateUserStorage('a', 'value1', testClient);
        updateUserStorage('b', 'value2', testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        removeStorage('b', testClient);
        await testObject.sync(await testClient.getLatestRef("globalState" /* SyncResource.GlobalState */));
        assert.strictEqual(testObject.status, "idle" /* SyncStatus.Idle */);
        assert.deepStrictEqual(testObject.conflicts.conflicts, []);
        assert.strictEqual(readStorage('a', testClient), 'value1');
        assert.strictEqual(readStorage('b', testClient), undefined);
        const { content } = await testClient.read(testObject.resource);
        assert.ok(content !== null);
        const actual = parseGlobalState(content);
        assert.deepStrictEqual(actual.storage, { 'a': { version: 1, value: 'value1' } });
    }));
    test('sync profile state', () => runWithFakedTimers({ useFakeTimers: true }, async () => {
        const client2 = disposableStore.add(new UserDataSyncClient(server));
        await client2.setUp(true);
        const profile = await client2.instantiationService.get(IUserDataProfilesService).createNamedProfile('profile1');
        await updateLocale(client2);
        await updateUserStorageForProfile('a', 'value1', profile, testClient);
        await client2.sync();
        await testClient.sync();
        const syncedProfile = testClient.instantiationService.get(IUserDataProfilesService).profiles.find(p => p.id === profile.id);
        const profileStorage = await testClient.instantiationService.get(IUserDataProfileStorageService).readStorageData(syncedProfile);
        assert.strictEqual(profileStorage.get('a')?.value, 'value1');
        assert.strictEqual(await readLocale(testClient), 'en');
        const { content } = await testClient.read(testObject.resource, '1');
        assert.ok(content !== null);
        const actual = parseGlobalState(content);
        assert.deepStrictEqual(actual.storage, { 'a': { version: 1, value: 'value1' } });
    }));
    function parseGlobalState(content) {
        const syncData = JSON.parse(content);
        return JSON.parse(syncData.content);
    }
    async function updateLocale(client) {
        const fileService = client.instantiationService.get(IFileService);
        const environmentService = client.instantiationService.get(IEnvironmentService);
        await fileService.writeFile(environmentService.argvResource, VSBuffer.fromString(JSON.stringify({ 'locale': 'en' })));
    }
    function updateUserStorage(key, value, client, profile) {
        const storageService = client.instantiationService.get(IStorageService);
        storageService.store(key, value, 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
    }
    async function updateUserStorageForProfile(key, value, profile, client) {
        const storageService = client.instantiationService.get(IUserDataProfileStorageService);
        const data = new Map();
        data.set(key, value);
        await storageService.updateStorageData(profile, data, 0 /* StorageTarget.USER */);
    }
    function updateMachineStorage(key, value, client) {
        const storageService = client.instantiationService.get(IStorageService);
        storageService.store(key, value, 0 /* StorageScope.PROFILE */, 1 /* StorageTarget.MACHINE */);
    }
    function removeStorage(key, client) {
        const storageService = client.instantiationService.get(IStorageService);
        storageService.remove(key, 0 /* StorageScope.PROFILE */);
    }
    function readStorage(key, client) {
        const storageService = client.instantiationService.get(IStorageService);
        return storageService.get(key, 0 /* StorageScope.PROFILE */);
    }
    async function readLocale(client) {
        const fileService = client.instantiationService.get(IFileService);
        const environmentService = client.instantiationService.get(IEnvironmentService);
        const content = await fileService.readFile(environmentService.argvResource);
        return JSON.parse(content.value.toString()).locale;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsU3RhdGVTeW5jLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdXNlckRhdGFTeW5jL3Rlc3QvY29tbW9uL2dsb2JhbFN0YXRlU3luYy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDN0QsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0scURBQXFELENBQUM7QUFDekYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDakYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sb0NBQW9DLENBQUM7QUFDbEcsT0FBTyxFQUFvQix3QkFBd0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBRWhILE9BQU8sRUFBMkIseUJBQXlCLEVBQTRCLE1BQU0sOEJBQThCLENBQUM7QUFDNUgsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sa0VBQWtFLENBQUM7QUFDbEgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLHNCQUFzQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDckYsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFHaEcsS0FBSyxDQUFDLGlCQUFpQixFQUFFLEdBQUcsRUFBRTtJQUU3QixNQUFNLE1BQU0sR0FBRyxJQUFJLHNCQUFzQixFQUFFLENBQUM7SUFDNUMsSUFBSSxVQUE4QixDQUFDO0lBQ25DLElBQUksT0FBMkIsQ0FBQztJQUVoQyxJQUFJLFVBQW1DLENBQUM7SUFFeEMsUUFBUSxDQUFDLEtBQUssSUFBSSxFQUFFO1FBQ25CLE1BQU0sVUFBVSxDQUFDLG9CQUFv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