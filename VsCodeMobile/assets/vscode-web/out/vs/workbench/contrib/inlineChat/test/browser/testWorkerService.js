var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { mock } from '../../../../../base/test/common/mock.js';
import { Range } from '../../../../../editor/common/core/range.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { assertType } from '../../../../../base/common/types.js';
import { EditorWorker } from '../../../../../editor/common/services/editorWebWorker.js';
import { LineRange } from '../../../../../editor/common/core/ranges/lineRange.js';
import { MovedText } from '../../../../../editor/common/diff/linesDiffComputer.js';
import { LineRangeMapping, DetailedLineRangeMapping, RangeMapping } from '../../../../../editor/common/diff/rangeMapping.js';
import { disposableTimeout } from '../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
let TestWorkerService = class TestWorkerService extends mock() {
    constructor(_modelService) {
        super();
        this._modelService = _modelService;
        this._store = new DisposableStore();
        this._worker = this._store.add(new EditorWorker());
    }
    dispose() {
        this._store.dispose();
    }
    async computeMoreMinimalEdits(resource, edits, pretty) {
        return undefined;
    }
    async computeDiff(original, modified, options, algorithm) {
        await new Promise(resolve => disposableTimeout(() => resolve(), 0, this._store));
        if (this._store.isDisposed) {
            return null;
        }
        const originalModel = this._modelService.getModel(original);
        const modifiedModel = this._modelService.getModel(modified);
        assertType(originalModel);
        assertType(modifiedModel);
        this._worker.$acceptNewModel({
            url: originalModel.uri.toString(),
            versionId: originalModel.getVersionId(),
            lines: originalModel.getLinesContent(),
            EOL: originalModel.getEOL(),
        });
        this._worker.$acceptNewModel({
            url: modifiedModel.uri.toString(),
            versionId: modifiedModel.getVersionId(),
            lines: modifiedModel.getLinesContent(),
            EOL: modifiedModel.getEOL(),
        });
        const result = await this._worker.$computeDiff(originalModel.uri.toString(), modifiedModel.uri.toString(), options, algorithm);
        if (!result) {
            return result;
        }
        // Convert from space efficient JSON data to rich objects.
        const diff = {
            identical: result.identical,
            quitEarly: result.quitEarly,
            changes: toLineRangeMappings(result.changes),
            moves: result.moves.map(m => new MovedText(new LineRangeMapping(new LineRange(m[0], m[1]), new LineRange(m[2], m[3])), toLineRangeMappings(m[4])))
        };
        return diff;
        function toLineRangeMappings(changes) {
            return changes.map((c) => new DetailedLineRangeMapping(new LineRange(c[0], c[1]), new LineRange(c[2], c[3]), c[4]?.map((c) => new RangeMapping(new Range(c[0], c[1], c[2], c[3]), new Range(c[4], c[5], c[6], c[7])))));
        }
    }
};
TestWorkerService = __decorate([
    __param(0, IModelService)
], TestWorkerService);
export { TestWorkerService };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFdvcmtlclNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvaW5saW5lQ2hhdC90ZXN0L2Jyb3dzZXIvdGVzdFdvcmtlclNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBS0EsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQy9ELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNuRSxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sZ0RBQWdELENBQUM7QUFDL0UsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBR2pFLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUN4RixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDbEYsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQ25GLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSx3QkFBd0IsRUFBRSxZQUFZLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUU3SCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUN4RSxPQUFPLEVBQUUsZUFBZSxFQUFlLE1BQU0seUNBQXlDLENBQUM7QUFHaEYsSUFBTSxpQkFBaUIsR0FBdkIsTUFBTSxpQkFBa0IsU0FBUSxJQUFJLEVBQXdCO0lBS2xFLFlBQTJCLGFBQTZDO1FBQ3ZFLEtBQUssRUFBRSxDQUFDO1FBRG1DLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1FBSHZELFdBQU0sR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQy9CLFlBQU8sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLFlBQVksRUFBRSxDQUFDLENBQUM7SUFJL0QsQ0FBQztJQUVELE9B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