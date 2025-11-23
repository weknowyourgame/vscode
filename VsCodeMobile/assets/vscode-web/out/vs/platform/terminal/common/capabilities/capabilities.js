/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Primarily driven by the shell integration feature, a terminal capability is the mechanism for
 * progressively enhancing various features that may not be supported in all terminals/shells.
 */
export var TerminalCapability;
(function (TerminalCapability) {
    /**
     * The terminal can reliably detect the current working directory as soon as the change happens
     * within the buffer.
     */
    TerminalCapability[TerminalCapability["CwdDetection"] = 0] = "CwdDetection";
    /**
     * The terminal can reliably detect the current working directory when requested.
     */
    TerminalCapability[TerminalCapability["NaiveCwdDetection"] = 1] = "NaiveCwdDetection";
    /**
     * The terminal can reliably identify prompts, commands and command outputs within the buffer.
     */
    TerminalCapability[TerminalCapability["CommandDetection"] = 2] = "CommandDetection";
    /**
     * The terminal can often identify prompts, commands and command outputs within the buffer. It
     * may not be so good at remembering the position of commands that ran in the past. This state
     * may be enabled when something goes wrong or when using conpty for example.
     */
    TerminalCapability[TerminalCapability["PartialCommandDetection"] = 3] = "PartialCommandDetection";
    /**
     * Manages buffer marks that can be used for terminal navigation. The source of
     * the request (task, debug, etc) provides an ID, optional marker, hoverMessage, and hidden property. When
     * hidden is not provided, a generic decoration is added to the buffer and overview ruler.
     */
    TerminalCapability[TerminalCapability["BufferMarkDetection"] = 4] = "BufferMarkDetection";
    /**
     * The terminal can detect the latest environment of user's current shell.
     */
    TerminalCapability[TerminalCapability["ShellEnvDetection"] = 5] = "ShellEnvDetection";
    /**
     * The terminal can detect the prompt type being used (e.g., p10k, posh-git).
     */
    TerminalCapability[TerminalCapability["PromptTypeDetection"] = 6] = "PromptTypeDetection";
})(TerminalCapability || (TerminalCapability = {}));
export var CommandInvalidationReason;
(function (CommandInvalidationReason) {
    CommandInvalidationReason["Windows"] = "windows";
    CommandInvalidationReason["NoProblemsReported"] = "noProblemsReported";
})(CommandInvalidationReason || (CommandInvalidationReason = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FwYWJpbGl0aWVzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0aWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBU2hHOzs7R0FHRztBQUNILE1BQU0sQ0FBTixJQUFrQixrQkFxQ2pCO0FBckNELFdBQWtCLGtCQUFrQjtJQUNuQzs7O09BR0c7SUFDSCwyRUFBWSxDQUFBO0lBQ1o7O09BRUc7SUFDSCxxRkFBaUIsQ0FBQTtJQUNqQjs7T0FFRztJQUNILG1GQUFnQixDQUFBO0lBQ2hCOzs7O09BSUc7SUFDSCxpR0FBdUIsQ0FBQTtJQUV2Qjs7OztPQUlHO0lBQ0gseUZBQW1CLENBQUE7SUFFbkI7O09BRUc7SUFDSCxxRkFBaUIsQ0FBQTtJQUVqQjs7T0FFRztJQUNILHlGQUFtQixDQUFBO0FBQ3BCLENBQUMsRUFyQ2lCLGtCQUFrQixLQUFsQixrQkFBa0IsUUFxQ25DO0FBd0lELE1BQU0sQ0FBTixJQUFrQix5QkFHakI7QUFIRCxXQUFrQix5QkFBeUI7SUFDMUMsZ0RBQW1CLENBQUE7SUFDbkIsc0VBQXlDLENBQUE7QUFDMUMsQ0FBQyxFQUhpQix5QkFBeUIsS0FBekIseUJBQXlCLFFBRzFDIn0=