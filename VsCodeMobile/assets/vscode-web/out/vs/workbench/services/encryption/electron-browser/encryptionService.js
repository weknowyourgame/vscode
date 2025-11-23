/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { registerMainProcessRemoteService } from '../../../../platform/ipc/electron-browser/services.js';
import { IEncryptionService } from '../../../../platform/encryption/common/encryptionService.js';
registerMainProcessRemoteService(IEncryptionService, 'encryption');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW5jcnlwdGlvblNlcnZpY2UuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL2VuY3J5cHRpb24vZWxlY3Ryb24tYnJvd3Nlci9lbmNyeXB0aW9uU2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsZ0NBQWdDLEVBQUUsTUFBTSx1REFBdUQsQ0FBQztBQUN6RyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2REFBNkQsQ0FBQztBQUVqRyxnQ0FBZ0MsQ0FBQyxrQkFBa0IsRUFBRSxZQUFZLENBQUMsQ0FBQyJ9