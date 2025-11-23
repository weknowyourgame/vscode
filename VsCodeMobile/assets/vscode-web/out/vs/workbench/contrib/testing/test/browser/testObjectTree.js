/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ObjectTree } from '../../../../../base/browser/ui/tree/objectTree.js';
import { Emitter } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { TestItemTreeElement, TestTreeErrorMessage } from '../../browser/explorerProjections/index.js';
import { MainThreadTestCollection } from '../../common/mainThreadTestCollection.js';
import { testStubs } from '../common/testStubs.js';
const element = document.createElement('div');
element.style.height = '1000px';
element.style.width = '200px';
class TestObjectTree extends ObjectTree {
    constructor(serializer, sorter) {
        super('test', element, {
            getHeight: () => 20,
            getTemplateId: () => 'default'
        }, [
            {
                disposeTemplate: ({ store }) => store.dispose(),
                renderElement: ({ depth, element }, _index, { container, store }) => {
                    const render = () => {
                        container.textContent = `${depth}:${serializer(element)}`;
                        Object.assign(container.dataset, element);
                    };
                    render();
                    if (element instanceof TestItemTreeElement) {
                        store.add(element.onChange(render));
                    }
                },
                disposeElement: (_el, _index, { store }) => store.clear(),
                renderTemplate: container => ({ container, store: new DisposableStore() }),
                templateId: 'default'
            }
        ], {
            sorter: sorter ?? {
                compare: (a, b) => serializer(a).localeCompare(serializer(b))
            }
        });
        this.layout(1000, 200);
    }
    getRendered(getProperty) {
        // eslint-disable-next-line no-restricted-syntax
        const elements = element.querySelectorAll('.monaco-tl-contents');
        const sorted = [...elements].sort((a, b) => pos(a) - pos(b));
        const chain = [{ e: '', children: [] }];
        for (const element of sorted) {
            const [depthStr, label] = element.textContent.split(':');
            const depth = Number(depthStr);
            const parent = chain[depth - 1];
            const child = { e: label };
            if (getProperty) {
                child.data = element.dataset[getProperty];
            }
            parent.children = parent.children?.concat(child) ?? [child];
            chain[depth] = child;
        }
        return chain[0].children;
    }
}
const pos = (element) => Number(element.parentElement.parentElement.getAttribute('aria-posinset'));
class ByLabelTreeSorter {
    compare(a, b) {
        if (a instanceof TestTreeErrorMessage || b instanceof TestTreeErrorMessage) {
            return (a instanceof TestTreeErrorMessage ? -1 : 0) + (b instanceof TestTreeErrorMessage ? 1 : 0);
        }
        if (a instanceof TestItemTreeElement && b instanceof TestItemTreeElement && a.test.item.uri && b.test.item.uri && a.test.item.uri.toString() === b.test.item.uri.toString() && a.test.item.range && b.test.item.range) {
            const delta = a.test.item.range.startLineNumber - b.test.item.range.startLineNumber;
            if (delta !== 0) {
                return delta;
            }
        }
        return (a.test.item.sortText || a.test.item.label).localeCompare(b.test.item.sortText || b.test.item.label);
    }
}
// names are hard
export class TestTreeTestHarness extends Disposable {
    constructor(makeTree, c = testStubs.nested()) {
        super();
        this.c = c;
        this.onDiff = this._register(new Emitter());
        this.onFolderChange = this._register(new Emitter());
        this.isProcessingDiff = false;
        this._register(c);
        this._register(this.c.onDidGenerateDiff(d => this.c.setDiff(d /* don't clear during testing */)));
        const collection = new MainThreadTestCollection({ asCanonicalUri: u => u }, (testId, levels) => {
            this.c.expand(testId, levels);
            if (!this.isProcessingDiff) {
                this.onDiff.fire(this.c.collectDiff());
            }
            return Promise.resolve();
        });
        this._register(this.onDiff.event(diff => collection.apply(diff)));
        // eslint-disable-next-line local/code-no-any-casts
        this.projection = this._register(makeTree({
            collection,
            onDidProcessDiff: this.onDiff.event,
        }));
        const sorter = new ByLabelTreeSorter();
        this.tree = this._register(new TestObjectTree(t => 'test' in t ? t.test.item.label : t.message.toString(), sorter));
        this._register(this.tree.onDidChangeCollapseState(evt => {
            if (evt.node.element instanceof TestItemTreeElement) {
                this.projection.expandElement(evt.node.element, evt.deep ? Infinity : 0);
            }
        }));
    }
    pushDiff(...diff) {
        this.onDiff.fire(diff);
    }
    flush() {
        this.isProcessingDiff = true;
        while (this.c.currentDiff.length) {
            this.onDiff.fire(this.c.collectDiff());
        }
        this.isProcessingDiff = false;
        this.projection.applyTo(this.tree);
        return this.tree.getRendered();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdE9iamVjdFRyZWUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvdGVzdGluZy90ZXN0L2Jyb3dzZXIvdGVzdE9iamVjdFRyZWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLG1EQUFtRCxDQUFDO0FBQy9FLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBRXRGLE9BQU8sRUFBZ0QsbUJBQW1CLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSw0Q0FBNEMsQ0FBQztBQUNySixPQUFPLEVBQUUsd0JBQXdCLEVBQUUsTUFBTSwwQ0FBMEMsQ0FBQztBQUdwRixPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFLbkQsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM5QyxPQUFPLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFDaEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDO0FBRTlCLE1BQU0sY0FBa0IsU0FBUSxVQUFrQjtJQUNqRCxZQUFZLFVBQStCLEVBQUUsTUFBdUI7UUFDbkUsS0FBSyxDQUNKLE1BQU0sRUFDTixPQUFPLEVBQ1A7WUFDQyxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtZQUNuQixhQUFhLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUztTQUM5QixFQUNEO1lBQ0M7Z0JBQ0MsZUFBZSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTtnQkFDL0MsYUFBYSxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7b0JBQ25FLE1BQU0sTUFBTSxHQUFHLEdBQUcsRUFBRTt3QkFDbkIsU0FBUyxDQUFDLFdBQVcsR0FBRyxHQUFHLEtBQUssSUFBSSxVQUFVLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQzt3QkFDMUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO29CQUMzQyxDQUFDLENBQUM7b0JBQ0YsTUFBTSxFQUFFLENBQUM7b0JBRVQsSUFBSSxPQUFPLFlBQVksbUJBQW1CLEVBQUUsQ0FBQzt3QkFDNUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ3JDLENBQUM7Z0JBQ0YsQ0FBQztnQkFDRCxjQUFjLEVBQUUsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7Z0JBQ3pELGNBQWMsRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLElBQUksZUFBZSxFQUFFLEVBQUUsQ0FBQztnQkFDMUUsVUFBVSxFQUFFLFNBQVM7YUFDK0Q7U0FDckYsRUFDRDtZQUNDLE1BQU0sRUFBRSxNQUFNLElBQUk7Z0JBQ2pCLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzdEO1NBQ0QsQ0FDRCxDQUFDO1FBQ0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVNLFdBQVcsQ0FBQyxXQUFvQjtRQUN0QyxnREFBZ0Q7UUFDaEQsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLGdCQUFnQixDQUFjLHFCQUFxQixDQUFDLENBQUM7UUFDOUUsTUFBTSxNQUFNLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM3RCxNQUFNLEtBQUssR0FBcUIsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDMUQsS0FBSyxNQUFNLE9BQU8sSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUM5QixNQUFNLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxXQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzFELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMvQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLE1BQU0sS0FBSyxHQUFtQixFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQztZQUMzQyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUNqQixLQUFLLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDM0MsQ0FBQztZQUNELE1BQU0sQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1RCxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7SUFDMUIsQ0FBQztDQUNEO0FBRUQsTUFBTSxHQUFHLEdBQUcsQ0FBQyxPQUFnQixFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWMsQ0FBQyxhQUFjLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7QUFHOUcsTUFBTSxpQkFBaUI7SUFDZixPQUFPLENBQUMsQ0FBMEIsRUFBRSxDQUEwQjtRQUNwRSxJQUFJLENBQUMsWUFBWSxvQkFBb0IsSUFBSSxDQUFDLFlBQVksb0JBQW9CLEVBQUUsQ0FBQztZQUM1RSxPQUFPLENBQUMsQ0FBQyxZQUFZLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFlBQVksb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkcsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLG1CQUFtQixJQUFJLENBQUMsWUFBWSxtQkFBbUIsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3ZOLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsQ0FBQztZQUNwRixJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDakIsT0FBTyxLQUFLLENBQUM7WUFDZCxDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM3RyxDQUFDO0NBQ0Q7QUFFRCxpQkFBaUI7QUFDakIsTUFBTSxPQUFPLG1CQUF5RSxTQUFRLFVBQVU7SUFPdkcsWUFBWSxRQUF1QyxFQUFrQixJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUU7UUFDMUYsS0FBSyxFQUFFLENBQUM7UUFENEQsTUFBQyxHQUFELENBQUMsQ0FBcUI7UUFOMUUsV0FBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQWEsQ0FBQyxDQUFDO1FBQ25ELG1CQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLE9BQU8sRUFBZ0MsQ0FBQyxDQUFDO1FBQ3JGLHFCQUFnQixHQUFHLEtBQUssQ0FBQztRQU1oQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVsRyxNQUFNLFVBQVUsR0FBRyxJQUFJLHdCQUF3QixDQUFDLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDOUYsSUFBSSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1lBQ3hDLENBQUM7WUFDRCxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUMxQixDQUFDLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVsRSxtREFBbUQ7UUFDbkQsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUN6QyxVQUFVO1lBQ1YsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLO1NBQzVCLENBQUMsQ0FBQyxDQUFDO1FBQ1gsTUFBTSxNQUFNLEdBQUcsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3BILElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN2RCxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxZQUFZLG1CQUFtQixFQUFFLENBQUM7Z0JBQ3JELElBQUksQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUUsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sUUFBUSxDQUFDLEdBQUcsSUFBbUI7UUFDckMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVNLEtBQUs7UUFDWCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO1FBQzdCLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ3hDLENBQUM7UUFDRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO1FBRTlCLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDaEMsQ0FBQztDQUNEIn0=