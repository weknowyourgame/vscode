/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { binarySearch } from '../../../base/common/arrays.js';
import { errorHandler, ErrorNoTelemetry, PendingMigrationError } from '../../../base/common/errors.js';
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { safeStringify } from '../../../base/common/objects.js';
import { FileOperationError } from '../../files/common/files.js';
export var ErrorEvent;
(function (ErrorEvent) {
    function compare(a, b) {
        if (a.callstack < b.callstack) {
            return -1;
        }
        else if (a.callstack > b.callstack) {
            return 1;
        }
        return 0;
    }
    ErrorEvent.compare = compare;
})(ErrorEvent || (ErrorEvent = {}));
export default class BaseErrorTelemetry {
    static { this.ERROR_FLUSH_TIMEOUT = 5 * 1000; }
    constructor(telemetryService, flushDelay = BaseErrorTelemetry.ERROR_FLUSH_TIMEOUT) {
        this._flushHandle = undefined;
        this._buffer = [];
        this._disposables = new DisposableStore();
        this._telemetryService = telemetryService;
        this._flushDelay = flushDelay;
        // (1) check for unexpected but handled errors
        const unbind = errorHandler.addListener((err) => this._onErrorEvent(err));
        this._disposables.add(toDisposable(unbind));
        // (2) install implementation-specific error listeners
        this.installErrorListeners();
    }
    dispose() {
        clearTimeout(this._flushHandle);
        this._flushBuffer();
        this._disposables.dispose();
    }
    installErrorListeners() {
        // to override
    }
    _onErrorEvent(err) {
        if (!err || err.code) {
            return;
        }
        // unwrap nested errors from loader
        if (err.detail && err.detail.stack) {
            err = err.detail;
        }
        // If it's the no telemetry error it doesn't get logged
        // TOOD @lramos15 hacking in FileOperation error because it's too messy to adopt ErrorNoTelemetry. A better solution should be found
        //
        // Explicitly filter out PendingMigrationError for https://github.com/microsoft/vscode/issues/250648#issuecomment-3394040431
        // We don't inherit from ErrorNoTelemetry to preserve the name used in reporting for exthostdeprecatedapiusage event.
        // TODO(deepak1556): remove when PendingMigrationError is no longer needed.
        if (ErrorNoTelemetry.isErrorNoTelemetry(err) || err instanceof FileOperationError || PendingMigrationError.is(err) || (typeof err?.message === 'string' && err.message.includes('Unable to read file'))) {
            return;
        }
        // work around behavior in workerServer.ts that breaks up Error.stack
        const callstack = Array.isArray(err.stack) ? err.stack.join('\n') : err.stack;
        const msg = err.message ? err.message : safeStringify(err);
        // errors without a stack are not useful telemetry
        if (!callstack) {
            return;
        }
        this._enqueue({ msg, callstack });
    }
    _enqueue(e) {
        const idx = binarySearch(this._buffer, e, ErrorEvent.compare);
        if (idx < 0) {
            e.count = 1;
            this._buffer.splice(~idx, 0, e);
        }
        else {
            if (!this._buffer[idx].count) {
                this._buffer[idx].count = 0;
            }
            this._buffer[idx].count += 1;
        }
        if (this._flushHandle === undefined) {
            this._flushHandle = setTimeout(() => {
                this._flushBuffer();
                this._flushHandle = undefined;
            }, this._flushDelay);
        }
    }
    _flushBuffer() {
        for (const error of this._buffer) {
            this._telemetryService.publicLogError2('UnhandledError', error);
        }
        this._buffer.length = 0;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3JUZWxlbWV0cnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi9lcnJvclRlbGVtZXRyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sZ0NBQWdDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxxQkFBcUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDbEYsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBQ2hFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBMEJqRSxNQUFNLEtBQVcsVUFBVSxDQVMxQjtBQVRELFdBQWlCLFVBQVU7SUFDMUIsU0FBZ0IsT0FBTyxDQUFDLENBQWEsRUFBRSxDQUFhO1FBQ25ELElBQUksQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDL0IsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNYLENBQUM7YUFBTSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3RDLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQztRQUNELE9BQU8sQ0FBQyxDQUFDO0lBQ1YsQ0FBQztJQVBlLGtCQUFPLFVBT3RCLENBQUE7QUFDRixDQUFDLEVBVGdCLFVBQVUsS0FBVixVQUFVLFFBUzFCO0FBRUQsTUFBTSxDQUFDLE9BQU8sT0FBZ0Isa0JBQWtCO2FBRWpDLHdCQUFtQixHQUFXLENBQUMsR0FBRyxJQUFJLEFBQW5CLENBQW9CO0lBUXJELFlBQVksZ0JBQW1DLEVBQUUsVUFBVSxHQUFHLGtCQUFr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