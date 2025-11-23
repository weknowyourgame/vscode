/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export var DebugLocation;
(function (DebugLocation) {
    let enabled = false;
    function enable() {
        enabled = true;
    }
    DebugLocation.enable = enable;
    function ofCaller() {
        if (!enabled) {
            return undefined;
        }
        const Err = Error;
        const l = Err.stackTraceLimit;
        Err.stackTraceLimit = 3;
        const stack = new Error().stack;
        Err.stackTraceLimit = l;
        return DebugLocationImpl.fromStack(stack, 2);
    }
    DebugLocation.ofCaller = ofCaller;
})(DebugLocation || (DebugLocation = {}));
class DebugLocationImpl {
    static fromStack(stack, parentIdx) {
        const lines = stack.split('\n');
        const location = parseLine(lines[parentIdx + 1]);
        if (location) {
            return new DebugLocationImpl(location.fileName, location.line, location.column, location.id);
        }
        else {
            return undefined;
        }
    }
    constructor(fileName, line, column, id) {
        this.fileName = fileName;
        this.line = line;
        this.column = column;
        this.id = id;
    }
}
function parseLine(stackLine) {
    const match = stackLine.match(/\((.*):(\d+):(\d+)\)/);
    if (match) {
        return {
            fileName: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            id: stackLine,
        };
    }
    const match2 = stackLine.match(/at ([^\(\)]*):(\d+):(\d+)/);
    if (match2) {
        return {
            fileName: match2[1],
            line: parseInt(match2[2]),
            column: parseInt(match2[3]),
            id: stackLine,
        };
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVidWdMb2NhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvZGVidWdMb2NhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxNQUFNLEtBQVcsYUFBYSxDQW9CN0I7QUFwQkQsV0FBaUIsYUFBYTtJQUM3QixJQUFJLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFcEIsU0FBZ0IsTUFBTTtRQUNyQixPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFGZSxvQkFBTSxTQUVyQixDQUFBO0lBRUQsU0FBZ0IsUUFBUTtRQUN2QixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDZCxPQUFPLFNBQVMsQ0FBQztRQUNsQixDQUFDO1FBQ0QsTUFBTSxHQUFHLEdBQUcsS0FBdUQsQ0FBQztRQUVwRSxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsZUFBZSxDQUFDO1FBQzlCLEdBQUcsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUMsS0FBTSxDQUFDO1FBQ2pDLEdBQUcsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDO1FBRXhCLE9BQU8saUJBQWlCLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBWmUsc0JBQVEsV0FZdkIsQ0FBQTtBQUNGLENBQUMsRUFwQmdCLGFBQWEsS0FBYixhQUFhLFFBb0I3QjtBQUVELE1BQU0saUJBQWlCO0lBQ2YsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFhLEVBQUUsU0FBaUI7UUFDdkQsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoQyxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pELElBQUksUUFBUSxFQUFFLENBQUM7WUFDZCxPQUFPLElBQUksaUJBQWlCLENBQzNCLFFBQVEsQ0FBQyxRQUFRLEVBQ2pCLFFBQVEsQ0FBQyxJQUFJLEVBQ2IsUUFBUSxDQUFDLE1BQU0sRUFDZixRQUFRLENBQUMsRUFBRSxDQUNYLENBQUM7UUFDSCxDQUFDO2FBQU0sQ0FBQztZQUNQLE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7SUFDRixDQUFDO0lBRUQsWUFDaUIsUUFBZ0IsRUFDaEIsSUFBWSxFQUNaLE1BQWMsRUFDZCxFQUFVO1FBSFYsYUFBUSxHQUFSLFFBQVEsQ0FBUTtRQUNoQixTQUFJLEdBQUosSUFBSSxDQUFRO1FBQ1osV0FBTSxHQUFOLE1BQU0sQ0FBUTtRQUNkLE9BQUUsR0FBRixFQUFFLENBQVE7SUFFM0IsQ0FBQztDQUNEO0FBVUQsU0FBUyxTQUFTLENBQUMsU0FBaUI7SUFDbkMsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3RELElBQUksS0FBSyxFQUFFLENBQUM7UUFDWCxPQUFPO1lBQ04sUUFBUSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDbEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEIsTUFBTSxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUIsRUFBRSxFQUFFLFNBQVM7U0FDYixDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sTUFBTSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUU1RCxJQUFJLE1BQU0sRUFBRSxDQUFDO1FBQ1osT0FBTztZQUNOLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ25CLElBQUksRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pCLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNCLEVBQUUsRUFBRSxTQUFTO1NBQ2IsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLFNBQVMsQ0FBQztBQUNsQixDQUFDIn0=