/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
class UserActivityRegistry {
    constructor() {
        this.todo = [];
        this.add = (ctor) => {
            this.todo.push(ctor);
        };
    }
    take(userActivityService, instantiation) {
        this.add = ctor => instantiation.createInstance(ctor, userActivityService);
        this.todo.forEach(this.add);
        this.todo = [];
    }
}
export const userActivityRegistry = new UserActivityRegistry();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlckFjdGl2aXR5UmVnaXN0cnkuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3VzZXJBY3Rpdml0eS9jb21tb24vdXNlckFjdGl2aXR5UmVnaXN0cnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFLaEcsTUFBTSxvQkFBb0I7SUFBMUI7UUFDUyxTQUFJLEdBQW9FLEVBQUUsQ0FBQztRQUU1RSxRQUFHLEdBQUcsQ0FBQyxJQUFtRSxFQUFFLEVBQUU7WUFDcEYsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDdEIsQ0FBQyxDQUFDO0lBT0gsQ0FBQztJQUxPLElBQUksQ0FBQyxtQkFBeUMsRUFBRSxhQUFvQztRQUMxRixJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUMzRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDNUIsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7SUFDaEIsQ0FBQztDQUNEO0FBRUQsTUFBTSxDQUFDLE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxvQkFBb0IsRUFBRSxDQUFDIn0=