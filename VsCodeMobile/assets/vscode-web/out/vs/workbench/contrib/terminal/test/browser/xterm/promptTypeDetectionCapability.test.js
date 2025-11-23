/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { strictEqual } from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { PromptTypeDetectionCapability } from '../../../../../../platform/terminal/common/capabilities/promptTypeDetectionCapability.js';
suite('PromptTypeDetectionCapability', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    test('should have correct capability type', () => {
        const capability = store.add(new PromptTypeDetectionCapability());
        strictEqual(capability.type, 6 /* TerminalCapability.PromptTypeDetection */);
    });
    test('should initialize with undefined prompt type', () => {
        const capability = store.add(new PromptTypeDetectionCapability());
        strictEqual(capability.promptType, undefined);
    });
    test('should set and get prompt type', () => {
        const capability = store.add(new PromptTypeDetectionCapability());
        capability.setPromptType('p10k');
        strictEqual(capability.promptType, 'p10k');
        capability.setPromptType('posh-git');
        strictEqual(capability.promptType, 'posh-git');
    });
    test('should fire event when prompt type changes', () => {
        const capability = store.add(new PromptTypeDetectionCapability());
        let eventFiredCount = 0;
        let lastEventValue;
        const disposable = capability.onPromptTypeChanged(value => {
            eventFiredCount++;
            lastEventValue = value;
        });
        store.add(disposable);
        capability.setPromptType('starship');
        strictEqual(eventFiredCount, 1);
        strictEqual(lastEventValue, 'starship');
        capability.setPromptType('oh-my-zsh');
        strictEqual(eventFiredCount, 2);
        strictEqual(lastEventValue, 'oh-my-zsh');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0VHlwZURldGVjdGlvbkNhcGFiaWxpdHkudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2Jyb3dzZXIveHRlcm0vcHJvbXB0VHlwZURldGVjdGlvbkNhcGFiaWxpdHkudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3JDLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQ3RHLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLDBGQUEwRixDQUFDO0FBR3pJLEtBQUssQ0FBQywrQkFBK0IsRUFBRSxHQUFHLEVBQUU7SUFDM0MsTUFBTSxLQUFLLEdBQUcsdUNBQXVDLEVBQUUsQ0FBQztJQUV4RCxJQUFJLENBQUMscUNBQXFDLEVBQUUsR0FBRyxFQUFFO1FBQ2hELE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSw2QkFBNkIsRUFBRSxDQUFDLENBQUM7UUFDbEUsV0FBVyxDQUFDLFVBQVUsQ0FBQyxJQUFJLGlEQUF5QyxDQUFDO0lBQ3RFLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDhDQUE4QyxFQUFFLEdBQUcsRUFBRTtRQUN6RCxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksNkJBQTZCLEVBQUUsQ0FBQyxDQUFDO1FBQ2xFLFdBQVcsQ0FBQyxVQUFVLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQy9DLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGdDQUFnQyxFQUFFLEdBQUcsRUFBRTtRQUMzQyxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksNkJBQTZCLEVBQUUsQ0FBQyxDQUFDO1FBRWxFLFVBQVUsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFFM0MsVUFBVSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNyQyxXQUFXLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNoRCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw0Q0FBNEMsRUFBRSxHQUFHLEVBQUU7UUFDdkQsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLDZCQUE2QixFQUFFLENBQUMsQ0FBQztRQUNsRSxJQUFJLGVBQWUsR0FBRyxDQUFDLENBQUM7UUFDeEIsSUFBSSxjQUFrQyxDQUFDO1FBRXZDLE1BQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN6RCxlQUFlLEVBQUUsQ0FBQztZQUNsQixjQUFjLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUFDO1FBQ0gsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUV0QixVQUFVLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JDLFdBQVcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEMsV0FBVyxDQUFDLGNBQWMsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUV4QyxVQUFVLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3RDLFdBQVcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEMsV0FBVyxDQUFDLGNBQWMsRUFBRSxXQUFXLENBQUMsQ0FBQztJQUMxQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=