/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { OffsetRange } from '../core/ranges/offsetRange.js';
import { LineTokens } from './lineTokens.js';
/**
 * This class represents a sequence of tokens.
 * Conceptually, each token has a length and a metadata number.
 * A token array might be used to annotate a string with metadata.
 * Use {@link TokenWithTextArrayBuilder} to efficiently create a token array.
 *
 * TODO: Make this class more efficient (e.g. by using a Int32Array).
*/
export class TokenWithTextArray {
    static fromLineTokens(lineTokens) {
        const tokenInfo = [];
        for (let i = 0; i < lineTokens.getCount(); i++) {
            tokenInfo.push(new TokenWithTextInfo(lineTokens.getTokenText(i), lineTokens.getMetadata(i)));
        }
        return TokenWithTextArray.create(tokenInfo);
    }
    static create(tokenInfo) {
        return new TokenWithTextArray(tokenInfo);
    }
    constructor(_tokenInfo) {
        this._tokenInfo = _tokenInfo;
    }
    toLineTokens(decoder) {
        return LineTokens.createFromTextAndMetadata(this.map((_r, t) => ({ text: t.text, metadata: t.metadata })), decoder);
    }
    forEach(cb) {
        let lengthSum = 0;
        for (const tokenInfo of this._tokenInfo) {
            const range = new OffsetRange(lengthSum, lengthSum + tokenInfo.text.length);
            cb(range, tokenInfo);
            lengthSum += tokenInfo.text.length;
        }
    }
    map(cb) {
        const result = [];
        let lengthSum = 0;
        for (const tokenInfo of this._tokenInfo) {
            const range = new OffsetRange(lengthSum, lengthSum + tokenInfo.text.length);
            result.push(cb(range, tokenInfo));
            lengthSum += tokenInfo.text.length;
        }
        return result;
    }
    slice(range) {
        const result = [];
        let lengthSum = 0;
        for (const tokenInfo of this._tokenInfo) {
            const tokenStart = lengthSum;
            const tokenEndEx = tokenStart + tokenInfo.text.length;
            if (tokenEndEx > range.start) {
                if (tokenStart >= range.endExclusive) {
                    break;
                }
                const deltaBefore = Math.max(0, range.start - tokenStart);
                const deltaAfter = Math.max(0, tokenEndEx - range.endExclusive);
                result.push(new TokenWithTextInfo(tokenInfo.text.slice(deltaBefore, tokenInfo.text.length - deltaAfter), tokenInfo.metadata));
            }
            lengthSum += tokenInfo.text.length;
        }
        return TokenWithTextArray.create(result);
    }
    append(other) {
        const result = this._tokenInfo.concat(other._tokenInfo);
        return TokenWithTextArray.create(result);
    }
}
export class TokenWithTextInfo {
    constructor(text, metadata) {
        this.text = text;
        this.metadata = metadata;
    }
}
/**
 * TODO: Make this class more efficient (e.g. by using a Int32Array).
*/
export class TokenWithTextArrayBuilder {
    constructor() {
        this._tokens = [];
    }
    add(text, metadata) {
        this._tokens.push(new TokenWithTextInfo(text, metadata));
    }
    build() {
        return TokenWithTextArray.create(this._tokens);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9rZW5XaXRoVGV4dEFycmF5LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb21tb24vdG9rZW5zL3Rva2VuV2l0aFRleHRBcnJheS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFFNUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRTdDOzs7Ozs7O0VBT0U7QUFDRixNQUFNLE9BQU8sa0JBQWtCO0lBQ3ZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsVUFBc0I7UUFDbEQsTUFBTSxTQUFTLEdBQXdCLEVBQUUsQ0FBQztRQUMxQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDaEQsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDOUYsQ0FBQztRQUNELE9BQU8sa0JBQWtCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTSxNQUFNLENBQUMsTUFBTSxDQUFDLFNBQThCO1FBQ2xELE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRUQsWUFDa0IsVUFBK0I7UUFBL0IsZUFBVSxHQUFWLFVBQVUsQ0FBcUI7SUFDN0MsQ0FBQztJQUVFLFlBQVksQ0FBQyxPQUF5QjtRQUM1QyxPQUFPLFVBQVUsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3JILENBQUM7SUFFTSxPQUFPLENBQUMsRUFBOEQ7UUFDNUUsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLEtBQUssTUFBTSxTQUFTLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sS0FBSyxHQUFHLElBQUksV0FBVyxDQUFDLFNBQVMsRUFBRSxTQUFTLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RSxFQUFFLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3JCLFNBQVMsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUNwQyxDQUFDO0lBQ0YsQ0FBQztJQUVNLEdBQUcsQ0FBSSxFQUEyRDtRQUN4RSxNQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7UUFDdkIsSUFBSSxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2xCLEtBQUssTUFBTSxTQUFTLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sS0FBSyxHQUFHLElBQUksV0FBVyxDQUFDLFNBQVMsRUFBRSxTQUFTLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUNsQyxTQUFTLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDcEMsQ0FBQztRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVNLEtBQUssQ0FBQyxLQUFrQjtRQUM5QixNQUFNLE1BQU0sR0FBd0IsRUFBRSxDQUFDO1FBQ3ZDLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztRQUNsQixLQUFLLE1BQU0sU0FBUyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUN6QyxNQUFNLFVBQVUsR0FBRyxTQUFTLENBQUM7WUFDN0IsTUFBTSxVQUFVLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3RELElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDOUIsSUFBSSxVQUFVLElBQUksS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDO29CQUN0QyxNQUFNO2dCQUNQLENBQUM7Z0JBRUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsQ0FBQztnQkFDMUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsVUFBVSxHQUFHLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFFaEUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsRUFBRSxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztZQUMvSCxDQUFDO1lBRUQsU0FBUyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3BDLENBQUM7UUFDRCxPQUFPLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRU0sTUFBTSxDQUFDLEtBQXlCO1FBQ3RDLE1BQU0sTUFBTSxHQUF3QixJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0UsT0FBTyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDMUMsQ0FBQztDQUNEO0FBSUQsTUFBTSxPQUFPLGlCQUFpQjtJQUM3QixZQUNpQixJQUFZLEVBQ1osUUFBdUI7UUFEdkIsU0FBSSxHQUFKLElBQUksQ0FBUTtRQUNaLGFBQVEsR0FBUixRQUFRLENBQWU7SUFDcEMsQ0FBQztDQUNMO0FBRUQ7O0VBRUU7QUFDRixNQUFNLE9BQU8seUJBQXlCO0lBQXRDO1FBQ2tCLFlBQU8sR0FBd0IsRUFBRSxDQUFDO0lBU3BELENBQUM7SUFQTyxHQUFHLENBQUMsSUFBWSxFQUFFLFFBQXVCO1FBQy9DLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksaUJBQWlCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVNLEtBQUs7UUFDWCxPQUFPLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEQsQ0FBQztDQUNEIn0=