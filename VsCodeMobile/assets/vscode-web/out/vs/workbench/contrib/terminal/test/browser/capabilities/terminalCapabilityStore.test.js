/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual, strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TerminalCapabilityStore, TerminalCapabilityStoreMultiplexer } from '../../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
suite('TerminalCapabilityStore', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let capabilityStore;
    let addEvents;
    let removeEvents;
    setup(() => {
        capabilityStore = store.add(new TerminalCapabilityStore());
        store.add(capabilityStore.onDidAddCapability(e => addEvents.push(e.id)));
        store.add(capabilityStore.onDidRemoveCapability(e => removeEvents.push(e.id)));
        addEvents = [];
        removeEvents = [];
    });
    test('should fire events when capabilities are added', () => {
        assertEvents(addEvents, []);
        capabilityStore.add(0 /* TerminalCapability.CwdDetection */, {});
        assertEvents(addEvents, [0 /* TerminalCapability.CwdDetection */]);
    });
    test('should fire events when capabilities are removed', async () => {
        assertEvents(removeEvents, []);
        capabilityStore.add(0 /* TerminalCapability.CwdDetection */, {});
        assertEvents(removeEvents, []);
        capabilityStore.remove(0 /* TerminalCapability.CwdDetection */);
        assertEvents(removeEvents, [0 /* TerminalCapability.CwdDetection */]);
    });
    test('has should return whether a capability is present', () => {
        deepStrictEqual(capabilityStore.has(0 /* TerminalCapability.CwdDetection */), false);
        capabilityStore.add(0 /* TerminalCapability.CwdDetection */, {});
        deepStrictEqual(capabilityStore.has(0 /* TerminalCapability.CwdDetection */), true);
        capabilityStore.remove(0 /* TerminalCapability.CwdDetection */);
        deepStrictEqual(capabilityStore.has(0 /* TerminalCapability.CwdDetection */), false);
    });
    test('items should reflect current state', () => {
        deepStrictEqual(Array.from(capabilityStore.items), []);
        capabilityStore.add(0 /* TerminalCapability.CwdDetection */, {});
        deepStrictEqual(Array.from(capabilityStore.items), [0 /* TerminalCapability.CwdDetection */]);
        capabilityStore.add(1 /* TerminalCapability.NaiveCwdDetection */, {});
        deepStrictEqual(Array.from(capabilityStore.items), [0 /* TerminalCapability.CwdDetection */, 1 /* TerminalCapability.NaiveCwdDetection */]);
        capabilityStore.remove(0 /* TerminalCapability.CwdDetection */);
        deepStrictEqual(Array.from(capabilityStore.items), [1 /* TerminalCapability.NaiveCwdDetection */]);
    });
    test('ensure events are memoized', () => {
        for (const getEvent of getDerivedEventGetters(capabilityStore)) {
            strictEqual(getEvent(), getEvent());
        }
    });
    test('ensure events are cleaned up', () => {
        for (const getEvent of getDerivedEventGetters(capabilityStore)) {
            store.add(getEvent()(() => { }));
        }
    });
});
suite('TerminalCapabilityStoreMultiplexer', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let multiplexer;
    let store1;
    let store2;
    let addEvents;
    let removeEvents;
    setup(() => {
        multiplexer = store.add(new TerminalCapabilityStoreMultiplexer());
        store.add(multiplexer.onDidAddCapability(e => addEvents.push(e.id)));
        store.add(multiplexer.onDidRemoveCapability(e => removeEvents.push(e.id)));
        store1 = store.add(new TerminalCapabilityStore());
        store2 = store.add(new TerminalCapabilityStore());
        addEvents = [];
        removeEvents = [];
    });
    test('should fire events when capabilities are enabled', async () => {
        assertEvents(addEvents, []);
        multiplexer.add(store1);
        multiplexer.add(store2);
        store1.add(0 /* TerminalCapability.CwdDetection */, {});
        assertEvents(addEvents, [0 /* TerminalCapability.CwdDetection */]);
        store2.add(1 /* TerminalCapability.NaiveCwdDetection */, {});
        assertEvents(addEvents, [1 /* TerminalCapability.NaiveCwdDetection */]);
    });
    test('should fire events when capabilities are disabled', async () => {
        assertEvents(removeEvents, []);
        multiplexer.add(store1);
        multiplexer.add(store2);
        store1.add(0 /* TerminalCapability.CwdDetection */, {});
        store2.add(1 /* TerminalCapability.NaiveCwdDetection */, {});
        assertEvents(removeEvents, []);
        store1.remove(0 /* TerminalCapability.CwdDetection */);
        assertEvents(removeEvents, [0 /* TerminalCapability.CwdDetection */]);
        store2.remove(1 /* TerminalCapability.NaiveCwdDetection */);
        assertEvents(removeEvents, [1 /* TerminalCapability.NaiveCwdDetection */]);
    });
    test('should fire events when stores are added', async () => {
        assertEvents(addEvents, []);
        store1.add(0 /* TerminalCapability.CwdDetection */, {});
        assertEvents(addEvents, []);
        store2.add(1 /* TerminalCapability.NaiveCwdDetection */, {});
        multiplexer.add(store1);
        multiplexer.add(store2);
        assertEvents(addEvents, [0 /* TerminalCapability.CwdDetection */, 1 /* TerminalCapability.NaiveCwdDetection */]);
    });
    test('items should return items from all stores', () => {
        deepStrictEqual(Array.from(multiplexer.items).sort(), [].sort());
        multiplexer.add(store1);
        multiplexer.add(store2);
        store1.add(0 /* TerminalCapability.CwdDetection */, {});
        deepStrictEqual(Array.from(multiplexer.items).sort(), [0 /* TerminalCapability.CwdDetection */].sort());
        store1.add(2 /* TerminalCapability.CommandDetection */, {});
        store2.add(1 /* TerminalCapability.NaiveCwdDetection */, {});
        deepStrictEqual(Array.from(multiplexer.items).sort(), [0 /* TerminalCapability.CwdDetection */, 2 /* TerminalCapability.CommandDetection */, 1 /* TerminalCapability.NaiveCwdDetection */].sort());
        store2.remove(1 /* TerminalCapability.NaiveCwdDetection */);
        deepStrictEqual(Array.from(multiplexer.items).sort(), [0 /* TerminalCapability.CwdDetection */, 2 /* TerminalCapability.CommandDetection */].sort());
    });
    test('has should return whether a capability is present', () => {
        deepStrictEqual(multiplexer.has(0 /* TerminalCapability.CwdDetection */), false);
        multiplexer.add(store1);
        store1.add(0 /* TerminalCapability.CwdDetection */, {});
        deepStrictEqual(multiplexer.has(0 /* TerminalCapability.CwdDetection */), true);
        store1.remove(0 /* TerminalCapability.CwdDetection */);
        deepStrictEqual(multiplexer.has(0 /* TerminalCapability.CwdDetection */), false);
    });
    test('ensure events are memoized', () => {
        for (const getEvent of getDerivedEventGetters(multiplexer)) {
            strictEqual(getEvent(), getEvent());
        }
    });
    test('ensure events are cleaned up', () => {
        for (const getEvent of getDerivedEventGetters(multiplexer)) {
            store.add(getEvent()(() => { }));
        }
    });
});
function assertEvents(actual, expected) {
    deepStrictEqual(actual, expected);
    actual.length = 0;
}
function getDerivedEventGetters(capabilityStore) {
    return [
        () => capabilityStore.onDidChangeCapabilities,
        () => capabilityStore.onDidAddCommandDetectionCapability,
        () => capabilityStore.onDidRemoveCommandDetectionCapability,
        () => capabilityStore.onDidAddCwdDetectionCapability,
        () => capabilityStore.onDidRemoveCwdDetectionCapability,
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxDYXBhYmlsaXR5U3RvcmUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvY2FwYWJpbGl0aWVzL3Rlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFFdEcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLGtDQUFrQyxFQUFFLE1BQU0sb0ZBQW9GLENBQUM7QUFFakssS0FBSyxDQUFDLHlCQUF5QixFQUFFLEdBQUcsRUFBRTtJQUNyQyxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELElBQUksZUFBd0MsQ0FBQztJQUM3QyxJQUFJLFNBQStCLENBQUM7SUFDcEMsSUFBSSxZQUFrQyxDQUFDO0lBRXZDLEtBQUssQ0FBQyxHQUFHLEVBQUU7UUFDVixlQUFlLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHVCQUF1QixFQUFFLENBQUMsQ0FBQztRQUMzRCxLQUFLLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RSxLQUFLLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRSxTQUFTLEdBQUcsRUFBRSxDQUFDO1FBQ2Ys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