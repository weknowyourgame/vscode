/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isString } from '../../../base/common/types.js';
export class TerminalDataBufferer {
    constructor(_callback) {
        this._callback = _callback;
        this._terminalBufferMap = new Map();
    }
    dispose() {
        for (const buffer of this._terminalBufferMap.values()) {
            buffer.dispose();
        }
    }
    startBuffering(id, event, throttleBy = 5) {
        const disposable = event((e) => {
            const data = isString(e) ? e : e.data;
            let buffer = this._terminalBufferMap.get(id);
            if (buffer) {
                buffer.data.push(data);
                return;
            }
            const timeoutId = setTimeout(() => this.flushBuffer(id), throttleBy);
            buffer = {
                data: [data],
                timeoutId,
                dispose: () => {
                    clearTimeout(timeoutId);
                    this.flushBuffer(id);
                    disposable.dispose();
                }
            };
            this._terminalBufferMap.set(id, buffer);
        });
        return disposable;
    }
    stopBuffering(id) {
        const buffer = this._terminalBufferMap.get(id);
        buffer?.dispose();
    }
    flushBuffer(id) {
        const buffer = this._terminalBufferMap.get(id);
        if (buffer) {
            this._terminalBufferMap.delete(id);
            this._callback(id, buffer.data.join(''));
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxEYXRhQnVmZmVyaW5nLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbERhdGFCdWZmZXJpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBUXpELE1BQU0sT0FBTyxvQkFBb0I7SUFHaEMsWUFBNkIsU0FBNkM7UUFBN0MsY0FBUyxHQUFULFNBQVMsQ0FBb0M7UUFGekQsdUJBQWtCLEdBQUcsSUFBSSxHQUFHLEVBQThCLENBQUM7SUFHNUUsQ0FBQztJQUVELE9BQU87UUFDTixLQUFLLE1BQU0sTUFBTSxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1lBQ3ZELE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNsQixDQUFDO0lBQ0YsQ0FBQztJQUVELGNBQWMsQ0FBQyxFQUFVLEVBQUUsS0FBd0MsRUFBRSxhQUFxQixDQUFDO1FBRTFGLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQTZCLEVBQUUsRUFBRTtZQUMxRCxNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUN0QyxJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLElBQUksTUFBTSxFQUFFLENBQUM7Z0JBQ1osTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZCLE9BQU87WUFDUixDQUFDO1lBRUQsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDckUsTUFBTSxHQUFHO2dCQUNSLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQztnQkFDWixTQUFTO2dCQUNULE9BQU8sRUFBRSxHQUFHLEVBQUU7b0JBQ2IsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUN4QixJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNyQixVQUFVLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3RCLENBQUM7YUFDRCxDQUFDO1lBQ0YsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDekMsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLFVBQVUsQ0FBQztJQUNuQixDQUFDO0lBRUQsYUFBYSxDQUFDLEVBQVU7UUFDdkIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMvQyxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUM7SUFDbkIsQ0FBQztJQUVELFdBQVcsQ0FBQyxFQUFVO1FBQ3JCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDL0MsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNaLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxQyxDQUFDO0lBQ0YsQ0FBQztDQUNEIn0=