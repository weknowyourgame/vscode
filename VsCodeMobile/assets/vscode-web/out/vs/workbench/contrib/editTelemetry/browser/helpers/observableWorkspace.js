/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { derivedHandleChanges, observableValue, runOnChange, autorun, derived } from '../../../../../base/common/observable.js';
import { StringEdit, StringReplacement } from '../../../../../editor/common/core/edits/stringEdit.js';
import { EditSources } from '../../../../../editor/common/textModelEditSource.js';
export class ObservableWorkspace {
    constructor() {
        this._version = 0;
        /**
         * Is fired when any open document changes.
        */
        this.onDidOpenDocumentChange = derivedHandleChanges({
            owner: this,
            changeTracker: {
                createChangeSummary: () => ({ didChange: false }),
                handleChange: (ctx, changeSummary) => {
                    if (!ctx.didChange(this.documents)) {
                        changeSummary.didChange = true; // A document changed
                    }
                    return true;
                }
            }
        }, (reader, changeSummary) => {
            const docs = this.documents.read(reader);
            for (const d of docs) {
                d.value.read(reader); // add dependency
            }
            if (changeSummary.didChange) {
                this._version++; // to force a change
            }
            return this._version;
            // TODO@hediet make this work:
            /*
            const docs = this.openDocuments.read(reader);
            for (const d of docs) {
                if (reader.readChangesSinceLastRun(d.value).length > 0) {
                    reader.reportChange(d);
                }
            }
            return undefined;
            */
        });
        this.lastActiveDocument = derived((reader) => {
            const obs = observableValue('lastActiveDocument', undefined);
            reader.store.add(autorun((reader) => {
                const docs = this.documents.read(reader);
                for (const d of docs) {
                    reader.store.add(runOnChange(d.value, () => {
                        obs.set(d, undefined);
                    }));
                }
            }));
            return obs;
        }).flatten();
    }
    getFirstOpenDocument() {
        return this.documents.get()[0];
    }
    getDocument(documentId) {
        return this.documents.get().find(d => d.uri.toString() === documentId.toString());
    }
}
export class StringEditWithReason extends StringEdit {
    static replace(range, newText, source = EditSources.unknown({})) {
        return new StringEditWithReason([new StringReplacement(range, newText)], source);
    }
    constructor(replacements, reason) {
        super(replacements);
        this.reason = reason;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZVdvcmtzcGFjZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvaGVscGVycy9vYnNlcnZhYmxlV29ya3NwYWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBeUIsb0JBQW9CLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBZSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFcEssT0FBTyxFQUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHVEQUF1RCxDQUFDO0FBR3RHLE9BQU8sRUFBRSxXQUFXLEVBQXVCLE1BQU0scURBQXFELENBQUM7QUFFdkcsTUFBTSxPQUFnQixtQkFBbUI7SUFBekM7UUFZUyxhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBRXJCOztVQUVFO1FBQ2MsNEJBQXVCLEdBQUcsb0JBQW9CLENBQUM7WUFDOUQsS0FBSyxFQUFFLElBQUk7WUFDWCxhQUFhLEVBQUU7Z0JBQ2QsbUJBQW1CLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsQ0FBQztnQkFDakQsWUFBWSxFQUFFLENBQUMsR0FBRyxFQUFFLGFBQWEsRUFBRSxFQUFFO29CQUNwQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQzt3QkFDcEMsYUFBYSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsQ0FBQyxxQkFBcUI7b0JBQ3RELENBQUM7b0JBQ0QsT0FBTyxJQUFJLENBQUM7Z0JBQ2IsQ0FBQzthQUNEO1NBQ0QsRUFBRSxDQUFDLE1BQU0sRUFBRSxhQUFhLEVBQUUsRUFBRTtZQUM1QixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN6QyxLQUFLLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUN0QixDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLGlCQUFpQjtZQUN4QyxDQUFDO1lBQ0QsSUFBSSxhQUFhLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQzdCLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLG9CQUFvQjtZQUN0QyxDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBRXJCLDhCQUE4QjtZQUM5Qjs7Ozs7Ozs7Y0FRRTtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRWEsdUJBQWtCLEdBQUcsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDdkQsTUFBTSxHQUFHLEdBQUcsZUFBZSxDQUFDLG9CQUFvQixFQUFFLFNBQTRDLENBQUMsQ0FBQztZQUNoRyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtnQkFDbkMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3pDLEtBQUssTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7b0JBQ3RCLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRTt3QkFDMUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7b0JBQ3ZCLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztZQUNGLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDSixPQUFPLEdBQUcsQ0FBQztRQUNaLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2QsQ0FBQztJQTFEQSxvQkFBb0I7UUFDbkIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxXQUFXLENBQUMsVUFBZTtRQUMxQixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxVQUFVLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztJQUNuRixDQUFDO0NBb0REO0FBYUQsTUFBTSxPQUFPLG9CQUFxQixTQUFRLFVBQVU7SUFDNUMsTUFBTSxDQUFVLE9BQU8sQ0FBQyxLQUFrQixFQUFFLE9BQWUsRUFBRSxTQUE4QixXQUFXLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUN4SCxPQUFPLElBQUksb0JBQW9CLENBQUMsQ0FBQyxJQUFJLGlCQUFpQixDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFFRCxZQUNDLFlBQXdDLEVBQ3hCLE1BQTJCO1FBRTNDLEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUZKLFdBQU0sR0FBTixNQUFNLENBQXFCO0lBRzVDLENBQUM7Q0FDRCJ9