/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { DebugNameData } from '../debugName.js';
import { strictEquals } from '../commonFacade/deps.js';
import { ObservableValue } from './observableValue.js';
import { LazyObservableValue } from './lazyObservableValue.js';
import { DebugLocation } from '../debugLocation.js';
export function observableValueOpts(options, initialValue, debugLocation = DebugLocation.ofCaller()) {
    if (options.lazy) {
        return new LazyObservableValue(new DebugNameData(options.owner, options.debugName, undefined), initialValue, options.equalsFn ?? strictEquals, debugLocation);
    }
    return new ObservableValue(new DebugNameData(options.owner, options.debugName, undefined), initialValue, options.equalsFn ?? strictEquals, debugLocation);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JzZXJ2YWJsZVZhbHVlT3B0cy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvb2JzZXJ2YWJsZXMvb2JzZXJ2YWJsZVZhbHVlT3B0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUdoRyxPQUFPLEVBQUUsYUFBYSxFQUFrQixNQUFNLGlCQUFpQixDQUFDO0FBQ2hFLE9BQU8sRUFBb0IsWUFBWSxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDekUsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQy9ELE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUVwRCxNQUFNLFVBQVUsbUJBQW1CLENBQ2xDLE9BR0MsRUFDRCxZQUFlLEVBQ2YsYUFBYSxHQUFHLGFBQWEsQ0FBQyxRQUFRLEVBQUU7SUFFeEMsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbEIsT0FBTyxJQUFJLG1CQUFtQixDQUM3QixJQUFJLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLEVBQzlELFlBQVksRUFDWixPQUFPLENBQUMsUUFBUSxJQUFJLFlBQVksRUFDaEMsYUFBYSxDQUNiLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxJQUFJLGVBQWUsQ0FDekIsSUFBSSxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsU0FBUyxFQUFFLFNBQVMsQ0FBQyxFQUM5RCxZQUFZLEVBQ1osT0FBTyxDQUFDLFFBQVEsSUFBSSxZQUFZLEVBQ2hDLGFBQWEsQ0FDYixDQUFDO0FBQ0gsQ0FBQyJ9