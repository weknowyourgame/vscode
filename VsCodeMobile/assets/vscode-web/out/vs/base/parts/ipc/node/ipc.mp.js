/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isUtilityProcess } from '../../sandbox/node/electronTypes.js';
import { VSBuffer } from '../../../common/buffer.js';
import { IPCServer } from '../common/ipc.js';
import { Emitter, Event } from '../../../common/event.js';
import { assertType } from '../../../common/types.js';
/**
 * The MessagePort `Protocol` leverages MessagePortMain style IPC communication
 * for the implementation of the `IMessagePassingProtocol`.
 */
class Protocol {
    constructor(port) {
        this.port = port;
        this.onMessage = Event.fromNodeEventEmitter(this.port, 'message', (e) => {
            if (e.data) {
                return VSBuffer.wrap(e.data);
            }
            return VSBuffer.alloc(0);
        });
        // we must call start() to ensure messages are flowing
        port.start();
    }
    send(message) {
        this.port.postMessage(message.buffer);
    }
    disconnect() {
        this.port.close();
    }
}
/**
 * An implementation of a `IPCServer` on top of MessagePort style IPC communication.
 * The clients register themselves via Electron Utility Process IPC transfer.
 */
export class Server extends IPCServer {
    static getOnDidClientConnect(filter) {
        assertType(isUtilityProcess(process), 'Electron Utility Process');
        const onCreateMessageChannel = new Emitter();
        process.parentPort.on('message', (e) => {
            if (filter?.handledClientConnection(e)) {
                return;
            }
            const port = e.ports.at(0);
            if (port) {
                onCreateMessageChannel.fire(port);
            }
        });
        return Event.map(onCreateMessageChannel.event, port => {
            const protocol = new Protocol(port);
            const result = {
                protocol,
                // Not part of the standard spec, but in Electron we get a `close` event
                // when the other side closes. We can use this to detect disconnects
                // (https://github.com/electron/electron/blob/11-x-y/docs/api/message-port-main.md#event-close)
                onDidClientDisconnect: Event.fromNodeEventEmitter(port, 'close')
            };
            return result;
        });
    }
    constructor(filter) {
        super(Server.getOnDidClientConnect(filter));
    }
}
export function once(port, message, callback) {
    const listener = (e) => {
        if (e.data === message) {
            port.removeListener('message', listener);
            callback();
        }
    };
    port.on('message', listener);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXBjLm1wLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvcGFydHMvaXBjL25vZGUvaXBjLm1wLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBbUIsZ0JBQWdCLEVBQWdCLE1BQU0scUNBQXFDLENBQUM7QUFDdEcsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3JELE9BQU8sRUFBa0QsU0FBUyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDN0YsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUMxRCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFFdEQ7OztHQUdHO0FBQ0gsTUFBTSxRQUFRO0lBSWIsWUFBb0IsSUFBcUI7UUFBckIsU0FBSSxHQUFKLElBQUksQ0FBaUI7UUFDeEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsb0JBQW9CLENBQVcsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFlLEVBQUUsRUFBRTtZQUMvRixJQUFJLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDWixPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQWtCLENBQUMsQ0FBQztZQUM1QyxDQUFDO1lBQ0QsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzFCLENBQUMsQ0FBQyxDQUFDO1FBQ0gsc0RBQXNEO1FBQ3RELElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNkLENBQUM7SUFFRCxJQUFJLENBQUMsT0FBaUI7UUFDckIsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCxVQUFVO1FBQ1QsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNuQixDQUFDO0NBQ0Q7QUFlRDs7O0dBR0c7QUFDSCxNQUFNLE9BQU8sTUFBTyxTQUFRLFNBQVM7SUFFNUIsTUFBTSxDQUFDLHFCQUFxQixDQUFDLE1BQWdDO1FBQ3BFLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO1FBRWxFLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxPQUFPLEVBQW1CLENBQUM7UUFFOUQsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBZSxFQUFFLEVBQUU7WUFDcEQsSUFBSSxNQUFNLEVBQUUsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDeEMsT0FBTztZQUNSLENBQUM7WUFFRCxNQUFNLElBQUksR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQixJQUFJLElBQUksRUFBRSxDQUFDO2dCQUNWLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ3JELE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXBDLE1BQU0sTUFBTSxHQUEwQjtnQkFDckMsUUFBUTtnQkFDUix3RUFBd0U7Z0JBQ3hFLG9FQUFvRTtnQkFDcEUsK0ZBQStGO2dCQUMvRixxQkFBcUIsRUFBRSxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQzthQUNoRSxDQUFDO1lBRUYsT0FBTyxNQUFNLENBQUM7UUFDZixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxZQUFZLE1BQWdDO1FBQzNDLEtBQUssQ0FBQyxNQUFNLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUM3QyxDQUFDO0NBQ0Q7QUFPRCxNQUFNLFVBQVUsSUFBSSxDQUFDLElBQThCLEVBQUUsT0FBZ0IsRUFBRSxRQUFvQjtJQUMxRixNQUFNLFFBQVEsR0FBRyxDQUFDLENBQWUsRUFBRSxFQUFFO1FBQ3BDLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUN6QyxRQUFRLEVBQUUsQ0FBQztRQUNaLENBQUM7SUFDRixDQUFDLENBQUM7SUFFRixJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUM5QixDQUFDIn0=