/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TerminalCapabilityStore } from '../../../../../platform/terminal/common/capabilities/terminalCapabilityStore.js';
import { createInstanceCapabilityEventMultiplexer } from '../../browser/terminalEvents.js';
// Mock implementations for testing
class MockCwdDetectionCapability {
    constructor() {
        this.type = 0 /* TerminalCapability.CwdDetection */;
        this.cwds = [];
        this._onDidChangeCwd = new Emitter();
        this.onDidChangeCwd = this._onDidChangeCwd.event;
    }
    getCwd() {
        return this.cwds[this.cwds.length - 1] || '';
    }
    updateCwd(cwd) {
        this.cwds.push(cwd);
        this._onDidChangeCwd.fire(cwd);
    }
    fireEvent(cwd) {
        this.updateCwd(cwd);
    }
    dispose() {
        this._onDidChangeCwd.dispose();
    }
}
function createMockTerminalInstance(instanceId, capabilities) {
    const instance = {
        instanceId,
        capabilities
    };
    return instance;
}
suite('Terminal Events', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    suite('createInstanceCapabilityEventMultiplexer', () => {
        test('should handle existing instances with capabilities', () => {
            const capability = store.add(new MockCwdDetectionCapability());
            const capabilities = store.add(new TerminalCapabilityStore());
            capabilities.add(0 /* TerminalCapability.CwdDetection */, capability);
            const instance = createMockTerminalInstance(1, capabilities);
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([instance], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventFired = false;
            let capturedData;
            store.add(multiplexer.event(e => {
                eventFired = true;
                capturedData = e;
            }));
            capability.fireEvent('test-data');
            strictEqual(eventFired, true, 'Event should be fired');
            strictEqual(capturedData?.instance, instance, 'Event should contain correct instance');
            strictEqual(capturedData?.data, 'test-data', 'Event should contain correct data');
        });
        test('should handle instances without capabilities', () => {
            const capabilities = store.add(new TerminalCapabilityStore());
            const instance = createMockTerminalInstance(1, capabilities);
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([instance], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventFired = false;
            store.add(multiplexer.event(() => {
                eventFired = true;
            }));
            strictEqual(eventFired, false, 'No event should be fired for instances without capabilities');
        });
        test('should handle adding new instances', () => {
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventFired = false;
            let capturedData;
            store.add(multiplexer.event(e => {
                eventFired = true;
                capturedData = e;
            }));
            // Add a new instance with capability
            const capability = store.add(new MockCwdDetectionCapability());
            const capabilities = store.add(new TerminalCapabilityStore());
            const instance = createMockTerminalInstance(2, capabilities);
            onAddInstance.fire(instance);
            // Add capability to the instance after it's added to the multiplexer
            capabilities.add(0 /* TerminalCapability.CwdDetection */, capability);
            // Fire an event from the capability
            capability.fireEvent('new-instance-data');
            strictEqual(eventFired, true, 'Event should be fired from new instance');
            strictEqual(capturedData?.instance, instance, 'Event should contain correct new instance');
            strictEqual(capturedData?.data, 'new-instance-data', 'Event should contain correct data');
        });
        test('should handle removing instances', () => {
            const capability = store.add(new MockCwdDetectionCapability());
            const capabilities = store.add(new TerminalCapabilityStore());
            capabilities.add(0 /* TerminalCapability.CwdDetection */, capability);
            const instance = createMockTerminalInstance(3, capabilities);
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([instance], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventCount = 0;
            store.add(multiplexer.event(() => {
                eventCount++;
            }));
            // Fire event before removal
            capability.fireEvent('before-removal');
            strictEqual(eventCount, 1, 'Event should be fired before removal');
            // Remove the instance
            onRemoveInstance.fire(instance);
            // Fire event after removal - should not be received
            capability.fireEvent('after-removal');
            strictEqual(eventCount, 1, 'Event should not be fired after instance removal');
        });
        test('should handle adding capabilities to existing instances', () => {
            const capabilities = store.add(new TerminalCapabilityStore());
            const instance = createMockTerminalInstance(4, capabilities);
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([instance], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventFired = false;
            let capturedData;
            store.add(multiplexer.event(e => {
                eventFired = true;
                capturedData = e;
            }));
            // Add capability to existing instance
            const capability = store.add(new MockCwdDetectionCapability());
            capabilities.add(0 /* TerminalCapability.CwdDetection */, capability);
            // Fire an event from the newly added capability
            capability.fireEvent('added-capability-data');
            strictEqual(eventFired, true, 'Event should be fired from newly added capability');
            strictEqual(capturedData?.instance, instance, 'Event should contain correct instance');
            strictEqual(capturedData?.data, 'added-capability-data', 'Event should contain correct data');
        });
        test('should handle removing capabilities from existing instances', () => {
            const capability = store.add(new MockCwdDetectionCapability());
            const capabilities = store.add(new TerminalCapabilityStore());
            capabilities.add(0 /* TerminalCapability.CwdDetection */, capability);
            const instance = createMockTerminalInstance(5, capabilities);
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([instance], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventCount = 0;
            store.add(multiplexer.event(() => {
                eventCount++;
            }));
            // Fire event before removing capability
            capability.fireEvent('before-capability-removal');
            strictEqual(eventCount, 1, 'Event should be fired before capability removal');
            // Remove the capability
            capabilities.remove(0 /* TerminalCapability.CwdDetection */); // Fire event after capability removal - should not be received
            capability.fireEvent('after-capability-removal');
            strictEqual(eventCount, 1, 'Event should not be fired after capability removal');
        });
        test('should handle multiple instances with same capability', () => {
            const capability1 = store.add(new MockCwdDetectionCapability());
            const capability2 = store.add(new MockCwdDetectionCapability());
            const capabilities1 = store.add(new TerminalCapabilityStore());
            const capabilities2 = store.add(new TerminalCapabilityStore());
            capabilities1.add(0 /* TerminalCapability.CwdDetection */, capability1);
            capabilities2.add(0 /* TerminalCapability.CwdDetection */, capability2);
            const instance1 = createMockTerminalInstance(6, capabilities1);
            const instance2 = createMockTerminalInstance(7, capabilities2);
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([instance1, instance2], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            const events = [];
            store.add(multiplexer.event(e => {
                events.push(e);
            }));
            // Fire events from both capabilities
            capability1.fireEvent('data-from-instance1');
            capability2.fireEvent('data-from-instance2');
            strictEqual(events.length, 2, 'Both events should be received');
            strictEqual(events[0].instance, instance1, 'First event should be from instance1');
            strictEqual(events[0].data, 'data-from-instance1', 'First event should have correct data');
            strictEqual(events[1].instance, instance2, 'Second event should be from instance2');
            strictEqual(events[1].data, 'data-from-instance2', 'Second event should have correct data');
        });
        test('should properly dispose all resources', () => {
            const testStore = new DisposableStore();
            const capability = testStore.add(new MockCwdDetectionCapability());
            const capabilities = testStore.add(new TerminalCapabilityStore());
            capabilities.add(0 /* TerminalCapability.CwdDetection */, capability);
            const instance = createMockTerminalInstance(8, capabilities);
            const onAddInstance = testStore.add(new Emitter());
            const onRemoveInstance = testStore.add(new Emitter());
            const multiplexer = testStore.add(createInstanceCapabilityEventMultiplexer([instance], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventCount = 0;
            testStore.add(multiplexer.event(() => {
                eventCount++;
            }));
            // Fire event before disposal
            capability.fireEvent('before-disposal');
            strictEqual(eventCount, 1, 'Event should be fired before disposal');
            // Dispose everything
            testStore.dispose();
            // Fire event after disposal - should not be received
            capability.fireEvent('after-disposal');
            strictEqual(eventCount, 1, 'Event should not be fired after disposal');
        });
        test('should handle empty current instances array', () => {
            const onAddInstance = store.add(new Emitter());
            const onRemoveInstance = store.add(new Emitter());
            const multiplexer = store.add(createInstanceCapabilityEventMultiplexer([], onAddInstance.event, onRemoveInstance.event, 0 /* TerminalCapability.CwdDetection */, (cap) => cap.onDidChangeCwd));
            let eventFired = false;
            store.add(multiplexer.event(() => {
                eventFired = true;
            }));
            // No instances, so no events should be fired initially
            strictEqual(eventFired, false, 'No events should be fired with empty instances array');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxFdmVudHMudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIvdGVybWluYWxFdmVudHMudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3JDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkcsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0saUZBQWlGLENBQUM7QUFDMUgsT0FBTyxFQUFFLHdDQUF3QyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFHM0YsbUNBQW1DO0FBQ25DLE1BQU0sMEJBQTBCO0lBQWhDO1FBQ1UsU0FBSSwyQ0FBbUM7UUFDdkMsU0FBSSxHQUFhLEVBQUUsQ0FBQztRQUVaLG9CQUFlLEdBQUcsSUFBSSxPQUFPLEVBQVUsQ0FBQztRQUNoRCxtQkFBYyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDO0lBa0J0RCxDQUFDO0lBaEJBLE1BQU07UUFDTCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzlDLENBQUM7SUFFRCxTQUFTLENBQUMsR0FBVztRQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsU0FBUyxDQUFD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