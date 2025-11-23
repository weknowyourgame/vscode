/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ExtHostCommands } from '../../common/extHostCommands.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { SingleProxyRPCProtocol } from '../common/testRPCProtocol.js';
import { mock } from '../../../../base/test/common/mock.js';
import { NullLogService } from '../../../../platform/log/common/log.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
suite('ExtHostCommands', function () {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('dispose calls unregister', function () {
        let lastUnregister;
        const shape = new class extends mock() {
            $registerCommand(id) {
                //
            }
            $unregisterCommand(id) {
                lastUnregister = id;
            }
        };
        const commands = new ExtHostCommands(SingleProxyRPCProtocol(shape), new NullLogService(), new class extends mock() {
            onExtensionError() {
                return true;
            }
        });
        commands.registerCommand(true, 'foo', () => { }).dispose();
        assert.strictEqual(lastUnregister, 'foo');
        assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);
    });
    test('dispose bubbles only once', function () {
        let unregisterCounter = 0;
        const shape = new class extends mock() {
            $registerCommand(id) {
                //
            }
            $unregisterCommand(id) {
                unregisterCounter += 1;
            }
        };
        const commands = new ExtHostCommands(SingleProxyRPCProtocol(shape), new NullLogService(), new class extends mock() {
            onExtensionError() {
                return true;
            }
        });
        const reg = commands.registerCommand(true, 'foo', () => { });
        reg.dispose();
        reg.dispose();
        reg.dispose();
        assert.strictEqual(unregisterCounter, 1);
    });
    test('execute with retry', async function () {
        let count = 0;
        const shape = new class extends mock() {
            $registerCommand(id) {
                //
            }
            async $executeCommand(id, args, retry) {
                count++;
                assert.strictEqual(retry, count === 1);
                if (count === 1) {
                    assert.strictEqual(retry, true);
                    throw new Error('$executeCommand:retry');
                }
                else {
                    assert.strictEqual(retry, false);
                    // eslint-disable-next-line local/code-no-any-casts
                    return 17;
                }
            }
        };
        const commands = new ExtHostCommands(SingleProxyRPCProtocol(shape), new NullLogService(), new class extends mock() {
            onExtensionError() {
                return true;
            }
        });
        const result = await commands.executeCommand('fooo', [this, true]);
        assert.strictEqual(result, 17);
        assert.strictEqual(count, 2);
    });
    test('onCommand:abc activates extensions when executed from command palette, but not when executed programmatically with vscode.commands.executeCommand #150293', async function () {
        const activationEvents = [];
        const shape = new class extends mock() {
            $registerCommand(id) {
                //
            }
            $fireCommandActivationEvent(id) {
                activationEvents.push(id);
            }
        };
        const commands = new ExtHostCommands(SingleProxyRPCProtocol(shape), new NullLogService(), new class extends mock() {
            onExtensionError() {
                return true;
            }
        });
        commands.registerCommand(true, 'extCmd', (args) => args);
        const result = await commands.executeCommand('extCmd', this);
        assert.strictEqual(result, this);
        assert.deepStrictEqual(activationEvents, ['extCmd']);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdENvbW1hbmRzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2FwaS90ZXN0L2Jyb3dzZXIvZXh0SG9zdENvbW1hbmRzLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztBQUVsRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUNwRixPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQztBQUN0RSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDNUQsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBRXhFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBRWhHLEtBQUssQ0FBQyxpQkFBaUIsRUFBRTtJQUN4Qix1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQywwQkFBMEIsRUFBRTtRQUVoQyxJQUFJLGNBQXNCLENBQUM7UUFFM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFNLFNBQVEsSUFBSSxFQUEyQjtZQUNyRCxnQkFBZ0IsQ0FBQyxFQUFVO2dCQUNuQyxFQUFFO1lBQ0gsQ0FBQztZQUNRLGtCQUFrQixDQUFDLEVBQVU7Z0JBQ3JDLGNBQWMsR0FBRyxFQUFFLENBQUM7WUFDckIsQ0FBQztTQUNELENBQUM7UUFFRixNQUFNLFFBQVEsR0FBRyxJQUFJLGVBQWUsQ0FDbkMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLEVBQzdCLElBQUksY0FBYyxFQUFFLEVBQ3BCLElBQUksS0FBTSxTQUFRLElBQUksRUFBcUI7WUFDakMsZ0JBQWdCO2dCQUN4QixPQUFPLElBQUksQ0FB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