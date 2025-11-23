/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ITreeSitterLibraryService } from '../../../../editor/common/services/treeSitter/treeSitterLibraryService.js';
import { ITreeSitterThemeService } from '../../../../editor/common/services/treeSitter/treeSitterThemeService.js';
import { registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { TreeSitterLibraryService } from './treeSitterLibraryService.js';
import { TreeSitterThemeService } from './treeSitterThemeService.js';
registerSingleton(ITreeSitterLibraryService, TreeSitterLibraryService, 0 /* InstantiationType.Eager */);
registerSingleton(ITreeSitterThemeService, TreeSitterThemeService, 0 /* InstantiationType.Eager */);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJlZVNpdHRlci5jb250cmlidXRpb24uanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3NlcnZpY2VzL3RyZWVTaXR0ZXIvYnJvd3Nlci90cmVlU2l0dGVyLmNvbnRyaWJ1dGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsTUFBTSwyRUFBMkUsQ0FBQztBQUN0SCxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsTUFBTSx5RUFBeUUsQ0FBQztBQUNsSCxPQUFPLEVBQXFCLGlCQUFpQixFQUFFLE1BQU0seURBQXlELENBQUM7QUFDL0csT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0JBQStCLENBQUM7QUFDekUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNkJBQTZCLENBQUM7QUFFckUsaUJBQWlCLENBQUMseUJBQXlCLEVBQUUsd0JBQXdCLGtDQUEwQixDQUFDO0FBQ2hHLGlCQUFpQixDQUFDLHVCQUF1QixFQUFFLHNCQUFzQixrQ0FBMEIsQ0FBQyJ9