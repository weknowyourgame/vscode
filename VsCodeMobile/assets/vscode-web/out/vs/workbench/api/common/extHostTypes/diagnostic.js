/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { equals } from '../../../../base/common/arrays.js';
import { URI } from '../../../../base/common/uri.js';
import { es5ClassCompat } from './es5ClassCompat.js';
import { Range } from './range.js';
export var DiagnosticTag;
(function (DiagnosticTag) {
    DiagnosticTag[DiagnosticTag["Unnecessary"] = 1] = "Unnecessary";
    DiagnosticTag[DiagnosticTag["Deprecated"] = 2] = "Deprecated";
})(DiagnosticTag || (DiagnosticTag = {}));
export var DiagnosticSeverity;
(function (DiagnosticSeverity) {
    DiagnosticSeverity[DiagnosticSeverity["Hint"] = 3] = "Hint";
    DiagnosticSeverity[DiagnosticSeverity["Information"] = 2] = "Information";
    DiagnosticSeverity[DiagnosticSeverity["Warning"] = 1] = "Warning";
    DiagnosticSeverity[DiagnosticSeverity["Error"] = 0] = "Error";
})(DiagnosticSeverity || (DiagnosticSeverity = {}));
let DiagnosticRelatedInformation = class DiagnosticRelatedInformation {
    static is(thing) {
        if (!thing) {
            return false;
        }
        return typeof thing.message === 'string'
            && thing.location
            && Range.isRange(thing.location.range)
            && URI.isUri(thing.location.uri);
    }
    constructor(location, message) {
        this.location = location;
        this.message = message;
    }
    static isEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return a.message === b.message
            && a.location.range.isEqual(b.location.range)
            && a.location.uri.toString() === b.location.uri.toString();
    }
};
DiagnosticRelatedInformation = __decorate([
    es5ClassCompat
], DiagnosticRelatedInformation);
export { DiagnosticRelatedInformation };
let Diagnostic = class Diagnostic {
    constructor(range, message, severity = DiagnosticSeverity.Error) {
        if (!Range.isRange(range)) {
            throw new TypeError('range must be set');
        }
        if (!message) {
            throw new TypeError('message must be set');
        }
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
    toJSON() {
        return {
            severity: DiagnosticSeverity[this.severity],
            message: this.message,
            range: this.range,
            source: this.source,
            code: this.code,
        };
    }
    static isEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b) {
            return false;
        }
        return a.message === b.message
            && a.severity === b.severity
            && a.code === b.code
            && a.severity === b.severity
            && a.source === b.source
            && a.range.isEqual(b.range)
            && equals(a.tags, b.tags)
            && equals(a.relatedInformation, b.relatedInformation, DiagnosticRelatedInformation.isEqual);
    }
};
Diagnostic = __decorate([
    es5ClassCompat
], Diagnostic);
export { Diagnostic };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhZ25vc3RpYy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0VHlwZXMvZGlhZ25vc3RpYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7OztBQUVoRyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDM0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3JELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUVyRCxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBRW5DLE1BQU0sQ0FBTixJQUFZLGFBR1g7QUFIRCxXQUFZLGFBQWE7SUFDeEIsK0RBQWUsQ0FBQTtJQUNmLDZEQUFjLENBQUE7QUFDZixDQUFDLEVBSFcsYUFBYSxLQUFiLGFBQWEsUUFHeEI7QUFFRCxNQUFNLENBQU4sSUFBWSxrQkFLWDtBQUxELFdBQVksa0JBQWtCO0lBQzdCLDJEQUFRLENBQUE7SUFDUix5RUFBZSxDQUFBO0lBQ2YsaUVBQVcsQ0FBQTtJQUNYLDZEQUFTLENBQUE7QUFDVixDQUFDLEVBTFcsa0JBQWtCLEtBQWxCLGtCQUFrQixRQUs3QjtBQUdNLElBQU0sNEJBQTRCLEdBQWxDLE1BQU0sNEJBQTRCO0lBRXhDLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBYztRQUN2QixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7UUFDRCxPQUFPLE9BQXNDLEtBQU0sQ0FBQyxPQUFPLEtBQUssUUFBUTtlQUNyQyxLQUFNLENBQUMsUUFBUTtlQUM5QyxLQUFLLENBQUMsT0FBTyxDQUFnQyxLQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQztlQUNuRSxHQUFHLENBQUMsS0FBSyxDQUFnQyxLQUFNLENB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