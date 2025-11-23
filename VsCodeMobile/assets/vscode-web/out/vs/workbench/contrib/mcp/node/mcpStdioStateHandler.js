/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { TimeoutTimer } from '../../../../base/common/async.js';
import { killTree } from '../../../../base/node/processes.js';
import { isWindows } from '../../../../base/common/platform.js';
var McpProcessState;
(function (McpProcessState) {
    McpProcessState[McpProcessState["Running"] = 0] = "Running";
    McpProcessState[McpProcessState["StdinEnded"] = 1] = "StdinEnded";
    McpProcessState[McpProcessState["KilledPolite"] = 2] = "KilledPolite";
    McpProcessState[McpProcessState["KilledForceful"] = 3] = "KilledForceful";
})(McpProcessState || (McpProcessState = {}));
/**
 * Manages graceful shutdown of MCP stdio connections following the MCP specification.
 *
 * Per spec, shutdown should:
 * 1. Close the input stream to the child process
 * 2. Wait for the server to exit, or send SIGTERM if it doesn't exit within 10 seconds
 * 3. Send SIGKILL if the server doesn't exit within 10 seconds after SIGTERM
 * 4. Allow forceful killing if called twice
 */
export class McpStdioStateHandler {
    static { this.GRACE_TIME_MS = 10_000; }
    get stopped() {
        return this._procState !== 0 /* McpProcessState.Running */;
    }
    constructor(_child, _graceTimeMs = McpStdioStateHandler.GRACE_TIME_MS) {
        this._child = _child;
        this._graceTimeMs = _graceTimeMs;
        this._procState = 0 /* McpProcessState.Running */;
    }
    /**
     * Initiates graceful shutdown. If called while shutdown is already in progress,
     * forces immediate termination.
     */
    stop() {
        if (this._procState === 0 /* McpProcessState.Running */) {
            let graceTime = this._graceTimeMs;
            try {
                this._child.stdin.end();
            }
            catch (error) {
                // If stdin.end() fails, continue with termination sequence
                // This can happen if the stream is already in an error state
                graceTime = 1;
            }
            this._procState = 1 /* McpProcessState.StdinEnded */;
            this._nextTimeout = new TimeoutTimer(() => this.killPolite(), graceTime);
        }
        else {
            this._nextTimeout?.dispose();
            this.killForceful();
        }
    }
    async killPolite() {
        this._procState = 2 /* McpProcessState.KilledPolite */;
        this._nextTimeout = new TimeoutTimer(() => this.killForceful(), this._graceTimeMs);
        if (this._child.pid) {
            if (!isWindows) {
                await killTree(this._child.pid, false).catch(() => {
                    this._child.kill('SIGTERM');
                });
            }
        }
        else {
            this._child.kill('SIGTERM');
        }
    }
    async killForceful() {
        this._procState = 3 /* McpProcessState.KilledForceful */;
        if (this._child.pid) {
            await killTree(this._child.pid, true).catch(() => {
                this._child.kill('SIGKILL');
            });
        }
        else {
            this._child.kill();
        }
    }
    write(message) {
        if (!this.stopped) {
            this._child.stdin.write(message + '\n');
        }
    }
    dispose() {
        this._nextTimeout?.dispose();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwU3RkaW9TdGF0ZUhhbmRsZXIuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL25vZGUvbWNwU3RkaW9TdGF0ZUhhbmRsZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRWhFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQ0FBb0MsQ0FBQztBQUM5RCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFaEUsSUFBVyxlQUtWO0FBTEQsV0FBVyxlQUFlO0lBQ3pCLDJEQUFPLENBQUE7SUFDUCxpRUFBVSxDQUFBO0lBQ1YscUVBQVksQ0FBQTtJQUNaLHlFQUFjLENBQUE7QUFDZixDQUFDLEVBTFUsZUFBZSxLQUFmLGVBQWUsUUFLekI7QUFFRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sT0FBTyxvQkFBb0I7YUFDUixrQkFBYSxHQUFHLE1BQU0sQUFBVCxDQUFVO0lBSy9DLElBQVcsT0FBTztRQUNqQixPQUFPLElBQUksQ0FBQyxVQUFVLG9DQUE0QixDQUFDO0lBQ3BELENBQUM7SUFFRCxZQUNrQixNQUFzQyxFQUN0QyxlQUF1QixvQkFBb0IsQ0FBQyxhQUFhO1FBRHpELFdBQU0sR0FBTixNQUFNLENBQWdDO1FBQ3RDLGlCQUFZLEdBQVosWUFBWSxDQUE2QztRQVRuRSxlQUFVLG1DQUEyQjtJQVV6QyxDQUFDO0lBRUw7OztPQUdHO0lBQ0ksSUFBSTtRQUNWLElBQUksSUFBSSxDQUFDLFVBQVUsb0NBQTRCLEVBQUUsQ0FBQztZQUNqRCxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1lBQ2xDLElBQUksQ0FBQztnQkFDSixJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN6QixDQUFDO1lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztnQkFDaEIsMkRBQTJEO2dCQUMzRCw2REFBNkQ7Z0JBQzdELFNBQVMsR0FBRyxDQUFDLENBQUM7WUFDZixDQUFDO1lBQ0QsSUFBSSxDQUFDLFVBQVUscUNBQTZCLENBQUM7WUFDN0MsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDMUUsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNyQixDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxVQUFVO1FBQ3ZCLElBQUksQ0FBQyxVQUFVLHVDQUErQixDQUFDO1FBQy9DLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUVuRixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDckIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNoQixNQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFO29CQUNqRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDN0IsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDO1FBQ0YsQ0FBQzthQUFNLENBQUM7WUFDUCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QixDQUFDO0lBQ0YsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZO1FBQ3pCLElBQUksQ0FBQyxVQUFVLHlDQUFpQyxDQUFDO1FBRWpELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNyQixNQUFNLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFO2dCQUNoRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM3QixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7YUFBTSxDQUFDO1lBQ1AsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNwQixDQUFDO0lBQ0YsQ0FBQztJQUVNLEtBQUssQ0FBQyxPQUFlO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FBQztRQUN6QyxDQUFDO0lBQ0YsQ0FBQztJQUVNLE9BQU87UUFDYixJQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxDQUFDO0lBQzlCLENBQUMifQ==