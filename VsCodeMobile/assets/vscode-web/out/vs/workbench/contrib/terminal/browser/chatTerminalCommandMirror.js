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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITerminalService } from './terminal.js';
import { DetachedProcessInfo } from './detachedTerminal.js';
import { TERMINAL_BACKGROUND_COLOR } from '../common/terminalColorRegistry.js';
import { PANEL_BACKGROUND } from '../../../common/theme.js';
/**
 * Mirrors a terminal command's output into a detached terminal instance.
 * Used in the chat terminal tool progress part to show command output for example.
 */
let DetachedTerminalCommandMirror = class DetachedTerminalCommandMirror extends Disposable {
    constructor(_xtermTerminal, _command, _terminalService) {
        super();
        this._xtermTerminal = _xtermTerminal;
        this._command = _command;
        this._terminalService = _terminalService;
        this._detachedTerminal = this._createTerminal();
    }
    async attach(container) {
        const terminal = await this._detachedTerminal;
        if (this._attachedContainer !== container) {
            container.classList.add('chat-terminal-output-terminal');
            terminal.attachToElement(container);
            this._attachedContainer = container;
        }
    }
    async renderCommand() {
        const vt = await this._getCommandOutputAsVT();
        if (!vt) {
            return undefined;
        }
        if (!vt.text) {
            return { lineCount: 0 };
        }
        const detached = await this._detachedTerminal;
        detached.xterm.write(vt.text);
        return { lineCount: vt.lineCount };
    }
    async _getCommandOutputAsVT() {
        const executedMarker = this._command.executedMarker;
        const endMarker = this._command.endMarker;
        if (!executedMarker || executedMarker.isDisposed || !endMarker || endMarker.isDisposed) {
            return undefined;
        }
        const startLine = executedMarker.line;
        const endLine = endMarker.line - 1;
        const lineCount = Math.max(endLine - startLine + 1, 0);
        const text = await this._xtermTerminal.getRangeAsVT(executedMarker, endMarker, true);
        if (!text) {
            return { text: '', lineCount: 0 };
        }
        return { text, lineCount };
    }
    async _createTerminal() {
        const detached = await this._terminalService.createDetachedTerminal({
            cols: this._xtermTerminal.raw.cols,
            rows: 10,
            readonly: true,
            processInfo: new DetachedProcessInfo({ initialCwd: '' }),
            disableOverviewRuler: true,
            colorProvider: {
                getBackgroundColor: theme => {
                    const terminalBackground = theme.getColor(TERMINAL_BACKGROUND_COLOR);
                    if (terminalBackground) {
                        return terminalBackground;
                    }
                    return theme.getColor(PANEL_BACKGROUND);
                },
            }
        });
        return this._register(detached);
    }
};
DetachedTerminalCommandMirror = __decorate([
    __param(2, ITerminalService)
], DetachedTerminalCommandMirror);
export { DetachedTerminalCommandMirror };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hhdFRlcm1pbmFsQ29tbWFuZE1pcnJvci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL2NoYXRUZXJtaW5hbENvbW1hbmRNaXJyb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRWxFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBa0MsTUFBTSxlQUFlLENBQUM7QUFDakYsT0FBTyxFQUFFLG1CQUFtQixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFNUQsT0FBTyxFQUFFLHlCQUF5QixFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDL0UsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFPNUQ7OztHQUdHO0FBQ0ksSUFBTSw2QkFBNkIsR0FBbkMsTUFBTSw2QkFBOEIsU0FBUSxVQUFVO0lBSTVELFlBQ2tCLGNBQTZCLEVBQzdCLFFBQTBCLEVBQ1IsZ0JBQWtDO1FBRXJFLEtBQUssRUFBRSxDQUFDO1FBSlMsbUJBQWMsR0FBZCxjQUFjLENBQWU7UUFDN0IsYUFBUSxHQUFSLFFBQVEsQ0FBa0I7UUFDUixxQkFBZ0IsR0FBaEIsZ0JBQWdCLENBQWtCO1FBR3JFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDakQsQ0FBQztJQUVELEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBc0I7UUFDbEMsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUM7UUFDOUMsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDM0MsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsK0JBQStCLENBQUMsQ0FBQztZQUN6RCxRQUFRLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxTQUFTLENBQUM7UUFDckMsQ0FBQztJQUNGLENBQUM7SUFFRCxLQUFLLENBQUMsYUFBYTtRQUNsQixNQUFNLEVBQUUsR0FBRyxNQUFNLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQzlDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNULE9BQU8sU0FBUyxDQUFDO1FBQ2xCLENBQUM7UUFDRCxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2QsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUN6QixDQUFDO1FBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUM7UUFDOUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzlCLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBQ3BDLENBQUM7SUFFTyxLQUFLLENBQUMscUJBQXFCO1FBQ2xDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDO1FBQ3BELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDO1FBQzFDLElBQUksQ0FBQyxjQUFjLElBQUksY0FBYyxDQUFDLFVBQVUsSUFBSSxDQUFDLFNBQVMsSUFBSSxTQUFTLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDeEYsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxJQUFJLENBQUM7UUFDdEMsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7UUFDbkMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEdBQUcsU0FBUyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUV2RCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDckYsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1gsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQ25DLENBQUM7UUFFRCxPQUFPLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZTtRQUM1QixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQztZQUNuRSxJQUFJLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFJLENBQUMsSUFBSTtZQUNuQyxJQUFJLEVBQUUsRUFBRTtZQUNSLFFBQVEsRUFBRSxJQUFJO1lBQ2QsV0FBVyxFQUFFLElBQUksbUJBQW1CLENBQUMsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLENBQUM7WUFDeEQsb0JBQW9CLEVBQUUsSUFBSTtZQUMxQixhQUFhLEVBQUU7Z0JBQ2Qsa0JBQWtCLEVBQUUsS0FBSyxDQUFDLEVBQUU7b0JBQzNCLE1BQU0sa0JBQWtCLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO29CQUNyRSxJQUFJLGtCQUFrQixFQUFFLENBQUM7d0JBQ3hCLE9BQU8sa0JBQWtCLENBQUM7b0JBQzNCLENBQUM7b0JBQ0QsT0FBTyxLQUFLLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBQ3pDLENBQUM7YUFDRDtTQUNELENBQUMsQ0FBQztRQUNILE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqQyxDQUFDO0NBRUQsQ0FBQTtBQTFFWSw2QkFBNkI7SUFPdkMsV0FBQSxnQkFBZ0IsQ0FBQTtHQVBOLDZCQUE2QixDQTBFekMifQ==