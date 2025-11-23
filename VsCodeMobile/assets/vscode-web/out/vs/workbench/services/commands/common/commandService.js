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
import { notCancellablePromise, raceCancellablePromises, timeout } from '../../../../base/common/async.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IExtensionService } from '../../extensions/common/extensions.js';
let CommandService = class CommandService extends Disposable {
    constructor(_instantiationService, _extensionService, _logService) {
        super();
        this._instantiationService = _instantiationService;
        this._extensionService = _extensionService;
        this._logService = _logService;
        this._extensionHostIsReady = false;
        this._onWillExecuteCommand = this._register(new Emitter());
        this.onWillExecuteCommand = this._onWillExecuteCommand.event;
        this._onDidExecuteCommand = new Emitter();
        this.onDidExecuteCommand = this._onDidExecuteCommand.event;
        this._extensionService.whenInstalledExtensionsRegistered().then(value => this._extensionHostIsReady = value);
        this._starActivation = null;
    }
    _activateStar() {
        if (!this._starActivation) {
            // wait for * activation, limited to at most 30s.
            this._starActivation = raceCancellablePromises([
                this._extensionService.activateByEvent(`*`),
                timeout(30000)
            ]);
        }
        // This is wrapped with notCancellablePromise so it doesn't get cancelled
        // early because it is shared between consumers.
        return notCancellablePromise(this._starActivation);
    }
    async executeCommand(id, ...args) {
        this._logService.trace('CommandService#executeCommand', id);
        const activationEvent = `onCommand:${id}`;
        const commandIsRegistered = !!CommandsRegistry.getCommand(id);
        if (commandIsRegistered) {
            // if the activation event has already resolved (i.e. subsequent call),
            // we will execute the registered command immediately
            if (this._extensionService.activationEventIsDone(activationEvent)) {
                return this._tryExecuteCommand(id, args);
            }
            // if the extension host didn't start yet, we will execute the registered
            // command immediately and send an activation event, but not wait for it
            if (!this._extensionHostIsReady) {
                this._extensionService.activateByEvent(activationEvent); // intentionally not awaited
                return this._tryExecuteCommand(id, args);
            }
            // we will wait for a simple activation event (e.g. in case an extension wants to overwrite it)
            await this._extensionService.activateByEvent(activationEvent);
            return this._tryExecuteCommand(id, args);
        }
        // finally, if the command is not registered we will send a simple activation event
        // as well as a * activation event raced against registration and against 30s
        await Promise.all([
            this._extensionService.activateByEvent(activationEvent),
            raceCancellablePromises([
                // race * activation against command registration
                this._activateStar(),
                Event.toPromise(Event.filter(CommandsRegistry.onDidRegisterCommand, e => e === id))
            ]),
        ]);
        return this._tryExecuteCommand(id, args);
    }
    _tryExecuteCommand(id, args) {
        const command = CommandsRegistry.getCommand(id);
        if (!command) {
            return Promise.reject(new Error(`command '${id}' not found`));
        }
        try {
            this._onWillExecuteCommand.fire({ commandId: id, args });
            const result = this._instantiationService.invokeFunction(command.handler, ...args);
            this._onDidExecuteCommand.fire({ commandId: id, args });
            return Promise.resolve(result);
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    dispose() {
        super.dispose();
        this._starActivation?.cancel();
    }
};
CommandService = __decorate([
    __param(0, IInstantiationService),
    __param(1, IExtensionService),
    __param(2, ILogService)
], CommandService);
export { CommandService };
registerSingleton(ICommandService, CommandService, 1 /* InstantiationType.Delayed */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWFuZFNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7OztBQUVoRyxPQUFPLEVBQXFCLHFCQUFxQixFQUFFLHVCQUF1QixFQUFFLE9BQU8sRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzlILE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDbEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSxnQkFBZ0IsRUFBaUIsZUFBZSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDcEgsT0FBTyxFQUFxQixpQkFBaUIsRUFBRSxNQUFNLHlEQUF5RCxDQUFDO0FBQy9HLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ25HLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUNyRSxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQztBQUVuRSxJQUFNLGNBQWMsR0FBcEIsTUFBTSxjQUFlLFNBQVEsVUFBVTtJQWE3QyxZQUN3QixxQkFBNkQsRUFDakUsaUJBQXFELEVBQzNELFdBQXlDO1FBRXRELEtBQUssRUFBRSxDQUFDO1FBSmdDLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7UUFDaEQsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFtQjtRQUMxQyxnQkFBVyxHQUFYLFdBQVcsQ0FBYTtRQVovQywwQkFBcUIsR0FBWSxLQUFLLENBQUM7UUFHOUIsMEJBQXFCLEdBQTJCLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxPQUFPLEVBQWlCLENBQUMsQ0FBQztRQUM5Rix5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