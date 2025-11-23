/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export class StaticServiceAccessor {
    constructor() {
        this.services = new Map();
    }
    withService(id, service) {
        this.services.set(id, service);
        return this;
    }
    get(id) {
        const value = this.services.get(id);
        if (!value) {
            throw new Error('Service does not exist');
        }
        return value;
    }
    getIfExists(id) {
        const value = this.services.get(id);
        return value;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL2NvbnRyaWIvd29yZFBhcnRPcGVyYXRpb25zL3Rlc3QvYnJvd3Nlci91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUloRyxNQUFNLE9BQU8scUJBQXFCO0lBQWxDO1FBQ1MsYUFBUSxHQUFHLElBQUksR0FBRyxFQUF1QyxDQUFDO0lBbUJuRSxDQUFDO0lBakJPLFdBQVcsQ0FBSSxFQUF3QixFQUFFLE9BQVU7UUFDekQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQy9CLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVNLEdBQUcsQ0FBSSxFQUF3QjtRQUNyQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDWixNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUNELE9BQU8sS0FBVSxDQUFDO0lBQ25CLENBQUM7SUFFRCxXQUFXLENBQUksRUFBd0I7UUFDdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDcEMsT0FBTyxLQUFzQixDQUFDO0lBQy9CLENBQUM7Q0FDRCJ9