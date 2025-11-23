/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../../../nls.js';
import assert from 'assert';
import { Extensions as ViewContainerExtensions, ViewContainerLocationToString } from '../../../../common/views.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { ViewDescriptorService } from '../../browser/viewDescriptorService.js';
import { assertReturnsDefined } from '../../../../../base/common/types.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { compare } from '../../../../../base/common/strings.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
const ViewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
const ViewContainersRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
const viewContainerIdPrefix = 'testViewContainer';
// eslint-disable-next-line local/code-no-any-casts
const sidebarContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 0 /* ViewContainerLocation.Sidebar */);
// eslint-disable-next-line local/code-no-any-casts
const panelContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 1 /* ViewContainerLocation.Panel */);
suite('ViewDescriptorService', () => {
    const disposables = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    setup(() => {
        disposables.add(instantiationService = workbenchInstantiationService(undefined, disposables));
        instantiationService.stub(IContextKeyService, disposables.add(instantiationService.createInstance(ContextKeyService)));
    });
    teardown(() => {
        for (const viewContainer of ViewContainersRegistry.all) {
            if (viewContainer.id.startsWith(viewContainerIdPrefix)) {
                ViewsRegistry.deregisterViews(ViewsRegistry.getViews(viewContainer), viewContainer);
            }
        }
    });
    function aViewDescriptorService() {
        return disposables.add(instantiationService.createInstance(ViewDescriptorService));
    }
    test('Empty Containers', function () {
        const testObject = aViewDescriptorService();
        const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        const panelViews = testObject.getViewContainerModel(panelContainer);
        assert.strictEqual(sidebarViews.allViewDescriptors.length, 0, 'The sidebar container should have no views yet.');
        assert.strictEqual(panelViews.allViewDescriptors.length, 0, 'The panel container should have no views yet.');
    });
    test('Register/Deregister', () => {
        const testObject = aViewDescriptorService();
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
        let sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        let panelViews = testObject.getViewContainerModel(panelContainer);
        assert.strictEqual(sidebarViews.activeViewDescriptors.length, 2, 'Sidebar should have 2 views');
        assert.strictEqual(panelViews.activeViewDescriptors.length, 1, 'Panel should have 1 view');
        ViewsRegistry.deregisterViews(viewDescriptors.slice(0, 2), sidebarContainer);
        ViewsRegistry.deregisterViews(viewDescriptors.slice(2), panelContainer);
        sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        panelViews = testObject.getViewContainerModel(panelContainer);
        assert.strictEqual(sidebarViews.activeViewDescriptors.length, 0, 'Sidebar should have no views');
        assert.strictEqual(panelViews.activeViewDescriptors.length, 0, 'Panel should have no views');
    });
    test('move views to existing containers', async function () {
        const testObject = aViewDescriptorService();
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
        testObject.moveViewsToContainer(viewDescriptors.slice(2), sidebarContainer);
        testObject.moveViewsToContainer(viewDescriptors.slice(0, 2), panelContainer);
        const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        const panelViews = testObject.getViewContainerModel(panelContainer);
        assert.strictEqual(sidebarViews.activeViewDescriptors.length, 1, 'Sidebar should have 2 views');
        assert.strictEqual(panelViews.activeViewDescriptors.length, 2, 'Panel should have 1 view');
        assert.notStrictEqual(sidebarViews.activeViewDescriptors.indexOf(viewDescriptors[2]), -1, `Sidebar should have ${viewDescriptors[2].name.value}`);
        assert.notStrictEqual(panelViews.activeViewDescriptors.indexOf(viewDescriptors[0]), -1, `Panel should have ${viewDescriptors[0].name.value}`);
        assert.notStrictEqual(panelViews.activeViewDescriptors.indexOf(viewDescriptors[1]), -1, `Panel should have ${viewDescriptors[1].name.value}`);
    });
    test('move views to generated containers', async function () {
        const testObject = aViewDescriptorService();
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
        testObject.moveViewToLocation(viewDescriptors[0], 1 /* ViewContainerLocation.Panel */);
        testObject.moveViewToLocation(viewDescriptors[2], 0 /* ViewContainerLocation.Sidebar */);
        let sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        let panelViews = testObject.getViewContainerModel(panelContainer);
        assert.strictEqual(sidebarViews.activeViewDescriptors.length, 1, 'Sidebar container should have 1 view');
        assert.strictEqual(panelViews.activeViewDescriptors.length, 0, 'Panel container should have no views');
        const generatedPanel = assertReturnsDefined(testObject.getViewContainerByViewId(viewDescriptors[0].id));
        const generatedSidebar = assertReturnsDefined(testObject.getViewContainerByViewId(viewDescriptors[2].id));
        assert.strictEqual(testObject.getViewContainerLocation(generatedPanel), 1 /* ViewContainerLocation.Panel */, 'Generated Panel should be in located in the panel');
        assert.strictEqual(testObject.getViewContainerLocation(generatedSidebar), 0 /* ViewContainerLocation.Sidebar */, 'Generated Sidebar should be in located in the sidebar');
        assert.strictEqual(testObject.getViewContainerLocation(generatedPanel), testObject.getViewLocationById(viewDescriptors[0].id), 'Panel view location and container location should match');
        assert.strictEqual(testObject.getViewContainerLocation(generatedSidebar), testObject.getViewLocationById(viewDescriptors[2].id), 'Sidebar view location and container location should match');
        assert.strictEqual(testObject.getDefaultContainerById(viewDescriptors[2].id), panelContainer, `${viewDescriptors[2].name.value} has wrong default container`);
        assert.strictEqual(testObject.getDefaultContainerById(viewDescriptors[0].id), sidebarContainer, `${viewDescriptors[0].name.value} has wrong default container`);
        testObject.moveViewToLocation(viewDescriptors[0], 0 /* ViewContainerLocation.Sidebar */);
        testObject.moveViewToLocation(viewDescriptors[2], 1 /* ViewContainerLocation.Panel */);
        sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        panelViews = testObject.getViewContainerModel(panelContainer);
        assert.strictEqual(sidebarViews.activeViewDescriptors.length, 1, 'Sidebar should have 2 views');
        assert.strictEqual(panelViews.activeViewDescriptors.length, 0, 'Panel should have 1 view');
        assert.strictEqual(testObject.getViewLocationById(viewDescriptors[0].id), 0 /* ViewContainerLocation.Sidebar */, 'View should be located in the sidebar');
        assert.strictEqual(testObject.getViewLocationById(viewDescriptors[2].id), 1 /* ViewContainerLocation.Panel */, 'View should be located in the panel');
    });
    test('move view events', async function () {
        const testObject = aViewDescriptorService();
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true
            }
        ];
        let expectedSequence = '';
        let actualSequence = '';
        const containerMoveString = (view, from, to) => {
            return `Moved ${view.id} from ${from.id} to ${to.id}\n`;
        };
        const locationMoveString = (view, from, to) => {
            return `Moved ${view.id} from ${from === 0 /* ViewContainerLocation.Sidebar */ ? 'Sidebar' : 'Panel'} to ${to === 0 /* ViewContainerLocation.Sidebar */ ? 'Sidebar' : 'Panel'}\n`;
        };
        disposables.add(testObject.onDidChangeContainer(({ views, from, to }) => {
            views.forEach(view => {
                actualSequence += containerMoveString(view, from, to);
            });
        }));
        disposables.add(testObject.onDidChangeLocation(({ views, from, to }) => {
            views.forEach(view => {
                actualSequence += locationMoveString(view, from, to);
            });
        }));
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
        expectedSequence += locationMoveString(viewDescriptors[0], 0 /* ViewContainerLocation.Sidebar */, 1 /* ViewContainerLocation.Panel */);
        testObject.moveViewToLocation(viewDescriptors[0], 1 /* ViewContainerLocation.Panel */);
        expectedSequence += containerMoveString(viewDescriptors[0], sidebarContainer, testObject.getViewContainerByViewId(viewDescriptors[0].id));
        expectedSequence += locationMoveString(viewDescriptors[2], 1 /* ViewContainerLocation.Panel */, 0 /* ViewContainerLocation.Sidebar */);
        testObject.moveViewToLocation(viewDescriptors[2], 0 /* ViewContainerLocation.Sidebar */);
        expectedSequence += containerMoveString(viewDescriptors[2], panelContainer, testObject.getViewContainerByViewId(viewDescriptors[2].id));
        expectedSequence += locationMoveString(viewDescriptors[0], 1 /* ViewContainerLocation.Panel */, 0 /* ViewContainerLocation.Sidebar */);
        expectedSequence += containerMoveString(viewDescriptors[0], testObject.getViewContainerByViewId(viewDescriptors[0].id), sidebarContainer);
        testObject.moveViewsToContainer([viewDescriptors[0]], sidebarContainer);
        expectedSequence += locationMoveString(viewDescriptors[2], 0 /* ViewContainerLocation.Sidebar */, 1 /* ViewContainerLocation.Panel */);
        expectedSequence += containerMoveString(viewDescriptors[2], testObject.getViewContainerByViewId(viewDescriptors[2].id), panelContainer);
        testObject.moveViewsToContainer([viewDescriptors[2]], panelContainer);
        expectedSequence += locationMoveString(viewDescriptors[0], 0 /* ViewContainerLocation.Sidebar */, 1 /* ViewContainerLocation.Panel */);
        expectedSequence += containerMoveString(viewDescriptors[0], sidebarContainer, panelContainer);
        testObject.moveViewsToContainer([viewDescriptors[0]], panelContainer);
        expectedSequence += locationMoveString(viewDescriptors[2], 1 /* ViewContainerLocation.Panel */, 0 /* ViewContainerLocation.Sidebar */);
        expectedSequence += containerMoveString(viewDescriptors[2], panelContainer, sidebarContainer);
        testObject.moveViewsToContainer([viewDescriptors[2]], sidebarContainer);
        expectedSequence += locationMoveString(viewDescriptors[1], 0 /* ViewContainerLocation.Sidebar */, 1 /* ViewContainerLocation.Panel */);
        expectedSequence += locationMoveString(viewDescriptors[2], 0 /* ViewContainerLocation.Sidebar */, 1 /* ViewContainerLocation.Panel */);
        expectedSequence += containerMoveString(viewDescriptors[1], sidebarContainer, panelContainer);
        expectedSequence += containerMoveString(viewDescriptors[2], sidebarContainer, panelContainer);
        testObject.moveViewsToContainer([viewDescriptors[1], viewDescriptors[2]], panelContainer);
        assert.strictEqual(actualSequence, expectedSequence, 'Event sequence not matching expected sequence');
    });
    test('reset', async function () {
        const testObject = aViewDescriptorService();
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true,
                order: 1
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true,
                order: 2
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true,
                order: 3
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 2), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(2), panelContainer);
        testObject.moveViewToLocation(viewDescriptors[0], 1 /* ViewContainerLocation.Panel */);
        testObject.moveViewsToContainer([viewDescriptors[1]], panelContainer);
        testObject.moveViewToLocation(viewDescriptors[2], 0 /* ViewContainerLocation.Sidebar */);
        const generatedPanel = assertReturnsDefined(testObject.getViewContainerByViewId(viewDescriptors[0].id));
        const generatedSidebar = assertReturnsDefined(testObject.getViewContainerByViewId(viewDescriptors[2].id));
        testObject.reset();
        const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        assert.deepStrictEqual(sidebarViews.allViewDescriptors.map(v => v.id), ['view1', 'view2']);
        const panelViews = testObject.getViewContainerModel(panelContainer);
        assert.deepStrictEqual(panelViews.allViewDescriptors.map(v => v.id), ['view3']);
        const actual = JSON.parse(instantiationService.get(IStorageService).get('views.customizations', 0 /* StorageScope.PROFILE */));
        assert.deepStrictEqual(actual, { viewContainerLocations: {}, viewLocations: {}, viewContainerBadgeEnablementStates: {} });
        assert.deepStrictEqual(testObject.getViewContainerById(generatedPanel.id), null);
        assert.deepStrictEqual(testObject.getViewContainerById(generatedSidebar.id), null);
    });
    test('initialize with custom locations', async function () {
        const storageService = instantiationService.get(IStorageService);
        // eslint-disable-next-line local/code-no-any-casts
        const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 0 /* ViewContainerLocation.Sidebar */);
        const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(0 /* ViewContainerLocation.Sidebar */)}.${generateUuid()}`;
        const viewsCustomizations = {
            viewContainerLocations: {
                [generateViewContainer1]: 0 /* ViewContainerLocation.Sidebar */,
                [viewContainer1.id]: 2 /* ViewContainerLocation.AuxiliaryBar */
            },
            viewLocations: {
                'view1': generateViewContainer1
            }
        };
        storageService.store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true
            },
            {
                id: 'view4',
                ctorDescriptor: null,
                name: nls.localize2('Test View 4', 'Test View 4'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 3), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(3), viewContainer1);
        const testObject = aViewDescriptorService();
        const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        assert.deepStrictEqual(sidebarViews.allViewDescriptors.map(v => v.id), ['view2', 'view3']);
        const generatedViewContainerViews = testObject.getViewContainerModel(testObject.getViewContainerById(generateViewContainer1));
        assert.deepStrictEqual(generatedViewContainerViews.allViewDescriptors.map(v => v.id), ['view1']);
        const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
        assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), 2 /* ViewContainerLocation.AuxiliaryBar */);
        assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map(v => v.id), ['view4']);
    });
    test('storage change', async function () {
        const testObject = aViewDescriptorService();
        // eslint-disable-next-line local/code-no-any-casts
        const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 0 /* ViewContainerLocation.Sidebar */);
        const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(0 /* ViewContainerLocation.Sidebar */)}.${generateUuid()}`;
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true
            },
            {
                id: 'view4',
                ctorDescriptor: null,
                name: nls.localize2('Test View 4', 'Test View 4'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 3), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(3), viewContainer1);
        const viewsCustomizations = {
            viewContainerLocations: {
                [generateViewContainer1]: 0 /* ViewContainerLocation.Sidebar */,
                [viewContainer1.id]: 2 /* ViewContainerLocation.AuxiliaryBar */
            },
            viewLocations: {
                'view1': generateViewContainer1
            }
        };
        instantiationService.get(IStorageService).store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        assert.deepStrictEqual(sidebarViews.allViewDescriptors.map(v => v.id), ['view2', 'view3']);
        const generatedViewContainerViews = testObject.getViewContainerModel(testObject.getViewContainerById(generateViewContainer1));
        assert.deepStrictEqual(generatedViewContainerViews.allViewDescriptors.map(v => v.id), ['view1']);
        const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
        assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), 2 /* ViewContainerLocation.AuxiliaryBar */);
        assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map(v => v.id), ['view4']);
    });
    test('orphan views', async function () {
        const storageService = instantiationService.get(IStorageService);
        const viewsCustomizations = {
            viewContainerLocations: {},
            viewLocations: {
                'view1': `${viewContainerIdPrefix}-${generateUuid()}`
            }
        };
        storageService.store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true,
                order: 1
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true,
                order: 2
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true,
                order: 3
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors, sidebarContainer);
        const testObject = aViewDescriptorService();
        const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        assert.deepStrictEqual(sidebarViews.allViewDescriptors.map(v => v.id), ['view2', 'view3']);
        testObject.whenExtensionsRegistered();
        assert.deepStrictEqual(sidebarViews.allViewDescriptors.map(v => v.id), ['view1', 'view2', 'view3']);
    });
    test('orphan view containers', async function () {
        const storageService = instantiationService.get(IStorageService);
        const generatedViewContainerId = `workbench.views.service.${ViewContainerLocationToString(0 /* ViewContainerLocation.Sidebar */)}.${generateUuid()}`;
        const viewsCustomizations = {
            viewContainerLocations: {
                [generatedViewContainerId]: 0 /* ViewContainerLocation.Sidebar */
            },
            viewLocations: {}
        };
        storageService.store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true,
                order: 1
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors, sidebarContainer);
        const testObject = aViewDescriptorService();
        testObject.whenExtensionsRegistered();
        assert.deepStrictEqual(testObject.getViewContainerById(generatedViewContainerId), null);
        assert.deepStrictEqual(testObject.isViewContainerRemovedPermanently(generatedViewContainerId), true);
        const actual = JSON.parse(storageService.get('views.customizations', 0 /* StorageScope.PROFILE */));
        assert.deepStrictEqual(actual, { viewContainerLocations: {}, viewLocations: {}, viewContainerBadgeEnablementStates: {} });
    });
    test('custom locations take precedence when default view container of views change', async function () {
        const storageService = instantiationService.get(IStorageService);
        // eslint-disable-next-line local/code-no-any-casts
        const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 0 /* ViewContainerLocation.Sidebar */);
        const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(0 /* ViewContainerLocation.Sidebar */)}.${generateUuid()}`;
        const viewsCustomizations = {
            viewContainerLocations: {
                [generateViewContainer1]: 0 /* ViewContainerLocation.Sidebar */,
                [viewContainer1.id]: 2 /* ViewContainerLocation.AuxiliaryBar */
            },
            viewLocations: {
                'view1': generateViewContainer1
            }
        };
        storageService.store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            },
            {
                id: 'view3',
                ctorDescriptor: null,
                name: nls.localize2('Test View 3', 'Test View 3'),
                canMoveView: true
            },
            {
                id: 'view4',
                ctorDescriptor: null,
                name: nls.localize2('Test View 4', 'Test View 4'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors.slice(0, 3), sidebarContainer);
        ViewsRegistry.registerViews(viewDescriptors.slice(3), viewContainer1);
        const testObject = aViewDescriptorService();
        ViewsRegistry.moveViews([viewDescriptors[0], viewDescriptors[1]], panelContainer);
        const sidebarViews = testObject.getViewContainerModel(sidebarContainer);
        assert.deepStrictEqual(sidebarViews.allViewDescriptors.map(v => v.id), ['view3']);
        const panelViews = testObject.getViewContainerModel(panelContainer);
        assert.deepStrictEqual(panelViews.allViewDescriptors.map(v => v.id), ['view2']);
        const generatedViewContainerViews = testObject.getViewContainerModel(testObject.getViewContainerById(generateViewContainer1));
        assert.deepStrictEqual(generatedViewContainerViews.allViewDescriptors.map(v => v.id), ['view1']);
        const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
        assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), 2 /* ViewContainerLocation.AuxiliaryBar */);
        assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map(v => v.id), ['view4']);
    });
    test('view containers with not existing views are not removed from customizations', async function () {
        const storageService = instantiationService.get(IStorageService);
        // eslint-disable-next-line local/code-no-any-casts
        const viewContainer1 = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 0 /* ViewContainerLocation.Sidebar */);
        const generateViewContainer1 = `workbench.views.service.${ViewContainerLocationToString(0 /* ViewContainerLocation.Sidebar */)}.${generateUuid()}`;
        const viewsCustomizations = {
            viewContainerLocations: {
                [generateViewContainer1]: 0 /* ViewContainerLocation.Sidebar */,
                [viewContainer1.id]: 2 /* ViewContainerLocation.AuxiliaryBar */
            },
            viewLocations: {
                'view5': generateViewContainer1
            }
        };
        storageService.store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors, viewContainer1);
        const testObject = aViewDescriptorService();
        testObject.whenExtensionsRegistered();
        const viewContainer1Views = testObject.getViewContainerModel(viewContainer1);
        assert.deepStrictEqual(testObject.getViewContainerLocation(viewContainer1), 2 /* ViewContainerLocation.AuxiliaryBar */);
        assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map(v => v.id), ['view1']);
        const actual = JSON.parse(storageService.get('views.customizations', 0 /* StorageScope.PROFILE */));
        assert.deepStrictEqual(actual, viewsCustomizations);
    });
    test('storage change also updates locations even if views do not exists and views are registered later', async function () {
        const storageService = instantiationService.get(IStorageService);
        const testObject = aViewDescriptorService();
        const generateViewContainerId = `workbench.views.service.${ViewContainerLocationToString(2 /* ViewContainerLocation.AuxiliaryBar */)}.${generateUuid()}`;
        const viewsCustomizations = {
            viewContainerLocations: {
                [generateViewContainerId]: 2 /* ViewContainerLocation.AuxiliaryBar */,
            },
            viewLocations: {
                'view1': generateViewContainerId
            }
        };
        storageService.store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        // eslint-disable-next-line local/code-no-any-casts
        const viewContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 0 /* ViewContainerLocation.Sidebar */);
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors, viewContainer);
        testObject.whenExtensionsRegistered();
        const viewContainer1Views = testObject.getViewContainerModel(viewContainer);
        assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map(v => v.id), ['view2']);
        const generateViewContainer = testObject.getViewContainerById(generateViewContainerId);
        assert.deepStrictEqual(testObject.getViewContainerLocation(generateViewContainer), 2 /* ViewContainerLocation.AuxiliaryBar */);
        const generatedViewContainerModel = testObject.getViewContainerModel(generateViewContainer);
        assert.deepStrictEqual(generatedViewContainerModel.allViewDescriptors.map(v => v.id), ['view1']);
    });
    test('storage change move views and retain visibility state', async function () {
        const storageService = instantiationService.get(IStorageService);
        const testObject = aViewDescriptorService();
        // eslint-disable-next-line local/code-no-any-casts
        const viewContainer = ViewContainersRegistry.registerViewContainer({ id: `${viewContainerIdPrefix}-${generateUuid()}`, title: nls.localize2('test', 'test'), ctorDescriptor: new SyncDescriptor({}) }, 0 /* ViewContainerLocation.Sidebar */);
        const viewDescriptors = [
            {
                id: 'view1',
                ctorDescriptor: null,
                name: nls.localize2('Test View 1', 'Test View 1'),
                canMoveView: true,
                canToggleVisibility: true
            },
            {
                id: 'view2',
                ctorDescriptor: null,
                name: nls.localize2('Test View 2', 'Test View 2'),
                canMoveView: true
            }
        ];
        ViewsRegistry.registerViews(viewDescriptors, viewContainer);
        testObject.whenExtensionsRegistered();
        const viewContainer1Views = testObject.getViewContainerModel(viewContainer);
        viewContainer1Views.setVisible('view1', false);
        const generateViewContainerId = `workbench.views.service.${ViewContainerLocationToString(2 /* ViewContainerLocation.AuxiliaryBar */)}.${generateUuid()}`;
        const viewsCustomizations = {
            viewContainerLocations: {
                [generateViewContainerId]: 2 /* ViewContainerLocation.AuxiliaryBar */,
            },
            viewLocations: {
                'view1': generateViewContainerId
            }
        };
        storageService.store('views.customizations', JSON.stringify(viewsCustomizations), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        const generateViewContainer = testObject.getViewContainerById(generateViewContainerId);
        const generatedViewContainerModel = testObject.getViewContainerModel(generateViewContainer);
        assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map(v => v.id), ['view2']);
        assert.deepStrictEqual(testObject.getViewContainerLocation(generateViewContainer), 2 /* ViewContainerLocation.AuxiliaryBar */);
        assert.deepStrictEqual(generatedViewContainerModel.allViewDescriptors.map(v => v.id), ['view1']);
        storageService.store('views.customizations', JSON.stringify({}), 0 /* StorageScope.PROFILE */, 0 /* StorageTarget.USER */);
        assert.deepStrictEqual(viewContainer1Views.allViewDescriptors.map(v => v.id).sort((a, b) => compare(a, b)), ['view1', 'view2']);
        assert.deepStrictEqual(viewContainer1Views.visibleViewDescriptors.map(v => v.id), ['view2']);
        assert.deepStrictEqual(generatedViewContainerModel.allViewDescriptors.map(v => v.id), []);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld0Rlc2NyaXB0b3JTZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3ZpZXdzL3Rlc3QvYnJvd3Nlci92aWV3RGVzY3JpcHRvclNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEtBQUssR0FBRyxNQUFNLHVCQUF1QixDQUFDO0FBQzdDLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQTRELFVBQVUsSUFBSSx1QkFBdUIsRUFBd0MsNkJBQTZCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNuTixPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scURBQXFELENBQUM7QUFDL0UsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFFbEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHdDQUF3QyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLGlFQUFpRSxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxlQUFlLEVBQStCLE1BQU0sbURBQW1ELENBQUM7QUFDakgsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUNoRSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUVuRyxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFpQix1QkFBdUIsQ0FBQyxh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