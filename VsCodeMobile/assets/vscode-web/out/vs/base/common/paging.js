/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { range } from './arrays.js';
import { CancellationTokenSource } from './cancellation.js';
import { CancellationError } from './errors.js';
import { Event, Emitter } from './event.js';
function createPage(elements) {
    return {
        isResolved: !!elements,
        promise: null,
        cts: null,
        promiseIndexes: new Set(),
        elements: elements || []
    };
}
export function singlePagePager(elements) {
    return {
        firstPage: elements,
        total: elements.length,
        pageSize: elements.length,
        getPage: (pageIndex, cancellationToken) => {
            return Promise.resolve(elements);
        }
    };
}
export class PagedModel {
    get length() { return this.pager.total; }
    constructor(arg) {
        this.pages = [];
        this.onDidIncrementLength = Event.None;
        this.pager = Array.isArray(arg) ? singlePagePager(arg) : arg;
        const totalPages = Math.ceil(this.pager.total / this.pager.pageSize);
        this.pages = [
            createPage(this.pager.firstPage.slice()),
            ...range(totalPages - 1).map(() => createPage())
        ];
    }
    isResolved(index) {
        const pageIndex = Math.floor(index / this.pager.pageSize);
        const page = this.pages[pageIndex];
        return !!page.isResolved;
    }
    get(index) {
        const pageIndex = Math.floor(index / this.pager.pageSize);
        const indexInPage = index % this.pager.pageSize;
        const page = this.pages[pageIndex];
        return page.elements[indexInPage];
    }
    resolve(index, cancellationToken) {
        if (cancellationToken.isCancellationRequested) {
            return Promise.reject(new CancellationError());
        }
        const pageIndex = Math.floor(index / this.pager.pageSize);
        const indexInPage = index % this.pager.pageSize;
        const page = this.pages[pageIndex];
        if (page.isResolved) {
            return Promise.resolve(page.elements[indexInPage]);
        }
        if (!page.promise) {
            page.cts = new CancellationTokenSource();
            page.promise = this.pager.getPage(pageIndex, page.cts.token)
                .then(elements => {
                page.elements = elements;
                page.isResolved = true;
                page.promise = null;
                page.cts = null;
            }, err => {
                page.isResolved = false;
                page.promise = null;
                page.cts = null;
                return Promise.reject(err);
            });
        }
        const listener = cancellationToken.onCancellationRequested(() => {
            if (!page.cts) {
                return;
            }
            page.promiseIndexes.delete(index);
            if (page.promiseIndexes.size === 0) {
                page.cts.cancel();
            }
        });
        page.promiseIndexes.add(index);
        return page.promise.then(() => page.elements[indexInPage])
            .finally(() => listener.dispose());
    }
}
export class DelayedPagedModel {
    get length() { return this.model.length; }
    get onDidIncrementLength() { return this.model.onDidIncrementLength; }
    constructor(model, timeout = 500) {
        this.model = model;
        this.timeout = timeout;
    }
    isResolved(index) {
        return this.model.isResolved(index);
    }
    get(index) {
        return this.model.get(index);
    }
    resolve(index, cancellationToken) {
        return new Promise((c, e) => {
            if (cancellationToken.isCancellationRequested) {
                return e(new CancellationError());
            }
            const timer = setTimeout(() => {
                if (cancellationToken.isCancellationRequested) {
                    return e(new CancellationError());
                }
                timeoutCancellation.dispose();
                this.model.resolve(index, cancellationToken).then(c, e);
            }, this.timeout);
            const timeoutCancellation = cancellationToken.onCancellationRequested(() => {
                clearTimeout(timer);
                timeoutCancellation.dispose();
                e(new CancellationError());
            });
        });
    }
}
/**
 * A PageIteratorPager wraps an IPageIterator to provide IPager functionality.
 * It caches pages as they are accessed and supports random page access by
 * sequentially loading pages until the requested page is reached.
 */
export class PageIteratorPager {
    constructor(initialIterator) {
        this.cachedPages = [];
        this.isComplete = false;
        this.pendingRequests = new Map();
        this.currentIterator = initialIterator;
        this.firstPage = [...initialIterator.elements];
        this.pageSize = initialIterator.elements.length || 1; // Use first page size as page size
        this.cachedPages[0] = this.firstPage;
        this.isComplete = !initialIterator.hasNextPage;
        this.total = initialIterator.total;
    }
    async getPage(pageIndex, cancellationToken) {
        if (cancellationToken.isCancellationRequested) {
            throw new CancellationError();
        }
        // If we already have this page cached, return it
        if (pageIndex < this.cachedPages.length) {
            return this.cachedPages[pageIndex];
        }
        // If we're complete and don't have this page, it doesn't exist
        if (this.isComplete) {
            throw new Error(`Page ${pageIndex} is out of bounds. Total pages: ${this.cachedPages.length}`);
        }
        // Check if there's already a pending request that will load this index
        // (any pending request for an index >= our requested index)
        let promise;
        for (const [pendingPageIndex, pendingPromise] of this.pendingRequests) {
            if (pendingPageIndex >= pageIndex) {
                promise = pendingPromise;
                break;
            }
        }
        if (!promise) {
            promise = this.loadPagesUntil(pageIndex, cancellationToken);
            this.pendingRequests.set(pageIndex, promise);
        }
        try {
            await promise;
            if (pageIndex >= this.cachedPages.length) {
                throw new Error(`Page ${pageIndex} is out of bounds. Total pages: ${this.cachedPages.length}`);
            }
            return this.cachedPages[pageIndex];
        }
        finally {
            this.pendingRequests.delete(pageIndex);
        }
    }
    async loadPagesUntil(targetPageIndex, cancellationToken) {
        while (targetPageIndex >= this.cachedPages.length && this.currentIterator.hasNextPage) {
            if (cancellationToken.isCancellationRequested) {
                throw new CancellationError();
            }
            this.currentIterator = await this.currentIterator.getNextPage(cancellationToken);
            this.cachedPages.push([...this.currentIterator.elements]);
        }
        if (!this.currentIterator.hasNextPage) {
            this.isComplete = true;
        }
    }
}
export class IterativePagedModel {
    constructor(pager) {
        this.items = [];
        this._hasNextPage = true;
        this._onDidIncrementLength = new Emitter();
        this.loadingPromise = null;
        this.pager = pager;
        this.items = [...pager.firstPage.items];
        this._hasNextPage = pager.firstPage.hasMore;
    }
    get onDidIncrementLength() {
        return this._onDidIncrementLength.event;
    }
    /**
     * Returns actual length + 1 if there are more pages (sentinel approach)
     */
    get length() {
        return this.items.length + (this._hasNextPage ? 1 : 0);
    }
    /**
     * Sentinel item is never resolved - it triggers loading
     */
    isResolved(index) {
        if (index === this.items.length && this._hasNextPage) {
            return false; // This will trigger resolve() call
        }
        return index < this.items.length;
    }
    get(index) {
        if (index < this.items.length) {
            return this.items[index];
        }
        throw new Error('Item not resolved yet');
    }
    /**
     * When sentinel item is accessed, load next page
     */
    async resolve(index, cancellationToken) {
        if (cancellationToken.isCancellationRequested) {
            return Promise.reject(new CancellationError());
        }
        // If trying to resolve the sentinel item, load next page
        if (index === this.items.length && this._hasNextPage) {
            await this.loadNextPage(cancellationToken);
        }
        // After loading, the requested index should now be valid
        if (index < this.items.length) {
            return this.items[index];
        }
        throw new Error('Index out of bounds');
    }
    async loadNextPage(cancellationToken) {
        if (!this._hasNextPage) {
            return;
        }
        // If already loading, return the cached promise
        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }
        const pagePromise = this.pager.getNextPage(cancellationToken);
        this.loadingPromise = pagePromise
            .then(page => {
            this.items.push(...page.items);
            this._hasNextPage = page.hasMore;
            // Clear the loading promise before firing the event
            // so that event handlers can trigger loading the next page if needed
            this.loadingPromise = null;
            // Fire length update event
            this._onDidIncrementLength.fire(this.length);
        }, err => {
            this.loadingPromise = null;
            throw err;
        });
        await this.loadingPromise;
    }
    dispose() {
        this._onDidIncrementLength.dispose();
    }
}
/**
 * Similar to array.map, `mapPager` lets you map the elements of an
 * abstract paged collection to another type.
 */
export function mapPager(pager, fn) {
    return {
        firstPage: pager.firstPage.map(fn),
        total: pager.total,
        pageSize: pager.pageSize,
        getPage: (pageIndex, token) => pager.getPage(pageIndex, token).then(r => r.map(fn))
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnaW5nLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL3BhZ2luZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQ3BDLE9BQU8sRUFBcUIsdUJBQXVCLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUMvRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFDaEQsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFxQzVDLFNBQVMsVUFBVSxDQUFJLFFBQWM7SUFDcEMsT0FBTztRQUNOLFVBQVUsRUFBRSxDQUFDLENBQUMsUUFBUTtRQUN0QixPQUFPLEVBQUUsSUFBSTtRQUNiLEdBQUcsRUFBRSxJQUFJO1FBQ1QsY0FBYyxFQUFFLElBQUksR0FBRyxFQUFVO1FBQ2pDLFFBQVEsRUFBRSxRQUFRLElBQUksRUFBRTtLQUN4QixDQUFDO0FBQ0gsQ0FBQztBQWFELE1BQU0sVUFBVSxlQUFlLENBQUksUUFBYTtJQUMvQyxPQUFPO1FBQ04sU0FBUyxFQUFFLFFBQVE7UUFDbkIsS0FBSyxFQUFFLFFBQVEsQ0FBQyxNQUFNO1FBQ3RCLFFBQVEsRUFBRSxRQUFRLENBQUMsTUFBTTtRQUN6QixPQUFPLEVBQUUsQ0FBQyxTQUFpQixFQUFFLGlCQUFvQyxFQUFnQixFQUFFO1lBQ2xGLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNsQyxDQUFDO0tBQ0QsQ0FBQztBQUNILENBQUM7QUFFRCxNQUFNLE9BQU8sVUFBVTtJQUt0QixJQUFJLE1BQU0sS0FBYSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUdqRCxZQUFZLEdBQW9CO1FBTHhCLFVBQUssR0FBZSxFQUFF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