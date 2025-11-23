/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { generateUuid } from '../../../../base/common/uuid.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
export const IRandomService = createDecorator('randomService');
export class RandomService {
    generateUuid() {
        return generateUuid();
    }
    /** Namespace should be 3 letter. */
    generatePrefixedUuid(namespace) {
        return `${namespace}-${this.generateUuid()}`;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFuZG9tU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvcmFuZG9tU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBRTdGLE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBRyxlQUFlLENBQWlCLGVBQWUsQ0FBQyxDQUFDO0FBUy9FLE1BQU0sT0FBTyxhQUFhO0lBR3pCLFlBQVk7UUFDWCxPQUFPLFlBQVksRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxvQ0FBb0M7SUFDcEMsb0JBQW9CLENBQUMsU0FBaUI7UUFDckMsT0FBTyxHQUFHLFNBQVMsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQztJQUM5QyxDQUFDO0NBQ0QifQ==