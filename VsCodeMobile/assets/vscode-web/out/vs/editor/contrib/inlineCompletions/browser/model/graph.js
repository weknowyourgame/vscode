/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class DirectedGraph {
    constructor() {
        this._nodes = new Set();
        this._outgoingEdges = new Map();
    }
    static from(nodes, getOutgoing) {
        const graph = new DirectedGraph();
        for (const node of nodes) {
            graph._nodes.add(node);
        }
        for (const node of nodes) {
            const outgoing = getOutgoing(node);
            if (outgoing.length > 0) {
                const outgoingSet = new Set();
                for (const target of outgoing) {
                    outgoingSet.add(target);
                }
                graph._outgoingEdges.set(node, outgoingSet);
            }
        }
        return graph;
    }
    /**
     * After this, the graph is guaranteed to have no cycles.
     */
    removeCycles() {
        const foundCycles = [];
        const visited = new Set();
        const recursionStack = new Set();
        const toRemove = [];
        const dfs = (node) => {
            visited.add(node);
            recursionStack.add(node);
            const outgoing = this._outgoingEdges.get(node);
            if (outgoing) {
                for (const neighbor of outgoing) {
                    if (!visited.has(neighbor)) {
                        dfs(neighbor);
                    }
                    else if (recursionStack.has(neighbor)) {
                        // Found a cycle
                        foundCycles.push(neighbor);
                        toRemove.push({ from: node, to: neighbor });
                    }
                }
            }
            recursionStack.delete(node);
        };
        // Run DFS from all unvisited nodes
        for (const node of this._nodes) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }
        // Remove edges that cause cycles
        for (const { from, to } of toRemove) {
            const outgoingSet = this._outgoingEdges.get(from);
            if (outgoingSet) {
                outgoingSet.delete(to);
            }
        }
        return { foundCycles };
    }
    getOutgoing(node) {
        const outgoing = this._outgoingEdges.get(node);
        return outgoing ? Array.from(outgoing) : [];
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JhcGguanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvaW5saW5lQ29tcGxldGlvbnMvYnJvd3Nlci9tb2RlbC9ncmFwaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxNQUFNLE9BQU8sYUFBYTtJQUExQjtRQUNrQixXQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUssQ0FBQztRQUN0QixtQkFBYyxHQUFHLElBQUksR0FBRyxFQUFhLENBQUM7SUEwRXhELENBQUM7SUF4RU8sTUFBTSxDQUFDLElBQUksQ0FBSSxLQUFtQixFQUFFLFdBQXNDO1FBQ2hGLE1BQU0sS0FBSyxHQUFHLElBQUksYUFBYSxFQUFLLENBQUM7UUFFckMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUMxQixLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QixDQUFDO1FBRUQsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUMxQixNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkMsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUN6QixNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBSyxDQUFDO2dCQUNqQyxLQUFLLE1BQU0sTUFBTSxJQUFJLFFBQVEsRUFBRSxDQUFDO29CQUMvQixXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUN6QixDQUFDO2dCQUNELEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztZQUM3QyxDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWTtRQUNYLE1BQU0sV0FBVyxHQUFRLEVBQUUsQ0FBQztRQUM1QixNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBSyxDQUFDO1FBQzdCLE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxFQUFLLENBQUM7UUFDcEMsTUFBTSxRQUFRLEdBQThCLEVBQUUsQ0FBQztRQUUvQyxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQU8sRUFBUSxFQUFFO1lBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEIsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUV6QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMvQyxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNkLEtBQUssTUFBTSxRQUFRLElBQUksUUFBUSxFQUFFLENBQUM7b0JBQ2pDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7d0JBQzVCLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDZixDQUFDO3lCQUFNLElBQUksY0FBYyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO3dCQUN6QyxnQkFBZ0I7d0JBQ2hCLFdBQVcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7d0JBQzNCLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO29CQUM3QyxDQUFDO2dCQUNGLENBQUM7WUFDRixDQUFDO1lBRUQsY0FBYyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM3QixDQUFDLENBQUM7UUFFRixtQ0FBbUM7UUFDbkMsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDeEIsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ1gsQ0FBQztRQUNGLENBQUM7UUFFRCxpQ0FBaUM7UUFDakMsS0FBSyxNQUFNLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xELElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQ2pCLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEIsQ0FBQztRQUNGLENBQUM7UUFFRCxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUM7SUFDeEIsQ0FBQztJQUVELFdBQVcsQ0FBQyxJQUFPO1FBQ2xCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQy9DLE9BQU8sUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDN0MsQ0FBQztDQUNEIn0=