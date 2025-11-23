/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { timeout } from '../../../../../base/common/async.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { isString } from '../../../../../base/common/types.js';
import { isWindows } from '../../../../../base/common/platform.js';
/**
 * Tracks a terminal process's data stream and responds immediately when a matching string is
 * received. This is done in a low overhead way and is ideally run on the same process as the
 * where the process is handled to minimize latency.
 */
export class TerminalAutoResponder extends Disposable {
    constructor(proc, matchWord, response, logService) {
        super();
        this._pointer = 0;
        this._paused = false;
        /**
         * Each reply is throttled by a second to avoid resource starvation and responding to screen
         * reprints on Winodws.
         */
        this._throttled = false;
        this._register(proc.onProcessData(e => {
            if (this._paused || this._throttled) {
                return;
            }
            const data = isString(e) ? e : e.data;
            for (let i = 0; i < data.length; i++) {
                if (data[i] === matchWord[this._pointer]) {
                    this._pointer++;
                }
                else {
                    this._reset();
                }
                // Auto reply and reset
                if (this._pointer === matchWord.length) {
                    logService.debug(`Auto reply match: "${matchWord}", response: "${response}"`);
                    proc.input(response);
                    this._throttled = true;
                    timeout(1000).then(() => this._throttled = false);
                    this._reset();
                }
            }
        }));
    }
    _reset() {
        this._pointer = 0;
    }
    /**
     * No auto response will happen after a resize on Windows in case the resize is a result of
     * reprinting the screen.
     */
    handleResize() {
        if (isWindows) {
            this._paused = true;
        }
    }
    handleInput() {
        this._paused = false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVybWluYWxBdXRvUmVzcG9uZGVyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Rlcm1pbmFsL25vZGUvdGVybWluYWxDb250cmliL2F1dG9SZXBsaWVzL3Rlcm1pbmFsQXV0b1Jlc3BvbmRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDOUQsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUMvRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFJbkU7Ozs7R0FJRztBQUNILE1BQU0sT0FBTyxxQkFBc0IsU0FBUSxVQUFVO0lBVXBELFlBQ0MsSUFBMkIsRUFDM0IsU0FBaUIsRUFDakIsUUFBZ0IsRUFDaEIsVUFBdUI7UUFFdkIsS0FBSyxFQUFFLENBQUM7UUFmRCxhQUFRLEdBQUcsQ0FBQyxDQUFDO1FBQ2IsWUFBTyxHQUFHLEtBQUssQ0FBQztRQUV4Qjs7O1dBR0c7UUFDSyxlQUFVLEdBQUcsS0FBSyxDQUFDO1FBVTFCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNyQyxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNyQyxPQUFPO1lBQ1IsQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ3RDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3RDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztvQkFDMUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNqQixDQUFDO3FCQUFNLENBQUM7b0JBQ1AsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNmLENBQUM7Z0JBQ0QsdUJBQXVCO2dCQUN2QixJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUN4QyxVQUFVLENBQUMsS0FBSyxDQUFDLHNCQUFzQixTQUFTLGlCQUFpQixRQUFRLEdBQUcsQ0FBQyxDQUFDO29CQUM5RSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO29CQUNyQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztvQkFDdkIsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDO29CQUNsRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7Z0JBQ2YsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLE1BQU07UUFDYixJQUFJLENBQUMsUUFBUSxHQUFHLENBQUMsQ0FBQztJQUNuQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsWUFBWTtRQUNYLElBQUksU0FBUyxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUNyQixDQUFDO0lBQ0YsQ0FBQztJQUVELFdBQVc7UUFDVixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUN0QixDQUFDO0NBQ0QifQ==