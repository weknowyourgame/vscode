/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var Chr;
(function (Chr) {
    Chr[Chr["CR"] = 13] = "CR";
    Chr[Chr["LF"] = 10] = "LF";
    Chr[Chr["COLON"] = 58] = "COLON";
    Chr[Chr["SPACE"] = 32] = "SPACE";
})(Chr || (Chr = {}));
/**
 * Parser for Server-Sent Events (SSE) streams.
 */
export class SSEParser {
    /**
     * Creates a new SSE parser.
     * @param onEvent The callback to invoke when an event is dispatched.
     */
    constructor(onEvent) {
        this.dataBuffer = '';
        this.eventTypeBuffer = '';
        this.buffer = [];
        this.endedOnCR = false;
        this.onEventHandler = onEvent;
        this.decoder = new TextDecoder('utf-8');
    }
    /**
     * Gets the last event ID received by this parser.
     */
    getLastEventId() {
        return this.lastEventIdBuffer;
    }
    /**
     * Gets the reconnection time in milliseconds, if one was specified by the server.
     */
    getReconnectionTime() {
        return this.reconnectionTime;
    }
    /**
     * Feeds a chunk of the SSE stream to the parser.
     * @param chunk The chunk to parse as a Uint8Array of UTF-8 encoded data.
     */
    feed(chunk) {
        if (chunk.length === 0) {
            return;
        }
        let offset = 0;
        // If the data stream was bifurcated between a CR and LF, avoid processing the CR as an extra newline
        if (this.endedOnCR && chunk[0] === 10 /* Chr.LF */) {
            offset++;
        }
        this.endedOnCR = false;
        // Process complete lines from the buffer
        while (offset < chunk.length) {
            const indexCR = chunk.indexOf(13 /* Chr.CR */, offset);
            const indexLF = chunk.indexOf(10 /* Chr.LF */, offset);
            const index = indexCR === -1 ? indexLF : (indexLF === -1 ? indexCR : Math.min(indexCR, indexLF));
            if (index === -1) {
                break;
            }
            let str = '';
            for (const buf of this.buffer) {
                str += this.decoder.decode(buf, { stream: true });
            }
            str += this.decoder.decode(chunk.subarray(offset, index));
            this.processLine(str);
            this.buffer.length = 0;
            offset = index + (chunk[index] === 13 /* Chr.CR */ && chunk[index + 1] === 10 /* Chr.LF */ ? 2 : 1);
        }
        if (offset < chunk.length) {
            this.buffer.push(chunk.subarray(offset));
        }
        else {
            this.endedOnCR = chunk[chunk.length - 1] === 13 /* Chr.CR */;
        }
    }
    /**
     * Processes a single line from the SSE stream.
     */
    processLine(line) {
        if (!line.length) {
            this.dispatchEvent();
            return;
        }
        if (line.startsWith(':')) {
            return;
        }
        // Parse the field name and value
        let field;
        let value;
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
            // Line with no colon - the entire line is the field name, value is empty
            field = line;
            value = '';
        }
        else {
            // Line with a colon - split into field name and value
            field = line.substring(0, colonIndex);
            value = line.substring(colonIndex + 1);
            // If value starts with a space, remove it
            if (value.startsWith(' ')) {
                value = value.substring(1);
            }
        }
        this.processField(field, value);
    }
    /**
     * Processes a field with the given name and value.
     */
    processField(field, value) {
        switch (field) {
            case 'event':
                this.eventTypeBuffer = value;
                break;
            case 'data':
                // Append the value to the data buffer, followed by a newline
                this.dataBuffer += value;
                this.dataBuffer += '\n';
                break;
            case 'id':
                // If the field value doesn't contain NULL, set the last event ID buffer
                if (!value.includes('\0')) {
                    this.currentEventId = this.lastEventIdBuffer = value;
                }
                else {
                    this.currentEventId = undefined;
                }
                break;
            case 'retry':
                // If the field value consists only of ASCII digits, set the reconnection time
                if (/^\d+$/.test(value)) {
                    this.reconnectionTime = parseInt(value, 10);
                }
                break;
            // Ignore any other fields
        }
    }
    /**
     * Dispatches the event based on the current buffer states.
     */
    dispatchEvent() {
        // If the data buffer is empty, reset the buffers and return
        if (this.dataBuffer === '') {
            this.dataBuffer = '';
            this.eventTypeBuffer = '';
            return;
        }
        // If the data buffer's last character is a newline, remove it
        if (this.dataBuffer.endsWith('\n')) {
            this.dataBuffer = this.dataBuffer.substring(0, this.dataBuffer.length - 1);
        }
        // Create and dispatch the event
        const event = {
            type: this.eventTypeBuffer || 'message',
            data: this.dataBuffer,
        };
        // Add optional fields if they exist
        if (this.currentEventId !== undefined) {
            event.id = this.currentEventId;
        }
        if (this.reconnectionTime !== undefined) {
            event.retry = this.reconnectionTime;
        }
        // Dispatch the event
        this.onEventHandler(event);
        // Reset the data and event type buffers
        this.reset();
    }
    /**
     * Resets the parser state.
     */
    reset() {
        this.dataBuffer = '';
        this.eventTypeBuffer = '';
        this.currentEventId = undefined;
        // Note: lastEventIdBuffer is not reset as it's used for reconnection
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3NlUGFyc2VyLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvY29tbW9uL3NzZVBhcnNlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQXFDaEcsSUFBVyxHQUtWO0FBTEQsV0FBVyxHQUFHO0lBQ2IsMEJBQU8sQ0FBQTtJQUNQLDBCQUFPLENBQUE7SUFDUCxnQ0FBVSxDQUFBO0lBQ1YsZ0NBQVUsQ0FBQTtBQUNYLENBQUMsRUFMVSxHQUFHLEtBQUgsR0FBRyxRQUtiO0FBRUQ7O0dBRUc7QUFDSCxNQUFNLE9BQU8sU0FBUztJQVVyQjs7O09BR0c7SUFDSCxZQUFZLE9BQXdCO1FBYjVCLGVBQVUsR0FBRyxFQUFFLENBQUM7UUFDaEIsb0JBQWUsR0FBRyxFQUFFLENBQUM7UUFJckIsV0FBTSxHQUFpQixFQUFFLENBQUM7UUFDMUIsY0FBUyxHQUFHLEtBQUssQ0FBQztRQVF6QixJQUFJLENBQUMsY0FBYyxHQUFHLE9BQU8sQ0FBQztRQUM5QixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNJLGNBQWM7UUFDcEIsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUM7SUFDL0IsQ0FBQztJQUNEOztPQUVHO0lBQ0ksbUJBQW1CO1FBQ3pCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDO0lBQzlCLENBQUM7SUFFRDs7O09BR0c7SUFDSSxJQUFJLENBQUMsS0FBaUI7UUFDNUIsSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3hCLE9BQU87UUFDUixDQUFDO1FBRUQsSUFBSSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBRWYscUdBQXFHO1FBQ3JHLElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLG9CQUFXLEVBQUUsQ0FB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