/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { deepStrictEqual, fail, strictEqual } from 'assert';
import { importAMDNodeModule } from '../../../../../../amdX.js';
import { getActiveDocument } from '../../../../../../base/browser/dom.js';
import { timeout } from '../../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
import { ShellIntegrationAddon } from '../../../../../../platform/terminal/common/xterm/shellIntegrationAddon.js';
import { workbenchInstantiationService } from '../../../../../test/browser/workbenchTestServices.js';
import { ITerminalConfigurationService } from '../../../../terminal/browser/terminal.js';
import { NullTelemetryService } from '../../../../../../platform/telemetry/common/telemetryUtils.js';
import { events as rich_windows11_pwsh7_echo_3_times } from './recordings/rich/windows11_pwsh7_echo_3_times.js';
import { events as rich_windows11_pwsh7_ls_one_time } from './recordings/rich/windows11_pwsh7_ls_one_time.js';
import { events as rich_windows11_pwsh7_type_foo } from './recordings/rich/windows11_pwsh7_type_foo.js';
import { events as rich_windows11_pwsh7_type_foo_left_twice } from './recordings/rich/windows11_pwsh7_type_foo_left_twice.js';
import { events as rich_macos_zsh_omz_echo_3_times } from './recordings/rich/macos_zsh_omz_echo_3_times.js';
import { events as rich_macos_zsh_omz_ls_one_time } from './recordings/rich/macos_zsh_omz_ls_one_time.js';
import { events as basic_macos_zsh_p10k_ls_one_time } from './recordings/basic/macos_zsh_p10k_ls_one_time.js';
const recordedTestCases = [
    {
        name: 'rich_windows11_pwsh7_echo_3_times',
        events: rich_windows11_pwsh7_echo_3_times,
        finalAssertions: (commandDetection) => {
            assertCommandDetectionState(commandDetection, ['echo a', 'echo b', 'echo c'], '|');
        }
    },
    {
        name: 'rich_windows11_pwsh7_ls_one_time',
        events: rich_windows11_pwsh7_ls_one_time,
        finalAssertions: (commandDetection) => {
            assertCommandDetectionState(commandDetection, ['ls'], '|');
        }
    },
    {
        name: 'rich_windows11_pwsh7_type_foo',
        events: rich_windows11_pwsh7_type_foo,
        finalAssertions: (commandDetection) => {
            assertCommandDetectionState(commandDetection, [], 'foo|');
        }
    },
    {
        name: 'rich_windows11_pwsh7_type_foo_left_twice',
        events: rich_windows11_pwsh7_type_foo_left_twice,
        finalAssertions: (commandDetection) => {
            assertCommandDetectionState(commandDetection, [], 'f|oo');
        }
    },
    {
        name: 'rich_macos_zsh_omz_echo_3_times',
        events: rich_macos_zsh_omz_echo_3_times,
        finalAssertions: (commandDetection) => {
            assertCommandDetectionState(commandDetection, ['echo a', 'echo b', 'echo c'], '|');
        }
    },
    {
        name: 'rich_macos_zsh_omz_ls_one_time',
        events: rich_macos_zsh_omz_ls_one_time,
        finalAssertions: (commandDetection) => {
            assertCommandDetectionState(commandDetection, ['ls'], '|');
        }
    },
    {
        name: 'basic_macos_zsh_p10k_ls_one_time',
        events: basic_macos_zsh_p10k_ls_one_time,
        finalAssertions: (commandDetection) => {
            // Prompt input model doesn't work for p10k yet
            // Assert a single command has completed
            deepStrictEqual(commandDetection.commands.map(e => e.command), ['']);
        }
    },
];
function assertCommandDetectionState(commandDetection, commands, promptInput) {
    if (!commandDetection) {
        fail('Command detection must be set');
    }
    deepStrictEqual(commandDetection.commands.map(e => e.command), commands);
    strictEqual(commandDetection.promptInputModel.getCombinedString(), promptInput);
}
suite('Terminal Contrib Shell Integration Recordings', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let xterm;
    let capabilities;
    setup(async () => {
        const terminalConfig = {
            integrated: {}
        };
        const instantiationService = workbenchInstantiationService({
            configurationService: () => new TestConfigurationService({
                files: { autoSave: false },
                terminal: terminalConfig,
                editor: { fontSize: 14, fontFamily: 'Arial', lineHeight: 12, fontWeight: 'bold' }
            })
        }, store);
        const terminalConfigurationService = instantiationService.get(ITerminalConfigurationService);
        terminalConfigurationService.setConfig(terminalConfig);
        const shellIntegrationAddon = store.add(new ShellIntegrationAddon('', true, undefined, NullTelemetryService, new NullLogService));
        const TerminalCtor = (await importAMDNodeModule('@xterm/xterm', 'lib/xterm.js')).Terminal;
        xterm = store.add(new TerminalCtor({ allowProposedApi: true }));
        capabilities = shellIntegrationAddon.capabilities;
        const testContainer = document.createElement('div');
        getActiveDocument().body.append(testContainer);
        xterm.open(testContainer);
        xterm.loadAddon(shellIntegrationAddon);
        xterm.focus();
    });
    for (const testCase of recordedTestCases) {
        test(testCase.name, async () => {
            for (const [i, event] of testCase.events.entries()) {
                // DEBUG: Uncomment to see the events as they are played
                // console.log(
                // 	event.type,
                // 	event.type === 'command'
                // 		? event.id
                // 		: event.type === 'resize'
                // 			? `${event.cols}x${event.rows}`
                // 			: (event.data.length > 50 ? event.data.slice(0, 50) + '...' : event.data).replaceAll('\x1b', '\\x1b').replace(/(\n|\r).+$/, '...')
                // );
                // console.log('promptInputModel', capabilities.get(TerminalCapability.CommandDetection)?.promptInputModel.getCombinedString());
                switch (event.type) {
                    case 'resize': {
                        xterm.resize(event.cols, event.rows);
                        break;
                    }
                    case 'output': {
                        const promises = [];
                        if (event.data.includes('\x1b]633;B')) {
                            // If the output contains the command start sequence, allow time for the prompt to get
                            // adjusted.
                            promises.push(new Promise(r => {
                                const commandDetection = capabilities.get(2 /* TerminalCapability.CommandDetection */);
                                if (commandDetection) {
                                    const d = commandDetection.onCommandStarted(() => {
                                        d.dispose();
                                        r();
                                    });
                                }
                            }));
                        }
                        promises.push(new Promise(r => xterm.write(event.data, () => r())));
                        await Promise.all(promises);
                        break;
                    }
                    case 'input': {
                        xterm.input(event.data, true);
                        break;
                    }
                    case 'promptInputChange': {
                        // Ignore this event if it's followed by another promptInputChange as that
                        // means this one isn't important and could cause a race condition in the
                        // test
                        if (testCase.events.length > i + 1 && testCase.events[i + 1].type === 'promptInputChange') {
                            continue;
                        }
                        const promptInputModel = capabilities.get(2 /* TerminalCapability.CommandDetection */)?.promptInputModel;
                        if (promptInputModel && promptInputModel.getCombinedString() !== event.data) {
                            await Promise.race([
                                await timeout(1000).then(() => { throw new Error(`Prompt input change timed out current="${promptInputModel.getCombinedString()}", expected="${event.data}"`); }),
                                await new Promise(r => {
                                    const d = promptInputModel.onDidChangeInput(() => {
                                        if (promptInputModel.getCombinedString() === event.data) {
                                            d.dispose();
                                            r();
                                        }
                                    });
                                })
                            ]);
                        }
                        break;
                    }
                }
            }
            testCase.finalAssertions(capabilities.get(2 /* TerminalCapability.CommandDetection */));
        });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmludGVncmF0aW9uVGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIveHRlcm0vc2hlbGxJbnRlZ3JhdGlvbkFkZG9uLmludGVncmF0aW9uVGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDNUQsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sMkJBQTJCLENBQUM7QUFDaEUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDMUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGtGQUFrRixDQUFDO0FBQzVILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUc5RSxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSwyRUFBMkUsQ0FBQztBQUNsSCxPQUFPLEVBQUUsNkJBQTZCLEVBQXlDLE1BQU0sc0RBQXNELENBQUM7QUFDNUksT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFekYsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sK0RBQStELENBQUM7QUFDckcsT0FBTyxFQUFFLE1BQU0sSUFBSSxpQ0FBaUMsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQ2hILE9BQU8sRUFBRSxNQUFNLElBQUksZ0NBQWdDLEVBQUUsTUFBTSxrREFBa0QsQ0FBQztBQUM5RyxPQUFPLEVBQUUsTUFBTSxJQUFJLDZCQUE2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