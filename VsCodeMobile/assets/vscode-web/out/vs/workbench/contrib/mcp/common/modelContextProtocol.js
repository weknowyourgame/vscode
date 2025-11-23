/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
//#endregion
/**
 * Schema updated from the Model Context Protocol repository at
 * https://github.com/modelcontextprotocol/specification/tree/main/schema
 *
 * ⚠️ Do not edit within `namespace` manually except to update schema versions ⚠️
 */
export var MCP;
(function (MCP) {
    /** @internal */
    MCP.LATEST_PROTOCOL_VERSION = "2025-06-18";
    /** @internal */
    MCP.JSONRPC_VERSION = "2.0";
    // Standard JSON-RPC error codes
    /** @internal */
    MCP.PARSE_ERROR = -32700;
    /** @internal */
    MCP.INVALID_REQUEST = -32600;
    /** @internal */
    MCP.METHOD_NOT_FOUND = -32601;
    /** @internal */
    MCP.INVALID_PARAMS = -32602;
    /** @internal */
    MCP.INTERNAL_ERROR = -32603;
    // Implementation-specific JSON-RPC error codes [-32000, -32099]
    /** @internal */
    MCP.URL_ELICITATION_REQUIRED = -32042;
})(MCP || (MCP = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZWxDb250ZXh0UHJvdG9jb2wuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvbWNwL2NvbW1vbi9tb2RlbENvbnRleHRQcm90b2NvbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQWlCaEcsWUFBWTtBQUVaOzs7OztHQUtHO0FBQ0gsTUFBTSxLQUFXLEdBQUcsQ0EwMERuQjtBQTEwREQsV0FBaUIsR0FBRztJQWFuQixnQkFBZ0I7SUFDSCwyQkFBdUIsR0FBRyxZQUFZLENBQUM7SUFDcEQsZ0JBQWdCO0lBQ0gsbUJBQWUsR0FBRyxLQUFLLENBQUM7SUFzR3JDLGdDQUFnQztJQUNoQyxnQkFBZ0I7SUFDSCxlQUFXLEdBQUcsQ0FBQyxLQUFLLENBQUM7SUFDbEMsZ0JBQWdCO0lBQ0gsbUJBQWUsR0FBRyxDQUFDLEtBQUssQ0FBQztJQUN0QyxnQkFBZ0I7SUFDSCxvQkFBZ0IsR0FBRyxDQUFDLEtBQUssQ0FBQztJQUN2QyxnQkFBZ0I7SUFDSCxrQkFBYyxHQUFHLENBQUMsS0FBSyxDQUFDO0lBQ3JDLGdCQUFnQjtJQUNILGtCQUFjLEdBQUcsQ0FBQyxLQUFLLENBQUM7SUFFckMsZ0VBQWdFO0lBQ2hFLGdCQUFnQjtJQUNILDRCQUF3QixHQUFHLENBQUMsS0FBSyxDQUFDO0FBc3NEaEQsQ0FBQyxFQTEwRGdCLEdBQUcsS0FBSCxHQUFHLFFBMDBEbkIifQ==