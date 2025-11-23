/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { createManageTodoListToolData } from '../../../common/tools/manageTodoListTool.js';
suite('ManageTodoListTool Description Field Setting', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    function getSchemaProperties(toolData) {
        assert.ok(toolData.inputSchema);
        // eslint-disable-next-line local/code-no-any-casts
        const schema = toolData.inputSchema;
        const properties = schema?.properties?.todoList?.items?.properties;
        const required = schema?.properties?.todoList?.items?.required;
        assert.ok(properties, 'Schema properties should be defined');
        assert.ok(required, 'Schema required fields should be defined');
        return { properties, required };
    }
    test('createManageTodoListToolData should include description field when enabled', () => {
        const toolData = createManageTodoListToolData(false, true);
        const { properties, required } = getSchemaProperties(toolData);
        assert.strictEqual('description' in properties, true);
        assert.strictEqual(required.includes('description'), true);
        assert.deepStrictEqual(required, ['id', 'title', 'description', 'status']);
    });
    test('createManageTodoListToolData should exclude description field when disabled', () => {
        const toolData = createManageTodoListToolData(false, false);
        const { properties, required } = getSchemaProperties(toolData);
        assert.strictEqual('description' in properties, false);
        assert.strictEqual(required.includes('description'), false);
        assert.deepStrictEqual(required, ['id', 'title', 'status']);
    });
    test('createManageTodoListToolData should use default value for includeDescription', () => {
        const toolDataDefault = createManageTodoListToolData(false);
        const { properties, required } = getSchemaProperties(toolDataDefault);
        // Default should be true (includes description)
        assert.strictEqual('description' in properties, true);
        assert.strictEqual(required.includes('description'), true);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlVG9kb0xpc3RUb29sLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi90b29scy9tYW5hZ2VUb2RvTGlzdFRvb2wudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDdEcsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFHM0YsS0FBSyxDQUFDLDhDQUE4QyxFQUFFLEdBQUcsRUFBRTtJQUMxRCx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLFNBQVMsbUJBQW1CLENBQUMsUUFBbUI7UUFDL0MsTUFBTSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDaEMsbURBQW1EO1FBQ25ELE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxXQUFrQixDQUFDO1FBQzNDLE1BQU0sVUFBVSxHQUFHLE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxVQUFVLENBQUM7UUFDbkUsTUFBTSxRQUFRLEdBQUcsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsQ0FBQztRQUUvRCxNQUFNLENBQUMsRUFBRSxDQUFDLFVBQVUsRUFBRSxxQ0FBcUMsQ0FBQyxDQUFDO1FBQzdELE1BQU0sQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLDBDQUEwQyxDQUFDLENBQUM7UUFFaEUsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsQ0FBQztJQUNqQyxDQUFDO0lBRUQsSUFBSSxDQUFDLDRFQUE0RSxFQUFFLEdBQUcsRUFBRTtRQUN2RixNQUFNLFFBQVEsR0FBRyw0QkFBNEIsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDM0QsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsR0FBRyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUUvRCxNQUFNLENBQUMsV0FBVyxDQUFDLGFBQWEsSUFBSSxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzNELE1BQU0sQ0FBQyxlQUFlLENBQUMsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUM1RSxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw2RUFBNkUsRUFBRSxHQUFHLEVBQUU7UUFDeEYsTUFBTSxRQUFRLEdBQUcsNEJBQTRCLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVELE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUSxFQUFFLEdBQUcsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFL0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxhQUFhLElBQUksVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM1RCxNQUFNLENBQUMsZUFBZSxDQUFDLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUM3RCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyw4RUFBOEUsRUFBRSxHQUFHLEVBQUU7UUFDekYsTUFBTSxlQUFlLEdBQUcsNEJBQTRCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDNUQsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsR0FBRyxtQkFBbUIsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUV0RSxnREFBZ0Q7UUFDaEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxhQUFhLElBQUksVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM1RCxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=