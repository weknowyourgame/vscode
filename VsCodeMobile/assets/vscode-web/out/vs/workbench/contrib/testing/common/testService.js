/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assert } from '../../../../base/common/assert.js';
import { DeferredPromise } from '../../../../base/common/async.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { LinkedList } from '../../../../base/common/linkedList.js';
import { WellDefinedPrefixTree } from '../../../../base/common/prefixTree.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { TestId } from './testId.js';
export const ITestService = createDecorator('testService');
export const testCollectionIsEmpty = (collection) => !Iterable.some(collection.rootItems, r => r.children.size > 0);
export const getContextForTestItem = (collection, id) => {
    if (typeof id === 'string') {
        id = TestId.fromString(id);
    }
    if (id.isRoot) {
        return { controller: id.toString() };
    }
    const context = { $mid: 16 /* MarshalledId.TestItemContext */, tests: [] };
    for (const i of id.idsFromRoot()) {
        if (!i.isRoot) {
            const test = collection.getNodeById(i.toString());
            if (test) {
                context.tests.push(test);
            }
        }
    }
    return context;
};
/**
 * Ensures the test with the given ID exists in the collection, if possible.
 * If cancellation is requested, or the test cannot be found, it will return
 * undefined.
 */
export const expandAndGetTestById = async (collection, id, ct = CancellationToken.None) => {
    const idPath = [...TestId.fromString(id).idsFromRoot()];
    let expandToLevel = 0;
    for (let i = idPath.length - 1; !ct.isCancellationRequested && i >= expandToLevel;) {
        const id = idPath[i].toString();
        const existing = collection.getNodeById(id);
        if (!existing) {
            i--;
            continue;
        }
        if (i === idPath.length - 1) {
            return existing;
        }
        // expand children only if it looks like it's necessary
        if (!existing.children.has(idPath[i + 1].toString())) {
            await collection.expand(id, 0);
        }
        expandToLevel = i + 1; // avoid an infinite loop if the test does not exist
        i = idPath.length - 1;
    }
    return undefined;
};
/**
 * Waits for the test to no longer be in the "busy" state.
 */
export const waitForTestToBeIdle = (testService, test) => {
    if (!test.item.busy) {
        return;
    }
    return new Promise(resolve => {
        const l = testService.onDidProcessDiff(() => {
            if (testService.collection.getNodeById(test.item.extId)?.item.busy !== true) {
                resolve(); // removed, or no longer busy
                l.dispose();
            }
        });
    });
};
/**
 * Iterator that expands to and iterates through tests in the file. Iterates
 * in strictly descending order.
 */
export const testsInFile = async function* (testService, ident, uri, waitForIdle = true, descendInFile = true) {
    // In this function we go to a bit of effort to avoid awaiting unnecessarily
    // and bulking the test collections we do collect for consumers. This fixes
    // a performance issue (#235819) where a large number of tests in a file
    // would cause a long delay switching editors.
    const queue = new LinkedList();
    const existing = [...testService.collection.getNodeByUrl(uri)].sort((a, b) => a.item.extId.length - b.item.extId.length);
    // getNodeByUrl will return all known tests in the URI, but this can include
    // children of tests even when `descendInFile` is false. Remove those cases.
    for (let i = 0; i < existing.length - 1; i++) {
        const prefix = existing[i].item.extId + "\0" /* TestIdPathParts.Delimiter */;
        for (let k = i + 1; k < existing.length; k++) {
            if (existing[k].item.extId.startsWith(prefix)) {
                existing.splice(k--, 1);
            }
        }
    }
    queue.push(existing.length ? existing.map(e => e.item.extId) : testService.collection.rootIds);
    let n = 0;
    let gather = [];
    while (queue.size > 0) {
        const next = queue.pop();
        let ids;
        if (!(next instanceof DeferredPromise)) {
            ids = next;
        }
        else if (next.isSettled) {
            ids = next.value || Iterable.empty();
        }
        else {
            if (gather.length) {
                yield gather;
                gather = [];
            }
            ids = await next.p;
        }
        for (const id of ids) {
            n++;
            const test = testService.collection.getNodeById(id);
            if (!test) {
                continue; // possible because we expand async and things could delete
            }
            if (!test.item.uri) {
                queue.push(test.children);
                continue;
            }
            if (ident.extUri.isEqual(uri, test.item.uri)) {
                gather.push(test);
                if (!descendInFile) {
                    continue;
                }
            }
            if (ident.extUri.isEqualOrParent(uri, test.item.uri)) {
                let prom;
                if (test.expand === 1 /* TestItemExpandState.Expandable */) {
                    prom = testService.collection.expand(test.item.extId, 1);
                }
                if (waitForIdle) {
                    if (prom) {
                        prom = prom.then(() => waitForTestToBeIdle(testService, test));
                    }
                    else if (test.item.busy) {
                        prom = waitForTestToBeIdle(testService, test);
                    }
                }
                if (prom) {
                    queue.push(DeferredPromise.fromPromise(prom.then(() => test.children)));
                }
                else if (test.children.size) {
                    queue.push(test.children);
                }
            }
        }
    }
    if (gather.length) {
        yield gather;
    }
};
/**
 * Iterator that iterates to the top-level children of tests under the given
 * the URI.
 */
export const testsUnderUri = async function* (testService, ident, uri, waitForIdle = true) {
    const queue = [testService.collection.rootIds];
    while (queue.length) {
        for (const testId of queue.pop()) {
            const test = testService.collection.getNodeById(testId);
            // Expand tests with URIs that are parent of the item, add tests
            // that are within the URI. Don't add their children, since those
            // tests already encompass their children.
            if (!test) {
                // no-op
            }
            else if (test.item.uri && ident.extUri.isEqualOrParent(test.item.uri, uri)) {
                yield test;
            }
            else if (!test.item.uri || ident.extUri.isEqualOrParent(uri, test.item.uri)) {
                if (test.expand === 1 /* TestItemExpandState.Expandable */) {
                    await testService.collection.expand(test.item.extId, 1);
                }
                if (waitForIdle) {
                    await waitForTestToBeIdle(testService, test);
                }
                queue.push(test.children.values());
            }
        }
    }
};
/**
 * Simplifies the array of tests by preferring test item parents if all of
 * their children are included.
 */
export const simplifyTestsToExecute = (collection, tests) => {
    if (tests.length < 2) {
        return tests;
    }
    const tree = new WellDefinedPrefixTree();
    for (const test of tests) {
        tree.insert(TestId.fromString(test.item.extId).path, test);
    }
    const out = [];
    // Returns the node if it and any children should be included. Otherwise
    // pushes into the `out` any individual children that should be included.
    const process = (currentId, node) => {
        // directly included, don't try to over-specify, and children should be ignored
        if (node.value) {
            return node.value;
        }
        assert(!!node.children, 'expect to have children');
        const thisChildren = [];
        for (const [part, child] of node.children) {
            currentId.push(part);
            const c = process(currentId, child);
            if (c) {
                thisChildren.push(c);
            }
            currentId.pop();
        }
        if (!thisChildren.length) {
            return;
        }
        // If there are multiple children and we have all of them, then tell the
        // parent this node should be included. Otherwise include children individually.
        const id = new TestId(currentId);
        const test = collection.getNodeById(id.toString());
        if (test?.children.size === thisChildren.length) {
            return test;
        }
        out.push(...thisChildren);
        return;
    };
    for (const [id, node] of tree.entries) {
        const n = process([id], node);
        if (n) {
            out.push(n);
        }
    }
    return out;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVzdGluZy9jb21tb24vdGVzdFNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzNELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQztBQUNuRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUU1RSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFL0QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBR25FLE9BQU8sRUFBbUIscUJBQXFCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUkvRixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sNERBQTRELENBQUM7QUFJN0YsT0FBTyxFQUFFLE1BQU0sRUFBbUIsTUFBTSxhQUFhLENBQUM7QUFJdEQsTUFBTSxDQUFDLE1BQU0sWUFBWSxHQUFHLGVBQWUsQ0FBZSxhQUFhLENBQUMsQ0FBQztBQXNFekUsTUFBTSxDQUFDLE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxVQUFxQyxFQUFFLEVBQUUsQ0FDOUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztBQUVoRSxNQUFNLENBQUMsTUFBTSxxQkFBcUIsR0FBRyxDQUFDLFVBQXFDLEVBQUUsRUFBbUIsRUFBRSxFQUFFO0lBQ25HLElBQUksT0FBTyxFQUFFLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDNUIsRUFBRSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENB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