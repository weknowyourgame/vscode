/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Typings for the https://wicg.github.io/file-system-access
 *
 * Use `supported(window)` to find out if the browser supports this kind of API.
 */
export var WebFileSystemAccess;
(function (WebFileSystemAccess) {
    function supported(obj) {
        if (typeof obj?.showDirectoryPicker === 'function') {
            return true;
        }
        return false;
    }
    WebFileSystemAccess.supported = supported;
    function isFileSystemHandle(handle) {
        const candidate = handle;
        if (!candidate) {
            return false;
        }
        return typeof candidate.kind === 'string' && typeof candidate.queryPermission === 'function' && typeof candidate.requestPermission === 'function';
    }
    WebFileSystemAccess.isFileSystemHandle = isFileSystemHandle;
    function isFileSystemFileHandle(handle) {
        return handle.kind === 'file';
    }
    WebFileSystemAccess.isFileSystemFileHandle = isFileSystemFileHandle;
    function isFileSystemDirectoryHandle(handle) {
        return handle.kind === 'directory';
    }
    WebFileSystemAccess.isFileSystemDirectoryHandle = isFileSystemDirectoryHandle;
})(WebFileSystemAccess || (WebFileSystemAccess = {}));
export var WebFileSystemObserver;
(function (WebFileSystemObserver) {
    function supported(obj) {
        return typeof obj?.FileSystemObserver === 'function';
    }
    WebFileSystemObserver.supported = supported;
})(WebFileSystemObserver || (WebFileSystemObserver = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViRmlsZVN5c3RlbUFjY2Vzcy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9maWxlcy9icm93c2VyL3dlYkZpbGVTeXN0ZW1BY2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEc7Ozs7R0FJRztBQUNILE1BQU0sS0FBVyxtQkFBbUIsQ0EwQm5DO0FBMUJELFdBQWlCLG1CQUFtQjtJQUVuQyxTQUFnQixTQUFTLENBQUMsR0FBc0I7UUFDL0MsSUFBSSxPQUFRLEdBQTZELEVBQUUsbUJBQW1CLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDL0csT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZCxDQUFDO0lBTmUsNkJBQVMsWUFNeEIsQ0FBQTtJQUVELFNBQWdCLGtCQUFrQixDQUFDLE1BQWU7UUFDakQsTUFBTSxTQUFTLEdBQUcsTUFBc0MsQ0FBQztRQUN6RCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO1FBRUQsT0FBTyxPQUFPLFNBQVMsQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLE9BQU8sU0FBUyxDQUFDLGVBQWUsS0FBSyxVQUFVLElBQUksT0FBTyxTQUFTLENBQUMsaUJBQWlCLEtBQUssVUFBVSxDQUFDO0lBQ25KLENBQUM7SUFQZSxzQ0FBa0IscUJBT2pDLENBQUE7SUFFRCxTQUFnQixzQkFBc0IsQ0FBQyxNQUF3QjtRQUM5RCxPQUFPLE1BQU0sQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDO0lBQy9CLENBQUM7SUFGZSwwQ0FBc0IseUJBRXJDLENBQUE7SUFFRCxTQUFnQiwyQkFBMkIsQ0FBQyxNQUF3QjtRQUNuRSxPQUFPLE1BQU0sQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDO0lBQ3BDLENBQUM7SUFGZSwrQ0FBMkIsOEJBRTFDLENBQUE7QUFDRixDQUFDLEVBMUJnQixtQkFBbUIsS0FBbkIsbUJBQW1CLFFBMEJuQztBQUVELE1BQU0sS0FBVyxxQkFBcUIsQ0FLckM7QUFMRCxXQUFpQixxQkFBcUI7SUFFckMsU0FBZ0IsU0FBUyxDQUFDLEdBQXNCO1FBQy9DLE9BQU8sT0FBUSxHQUE0RCxFQUFFLGtCQUFrQixLQUFLLFVBQVUsQ0FBQztJQUNoSCxDQUFDO0lBRmUsK0JBQVMsWUFFeEIsQ0FBQTtBQUNGLENBQUMsRUFMZ0IscUJBQXFCLEtBQXJCLHFCQUFxQixRQUtyQyJ9