/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from '../../../../../nls.js';
export const ScreenshotVariableId = 'screenshot-focused-window';
export function convertBufferToScreenshotVariable(buffer) {
    return {
        id: ScreenshotVariableId,
        name: localize('screenshot', 'Screenshot'),
        value: buffer.buffer,
        kind: 'image'
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NyZWVuc2hvdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY29udHJpYi9zY3JlZW5zaG90LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBR2hHLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUdqRCxNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRywyQkFBMkIsQ0FBQztBQUVoRSxNQUFNLFVBQVUsaUNBQWlDLENBQUMsTUFBZ0I7SUFDakUsT0FBTztRQUNOLEVBQUUsRUFBRSxvQkFBb0I7UUFDeEIsSUFBSSxFQUFFLFFBQVEsQ0FBQyxZQUFZLEVBQUUsWUFBWSxDQUFDO1FBQzFDLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTTtRQUNwQixJQUFJLEVBQUUsT0FBTztLQUNiLENBQUM7QUFDSCxDQUFDIn0=