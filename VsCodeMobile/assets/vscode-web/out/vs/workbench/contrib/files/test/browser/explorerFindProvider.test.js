/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { TreeFindMatchType, TreeFindMode } from '../../../../../base/browser/ui/tree/abstractTree.js';
import { CancellationTokenSource } from '../../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { basename } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { WorkbenchCompressibleAsyncDataTree } from '../../../../../platform/list/browser/listService.js';
import { ISearchService } from '../../../../services/search/common/search.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { NullFilesConfigurationService, TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { IExplorerService } from '../../browser/files.js';
import { ExplorerFindProvider } from '../../browser/views/explorerViewer.js';
import { ExplorerItem } from '../../common/explorerModel.js';
function find(element, id) {
    if (element.name === id) {
        return element;
    }
    if (!element.children) {
        return undefined;
    }
    for (const child of element.children.values()) {
        const result = find(child, id);
        if (result) {
            return result;
        }
    }
    return undefined;
}
class Renderer {
    constructor() {
        this.templateId = 'default';
    }
    renderTemplate(container) {
        return container;
    }
    renderElement(element, index, templateData) {
        templateData.textContent = element.element.name;
    }
    disposeTemplate(templateData) {
        // noop
    }
    renderCompressedElements(node, index, templateData) {
        const result = [];
        for (const element of node.element.elements) {
            result.push(element.name);
        }
        templateData.textContent = result.join('/');
    }
}
class IdentityProvider {
    getId(element) {
        return {
            toString: () => { return element.name; }
        };
    }
}
class VirtualDelegate {
    getHeight() { return 20; }
    getTemplateId(element) { return 'default'; }
}
class DataSource {
    hasChildren(element) {
        return !!element.children && element.children.size > 0;
    }
    getChildren(element) {
        return Promise.resolve(Array.from(element.children.values()) || []);
    }
    getParent(element) {
        return element.parent;
    }
}
class AccessibilityProvider {
    getWidgetAriaLabel() {
        return '';
    }
    getAriaLabel(stat) {
        return stat.name;
    }
}
class KeyboardNavigationLabelProvider {
    getKeyboardNavigationLabel(stat) {
        return stat.name;
    }
    getCompressedNodeKeyboardNavigationLabel(stats) {
        return stats.map(stat => stat.name).join('/');
    }
}
class CompressionDelegate {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    isIncompressible(element) {
        return !this.dataSource.hasChildren(element);
    }
}
class TestFilesFilter {
    filter() { return true; }
    isIgnored() { return false; }
    dispose() { }
}
suite('Find Provider - ExplorerView', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    const fileService = new TestFileService();
    const configService = new TestConfigurationService();
    function createStat(path, isFolder) {
        return new ExplorerItem(URI.from({ scheme: 'file', path }), fileService, configService, NullFilesConfigurationService, undefined, isFolder);
    }
    let root;
    let instantiationService;
    const searchMappings = new Map([
        ['bb', [URI.file('/root/b/bb/bbb.txt'), URI.file('/root/a/ab/abb.txt'), URI.file('/root/b/bb/bba.txt')]],
    ]);
    setup(() => {
        root = createStat.call(this, '/root', true);
        const a = createStat.call(this, '/root/a', true);
        const aa = createStat.call(this, '/root/a/aa', true);
        const ab = createStat.call(this, '/root/a/ab', true);
        const aba = createStat.call(this, '/root/a/ab/aba.txt', false);
        const abb = createStat.call(this, '/root/a/ab/abb.txt', false);
        const b = createStat.call(this, '/root/b', true);
        const ba = createStat.call(this, '/root/b/ba', true);
        const baa = createStat.call(this, '/root/b/ba/baa.txt', false);
        const bab = createStat.call(this, '/root/b/ba/bab.txt', false);
        const bb = createStat.call(this, '/root/b/bb', true);
        root.addChild(a);
        a.addChild(aa);
        a.addChild(ab);
        ab.addChild(aba);
        ab.addChild(abb);
        root.addChild(b);
        b.addChild(ba);
        ba.addChild(baa);
        ba.addChild(bab);
        b.addChild(bb);
        instantiationService = workbenchInstantiationService(undefined, disposables);
        instantiationService.stub(IExplorerService, {
            roots: [root],
            refresh: () => Promise.resolve(),
            findClosest: (resource) => {
                return find(root, basename(resource)) ?? null;
            },
        });
        instantiationService.stub(ISearchService, {
            fileSearch(query, token) {
                const filePattern = query.filePattern?.replace(/\//g, '')
                    .replace(/\*/g, '')
                    .replace(/\[/g, '')
                    .replace(/\]/g, '')
                    .replace(/[A-Z]/g, '') ?? '';
                const fileMatches = (searchMappings.get(filePattern) ?? []).map(u => ({ resource: u }));
                return Promise.resolve({ results: fileMatches, messages: [] });
            },
            schemeHasFileSearchProvider() {
                return true;
            }
        });
    });
    test('find provider', async function () {
        const disposables = new DisposableStore();
        // Tree Stuff
        const container = document.createElement('div');
        const dataSource = new DataSource();
        const compressionDelegate = new CompressionDelegate(dataSource);
        const keyboardNavigationLabelProvider = new KeyboardNavigationLabelProvider();
        const accessibilityProvider = new AccessibilityProvider();
        const filter = instantiationService.createInstance(TestFilesFilter);
        const options = { identityProvider: new IdentityProvider(), keyboardNavigationLabelProvider, accessibilityProvider };
        const tree = disposables.add(instantiationService.createInstance((WorkbenchCompressibleAsyncDataTree), 'test', container, new VirtualDelegate(), compressionDelegate, [new Renderer()], dataSource, options));
        tree.layout(200);
        await tree.setInput(root);
        const findProvider = instantiationService.createInstance(ExplorerFindProvider, filter, () => tree);
        findProvider.startSession();
        assert.strictEqual(find(root, 'abb.txt') !== undefined, true);
        assert.strictEqual(find(root, 'bba.txt') !== undefined, false);
        assert.strictEqual(find(root, 'bbb.txt') !== undefined, false);
        assert.strictEqual(find(root, 'abb.txt')?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, 'a')?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, 'ab')?.isMarkedAsFiltered(), false);
        await findProvider.find('bb', { matchType: TreeFindMatchType.Contiguous, findMode: TreeFindMode.Filter }, new CancellationTokenSource().token);
        assert.strictEqual(find(root, 'abb.txt') !== undefined, true);
        assert.strictEqual(find(root, 'bba.txt') !== undefined, true);
        assert.strictEqual(find(root, 'bbb.txt') !== undefined, true);
        assert.strictEqual(find(root, 'abb.txt')?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, 'bba.txt')?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, 'bbb.txt')?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, 'a')?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, 'ab')?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, 'b')?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, 'bb')?.isMarkedAsFiltered(), true);
        assert.strictEqual(find(root, 'aa')?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, 'ba')?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, 'aba.txt')?.isMarkedAsFiltered(), false);
        await findProvider.endSession();
        assert.strictEqual(find(root, 'abb.txt') !== undefined, true);
        assert.strictEqual(find(root, 'baa.txt') !== undefined, true);
        assert.strictEqual(find(root, 'baa.txt') !== undefined, true);
        assert.strictEqual(find(root, 'bba.txt') !== undefined, false);
        assert.strictEqual(find(root, 'bbb.txt') !== undefined, false);
        assert.strictEqual(find(root, 'a')?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, 'ab')?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, 'b')?.isMarkedAsFiltered(), false);
        assert.strictEqual(find(root, 'bb')?.isMarkedAsFiltered(), false);
        disposables.dispose();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwbG9yZXJGaW5kUHJvdmlkZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy90ZXN0L2Jyb3dzZXIvZXhwbG9yZXJGaW5kUHJvdmlkZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFHNUIsT0FBTyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxNQUFNLHFEQUFxRCxDQUFDO0FBS3RHLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUV4RyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDMUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ25FLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUNuRyxPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwrRUFBK0UsQ0FBQztBQUV6SCxPQUFPLEVBQThDLGtDQUFrQyxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDckosT0FBTyxFQUEyQyxjQUFjLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN2SCxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxtREFBbUQsQ0FBQztBQUNsRyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDbEgsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDMUQsT0FBTyxFQUFFLG9CQUFvQixFQUFlLE1BQU0sdUNBQXVDLENBQUM7QUFDMUYsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRTdELFNB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QUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pFLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2hFLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRWpFLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsRUFBRSxrQkFBa0IsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXZFLE1BQU0sWUFBWSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBRWhDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsS0FBSyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM5RCxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlELE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsS0FBSyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUvRCxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNqRSxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsRSxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNqRSxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUVsRSxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDdkIsQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9