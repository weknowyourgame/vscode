/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const performanceNow = globalThis.performance.now.bind(globalThis.performance);
export class StopWatch {
    static create(highResolution) {
        return new StopWatch(highResolution);
    }
    constructor(highResolution) {
        this._now = highResolution === false ? Date.now : performanceNow;
        this._startTime = this._now();
        this._stopTime = -1;
    }
    stop() {
        this._stopTime = this._now();
    }
    reset() {
        this._startTime = this._now();
        this._stopTime = -1;
    }
    elapsed() {
        if (this._stopTime !== -1) {
            return this._stopTime - this._startTime;
        }
        return this._now() - this._startTime;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RvcHdhdGNoLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxNQUFNLGNBQWMsR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBRS9FLE1BQU0sT0FBTyxTQUFTO0lBT2QsTUFBTSxDQUFDLE1BQU0sQ0FBQyxjQUF3QjtRQUM1QyxPQUFPLElBQUksU0FBUyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRCxZQUFZLGNBQXdCO1FBQ25DLElBQUksQ0FBQyxJQUFJLEdBQUcsY0FBYyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUVNLElBQUk7UUFDVixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUM5QixDQUFDO0lBRU0sS0FBSztRQUNYLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUVNLE9BQU87UUFDYixJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUMzQixPQUFPLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUN6QyxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztJQUN0QyxDQUFDO0NBQ0QifQ==