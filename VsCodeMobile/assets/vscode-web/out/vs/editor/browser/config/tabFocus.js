/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
class TabFocusImpl extends Disposable {
    constructor() {
        super(...arguments);
        this._tabFocus = false;
        this._onDidChangeTabFocus = this._register(new Emitter());
        this.onDidChangeTabFocus = this._onDidChangeTabFocus.event;
    }
    getTabFocusMode() {
        return this._tabFocus;
    }
    setTabFocusMode(tabFocusMode) {
        this._tabFocus = tabFocusMode;
        this._onDidChangeTabFocus.fire(this._tabFocus);
    }
}
/**
 * Control what pressing Tab does.
 * If it is false, pressing Tab or Shift-Tab will be handled by the editor.
 * If it is true, pressing Tab or Shift-Tab will move the browser focus.
 * Defaults to false.
 */
export const TabFocus = new TabFocusImpl();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFiRm9jdXMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2Jyb3dzZXIvY29uZmlnL3RhYkZvY3VzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxPQUFPLEVBQVMsTUFBTSwrQkFBK0IsQ0FBQztBQUMvRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFFL0QsTUFBTSxZQUFhLFNBQVEsVUFBVTtJQUFyQzs7UUFDUyxjQUFTLEdBQVksS0FBSyxDQUFDO1FBQ2xCLHlCQUFvQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQVcsQ0FBQyxDQUFDO1FBQy9ELHdCQUFtQixHQUFtQixJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDO0lBVXZGLENBQUM7SUFSTyxlQUFlO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN2QixDQUFDO0lBRU0sZUFBZSxDQUFDLFlBQXFCO1FBQzNDLElBQUksQ0FBQyxTQUFTLEdBQUcsWUFBWSxDQUFDO1FBQzlCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2hELENBQUM7Q0FDRDtBQUVEOzs7OztHQUtHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sUUFBUSxHQUFHLElBQUksWUFBWSxFQUFFLENBQUMifQ==