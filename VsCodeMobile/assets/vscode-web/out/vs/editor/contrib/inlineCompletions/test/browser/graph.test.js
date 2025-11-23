/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DirectedGraph } from '../../browser/model/graph.js';
suite('DirectedGraph', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('from - creates empty graph', () => {
        const graph = DirectedGraph.from([], () => []);
        assert.deepStrictEqual(graph.getOutgoing('a'), []);
    });
    test('from - creates graph with single node', () => {
        const graph = DirectedGraph.from(['a'], () => []);
        assert.deepStrictEqual(graph.getOutgoing('a'), []);
    });
    test('from - creates graph with nodes and edges', () => {
        const nodes = ['a', 'b', 'c'];
        const getOutgoing = (node) => {
            switch (node) {
                case 'a':
                    return ['b', 'c'];
                case 'b':
                    return ['c'];
                case 'c':
                    return [];
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        assert.deepStrictEqual([...graph.getOutgoing('a')].sort(), ['b', 'c']);
        assert.deepStrictEqual(graph.getOutgoing('b'), ['c']);
        assert.deepStrictEqual(graph.getOutgoing('c'), []);
    });
    test('from - handles duplicate edges', () => {
        const nodes = ['a', 'b'];
        const getOutgoing = (node) => {
            switch (node) {
                case 'a':
                    return ['b', 'b']; // Duplicate edge
                case 'b':
                    return [];
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        assert.deepStrictEqual(graph.getOutgoing('a'), ['b']);
        assert.deepStrictEqual(graph.getOutgoing('b'), []);
    });
    test('removeCycles - no cycles', () => {
        const nodes = ['a', 'b', 'c'];
        const getOutgoing = (node) => {
            switch (node) {
                case 'a':
                    return ['b'];
                case 'b':
                    return ['c'];
                case 'c':
                    return [];
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        const result = graph.removeCycles();
        assert.deepStrictEqual(result.foundCycles, []);
        assert.deepStrictEqual(graph.getOutgoing('a'), ['b']);
        assert.deepStrictEqual(graph.getOutgoing('b'), ['c']);
        assert.deepStrictEqual(graph.getOutgoing('c'), []);
    });
    test('removeCycles - simple cycle', () => {
        const nodes = ['a', 'b'];
        const getOutgoing = (node) => {
            switch (node) {
                case 'a':
                    return ['b'];
                case 'b':
                    return ['a']; // Creates cycle
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        const result = graph.removeCycles();
        assert.strictEqual(result.foundCycles.length, 1);
        assert.ok(result.foundCycles.includes('a') || result.foundCycles.includes('b'));
        // After removing cycles, one of the edges should be removed
        const aOutgoing = graph.getOutgoing('a');
        const bOutgoing = graph.getOutgoing('b');
        assert.ok((aOutgoing.length === 0 && bOutgoing.length === 1) ||
            (aOutgoing.length === 1 && bOutgoing.length === 0));
    });
    test('removeCycles - self loop', () => {
        const nodes = ['a'];
        const getOutgoing = (node) => {
            switch (node) {
                case 'a':
                    return ['a']; // Self loop
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        const result = graph.removeCycles();
        assert.deepStrictEqual(result.foundCycles, ['a']);
        assert.deepStrictEqual(graph.getOutgoing('a'), []);
    });
    test('removeCycles - complex cycle', () => {
        const nodes = ['a', 'b', 'c', 'd'];
        const getOutgoing = (node) => {
            switch (node) {
                case 'a':
                    return ['b'];
                case 'b':
                    return ['c'];
                case 'c':
                    return ['d', 'a']; // Creates cycle back to 'a'
                case 'd':
                    return [];
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        const result = graph.removeCycles();
        assert.ok(result.foundCycles.length >= 1);
        // After removing cycles, there should be no path back to 'a' from 'c'
        const cOutgoing = graph.getOutgoing('c');
        assert.ok(!cOutgoing.includes('a'));
    });
    test('removeCycles - multiple disconnected cycles', () => {
        const nodes = ['a', 'b', 'c', 'd'];
        const getOutgoing = (node) => {
            switch (node) {
                case 'a':
                    return ['b'];
                case 'b':
                    return ['a']; // Cycle 1: a <-> b
                case 'c':
                    return ['d'];
                case 'd':
                    return ['c']; // Cycle 2: c <-> d
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        const result = graph.removeCycles();
        assert.ok(result.foundCycles.length >= 2);
        // After removing cycles, each pair should have only one direction
        const aOutgoing = graph.getOutgoing('a');
        const bOutgoing = graph.getOutgoing('b');
        const cOutgoing = graph.getOutgoing('c');
        const dOutgoing = graph.getOutgoing('d');
        assert.ok((aOutgoing.length === 0 && bOutgoing.length === 1) ||
            (aOutgoing.length === 1 && bOutgoing.length === 0));
        assert.ok((cOutgoing.length === 0 && dOutgoing.length === 1) ||
            (cOutgoing.length === 1 && dOutgoing.length === 0));
    });
    test('getOutgoing - non-existent node', () => {
        const graph = DirectedGraph.from(['a'], () => []);
        assert.deepStrictEqual(graph.getOutgoing('b'), []);
    });
    test('with number nodes', () => {
        const nodes = [1, 2, 3];
        const getOutgoing = (node) => {
            switch (node) {
                case 1:
                    return [2, 3];
                case 2:
                    return [3];
                case 3:
                    return [];
                default:
                    return [];
            }
        };
        const graph = DirectedGraph.from(nodes, getOutgoing);
        assert.deepStrictEqual([...graph.getOutgoing(1)].sort(), [2, 3]);
        assert.deepStrictEqual(graph.getOutgoing(2), [3]);
        assert.deepStrictEqual(graph.getOutgoing(3), []);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGgudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy90ZXN0L2Jyb3dzZXIvZ3JhcGgudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDbkcsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBRTdELEtBQUssQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO0lBQzNCLHVDQUF1QyxFQUFFLENBQUM7SUFFMUMsSUFBSSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsRUFBRTtRQUN2QyxNQUFNLEtBQUssR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFTLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN2RCxNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsdUNBQXVDLEVBQUUsR0FBRyxFQUFFO1FBQ2xELE1BQU0sS0FBSyxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNsRCxNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsMkNBQTJDLEVBQUUsR0FBRyxFQUFFO1FBQ3RELE1BQU0sS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxH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