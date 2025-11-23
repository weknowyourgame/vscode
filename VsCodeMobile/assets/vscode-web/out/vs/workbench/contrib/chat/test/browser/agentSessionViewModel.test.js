/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { MarkdownString } from '../../../../../base/common/htmlContent.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { AgentSessionsViewModel, isAgentSession, isAgentSessionsViewModel, isLocalAgentSessionItem } from '../../browser/agentSessions/agentSessionViewModel.js';
import { AgentSessionsViewFilter } from '../../browser/agentSessions/agentSessionsViewFilter.js';
import { IChatSessionsService, localChatSessionType } from '../../common/chatSessionsService.js';
import { LocalChatSessionUri } from '../../common/chatUri.js';
import { MockChatSessionsService } from '../common/mockChatSessionsService.js';
import { TestLifecycleService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { MenuId } from '../../../../../platform/actions/common/actions.js';
import { ILifecycleService } from '../../../../services/lifecycle/common/lifecycle.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
suite('AgentSessionsViewModel', () => {
    const disposables = new DisposableStore();
    let mockChatSessionsService;
    let mockLifecycleService;
    let viewModel;
    let instantiationService;
    function createViewModel() {
        return disposables.add(instantiationService.createInstance(AgentSessionsViewModel, { filterMenuId: MenuId.ViewTitle }));
    }
    setup(() => {
        mockChatSessionsService = new MockChatSessionsService();
        mockLifecycleService = disposables.add(new TestLifecycleService());
        instantiationService = disposables.add(workbenchInstantiationService(undefined, disposables));
        instantiationService.stub(IChatSessionsService, mockChatSessionsService);
        instantiationService.stub(ILifecycleService, mockLifecycleService);
    });
    teardown(() => {
        disposables.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('should initialize with empty sessions', () => {
        viewModel = createViewModel();
        assert.strictEqual(viewModel.sessions.length, 0);
    });
    test('should resolve sessions from providers', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Test Session 1',
                        description: 'Description 1',
                        timing: { startTime: Date.now() }
                    },
                    {
                        resource: URI.parse('test://session-2'),
                        label: 'Test Session 2',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 2);
            assert.strictEqual(viewModel.sessions[0].resource.toString(), 'test://session-1');
            assert.strictEqual(viewModel.sessions[0].label, 'Test Session 1');
            assert.strictEqual(viewModel.sessions[1].resource.toString(), 'test://session-2');
            assert.strictEqual(viewModel.sessions[1].label, 'Test Session 2');
        });
    });
    test('should resolve sessions from multiple providers', async () => {
        return runWithFakedTimers({}, async () => {
            const provider1 = {
                chatSessionType: 'type-1',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Session 1',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            const provider2 = {
                chatSessionType: 'type-2',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-2'),
                        label: 'Session 2',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider1);
            mockChatSessionsService.registerChatSessionItemProvider(provider2);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 2);
            assert.strictEqual(viewModel.sessions[0].resource.toString(), 'test://session-1');
            assert.strictEqual(viewModel.sessions[1].resource.toString(), 'test://session-2');
        });
    });
    test('should fire onWillResolve and onDidResolve events', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => []
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            let willResolveFired = false;
            let didResolveFired = false;
            disposables.add(viewModel.onWillResolve(() => {
                willResolveFired = true;
                assert.strictEqual(didResolveFired, false, 'onDidResolve should not fire before onWillResolve completes');
            }));
            disposables.add(viewModel.onDidResolve(() => {
                didResolveFired = true;
                assert.strictEqual(willResolveFired, true, 'onWillResolve should fire before onDidResolve');
            }));
            await viewModel.resolve(undefined);
            assert.strictEqual(willResolveFired, true, 'onWillResolve should have fired');
            assert.strictEqual(didResolveFired, true, 'onDidResolve should have fired');
        });
    });
    test('should fire onDidChangeSessions event after resolving', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Test Session',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            let sessionsChangedFired = false;
            disposables.add(viewModel.onDidChangeSessions(() => {
                sessionsChangedFired = true;
            }));
            await viewModel.resolve(undefined);
            assert.strictEqual(sessionsChangedFired, true, 'onDidChangeSessions should have fired');
        });
    });
    test('should handle session with all properties', async () => {
        return runWithFakedTimers({}, async () => {
            const startTime = Date.now();
            const endTime = startTime + 1000;
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Test Session',
                        description: new MarkdownString('**Bold** description'),
                        status: 1 /* ChatSessionStatus.Completed */,
                        tooltip: 'Session tooltip',
                        iconPath: ThemeIcon.fromId('check'),
                        timing: { startTime, endTime },
                        statistics: { files: 1, insertions: 10, deletions: 5 }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 1);
            const session = viewModel.sessions[0];
            assert.strictEqual(session.resource.toString(), 'test://session-1');
            assert.strictEqual(session.label, 'Test Session');
            assert.ok(session.description instanceof MarkdownString);
            if (session.description instanceof MarkdownString) {
                assert.strictEqual(session.description.value, '**Bold** description');
            }
            assert.strictEqual(session.status, 1 /* ChatSessionStatus.Completed */);
            assert.strictEqual(session.timing.startTime, startTime);
            assert.strictEqual(session.timing.endTime, endTime);
            assert.deepStrictEqual(session.statistics, { files: 1, insertions: 10, deletions: 5 });
        });
    });
    test('should handle resolve with specific provider', async () => {
        return runWithFakedTimers({}, async () => {
            const provider1 = {
                chatSessionType: 'type-1',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Session 1',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            const provider2 = {
                chatSessionType: 'type-2',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        id: 'session-2',
                        resource: URI.parse('test://session-2'),
                        label: 'Session 2',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider1);
            mockChatSessionsService.registerChatSessionItemProvider(provider2);
            viewModel = createViewModel();
            // First resolve all
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 2);
            // Now resolve only type-1
            await viewModel.resolve('type-1');
            // Should still have both sessions, but only type-1 was re-resolved
            assert.strictEqual(viewModel.sessions.length, 2);
        });
    });
    test('should handle resolve with multiple specific providers', async () => {
        return runWithFakedTimers({}, async () => {
            const provider1 = {
                chatSessionType: 'type-1',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Session 1',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            const provider2 = {
                chatSessionType: 'type-2',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        id: 'session-2',
                        resource: URI.parse('test://session-2'),
                        label: 'Session 2',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider1);
            mockChatSessionsService.registerChatSessionItemProvider(provider2);
            viewModel = createViewModel();
            await viewModel.resolve(['type-1', 'type-2']);
            assert.strictEqual(viewModel.sessions.length, 2);
        });
    });
    test('should respond to onDidChangeItemsProviders event', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Test Session',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            const sessionsChangedPromise = Event.toPromise(viewModel.onDidChangeSessions);
            // Trigger event - this should automatically call resolve
            mockChatSessionsService.fireDidChangeItemsProviders(provider);
            // Wait for the sessions to be resolved
            await sessionsChangedPromise;
            assert.strictEqual(viewModel.sessions.length, 1);
        });
    });
    test('should respond to onDidChangeAvailability event', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Test Session',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            const sessionsChangedPromise = Event.toPromise(viewModel.onDidChangeSessions);
            // Trigger event - this should automatically call resolve
            mockChatSessionsService.fireDidChangeAvailability();
            // Wait for the sessions to be resolved
            await sessionsChangedPromise;
            assert.strictEqual(viewModel.sessions.length, 1);
        });
    });
    test('should respond to onDidChangeSessionItems event', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Test Session',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            const sessionsChangedPromise = Event.toPromise(viewModel.onDidChangeSessions);
            // Trigger event - this should automatically call resolve
            mockChatSessionsService.fireDidChangeSessionItems('test-type');
            // Wait for the sessions to be resolved
            await sessionsChangedPromise;
            assert.strictEqual(viewModel.sessions.length, 1);
        });
    });
    test('should maintain provider reference in session view model', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: URI.parse('test://session-1'),
                        label: 'Test Session',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 1);
            assert.strictEqual(viewModel.sessions[0].providerType, 'test-type');
        });
    });
    test('should handle empty provider results', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => []
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 0);
        });
    });
    test('should handle sessions with different statuses', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        id: 'session-failed',
                        resource: URI.parse('test://session-failed'),
                        label: 'Failed Session',
                        status: 0 /* ChatSessionStatus.Failed */,
                        timing: { startTime: Date.now() }
                    },
                    {
                        id: 'session-completed',
                        resource: URI.parse('test://session-completed'),
                        label: 'Completed Session',
                        status: 1 /* ChatSessionStatus.Completed */,
                        timing: { startTime: Date.now() }
                    },
                    {
                        id: 'session-inprogress',
                        resource: URI.parse('test://session-inprogress'),
                        label: 'In Progress Session',
                        status: 2 /* ChatSessionStatus.InProgress */,
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 3);
            assert.strictEqual(viewModel.sessions[0].status, 0 /* ChatSessionStatus.Failed */);
            assert.strictEqual(viewModel.sessions[1].status, 1 /* ChatSessionStatus.Completed */);
            assert.strictEqual(viewModel.sessions[2].status, 2 /* ChatSessionStatus.InProgress */);
        });
    });
    test('should replace sessions on re-resolve', async () => {
        return runWithFakedTimers({}, async () => {
            let sessionCount = 1;
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => {
                    const sessions = [];
                    for (let i = 0; i < sessionCount; i++) {
                        sessions.push({
                            resource: URI.parse(`test://session-${i}`),
                            label: `Session ${i}`,
                            timing: { startTime: Date.now() }
                        });
                    }
                    return sessions;
                }
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 1);
            sessionCount = 3;
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 3);
        });
    });
    test('should handle local agent session type specially', async () => {
        return runWithFakedTimers({}, async () => {
            const provider = {
                chatSessionType: localChatSessionType,
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        id: 'local-session',
                        resource: LocalChatSessionUri.forSession('local-session'),
                        label: 'Local Session',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 1);
            assert.strictEqual(viewModel.sessions[0].providerType, localChatSessionType);
        });
    });
    test('should correctly construct resource URIs for sessions', async () => {
        return runWithFakedTimers({}, async () => {
            const resource = URI.parse('custom://my-session/path');
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => [
                    {
                        resource: resource,
                        label: 'Test Session',
                        timing: { startTime: Date.now() }
                    }
                ]
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 1);
            assert.strictEqual(viewModel.sessions[0].resource.toString(), resource.toString());
        });
    });
    test('should throttle multiple rapid resolve calls', async () => {
        return runWithFakedTimers({}, async () => {
            let providerCallCount = 0;
            const provider = {
                chatSessionType: 'test-type',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => {
                    providerCallCount++;
                    return [
                        {
                            resource: URI.parse('test://session-1'),
                            label: 'Test Session',
                            timing: { startTime: Date.now() }
                        }
                    ];
                }
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider);
            viewModel = createViewModel();
            // Make multiple rapid resolve calls
            const resolvePromises = [
                viewModel.resolve(undefined),
                viewModel.resolve(undefined),
                viewModel.resolve(undefined)
            ];
            await Promise.all(resolvePromises);
            // Should only call provider once due to throttling
            assert.strictEqual(providerCallCount, 1);
            assert.strictEqual(viewModel.sessions.length, 1);
        });
    });
    test('should preserve sessions from non-resolved providers', async () => {
        return runWithFakedTimers({}, async () => {
            let provider1CallCount = 0;
            let provider2CallCount = 0;
            const provider1 = {
                chatSessionType: 'type-1',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => {
                    provider1CallCount++;
                    return [
                        {
                            resource: URI.parse('test://session-1'),
                            label: `Session 1 (call ${provider1CallCount})`,
                            timing: { startTime: Date.now() }
                        }
                    ];
                }
            };
            const provider2 = {
                chatSessionType: 'type-2',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => {
                    provider2CallCount++;
                    return [
                        {
                            resource: URI.parse('test://session-2'),
                            label: `Session 2 (call ${provider2CallCount})`,
                            timing: { startTime: Date.now() }
                        }
                    ];
                }
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider1);
            mockChatSessionsService.registerChatSessionItemProvider(provider2);
            viewModel = createViewModel();
            // First resolve all
            await viewModel.resolve(undefined);
            assert.strictEqual(viewModel.sessions.length, 2);
            assert.strictEqual(provider1CallCount, 1);
            assert.strictEqual(provider2CallCount, 1);
            const originalSession1Label = viewModel.sessions[0].label;
            // Now resolve only type-2
            await viewModel.resolve('type-2');
            // Should still have both sessions
            assert.strictEqual(viewModel.sessions.length, 2);
            // Provider 1 should not be called again
            assert.strictEqual(provider1CallCount, 1);
            // Provider 2 should be called again
            assert.strictEqual(provider2CallCount, 2);
            // Session 1 should be preserved with original label
            assert.strictEqual(viewModel.sessions.find(s => s.resource.toString() === 'test://session-1')?.label, originalSession1Label);
        });
    });
    test('should accumulate providers when resolve is called with different provider types', async () => {
        return runWithFakedTimers({}, async () => {
            let resolveCount = 0;
            const resolvedProviders = [];
            const provider1 = {
                chatSessionType: 'type-1',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => {
                    resolveCount++;
                    resolvedProviders.push('type-1');
                    return [{
                            resource: URI.parse('test://session-1'),
                            label: 'Session 1',
                            timing: { startTime: Date.now() }
                        }];
                }
            };
            const provider2 = {
                chatSessionType: 'type-2',
                onDidChangeChatSessionItems: Event.None,
                provideChatSessionItems: async () => {
                    resolveCount++;
                    resolvedProviders.push('type-2');
                    return [{
                            resource: URI.parse('test://session-2'),
                            label: 'Session 2',
                            timing: { startTime: Date.now() }
                        }];
                }
            };
            mockChatSessionsService.registerChatSessionItemProvider(provider1);
            mockChatSessionsService.registerChatSessionItemProvider(provider2);
            viewModel = createViewModel();
            // Call resolve with different types rapidly - they should accumulate
            const promise1 = viewModel.resolve('type-1');
            const promise2 = viewModel.resolve(['type-2']);
            await Promise.all([promise1, promise2]);
            // Both providers should be resolved
            assert.strictEqual(viewModel.sessions.length, 2);
        });
    });
});
suite('AgentSessionsViewModel - Helper Functions', () => {
    const disposables = new DisposableStore();
    teardown(() => {
        disposables.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('isLocalAgentSessionItem should identify local sessions', () => {
        const localSession = {
            providerType: localChatSessionType,
            providerLabel: 'Local',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://local-1'),
            label: 'Local',
            description: 'test',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        const remoteSession = {
            providerType: 'remote',
            providerLabel: 'Remote',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://remote-1'),
            label: 'Remote',
            description: 'test',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        assert.strictEqual(isLocalAgentSessionItem(localSession), true);
        assert.strictEqual(isLocalAgentSessionItem(remoteSession), false);
    });
    test('isAgentSession should identify session view models', () => {
        const session = {
            providerType: 'test',
            providerLabel: 'Local',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://test-1'),
            label: 'Test',
            description: 'test',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        // Test with a session object
        assert.strictEqual(isAgentSession(session), true);
        // Test with a sessions container - pass as session to see it returns false
        const sessionOrContainer = session;
        assert.strictEqual(isAgentSession(sessionOrContainer), true);
    });
    test('isAgentSessionsViewModel should identify sessions view models', () => {
        const session = {
            providerType: 'test',
            providerLabel: 'Local',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://test-1'),
            label: 'Test',
            description: 'test',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        // Test with actual view model
        const instantiationService = workbenchInstantiationService(undefined, disposables);
        const lifecycleService = disposables.add(new TestLifecycleService());
        instantiationService.stub(IChatSessionsService, new MockChatSessionsService());
        instantiationService.stub(ILifecycleService, lifecycleService);
        const actualViewModel = disposables.add(instantiationService.createInstance(AgentSessionsViewModel, { filterMenuId: MenuId.ViewTitle }));
        assert.strictEqual(isAgentSessionsViewModel(actualViewModel), true);
        // Test with session object
        assert.strictEqual(isAgentSessionsViewModel(session), false);
    });
});
suite('AgentSessionsViewFilter', () => {
    const disposables = new DisposableStore();
    let mockChatSessionsService;
    let instantiationService;
    setup(() => {
        mockChatSessionsService = new MockChatSessionsService();
        instantiationService = disposables.add(workbenchInstantiationService(undefined, disposables));
        instantiationService.stub(IChatSessionsService, mockChatSessionsService);
    });
    teardown(() => {
        disposables.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('should filter out sessions from excluded provider', () => {
        const storageService = instantiationService.get(IStorageService);
        const filter = disposables.add(instantiationService.createInstance(AgentSessionsViewFilter, { filterMenuId: MenuId.ViewTitle }));
        const provider1 = {
            chatSessionType: 'type-1',
            onDidChangeChatSessionItems: Event.None,
            provideChatSessionItems: async () => []
        };
        const provider2 = {
            chatSessionType: 'type-2',
            onDidChangeChatSessionItems: Event.None,
            provideChatSessionItems: async () => []
        };
        const session1 = {
            providerType: provider1.chatSessionType,
            providerLabel: 'Provider 1',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://session-1'),
            label: 'Session 1',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        const session2 = {
            providerType: provider2.chatSessionType,
            providerLabel: 'Provider 2',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://session-2'),
            label: 'Session 2',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        // Initially, no sessions should be filtered
        assert.strictEqual(filter.exclude(session1), false);
        assert.strictEqual(filter.exclude(session2), false);
        // Exclude type-1 by setting it in storage
        const excludes = {
            providers: ['type-1'],
            states: [],
            archived: true
        };
        storageService.store('agentSessions.filterExcludes', JSON.stringify(excludes), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        // After excluding type-1, session1 should be filtered but not session2
        assert.strictEqual(filter.exclude(session1), true);
        assert.strictEqual(filter.exclude(session2), false);
    });
    test('should filter out archived sessions', () => {
        const storageService = instantiationService.get(IStorageService);
        const filter = disposables.add(instantiationService.createInstance(AgentSessionsViewFilter, { filterMenuId: MenuId.ViewTitle }));
        const provider = {
            chatSessionType: 'test-type',
            onDidChangeChatSessionItems: Event.None,
            provideChatSessionItems: async () => []
        };
        const archivedSession = {
            providerType: provider.chatSessionType,
            providerLabel: 'Test Provider',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://archived-session'),
            label: 'Archived Session',
            timing: { startTime: Date.now() },
            archived: true,
            status: 1 /* ChatSessionStatus.Completed */
        };
        const activeSession = {
            providerType: provider.chatSessionType,
            providerLabel: 'Test Provider',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://active-session'),
            label: 'Active Session',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        // By default, archived sessions should be filtered (archived: true in default excludes)
        assert.strictEqual(filter.exclude(archivedSession), true);
        assert.strictEqual(filter.exclude(activeSession), false);
        // Include archived by setting archived to false in storage
        const excludes = {
            providers: [],
            states: [],
            archived: false
        };
        storageService.store('agentSessions.filterExcludes', JSON.stringify(excludes), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        // After including archived, both sessions should not be filtered
        assert.strictEqual(filter.exclude(archivedSession), false);
        assert.strictEqual(filter.exclude(activeSession), false);
    });
    test('should filter out sessions with excluded status', () => {
        const storageService = instantiationService.get(IStorageService);
        const filter = disposables.add(instantiationService.createInstance(AgentSessionsViewFilter, { filterMenuId: MenuId.ViewTitle }));
        const provider = {
            chatSessionType: 'test-type',
            onDidChangeChatSessionItems: Event.None,
            provideChatSessionItems: async () => []
        };
        const failedSession = {
            providerType: provider.chatSessionType,
            providerLabel: 'Test Provider',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://failed-session'),
            label: 'Failed Session',
            timing: { startTime: Date.now() },
            archived: false,
            status: 0 /* ChatSessionStatus.Failed */
        };
        const completedSession = {
            providerType: provider.chatSessionType,
            providerLabel: 'Test Provider',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://completed-session'),
            label: 'Completed Session',
            timing: { startTime: Date.now() },
            archived: false,
            status: 1 /* ChatSessionStatus.Completed */
        };
        const inProgressSession = {
            providerType: provider.chatSessionType,
            providerLabel: 'Test Provider',
            icon: Codicon.chatSparkle,
            resource: URI.parse('test://inprogress-session'),
            label: 'In Progress Session',
            timing: { startTime: Date.now() },
            archived: false,
            status: 2 /* ChatSessionStatus.InProgress */
        };
        // Initially, no sessions should be filtered by status
        assert.strictEqual(filter.exclude(failedSession), false);
        assert.strictEqual(filter.exclude(completedSession), false);
        assert.strictEqual(filter.exclude(inProgressSession), false);
        // Exclude failed status by setting it in storage
        const excludes = {
            providers: [],
            states: [0 /* ChatSessionStatus.Failed */],
            archived: false
        };
        storageService.store('agentSessions.filterExcludes', JSON.stringify(excludes), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        // After excluding failed status, only failedSession should be filtered
        assert.strictEqual(filter.exclude(failedSession), true);
        assert.strictEqual(filter.exclude(completedSession), false);
        assert.strictEqual(filter.exclude(inProgressSession), false);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWdlbnRTZXNzaW9uVmlld01vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2Jyb3dzZXIvYWdlbnRTZXNzaW9uVmlld01vZGVsLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM1RCxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sMkNBQTJDLENBQUM7QUFDM0UsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUNwRSxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDeEQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLHNCQUFzQixFQUEwQixjQUFjLEVBQUUsd0JBQXdCLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUN6TCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx3REFBd0QsQ0FBQztBQUNqRyxPQUFPLEVBQWlFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDaEssT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDOUQsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDL0UsT0FBTyxFQUFFLG9CQUFvQixFQUFFLDZCQUE2QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDeEgsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDNUYsT0FBTyxFQUFF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