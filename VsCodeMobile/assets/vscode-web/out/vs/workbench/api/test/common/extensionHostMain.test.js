/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { errorHandler, onUnexpectedError } from '../../../../base/common/errors.js';
import { isFirefox, isSafari } from '../../../../base/common/platform.js';
import { TernarySearchTree } from '../../../../base/common/ternarySearchTree.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { InstantiationService } from '../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { ILogService, NullLogService } from '../../../../platform/log/common/log.js';
import { ExtensionPaths, IExtHostExtensionService } from '../../common/extHostExtensionService.js';
import { IExtHostRpcService } from '../../common/extHostRpcService.js';
import { IExtHostTelemetry } from '../../common/extHostTelemetry.js';
import { ErrorHandler } from '../../common/extensionHostMain.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { IExtHostApiDeprecationService, NullApiDeprecationService } from '../../common/extHostApiDeprecationService.js';
import { ExtensionDescriptionRegistry } from '../../../services/extensions/common/extensionDescriptionRegistry.js';
suite('ExtensionHostMain#ErrorHandler - Wrapping prepareStackTrace can cause slowdown and eventual stack overflow #184926 ', function () {
    if (isFirefox || isSafari) {
        return;
    }
    const extensionsIndex = TernarySearchTree.forUris();
    const mainThreadExtensionsService = new class extends mock() {
        $onExtensionRuntimeError(extensionId, data) {
        }
        $onUnexpectedError(err) {
        }
    };
    const basicActivationEventsReader = {
        readActivationEvents: (extensionDescription) => {
            return [];
        }
    };
    const collection = new ServiceCollection([ILogService, new NullLogService()], [IExtHostTelemetry, new class extends mock() {
            onExtensionError(extension, error) {
                return true;
            }
        }], [IExtHostExtensionService, new class extends mock() {
            getExtensionPathIndex() {
                return new class extends ExtensionPaths {
                    findSubstr(key) {
                        findSubstrCount++;
                        return nullExtensionDescription;
                    }
                }(extensionsIndex);
            }
            getExtensionRegistry() {
                return new class extends ExtensionDescriptionRegistry {
                    getExtensionDescription(extensionId) {
                        return nullExtensionDescription;
                    }
                }(basicActivationEventsReader, []);
            }
        }], [IExtHostRpcService, new class extends mock() {
            getProxy(identifier) {
                // eslint-disable-next-line local/code-no-any-casts
                return mainThreadExtensionsService;
            }
        }], [IExtHostApiDeprecationService, NullApiDeprecationService]);
    const originalPrepareStackTrace = Error.prepareStackTrace;
    const insta = new InstantiationService(collection, false);
    let existingErrorHandler;
    let findSubstrCount = 0;
    ensureNoDisposablesAreLeakedInTestSuite();
    suiteSetup(async function () {
        existingErrorHandler = errorHandler.getUnexpectedErrorHandler();
        await insta.invokeFunction(ErrorHandler.installFullHandler);
    });
    suiteTeardown(function () {
        errorHandler.setUnexpectedErrorHandler(existingErrorHandler);
    });
    setup(async function () {
        findSubstrCount = 0;
    });
    teardown(() => {
        Error.prepareStackTrace = originalPrepareStackTrace;
    });
    test('basics', function () {
        const err = new Error('test1');
        onUnexpectedError(err);
        assert.strictEqual(findSubstrCount, 1);
    });
    test('set/reset prepareStackTrace-callback', function () {
        const original = Error.prepareStackTrace;
        Error.prepareStackTrace = (_error, _stack) => 'stack';
        const probeErr = new Error();
        const stack = probeErr.stack;
        assert.ok(stack);
        Error.prepareStackTrace = original;
        assert.strictEqual(findSubstrCount, 1);
        // already checked
        onUnexpectedError(probeErr);
        assert.strictEqual(findSubstrCount, 1);
        // one more error
        const err = new Error('test2');
        onUnexpectedError(err);
        assert.strictEqual(findSubstrCount, 2);
    });
    test('wrap prepareStackTrace-callback', function () {
        function do_something_else(params) {
            return params;
        }
        const original = Error.prepareStackTrace;
        Error.prepareStackTrace = (...args) => {
            return do_something_else(original?.(...args));
        };
        const probeErr = new Error();
        const stack = probeErr.stack;
        assert.ok(stack);
        onUnexpectedError(probeErr);
        assert.strictEqual(findSubstrCount, 1);
    });
    test('prevent rewrapping', function () {
        let do_something_count = 0;
        function do_something(params) {
            do_something_count++;
        }
        Error.prepareStackTrace = (result, stack) => {
            do_something(stack);
            return 'fakestack';
        };
        for (let i = 0; i < 2_500; ++i) {
            Error.prepareStackTrace = Error.prepareStackTrace;
        }
        const probeErr = new Error();
        const stack = probeErr.stack;
        assert.strictEqual(stack, 'fakestack');
        onUnexpectedError(probeErr);
        assert.strictEqual(findSubstrCount, 1);
        const probeErr2 = new Error();
        onUnexpectedError(probeErr2);
        assert.strictEqual(findSubstrCount, 2);
        assert.strictEqual(do_something_count, 2);
    });
    suite('https://gist.github.com/thecrypticace/f0f2e182082072efdaf0f8e1537d2cce', function () {
        test('Restored, separate operations', () => {
            // Actual Test
            let original;
            // Operation 1
            original = Error.prepareStackTrace;
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            const err1 = new Error();
            assert.ok(err1.stack);
            assert.strictEqual(findSubstrCount, 1);
            Error.prepareStackTrace = original;
            // Operation 2
            original = Error.prepareStackTrace;
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
            assert.strictEqual(findSubstrCount, 2);
            Error.prepareStackTrace = original;
            // Operation 3
            original = Error.prepareStackTrace;
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
            assert.strictEqual(findSubstrCount, 3);
            Error.prepareStackTrace = original;
            // Operation 4
            original = Error.prepareStackTrace;
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
            assert.strictEqual(findSubstrCount, 4);
            Error.prepareStackTrace = original;
            // Back to Operation 1
            assert.ok(err1.stack);
            assert.strictEqual(findSubstrCount, 4);
        });
        test('Never restored, separate operations', () => {
            // Operation 1
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
            // Operation 2
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
            // Operation 3
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
            // Operation 4
            for (let i = 0; i < 12_500; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
        });
        test('Restored, too many uses before restoration', async () => {
            const original = Error.prepareStackTrace;
            Error.prepareStackTrace = (_, stack) => stack;
            // Operation 1 — more uses of `prepareStackTrace`
            for (let i = 0; i < 10_000; ++i) {
                Error.prepareStackTrace = Error.prepareStackTrace;
            }
            assert.ok(new Error().stack);
            Error.prepareStackTrace = original;
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uSG9zdE1haW4udGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL3Rlc3QvY29tbW9uL2V4dGVuc2lvbkhvc3RNYWluLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBbUIsWUFBWSxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDckcsT0FBTyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUVqRixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDNUQsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFFaEcsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDekcsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sZ0VBQWdFLENBQUM7QUFDbkcsT0FBTyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUVyRixPQUFPLEVBQUUsY0FBYyxFQUFFLHdCQUF3QixFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDdkUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDckUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBRTdGLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSx5QkFBeUIsRUFBRSxNQUFNLDhDQUE4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