/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { stub } from 'sinon';
export function mock() {
    // eslint-disable-next-line local/code-no-any-casts
    return function () { };
}
// Creates an object object that returns sinon mocks for every property. Optionally
// takes base properties.
export const mockObject = () => (properties) => {
    // eslint-disable-next-line local/code-no-any-casts
    return new Proxy({ ...properties }, {
        get(target, key) {
            if (!target.hasOwnProperty(key)) {
                target[key] = stub();
            }
            return target[key];
        },
        set(target, key, value) {
            target[key] = value;
            return true;
        },
    });
};
/**
 * Shortcut for type-safe partials in mocks. A shortcut for `obj as Partial<T> as T`.
 */
export function upcastPartial(partial) {
    return partial;
}
export function upcastDeepPartial(partial) {
    return partial;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9jay5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3Rlc3QvY29tbW9uL21vY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFhLElBQUksRUFBRSxNQUFNLE9BQU8sQ0FBQztBQU94QyxNQUFNLFVBQVUsSUFBSTtJQUNuQixtREFBbUQ7SUFDbkQsT0FBTyxjQUFjLENBQVEsQ0FBQztBQUMvQixDQUFDO0FBSUQsbUZBQW1GO0FBQ25GLHlCQUF5QjtBQUN6QixNQUFNLENBQUMsTUFBTSxVQUFVLEdBQUcsR0FBcUIsRUFBRSxDQUFDLENBQTZCLFVBQWUsRUFBMkIsRUFBRTtJQUMxSCxtREFBbUQ7SUFDbkQsT0FBTyxJQUFJLEtBQUssQ0FBQyxFQUFFLEdBQUcsVUFBVSxFQUFTLEVBQUU7UUFDMUMsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHO1lBQ2QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDO1lBQ3RCLENBQUM7WUFFRCxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNwQixDQUFDO1FBQ0QsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsS0FBSztZQUNyQixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO1lBQ3BCLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQztLQUNELENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQztBQUVGOztHQUVHO0FBQ0gsTUFBTSxVQUFVLGFBQWEsQ0FBSSxPQUFtQjtJQUNuRCxPQUFPLE9BQVksQ0FBQztBQUNyQixDQUFDO0FBQ0QsTUFBTSxVQUFVLGlCQUFpQixDQUFJLE9BQXVCO0lBQzNELE9BQU8sT0FBWSxDQUFDO0FBQ3JCLENBQUMifQ==