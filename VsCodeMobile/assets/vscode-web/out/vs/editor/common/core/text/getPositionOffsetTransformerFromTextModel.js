/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PositionOffsetTransformerBase } from './positionToOffset.js';
export function getPositionOffsetTransformerFromTextModel(textModel) {
    return new PositionOffsetTransformerWithTextModel(textModel);
}
class PositionOffsetTransformerWithTextModel extends PositionOffsetTransformerBase {
    constructor(_textModel) {
        super();
        this._textModel = _textModel;
    }
    getOffset(position) {
        return this._textModel.getOffsetAt(position);
    }
    getPosition(offset) {
        return this._textModel.getPositionAt(offset);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UG9zaXRpb25PZmZzZXRUcmFuc2Zvcm1lckZyb21UZXh0TW9kZWwuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbW1vbi9jb3JlL3RleHQvZ2V0UG9zaXRpb25PZmZzZXRUcmFuc2Zvcm1lckZyb21UZXh0TW9kZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFJaEcsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFFdEUsTUFBTSxVQUFVLHlDQUF5QyxDQUFDLFNBQXFCO0lBQzlFLE9BQU8sSUFBSSxzQ0FBc0MsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUM5RCxDQUFDO0FBRUQsTUFBTSxzQ0FBdUMsU0FBUSw2QkFBNkI7SUFDakYsWUFBNkIsVUFBc0I7UUFDbEQsS0FBSyxFQUFFLENBQUM7UUFEb0IsZUFBVSxHQUFWLFVBQVUsQ0FBWTtJQUVuRCxDQUFDO0lBRVEsU0FBUyxDQUFDLFFBQWtCO1FBQ3BDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVRLFdBQVcsQ0FBQyxNQUFjO1FBQ2xDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDOUMsQ0FBQztDQUNEIn0=