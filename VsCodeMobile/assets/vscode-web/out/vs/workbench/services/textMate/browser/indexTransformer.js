/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Can only be called with increasing values of `index`.
*/
export class MonotonousIndexTransformer {
    static fromMany(transformations) {
        // TODO improve performance by combining transformations first
        const transformers = transformations.map(t => new MonotonousIndexTransformer(t));
        return new CombinedIndexTransformer(transformers);
    }
    constructor(transformation) {
        this.transformation = transformation;
        this.idx = 0;
        this.offset = 0;
    }
    /**
     * Precondition: index >= previous-value-of(index).
     */
    transform(index) {
        let nextChange = this.transformation.replacements.at(this.idx);
        while (nextChange && nextChange.replaceRange.endExclusive <= index) {
            this.offset += nextChange.getLengthDelta();
            this.idx++;
            nextChange = this.transformation.replacements.at(this.idx);
        }
        // assert nextChange === undefined || index < nextChange.offset + nextChange.length
        if (nextChange && nextChange.replaceRange.start <= index) {
            // Offset is touched by the change
            return undefined;
        }
        return index + this.offset;
    }
}
export class CombinedIndexTransformer {
    constructor(transformers) {
        this.transformers = transformers;
    }
    transform(index) {
        for (const transformer of this.transformers) {
            const result = transformer.transform(index);
            if (result === undefined) {
                return undefined;
            }
            index = result;
        }
        return index;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXhUcmFuc2Zvcm1lci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dE1hdGUvYnJvd3Nlci9pbmRleFRyYW5zZm9ybWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBUWhHOztFQUVFO0FBQ0YsTUFBTSxPQUFPLDBCQUEwQjtJQUMvQixNQUFNLENBQUMsUUFBUSxDQUFDLGVBQTBCO1FBQ2hELDhEQUE4RDtRQUM5RCxNQUFNLFlBQVksR0FBRyxlQUFlLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSwwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pGLE9BQU8sSUFBSSx3QkFBd0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNuRCxDQUFDO0lBS0QsWUFBNkIsY0FBdUI7UUFBdkIsbUJBQWMsR0FBZCxjQUFjLENBQVM7UUFINUMsUUFBRyxHQUFHLENBQUMsQ0FBQztRQUNSLFdBQU0sR0FBRyxDQUFDLENBQUM7SUFHbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxDQUFDLEtBQWE7UUFDdEIsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMvRCxPQUFPLFVBQVUsSUFBSSxVQUFVLENBQUMsWUFBWSxDQUFDLFlBQVksSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNwRSxJQUFJLENBQUMsTUFBTSxJQUFJLFVBQVUsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUMzQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDWCxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBQ0QsbUZBQW1GO1FBRW5GLElBQUksVUFBVSxJQUFJLFVBQVUsQ0FBQyxZQUFZLENBQUMsS0FBSyxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQzFELGtDQUFrQztZQUNsQyxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBRUQsT0FBTyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUM1QixDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sd0JBQXdCO0lBQ3BDLFlBQ2tCLFlBQWlDO1FBQWpDLGlCQUFZLEdBQVosWUFBWSxDQUFxQjtJQUMvQyxDQUFDO0lBRUwsU0FBUyxDQUFDLEtBQWE7UUFDdEIsS0FBSyxNQUFNLFdBQVcsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDN0MsTUFBTSxNQUFNLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QyxJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDMUIsT0FBTyxTQUFTLENBQUM7WUFDbEIsQ0FBQztZQUNELEtBQUssR0FBRyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztDQUNEIn0=