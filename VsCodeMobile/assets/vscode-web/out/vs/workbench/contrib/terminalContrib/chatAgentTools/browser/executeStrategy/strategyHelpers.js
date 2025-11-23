/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MutableDisposable, toDisposable } from '../../../../../../base/common/lifecycle.js';
/**
 * Sets up a recreating start marker which is resilient to prompts that clear/re-render (eg. transient
 * or powerlevel10k style prompts). The marker is recreated at the cursor position whenever the
 * existing marker is disposed. The caller is responsible for adding the startMarker to the store.
 */
export function setupRecreatingStartMarker(xterm, startMarker, fire, store, log) {
    const markerListener = new MutableDisposable();
    const recreateStartMarker = () => {
        if (store.isDisposed) {
            return;
        }
        const marker = xterm.raw.registerMarker();
        startMarker.value = marker ?? undefined;
        fire(marker);
        if (!marker) {
            markerListener.clear();
            return;
        }
        markerListener.value = marker.onDispose(() => {
            log?.('Start marker was disposed, recreating');
            recreateStartMarker();
        });
    };
    recreateStartMarker();
    store.add(toDisposable(() => {
        markerListener.dispose();
        startMarker.clear();
        fire(undefined);
    }));
    store.add(startMarker);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RyYXRlZ3lIZWxwZXJzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9jaGF0QWdlbnRUb29scy9icm93c2VyL2V4ZWN1dGVTdHJhdGVneS9zdHJhdGVneUhlbHBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFtQixpQkFBaUIsRUFBRSxZQUFZLEVBQW9CLE1BQU0sNENBQTRDLENBQUM7QUFHaEk7Ozs7R0FJRztBQUNILE1BQU0sVUFBVSwwQkFBMEIsQ0FDekMsS0FBOEQsRUFDOUQsV0FBNEMsRUFDNUMsSUFBZ0QsRUFDaEQsS0FBc0IsRUFDdEIsR0FBK0I7SUFFL0IsTUFBTSxjQUFjLEdBQUcsSUFBSSxpQkFBaUIsRUFBZSxDQUFDO0lBQzVELE1BQU0sbUJBQW1CLEdBQUcsR0FBRyxFQUFFO1FBQ2hDLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3RCLE9BQU87UUFDUixDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUMxQyxXQUFXLENBQUMsS0FBSyxHQUFHLE1BQU0sSUFBSSxTQUFTLENBQUM7UUFDeEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2IsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2IsY0FBYyxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3ZCLE9BQU87UUFDUixDQUFDO1FBQ0QsY0FBYyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRTtZQUM1QyxHQUFHLEVBQUUsQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO1lBQy9DLG1CQUFtQixFQUFFLENBQUM7UUFDdkIsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUM7SUFDRixtQkFBbUIsRUFBRSxDQUFDO0lBQ3RCLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEdBQUcsRUFBRTtRQUMzQixjQUFjLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDekIsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ3BCLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNqQixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ0osS0FBSyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN4QixDQUFDIn0=