/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class Size2D {
    static equals(a, b) {
        return a.width === b.width && a.height === b.height;
    }
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
    add(other) {
        return new Size2D(this.width + other.width, this.height + other.height);
    }
    deltaX(delta) {
        return new Size2D(this.width + delta, this.height);
    }
    deltaY(delta) {
        return new Size2D(this.width, this.height + delta);
    }
    toString() {
        return `(${this.width},${this.height})`;
    }
    subtract(other) {
        return new Size2D(this.width - other.width, this.height - other.height);
    }
    scale(factor) {
        return new Size2D(this.width * factor, this.height * factor);
    }
    scaleWidth(factor) {
        return new Size2D(this.width * factor, this.height);
    }
    mapComponents(map) {
        return new Size2D(map(this.width), map(this.height));
    }
    isZero() {
        return this.width === 0 && this.height === 0;
    }
    transpose() {
        return new Size2D(this.height, this.width);
    }
    toDimension() {
        return { width: this.width, height: this.height };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2l6ZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2NvcmUvMmQvc2l6ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxNQUFNLE9BQU8sTUFBTTtJQUNsQixNQUFNLENBQUMsTUFBTSxDQUFDLENBQVMsRUFBRSxDQUFTO1FBQ2pDLE9BQU8sQ0FBQyxDQUFDLEtBQUssS0FBSyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNyRCxDQUFDO0lBRUQsWUFDaUIsS0FBYSxFQUNiLE1BQWM7UUFEZCxVQUFLLEdBQUwsS0FBSyxDQUFRO1FBQ2IsV0FBTSxHQUFOLE1BQU0sQ0FBUTtJQUMzQixDQUFDO0lBRUUsR0FBRyxDQUFDLEtBQWE7UUFDdkIsT0FBTyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFhO1FBQzFCLE9BQU8sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFTSxNQUFNLENBQUMsS0FBYTtRQUMxQixPQUFPLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRU0sUUFBUTtRQUNkLE9BQU8sSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQztJQUN6QyxDQUFDO0lBRU0sUUFBUSxDQUFDLEtBQWE7UUFDNUIsT0FBTyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVNLEtBQUssQ0FBQyxNQUFjO1FBQzFCLE9BQU8sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRU0sVUFBVSxDQUFDLE1BQWM7UUFDL0IsT0FBTyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVNLGFBQWEsQ0FBQyxHQUE4QjtRQUNsRCxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFTSxNQUFNO1FBQ1osT0FBTyxJQUFJLENBQUMsS0FBSyxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRU0sU0FBUztRQUNmLE9BQU8sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVNLFdBQVc7UUFDakIsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDbkQsQ0FBQztDQUNEIn0=