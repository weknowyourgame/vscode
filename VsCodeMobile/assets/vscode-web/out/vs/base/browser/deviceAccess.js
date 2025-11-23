/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export async function requestUsbDevice(options) {
    const usb = navigator.usb;
    if (!usb) {
        return undefined;
    }
    const device = await usb.requestDevice({ filters: options?.filters ?? [] });
    if (!device) {
        return undefined;
    }
    return {
        deviceClass: device.deviceClass,
        deviceProtocol: device.deviceProtocol,
        deviceSubclass: device.deviceSubclass,
        deviceVersionMajor: device.deviceVersionMajor,
        deviceVersionMinor: device.deviceVersionMinor,
        deviceVersionSubminor: device.deviceVersionSubminor,
        manufacturerName: device.manufacturerName,
        productId: device.productId,
        productName: device.productName,
        serialNumber: device.serialNumber,
        usbVersionMajor: device.usbVersionMajor,
        usbVersionMinor: device.usbVersionMinor,
        usbVersionSubminor: device.usbVersionSubminor,
        vendorId: device.vendorId,
    };
}
export async function requestSerialPort(options) {
    const serial = navigator.serial;
    if (!serial) {
        return undefined;
    }
    const port = await serial.requestPort({ filters: options?.filters ?? [] });
    if (!port) {
        return undefined;
    }
    const info = port.getInfo();
    return {
        usbVendorId: info.usbVendorId,
        usbProductId: info.usbProductId
    };
}
export async function requestHidDevice(options) {
    const hid = navigator.hid;
    if (!hid) {
        return undefined;
    }
    const devices = await hid.requestDevice({ filters: options?.filters ?? [] });
    if (!devices.length) {
        return undefined;
    }
    const device = devices[0];
    return {
        opened: device.opened,
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName,
        collections: device.collections
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlQWNjZXNzLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2Jhc2UvYnJvd3Nlci9kZXZpY2VBY2Nlc3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUEwQ2hHLE1BQU0sQ0FBQyxLQUFLLFVBQVUsZ0JBQWdCLENBQUMsT0FBaUM7SUFDdkUsTUFBTSxHQUFHLEdBQUksU0FBdUMsQ0FBQyxHQUFHLENBQUM7SUFDekQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ1YsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDNUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ2IsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELE9BQU87UUFDTixXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7UUFDL0IsY0FBYyxFQUFFLE1BQU0sQ0FBQyxjQUFjO1FBQ3JDLGNBQWMsRUFBRSxNQUFNLENBQUMsY0FBYztRQUNyQyxrQkFBa0IsRUFBRSxNQUFNLENBQUMsa0JBQWtCO1FBQzdDLGtCQUFrQixFQUFFLE1BQU0sQ0FBQyxrQkFBa0I7UUFDN0MscUJBQXFCLEVBQUUsTUFBTSxDQUFDLHFCQUFxQjtRQUNuRCxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsZ0JBQWdCO1FBQ3pDLFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUztRQUMzQixXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7UUFDL0IsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZO1FBQ2pDLGVBQWUsRUFBRSxNQUFNLENBQUMsZUFBZTtRQUN2QyxlQUFlLEVBQUUsTUFBTSxDQUFDLGVBQWU7UUFDdkMsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLGtCQUFrQjtRQUM3QyxRQUFRLEVBQUUsTUFBTSxDQUFDLFFBQVE7S0FDekIsQ0FBQztBQUNILENBQUM7QUFzQkQsTUFBTSxDQUFDLEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxPQUFpQztJQUN4RSxNQUFNLE1BQU0sR0FBSSxTQUE2QyxDQUFDLE1BQU0sQ0FBQztJQUNyRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDYixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDWCxPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzVCLE9BQU87UUFDTixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7UUFDN0IsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZO0tBQy9CLENBQUM7QUFDSCxDQUFDO0FBd0JELE1BQU0sQ0FBQyxLQUFLLFVBQVUsZ0JBQWdCLENBQUMsT0FBaUM7SUFDdkUsTUFBTSxHQUFHLEdBQUksU0FBdUMsQ0FBQyxHQUFHLENBQUM7SUFDekQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ1YsT0FBTyxTQUFTLENBQUM7SUFDbEIsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU0sR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDN0UsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNyQixPQUFPLFNBQVMsQ0FBQztJQUNsQixDQUFDO0lBRUQsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFCLE9BQU87UUFDTixNQUFNLEVBQUUsTUFBTSxDQUFDLE1BQU07UUFDckIsUUFBUSxFQUFFLE1BQU0sQ0FBQyxRQUFRO1FBQ3pCLFNBQVMsRUFBRSxNQUFNLENBQUMsU0FBUztRQUMzQixXQUFXLEVBQUUsTUFBTSxDQUFDLFdBQVc7UUFDL0IsV0FBVyxFQUFFLE1BQU0sQ0FBQyxXQUFXO0tBQy9CLENBQUM7QUFDSCxDQUFDIn0=