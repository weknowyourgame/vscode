/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class RateLimiter {
    constructor(timesPerSecond = 5) {
        this.timesPerSecond = timesPerSecond;
        this._lastRun = 0;
        this._minimumTimeBetweenRuns = 1000 / timesPerSecond;
    }
    runIfNotLimited(callback) {
        const now = Date.now();
        if (now - this._lastRun >= this._minimumTimeBetweenRuns) {
            this._lastRun = now;
            callback();
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vdG9rZW5zL2NvbW1vbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxNQUFNLE9BQU8sV0FBVztJQUl2QixZQUE0QixpQkFBeUIsQ0FBQztRQUExQixtQkFBYyxHQUFkLGNBQWMsQ0FBWTtRQUNyRCxJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztRQUNsQixJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSSxHQUFHLGNBQWMsQ0FBQztJQUN0RCxDQUFDO0lBRU0sZUFBZSxDQUFDLFFBQW9CO1FBQzFDLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDO1lBQ3BCLFFBQVEsRUFBRSxDQUFDO1FBQ1osQ0FBQztJQUNGLENBQUM7Q0FDRCJ9