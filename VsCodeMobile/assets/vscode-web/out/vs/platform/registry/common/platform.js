/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as Assert from '../../../base/common/assert.js';
import * as Types from '../../../base/common/types.js';
class RegistryImpl {
    constructor() {
        this.data = new Map();
    }
    add(id, data) {
        Assert.ok(Types.isString(id));
        Assert.ok(Types.isObject(data));
        Assert.ok(!this.data.has(id), 'There is already an extension with this id');
        this.data.set(id, data);
    }
    knows(id) {
        return this.data.has(id);
    }
    as(id) {
        return this.data.get(id) || null;
    }
    dispose() {
        this.data.forEach((value) => {
            if (Types.isFunction(value.dispose)) {
                value.dispose();
            }
        });
        this.data.clear();
    }
}
export const Registry = new RegistryImpl();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhdGZvcm0uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sS0FBSyxNQUFNLE1BQU0sZ0NBQWdDLENBQUM7QUFDekQsT0FBTyxLQUFLLEtBQUssTUFBTSwrQkFBK0IsQ0FBQztBQXlCdkQsTUFBTSxZQUFZO0lBQWxCO1FBRWtCLFNBQUksR0FBRyxJQUFJLEdBQUcsRUFBZSxDQUFDO0lBMkJoRCxDQUFDO0lBekJPLEdBQUcsQ0FBQyxFQUFVLEVBQUUsSUFBUztRQUMvQixNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5QixNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNoQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsNENBQTRDLENBQUMsQ0FBQztRQUU1RSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUVNLEtBQUssQ0FBQyxFQUFVO1FBQ3RCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVNLEVBQUUsQ0FBQyxFQUFVO1FBQ25CLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksSUFBSSxDQUFDO0lBQ2xDLENBQUM7SUFFTSxPQUFPO1FBQ2IsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUMzQixJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ3JDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqQixDQUFDO1FBQ0YsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ25CLENBQUM7Q0FFRDtBQUVELE1BQU0sQ0FBQyxNQUFNLFFBQVEsR0FBYyxJQUFJLFlBQVksRUFBRSxDQUFDIn0=