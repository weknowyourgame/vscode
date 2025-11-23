/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { NullExtensionService } from '../../../extensions/common/extensions.js';
import { CommandService } from '../../common/commandService.js';
suite('CommandService', function () {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    setup(function () {
        store.add(CommandsRegistry.registerCommand('foo', function () { }));
    });
    test('activateOnCommand', () => {
        let lastEvent;
        const service = store.add(new CommandService(new InstantiationService(), new class extends NullExtensionService {
            activateByEvent(activationEvent) {
                lastEvent = activationEvent;
                return super.activateByEvent(activationEvent);
            }
        }, new NullLogService()));
        return service.executeCommand('foo').then(() => {
            assert.ok(lastEvent, 'onCommand:foo');
            return service.executeCommand('unknownCommandId');
        }).then(() => {
            assert.ok(false);
        }, () => {
            assert.ok(lastEvent, 'onCommand:unknownCommandId');
        });
    });
    test('fwd activation error', async function () {
        const extensionService = new class extends NullExtensionService {
            activateByEvent(activationEvent) {
                return Promise.reject(new Error('bad_activate'));
            }
        };
        const service = store.add(new CommandService(new InstantiationService(), extensionService, new NullLogService()));
        await extensionService.whenInstalledExtensionsRegistered();
        return service.executeCommand('foo').then(() => assert.ok(false), err => {
            assert.strictEqual(err.message, 'bad_activate');
        });
    });
    test('!onReady, but executeCommand', function () {
        let callCounter = 0;
        const reg = CommandsRegistry.registerCommand('bar', () => callCounter += 1);
        const service = store.add(new CommandService(new InstantiationService(), new class extends NullExtensionService {
            whenInstalledExtensionsRegistered() {
                return new Promise(_resolve => { });
            }
        }, new NullLogService()));
        service.executeCommand('bar');
        assert.strictEqual(callCounter, 1);
        reg.dispose();
    });
    test('issue #34913: !onReady, unknown command', function () {
        let callCounter = 0;
        let resolveFunc;
        const whenInstalledExtensionsRegistered = new Promise(_resolve => { resolveFunc = _resolve; });
        const service = store.add(new CommandService(new InstantiationService(), new class extends NullExtensionService {
            whenInstalledExtensionsRegistered() {
                return whenInstalledExtensionsRegistered;
            }
        }, new NullLogService()));
        const r = service.executeCommand('bar');
        assert.strictEqual(callCounter, 0);
        const reg = CommandsRegistry.registerCommand('bar', () => callCounter += 1);
        resolveFunc(true);
        return r.then(() => {
            reg.dispose();
            assert.strictEqual(callCounter, 1);
        });
    });
    test('Stop waiting for * extensions to activate when trigger is satisfied #62457', function () {
        let callCounter = 0;
        const disposable = new DisposableStore();
        const events = [];
        const service = store.add(new CommandService(new InstantiationService(), new class extends NullExtensionService {
            activateByEvent(event) {
                events.push(event);
                if (event === '*') {
                    return new Promise(() => { }); //forever promise...
                }
                if (event.indexOf('onCommand:') === 0) {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            const reg = CommandsRegistry.registerCommand(event.substr('onCommand:'.length), () => {
                                callCounter += 1;
                            });
                            disposable.add(reg);
                            resolve();
                        }, 0);
                    });
                }
                return Promise.resolve();
            }
        }, new NullLogService()));
        return service.executeCommand('farboo').then(() => {
            assert.strictEqual(callCounter, 1);
            assert.deepStrictEqual(events.sort(), ['*', 'onCommand:farboo'].sort());
        }).finally(() => {
            disposable.dispose();
        });
    });
    test('issue #71471: wait for onCommand activation even if a command is registered', () => {
        const expectedOrder = ['registering command', 'resolving activation event', 'executing command'];
        const actualOrder = [];
        const disposables = new DisposableStore();
        const service = store.add(new CommandService(new InstantiationService(), new class extends NullExtensionService {
            activateByEvent(event) {
                if (event === '*') {
                    return new Promise(() => { }); //forever promise...
                }
                if (event.indexOf('onCommand:') === 0) {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            // Register the command after some time
                            actualOrder.push('registering command');
                            const reg = CommandsRegistry.registerCommand(event.substr('onCommand:'.length), () => {
                                actualOrder.push('executing command');
                            });
                            disposables.add(reg);
                            setTimeout(() => {
                                // Resolve the activation event after some more time
                                actualOrder.push('resolving activation event');
                                resolve();
                            }, 10);
                        }, 10);
                    });
                }
                return Promise.resolve();
            }
        }, new NullLogService()));
        return service.executeCommand('farboo2').then(() => {
            assert.deepStrictEqual(actualOrder, expectedOrder);
        }).finally(() => {
            disposables.dispose();
        });
    });
    test('issue #142155: execute commands synchronously if possible', async () => {
        const actualOrder = [];
        const disposables = new DisposableStore();
        disposables.add(CommandsRegistry.registerCommand(`bizBaz`, () => {
            actualOrder.push('executing command');
        }));
        const extensionService = new class extends NullExtensionService {
            activationEventIsDone(_activationEvent) {
                return true;
            }
        };
        const service = store.add(new CommandService(new InstantiationService(), extensionService, new NullLogService()));
        await extensionService.whenInstalledExtensionsRegistered();
        try {
            actualOrder.push(`before call`);
            const promise = service.executeCommand('bizBaz');
            actualOrder.push(`after call`);
            await promise;
            actualOrder.push(`resolved`);
            assert.deepStrictEqual(actualOrder, [
                'before call',
                'executing command',
                'after call',
                'resolved'
            ]);
        }
        finally {
            disposables.dispose();
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZFNlcnZpY2UudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvY29tbWFuZHMvdGVzdC9jb21tb24vY29tbWFuZFNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBQ3ZGLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHNFQUFzRSxDQUFDO0FBQzVHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNoRixPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFFaEUsS0FBSyxDQUFDLGdCQUFnQixFQUFFO0lBRXZCLE1BQU0sS0FBSyxHQUFHLHVDQUF1QyxFQUFFLENBQUM7SUFFeEQsS0FBSyxDQUFDO1FBQ0wsS0FBSyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyRSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxtQkFBbUIsRUFBRSxHQUFHLEVBQUU7UUFFOUIsSUFBSSxTQUFpQixDQUFDO1FBRXRCLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxjQUFjLENBQUMsSUFBSSxvQkFBb0IsRUFBRSxFQUFFLElBQUksS0FBTSxTQUFRLG9CQUFvQjtZQUNyRyxl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