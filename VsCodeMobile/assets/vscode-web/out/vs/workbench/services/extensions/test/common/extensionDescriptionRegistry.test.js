/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionIdentifier } from '../../../../../platform/extensions/common/extensions.js';
import { ExtensionDescriptionRegistry } from '../../common/extensionDescriptionRegistry.js';
suite('ExtensionDescriptionRegistry', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('allow removing and adding the same extension at a different version', () => {
        const idA = new ExtensionIdentifier('a');
        const extensionA1 = desc(idA, '1.0.0');
        const extensionA2 = desc(idA, '2.0.0');
        const basicActivationEventsReader = {
            readActivationEvents: (extensionDescription) => {
                return extensionDescription.activationEvents?.slice() ?? [];
            }
        };
        const registry = new ExtensionDescriptionRegistry(basicActivationEventsReader, [extensionA1]);
        registry.deltaExtensions([extensionA2], [idA]);
        assert.deepStrictEqual(registry.getAllExtensionDescriptions(), [extensionA2]);
        registry.dispose();
    });
    function desc(id, version, activationEvents = ['*']) {
        return {
            name: id.value,
            publisher: 'test',
            version: '0.0.0',
            engines: { vscode: '^1.0.0' },
            identifier: id,
            extensionLocation: URI.parse(`nothing://nowhere`),
            isBuiltin: false,
            isUnderDevelopment: false,
            isUserBuiltin: false,
            activationEvents,
            main: 'index.js',
            targetPlatform: "undefined" /* TargetPlatform.UNDEFINED */,
            extensionDependencies: [],
            enabledApiProposals: undefined,
            preRelease: false,
        };
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeS50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9leHRlbnNpb25zL3Rlc3QvY29tbW9uL2V4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3hELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxtQkFBbUIsRUFBeUMsTUFBTSx5REFBeUQsQ0FBQztBQUNySSxPQUFPLEVBQUUsNEJBQTRCLEVBQTJCLE1BQU0sOENBQThDLENBQUM7QUFFckgsS0FBSyxDQUFDLDhCQUE4QixFQUFFLEdBQUcsRUFBRTtJQUUxQyx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQyxxRUFBcUUsRUFBRSxHQUFHLEVBQUU7UUFDaEYsTUFBTSxHQUFHLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN6QyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFdkMsTUFBTSwyQkFBMkIsR0FBNEI7WUFDNUQsb0JBQW9CLEVBQUUsQ0FBQyxvQkFBMkMsRUFBWSxFQUFFO2dCQUMvRSxPQUFPLG9CQUFvQixDQUFDLGdCQUFnQixFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUM3RCxDQUFDO1NBQ0QsQ0FBQztRQUVGLE1BQU0sUUFBUSxHQUFHLElBQUksNEJBQTRCLENBQUMsMkJBQTJCLEVBQUUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1FBQzlGLFFBQVEsQ0FBQyxlQUFlLENBQUMsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFL0MsTUFBTSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsMkJBQTJCLEVBQUUsRUFBRSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFFOUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3BCLENBQUMsQ0FBQyxDQUFDO0lBRUgsU0FBUyxJQUFJLENBQUMsRUFBdUIsRUFBRSxPQUFlLEVBQUUsbUJBQTZCLENBQUMsR0FBRyxDQUFDO1FBQ3pGLE9BQU87WUFDTixJQUFJLEVBQUUsRUFBRSxDQUFDLEtBQUs7WUFDZCxTQUFTLEVBQUUsTUFBTTtZQUNqQixPQUFPLEVBQUUsT0FBTztZQUNoQixPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO1lBQzdCLFVBQVUsRUFBRSxFQUFFO1lBQ2QsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQztZQUNqRCxTQUFTLEVBQUUsS0FBSztZQUNoQixrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLGFBQWEsRUFBRSxLQUFLO1lBQ3BCLGdCQUFnQjtZQUNoQixJQUFJLEVBQUUsVUFBVTtZQUNoQixjQUFjLDRDQUEwQjtZQUN4QyxxQkFBcUIsRUFBRSxFQUFFO1lBQ3pCLG1CQUFtQixFQUFFLFNBQVM7WUFDOUIsVUFBVSxFQUFFLEtBQUs7U0FDakIsQ0FBQztJQUNILENBQUM7QUFDRixDQUFDLENBQUMsQ0FBQyJ9