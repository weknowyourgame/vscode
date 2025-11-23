/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import product from '../../../product/common/product.js';
import { RemoteAuthorityResolverError, RemoteAuthorityResolverErrorCode } from '../../common/remoteAuthorityResolver.js';
import { RemoteAuthorityResolverService } from '../../electron-browser/remoteAuthorityResolverService.js';
suite('RemoteAuthorityResolverService', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    test('issue #147318: RemoteAuthorityResolverError keeps the same type', async () => {
        const productService = { _serviceBrand: undefined, ...product };
        // eslint-disable-next-line local/code-no-any-casts
        const service = new RemoteAuthorityResolverService(productService, undefined);
        const result = service.resolveAuthority('test+x');
        service._setResolvedAuthorityError('test+x', new RemoteAuthorityResolverError('something', RemoteAuthorityResolverErrorCode.TemporarilyNotAvailable));
        try {
            await result;
            assert.fail();
        }
        catch (err) {
            assert.strictEqual(RemoteAuthorityResolverError.isTemporarilyNotAvailable(err), true);
        }
        service.dispose();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXJTZXJ2aWNlLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vcmVtb3RlL3Rlc3QvZWxlY3Ryb24tYnJvd3Nlci9yZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDNUIsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDaEcsT0FBTyxPQUFPLE1BQU0sb0NBQW9DLENBQUM7QUFFekQsT0FBTyxFQUFFLDRCQUE0QixFQUFFLGdDQUFnQyxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDekgsT0FBTyxFQUFFLDhCQUE4QixFQUFFLE1BQU0sMERBQTBELENBQUM7QUFFMUcsS0FBSyxDQUFDLGdDQUFnQyxFQUFFLEdBQUcsRUFBRTtJQUU1Qyx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQyxpRUFBaUUsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNsRixNQUFNLGNBQWMsR0FBb0IsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUM7UUFDakYsbURBQW1EO1FBQ25ELE1BQU0sT0FBTyxHQUFHLElBQUksOEJBQThCLENBQUMsY0FBYyxFQUFFLFNBQWdCLENBQUMsQ0FBQztRQUNyRixNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEQsT0FBTyxDQUFDLDBCQUEwQixDQUFDLFFBQVEsRUFBRSxJQUFJLDRCQUE0QixDQUFDLFdBQVcsRUFBRSxnQ0FBZ0MsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUM7UUFDdEosSUFBSSxDQUFDO1lBQ0osTUFBTSxNQUFNLENBQUM7WUFDYixNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDZixDQUFDO1FBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNkLE1BQU0sQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUMseUJBQXlCLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdkYsQ0FBQztRQUNELE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNuQixDQUFDLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIn0=