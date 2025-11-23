/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { WorkspaceFolder } from '../../../../../platform/workspace/common/workspace.js';
import { BreadcrumbsModel } from '../../../../browser/parts/editor/breadcrumbsModel.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { FileKind } from '../../../../../platform/files/common/files.js';
import { TestContextService } from '../../../common/workbenchTestServices.js';
import { Workspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
suite('Breadcrumb Model', function () {
    let model;
    const workspaceService = new TestContextService(new Workspace('ffff', [new WorkspaceFolder({ uri: URI.parse('foo:/bar/baz/ws'), name: 'ws', index: 0 })]));
    const configService = new class extends TestConfigurationService {
        getValue(...args) {
            if (args[0] === 'breadcrumbs.filePath') {
                return 'on';
            }
            if (args[0] === 'breadcrumbs.symbolPath') {
                return 'on';
            }
            return super.getValue(...args);
        }
        updateValue() {
            return Promise.resolve();
        }
    };
    teardown(function () {
        model.dispose();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('only uri, inside workspace', function () {
        model = new BreadcrumbsModel(URI.parse('foo:/bar/baz/ws/some/path/file.ts'), undefined, configService, workspaceService, new class extends mock() {
        });
        const elements = model.getElements();
        assert.strictEqual(elements.length, 3);
        const [one, two, three] = elements;
        assert.strictEqual(one.kind, FileKind.FOLDER);
        assert.strictEqual(two.kind, FileKind.FOLDER);
        assert.strictEqual(three.kind, FileKind.FILE);
        assert.strictEqual(one.uri.toString(), 'foo:/bar/baz/ws/some');
        assert.strictEqual(two.uri.toString(), 'foo:/bar/baz/ws/some/path');
        assert.strictEqual(three.uri.toString(), 'foo:/bar/baz/ws/some/path/file.ts');
    });
    test('display uri matters for FileElement', function () {
        model = new BreadcrumbsModel(URI.parse('foo:/bar/baz/ws/some/PATH/file.ts'), undefined, configService, workspaceService, new class extends mock() {
        });
        const elements = model.getElements();
        assert.strictEqual(elements.length, 3);
        const [one, two, three] = elements;
        assert.strictEqual(one.kind, FileKind.FOLDER);
        assert.strictEqual(two.kind, FileKind.FOLDER);
        assert.strictEqual(three.kind, FileKind.FILE);
        assert.strictEqual(one.uri.toString(), 'foo:/bar/baz/ws/some');
        assert.strictEqual(two.uri.toString(), 'foo:/bar/baz/ws/some/PATH');
        assert.strictEqual(three.uri.toString(), 'foo:/bar/baz/ws/some/PATH/file.ts');
    });
    test('only uri, outside workspace', function () {
        model = new BreadcrumbsModel(URI.parse('foo:/outside/file.ts'), undefined, configService, workspaceService, new class extends mock() {
        });
        const elements = model.getElements();
        assert.strictEqual(elements.length, 2);
        const [one, two] = elements;
        assert.strictEqual(one.kind, FileKind.FOLDER);
        assert.strictEqual(two.kind, FileKind.FILE);
        assert.strictEqual(one.uri.toString(), 'foo:/outside');
        assert.strictEqual(two.uri.toString(), 'foo:/outside/file.ts');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJlYWRjcnVtYk1vZGVsLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3Rlc3QvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvYnJlYWRjcnVtYk1vZGVsLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdURBQXVELENBQUM7QUFDeEYsT0FBTyxFQUFFLGdCQUFnQixFQUFlLE1BQU0sc0RBQXNELENBQUM7QUFDckcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFDekgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtDQUErQyxDQUFDO0FBQ3pFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQzlFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUMzRixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFFL0QsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFbkcsS0FBSyxDQUFDLGtCQUFrQixFQUFFO0lBRXpCLElBQUksS0FBdUIsQ0FBQztJQUM1QixNQUFNLGdCQUFnQixHQUFHLElBQUksa0JBQWtCLENBQUMsSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxlQUFlLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0osTUFBTSxhQUFh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