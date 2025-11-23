/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isHotReloadEnabled, registerHotReloadHandler } from './hotReload.js';
import { constObservable, observableSignalFromEvent, observableValue } from './observable.js';
export function readHotReloadableExport(value, reader) {
    observeHotReloadableExports([value], reader);
    return value;
}
export function observeHotReloadableExports(values, reader) {
    if (isHotReloadEnabled()) {
        const o = observableSignalFromEvent('reload', event => registerHotReloadHandler(({ oldExports }) => {
            if (![...Object.values(oldExports)].some(v => values.includes(v))) {
                return undefined;
            }
            return (_newExports) => {
                event(undefined);
                return true;
            };
        }));
        o.read(reader);
    }
}
const classes = new Map();
export function createHotClass(clazz) {
    if (!isHotReloadEnabled()) {
        return constObservable(clazz);
    }
    // eslint-disable-next-line local/code-no-any-casts
    const id = clazz.name;
    let existing = classes.get(id);
    if (!existing) {
        existing = observableValue(id, clazz);
        classes.set(id, existing);
    }
    else {
        setTimeout(() => {
            existing.set(clazz, undefined);
        }, 0);
    }
    return existing;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG90UmVsb2FkSGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi9ob3RSZWxvYWRIZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSx3QkFBd0IsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQzlFLE9BQU8sRUFBRSxlQUFlLEVBQTZDLHlCQUF5QixFQUFFLGVBQWUsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBRXpJLE1BQU0sVUFBVSx1QkFBdUIsQ0FBSSxLQUFRLEVBQUUsTUFBMkI7SUFDL0UsMkJBQTJCLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM3QyxPQUFPLEtBQUssQ0FBQztBQUNkLENBQUM7QUFFRCxNQUFNLFVBQVUsMkJBQTJCLENBQUMsTUFBYSxFQUFFLE1BQTJCO0lBQ3JGLElBQUksa0JBQWtCLEVBQUUsRUFBRSxDQUFDO1FBQzFCLE1BQU0sQ0FBQyxHQUFHLHlCQUF5QixDQUNsQyxRQUFRLEVBQ1IsS0FBSyxDQUFDLEVBQUUsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFLEVBQUUsRUFBRTtZQUNwRCxJQUFJLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDbkUsT0FBTyxTQUFTLENBQUM7WUFDbEIsQ0FBQztZQUNELE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRTtnQkFDdEIsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNqQixPQUFPLElBQUksQ0FBQztZQUNiLENBQUMsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUNGLENBQUM7UUFDRixDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ2hCLENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSxPQUFPLEdBQUcsSUFBSSxHQUFHLEVBQXdDLENBQUM7QUFFaEUsTUFBTSxVQUFVLGNBQWMsQ0FBSSxLQUFRO0lBQ3pDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7UUFDM0IsT0FBTyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELG1EQUFtRDtJQUNuRCxNQUFNLEVBQUUsR0FBSSxLQUFhLENBQUMsSUFBSSxDQUFDO0lBRS9CLElBQUksUUFBUSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0IsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ2YsUUFBUSxHQUFHLGVBQWUsQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDdEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDM0IsQ0FBQztTQUFNLENBQUM7UUFDUCxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ2YsUUFBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDakMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUNELE9BQU8sUUFBMEIsQ0FBQztBQUNuQyxDQUFDIn0=