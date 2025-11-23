/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../base/common/event.js';
import { toDisposable } from '../../base/common/lifecycle.js';
import { shouldSynchronizeModel } from './model.js';
import { score } from './languageSelector.js';
function isExclusive(selector) {
    if (typeof selector === 'string') {
        return false;
    }
    else if (Array.isArray(selector)) {
        return selector.every(isExclusive);
    }
    else {
        return !!selector.exclusive; // TODO: microsoft/TypeScript#42768
    }
}
class MatchCandidate {
    constructor(uri, languageId, notebookUri, notebookType, recursive) {
        this.uri = uri;
        this.languageId = languageId;
        this.notebookUri = notebookUri;
        this.notebookType = notebookType;
        this.recursive = recursive;
    }
    equals(other) {
        return this.notebookType === other.notebookType
            && this.languageId === other.languageId
            && this.uri.toString() === other.uri.toString()
            && this.notebookUri?.toString() === other.notebookUri?.toString()
            && this.recursive === other.recursive;
    }
}
export class LanguageFeatureRegistry {
    get onDidChange() { return this._onDidChange.event; }
    constructor(_notebookInfoResolver) {
        this._notebookInfoResolver = _notebookInfoResolver;
        this._clock = 0;
        this._entries = [];
        this._onDidChange = new Emitter();
    }
    register(selector, provider) {
        let entry = {
            selector,
            provider,
            _score: -1,
            _time: this._clock++
        };
        this._entries.push(entry);
        this._lastCandidate = undefined;
        this._onDidChange.fire(this._entries.length);
        return toDisposable(() => {
            if (entry) {
                const idx = this._entries.indexOf(entry);
                if (idx >= 0) {
                    this._entries.splice(idx, 1);
                    this._lastCandidate = undefined;
                    this._onDidChange.fire(this._entries.length);
                    entry = undefined;
                }
            }
        });
    }
    has(model) {
        return this.all(model).length > 0;
    }
    all(model) {
        if (!model) {
            return [];
        }
        this._updateScores(model, false);
        const result = [];
        // from registry
        for (const entry of this._entries) {
            if (entry._score > 0) {
                result.push(entry.provider);
            }
        }
        return result;
    }
    allNoModel() {
        return this._entries.map(entry => entry.provider);
    }
    ordered(model, recursive = false) {
        const result = [];
        this._orderedForEach(model, recursive, entry => result.push(entry.provider));
        return result;
    }
    orderedGroups(model) {
        const result = [];
        let lastBucket;
        let lastBucketScore;
        this._orderedForEach(model, false, entry => {
            if (lastBucket && lastBucketScore === entry._score) {
                lastBucket.push(entry.provider);
            }
            else {
                lastBucketScore = entry._score;
                lastBucket = [entry.provider];
                result.push(lastBucket);
            }
        });
        return result;
    }
    _orderedForEach(model, recursive, callback) {
        this._updateScores(model, recursive);
        for (const entry of this._entries) {
            if (entry._score > 0) {
                callback(entry);
            }
        }
    }
    _updateScores(model, recursive) {
        const notebookInfo = this._notebookInfoResolver?.(model.uri);
        // use the uri (scheme, pattern) of the notebook info iff we have one
        // otherwise it's the model's/document's uri
        const candidate = notebookInfo
            ? new MatchCandidate(model.uri, model.getLanguageId(), notebookInfo.uri, notebookInfo.type, recursive)
            : new MatchCandidate(model.uri, model.getLanguageId(), undefined, undefined, recursive);
        if (this._lastCandidate?.equals(candidate)) {
            // nothing has changed
            return;
        }
        this._lastCandidate = candidate;
        for (const entry of this._entries) {
            entry._score = score(entry.selector, candidate.uri, candidate.languageId, shouldSynchronizeModel(model), candidate.notebookUri, candidate.notebookType);
            if (isExclusive(entry.selector) && entry._score > 0) {
                if (recursive) {
                    entry._score = 0;
                }
                else {
                    // support for one exclusive selector that overwrites
                    // any other selector
                    for (const entry of this._entries) {
                        entry._score = 0;
                    }
                    entry._score = 1000;
                    break;
                }
            }
        }
        // needs sorting
        this._entries.sort(LanguageFeatureRegistry._compareByScoreAndTime);
    }
    static _compareByScoreAndTime(a, b) {
        if (a._score < b._score) {
            return 1;
        }
        else if (a._score > b._score) {
            return -1;
        }
        // De-prioritize built-in providers
        if (isBuiltinSelector(a.selector) && !isBuiltinSelector(b.selector)) {
            return 1;
        }
        else if (!isBuiltinSelector(a.selector) && isBuiltinSelector(b.selector)) {
            return -1;
        }
        if (a._time < b._time) {
            return 1;
        }
        else if (a._time > b._time) {
            return -1;
        }
        else {
            return 0;
        }
    }
}
function isBuiltinSelector(selector) {
    if (typeof selector === 'string') {
        return false;
    }
    if (Array.isArray(selector)) {
        return selector.some(isBuiltinSelector);
    }
    return Boolean(selector.isBuiltin);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9sYW5ndWFnZUZlYXR1cmVSZWdpc3RyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sNEJBQTRCLENBQUM7QUFDckQsT0FBTyxFQUFlLFlBQVksRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQzNFLE9BQU8sRUFBYyxzQkFBc0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUNoRSxPQUFPLEVBQW9DLEtBQUssRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBVWhGLFNBQVMsV0FBVyxDQUFDLFFBQTBCO0lBQzlDLElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDbEMsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO1NBQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDcEMsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7U0FBTSxDQUFDO1FBQ1AsT0FBTyxDQUFDLENBQUUsUUFBMkIsQ0FBQyxTQUFTLENBQUMsQ0FBQyxtQ0FBbUM7SUFDckYsQ0FBQztBQUNGLENBQUM7QUFXRCxNQUFNLGNBQWM7SUFDbkIsWUFDVSxHQUFRLEVBQ1IsVUFBa0IsRUFDbEIsV0FBNEIsRUFDNUIsWUFBZ0MsRUFDaEMsU0FBa0I7UUFKbEIsUUFBRyxHQUFILEdBQUcsQ0FBSztRQUNSLGVBQVUsR0FBVixVQUFVLENBQVE7UUFDbEIsZ0JBQVcsR0FBWCxXQUFXLENBQWlCO1FBQzVCLGlCQUFZLEdBQVosWUFBWSxDQUFvQjtRQUNoQyxjQUFTLEdBQVQsU0FBUyxDQUFTO0lBQ3hCLENBQUM7SUFFTCxNQUFNLENBQUMsS0FBcUI7UUFDM0IsT0FBTyxJQUFJLENBQUMsWUFBWSxLQUFLLEtBQUssQ0FBQyxZQUFZO2VBQzNDLElBQUksQ0FBQyxVQUFVLEtBQUssS0FBSyxDQUFDLFVBQVU7ZUFDcEMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtlQUM1QyxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsRUFBRSxLQUFLLEtBQUssQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFO2VBQzlELElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLFNBQVMsQ0FBQztJQUN4QyxDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sdUJBQXVCO0lBTW5DLElBQUksV0FBVyxLQUFLLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRXJELFlBQTZCLHFCQUE0QztRQUE1QywwQkFBcUIsR0FBckIscUJBQXFCLENBQXVCO1FBTmpFLFdBQU0sR0FBVyxDQUFDLENBQUM7UUFDVixhQUFRLEdBQWUsRUFBRSxDQUFDO1FBRTFCLGlCQUFZLEdBQUcsSUFBSSxPQUFPLEVBQVUsQ0FBQztJQUd1QixDQUFDO0lBRTlFLFFBQVEsQ0FBQyxRQUEwQixFQUFFLFFBQVc7UUFFL0MsSUFBSSxLQUFLLEdBQXlCO1lBQ2pDLFFBQVE7WUFDUixRQUFRO1lBQ1IsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUNWLEtBQUssRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFO1NBQ3BCLENBQUM7UUFFRixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMxQixJQUFJLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztRQUNoQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRTdDLE9BQU8sWUFBWSxDQUFDLEdBQUcsRUFBRTtZQUN4QixJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUNYLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUN6QyxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDZCxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7b0JBQzdCLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO29CQUNoQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUM3QyxLQUFLLEdBQUcsU0FBUyxDQUFDO2dCQUNuQixDQUFDO1lBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELEdBQUcsQ0FBQyxLQUFpQjtRQUNwQixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsR0FBRyxDQUFDLEtBQWlCO1FBQ3BCLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNaLE9BQU8sRUFBRSxDQUFDO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2pDLE1BQU0sTUFBTSxHQUFRLEVBQUUsQ0FBQztRQUV2QixnQkFBZ0I7UUFDaEIsS0FBSyxNQUFNLEtBQUssSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbkMsSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUN0QixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM3QixDQUFDO1FBQ0YsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQztJQUVELFVBQVU7UUFDVCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFRCxPQUFPLENBQUMsS0FBaUIsRUFBRSxTQUFTLEdBQUcsS0FBSztRQUMzQyxNQUFNLE1BQU0sR0FBUSxFQUFFLENBQUM7UUFDdkIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUM3RSxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUM7SUFFRCxhQUFhLENBQUMsS0FBaUI7UUFDOUIsTUFBTSxNQUFNLEdBQVUsRUFBRSxDQUFDO1FBQ3pCLElBQUksVUFBZSxDQUFDO1FBQ3BCLElBQUksZUFBdUIsQ0FBQztRQUU1QixJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7WUFDMUMsSUFBSSxVQUFVLElBQUksZUFBZSxLQUFLLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDcEQsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDakMsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLGVBQWUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO2dCQUMvQixVQUFVLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDekIsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDO0lBRU8sZUFBZSxDQUFDLEtBQWlCLEVBQUUsU0FBa0IsRUFBRSxRQUFzQztRQUVwRyxJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztRQUVyQyxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3RCLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNqQixDQUFDO1FBQ0YsQ0FBQztJQUNGLENBQUM7SUFJTyxhQUFhLENBQUMsS0FBaUIsRUFBRSxTQUFrQjtRQUUxRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFN0QscUVBQXFFO1FBQ3JFLDRDQUE0QztRQUM1QyxNQUFNLFNBQVMsR0FBRyxZQUFZO1lBQzdCLENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxhQUFhLEVBQUUsRUFBRSxZQUFZLENBQUMsR0FBRyxFQUFFLFlBQVksQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDO1lBQ3RHLENBQUMsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxhQUFhLEVBQUUsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBRXpGLElBQUksSUFBSSxDQUFDLGNBQWMsRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztZQUM1QyxzQkFBc0I7WUFDdEIsT0FBTztRQUNSLENBQUM7UUFFRCxJQUFJLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztRQUVoQyxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLFVBQVUsRUFBRSxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxTQUFTLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUV4SixJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDckQsSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDZixLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztnQkFDbEIsQ0FBQztxQkFBTSxDQUFDO29CQUNQLHFEQUFxRDtvQkFDckQscUJBQXFCO29CQUNyQixLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQzt3QkFDbkMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7b0JBQ2xCLENBQUM7b0JBQ0QsS0FBSyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7b0JBQ3BCLE1BQU07Z0JBQ1AsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsZ0JBQWdCO1FBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLHNCQUFzQixDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVPLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxDQUFpQixFQUFFLENBQWlCO1FBQ3pFLElBQUksQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDekIsT0FBTyxDQUFDLENBQUM7UUFDVixDQUFDO2FBQU0sSUFBSSxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ1gsQ0FBQztRQUVELG1DQUFtQztRQUNuQyxJQUFJLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3JFLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQzthQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksaUJBQWlCLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDNUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sQ0FBQyxDQUFDO1FBQ1YsQ0FBQzthQUFNLElBQUksQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDOUIsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUNYLENBQUM7YUFBTSxDQUFDO1lBQ1AsT0FBTyxDQUFDLENBQUM7UUFDVixDQUFDO0lBQ0YsQ0FBQztDQUNEO0FBRUQsU0FBUyxpQkFBaUIsQ0FBQyxRQUEwQjtJQUNwRCxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ2xDLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1FBQzdCLE9BQU8sUUFBUSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxPQUFPLE9BQU8sQ0FBRSxRQUEyQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3hELENBQUMifQ==