/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { StringEdit, StringReplacement } from '../edits/stringEdit.js';
import { TextEdit, TextReplacement } from '../edits/textEdit.js';
import { _setPositionOffsetTransformerDependencies } from './positionToOffsetImpl.js';
import { TextLength } from './textLength.js';
export { PositionOffsetTransformerBase, PositionOffsetTransformer } from './positionToOffsetImpl.js';
_setPositionOffsetTransformerDependencies({
    StringEdit: StringEdit,
    StringReplacement: StringReplacement,
    TextReplacement: TextReplacement,
    TextEdit: TextEdit,
    TextLength: TextLength,
});
// TODO@hediet this is dept and needs to go. See https://github.com/microsoft/vscode/issues/251126.
export function ensureDependenciesAreSet() {
    // Noop
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zaXRpb25Ub09mZnNldC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9lZGl0b3IvY29tbW9uL2NvcmUvdGV4dC9wb3NpdGlvblRvT2Zmc2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxVQUFVLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RSxPQUFPLEVBQUUsUUFBUSxFQUFFLGVBQWUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ2pFLE9BQU8sRUFBRSx5Q0FBeUMsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ3RGLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUU3QyxPQUFPLEVBQUUsNkJBQTZCLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQztBQUVyRyx5Q0FBeUMsQ0FBQztJQUN6QyxVQUFVLEVBQUUsVUFBVTtJQUN0QixpQkFBaUIsRUFBRSxpQkFBaUI7SUFDcEMsZUFBZSxFQUFFLGVBQWU7SUFDaEMsUUFBUSxFQUFFLFFBQVE7SUFDbEIsVUFBVSxFQUFFLFVBQVU7Q0FDdEIsQ0FBQyxDQUFDO0FBRUgsbUdBQW1HO0FBQ25HLE1BQU0sVUFBVSx3QkFBd0I7SUFDdkMsT0FBTztBQUNSLENBQUMifQ==