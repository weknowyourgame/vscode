/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Disposable } from '../../../../base/common/lifecycle.js';
export const NullHoverService = {
    _serviceBrand: undefined,
    hideHover: () => undefined,
    showInstantHover: () => undefined,
    showDelayedHover: () => undefined,
    setupDelayedHover: () => Disposable.None,
    setupDelayedHoverAtMouse: () => Disposable.None,
    setupManagedHover: () => ({
        dispose: () => { },
        show: (focus) => { },
        hide: () => { },
        update: (tooltip, options) => { }
    }),
    showAndFocusLastHover: () => undefined,
    showManagedHover: () => undefined
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibnVsbEhvdmVyU2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9wbGF0Zm9ybS9ob3Zlci90ZXN0L2Jyb3dzZXIvbnVsbEhvdmVyU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFHbEUsTUFBTSxDQUFDLE1BQU0sZ0JBQWdCLEdBQWtCO0lBQzlDLGFBQWEsRUFBRSxTQUFTO0lBQ3hCLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO0lBQzFCLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUFDLFNBQVM7SUFDakMsZ0JBQWdCLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUztJQUNqQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSTtJQUN4Qyx3QkFBd0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsSUFBSTtJQUMvQyxpQkFBaUIsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3pCLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO1FBQ2xCLElBQUksRUFBRSxDQUFDLEtBQWUsRUFBRSxFQUFFLEdBQUcsQ0FBQztRQUM5QixJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztRQUNmLE1BQU0sRUFBRSxDQUFDLE9BQTZCLEVBQUUsT0FBOEIsRUFBRSxFQUFFLEdBQUcsQ0FBQztLQUM5RSxDQUFDO0lBQ0YscUJBQXFCLEVBQUUsR0FBRyxFQUFFLENBQUMsU0FBUztJQUN0QyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUUsQ0FBQyxTQUFTO0NBQ2pDLENBQUMifQ==