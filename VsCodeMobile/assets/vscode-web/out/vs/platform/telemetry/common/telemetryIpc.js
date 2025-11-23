/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class TelemetryAppenderChannel {
    constructor(appenders) {
        this.appenders = appenders;
    }
    listen(_, event) {
        throw new Error(`Event not found: ${event}`);
    }
    call(_, command, { eventName, data }) {
        this.appenders.forEach(a => a.log(eventName, data ?? {}));
        return Promise.resolve(null);
    }
}
export class TelemetryAppenderClient {
    constructor(channel) {
        this.channel = channel;
    }
    log(eventName, data) {
        this.channel.call('log', { eventName, data })
            .then(undefined, err => `Failed to log telemetry: ${console.warn(err)}`);
        return Promise.resolve(null);
    }
    flush() {
        // TODO
        return Promise.resolve();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVsZW1ldHJ5SXBjLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5SXBjLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBWWhHLE1BQU0sT0FBTyx3QkFBd0I7SUFFcEMsWUFBb0IsU0FBK0I7UUFBL0IsY0FBUyxHQUFULFNBQVMsQ0FBc0I7SUFBSSxDQUFDO0lBRXhELE1BQU0sQ0FBSSxDQUFVLEVBQUUsS0FBYTtRQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCxJQUFJLENBQUksQ0FBVSxFQUFFLE9BQWUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQWlCO1FBQ3RFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQW9CLENBQUMsQ0FBQztJQUM5QyxDQUFDO0NBQ0Q7QUFFRCxNQUFNLE9BQU8sdUJBQXVCO0lBRW5DLFlBQW9CLE9BQWlCO1FBQWpCLFlBQU8sR0FBUCxPQUFPLENBQVU7SUFBSSxDQUFDO0lBRTFDLEdBQUcsQ0FBQyxTQUFpQixFQUFFLElBQWM7UUFDcEMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDO2FBQzNDLElBQUksQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyw0QkFBNEIsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFMUUsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxLQUFLO1FBQ0osT0FBTztRQUNQLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzFCLENBQUM7Q0FDRCJ9