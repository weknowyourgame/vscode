/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Event } from '../../../../../base/common/event.js';
import { ChatMode } from '../../common/chatModes.js';
export class MockChatModeService {
    constructor(_modes = { builtin: [ChatMode.Ask], custom: [] }) {
        this._modes = _modes;
        this.onDidChangeChatModes = Event.None;
    }
    getModes() {
        return this._modes;
    }
    findModeById(id) {
        return this._modes.builtin.find(mode => mode.id === id) ?? this._modes.custom.find(mode => mode.id === id);
    }
    findModeByName(name) {
        return this._modes.builtin.find(mode => mode.name.get() === name) ?? this._modes.custom.find(mode => mode.name.get() === name);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja0NoYXRNb2RlU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL21vY2tDaGF0TW9kZVNlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFHaEcsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSxRQUFRLEVBQStCLE1BQU0sMkJBQTJCLENBQUM7QUFFbEYsTUFBTSxPQUFPLG1CQUFtQjtJQUsvQixZQUNrQixTQUEwRSxFQUFFLE9BQU8sRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFO1FBQWpILFdBQU0sR0FBTixNQUFNLENBQTJHO1FBSG5ILHlCQUFvQixHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7SUFJOUMsQ0FBQztJQUVMLFFBQVE7UUFDUCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDcEIsQ0FBQztJQUVELFlBQVksQ0FBQyxFQUFVO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQzVHLENBQUM7SUFFRCxjQUFjLENBQUMsSUFBWTtRQUMxQixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQztJQUNoSSxDQUFDO0NBRUQifQ==