/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { Barrier, timeout } from '../../../../../base/common/async.js';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILanguageFeatureDebounceService, LanguageFeatureDebounceService } from '../../../../common/services/languageFeatureDebounce.js';
import { ILanguageFeaturesService } from '../../../../common/services/languageFeatures.js';
import { LanguageFeaturesService } from '../../../../common/services/languageFeaturesService.js';
import { LanguageService } from '../../../../common/services/languageService.js';
import { ISemanticTokensStylingService } from '../../../../common/services/semanticTokensStyling.js';
import { SemanticTokensStylingService } from '../../../../common/services/semanticTokensStylingService.js';
import { ViewportSemanticTokensContribution } from '../../browser/viewportSemanticTokens.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { ColorScheme } from '../../../../../platform/theme/common/theme.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { TestColorTheme, TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { createTextModel } from '../../../../test/common/testTextModel.js';
import { createTestCodeEditor } from '../../../../test/browser/testCodeEditor.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
suite('ViewportSemanticTokens', () => {
    const disposables = new DisposableStore();
    let languageService;
    let languageFeaturesService;
    let serviceCollection;
    setup(() => {
        const configService = new TestConfigurationService({ editor: { semanticHighlighting: true } });
        const themeService = new TestThemeService();
        themeService.setTheme(new TestColorTheme({}, ColorScheme.DARK, true));
        languageFeaturesService = new LanguageFeaturesService();
        languageService = disposables.add(new LanguageService(false));
        const logService = new NullLogService();
        const semanticTokensStylingService = new SemanticTokensStylingService(themeService, logService, languageService);
        const envService = new class extends mock() {
            constructor() {
                super(...arguments);
                this.isBuilt = true;
                this.isExtensionDevelopment = false;
            }
        };
        const languageFeatureDebounceService = new LanguageFeatureDebounceService(logService, envService);
        serviceCollection = new ServiceCollection([ILanguageFeaturesService, languageFeaturesService], [ILanguageFeatureDebounceService, languageFeatureDebounceService], [ISemanticTokensStylingService, semanticTokensStylingService], [IThemeService, themeService], [IConfigurationService, configService]);
    });
    teardown(() => {
        disposables.clear();
    });
    ensureNoDisposablesAreLeakedInTestSuite();
    test('DocumentRangeSemanticTokens provider onDidChange event should trigger refresh', async () => {
        await runWithFakedTimers({}, async () => {
            disposables.add(languageService.registerLanguage({ id: 'testMode' }));
            const inFirstCall = new Barrier();
            const inRefreshCall = new Barrier();
            const emitter = new Emitter();
            let requestCount = 0;
            disposables.add(languageFeaturesService.documentRangeSemanticTokensProvider.register('testMode', new class {
                constructor() {
                    this.onDidChange = emitter.event;
                }
                getLegend() {
                    return { tokenTypes: ['class'], tokenModifiers: [] };
                }
                async provideDocumentRangeSemanticTokens(model, range, token) {
                    requestCount++;
                    if (requestCount === 1) {
                        inFirstCall.open();
                    }
                    else if (requestCount === 2) {
                        inRefreshCall.open();
                    }
                    return {
                        data: new Uint32Array([0, 1, 1, 1, 1])
                    };
                }
            }));
            const textModel = disposables.add(createTextModel('Hello world', 'testMode'));
            const editor = disposables.add(createTestCodeEditor(textModel, { serviceCollection }));
            const instantiationService = new TestInstantiationService(serviceCollection);
            disposables.add(instantiationService.createInstance(ViewportSemanticTokensContribution, editor));
            textModel.onBeforeAttached();
            await inFirstCall.wait();
            assert.strictEqual(requestCount, 1, 'Initial request should have been made');
            // Make sure no other requests are made for a little while
            await timeout(1000);
            assert.strictEqual(requestCount, 1, 'No additional requests should have been made');
            // Fire the provider's onDidChange event
            emitter.fire();
            await inRefreshCall.wait();
            assert.strictEqual(requestCount, 2, 'Provider onDidChange should trigger a refresh of viewport semantic tokens');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlld3BvcnRTZW1hbnRpY1Rva2Vucy50ZXN0LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL3NlbWFudGljVG9rZW5zL3Rlc3QvYnJvd3Nlci92aWV3cG9ydFNlbWFudGljVG9rZW5zLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFDO0FBQzVCLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFFdkUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzlELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSx5Q0FBeUMsQ0FBQztBQUMxRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0seUNBQXlDLENBQUM7QUFDL0QsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDNUYsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFLbkcsT0FBTyxFQUFFLCtCQUErQixFQUFFLDhCQUE4QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDekksT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0saURBQWlELENBQUM7QUFDM0YsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sd0RBQXdELENBQUM7QUFDakcsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdEQUFnRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JHLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLDZEQUE2RCxDQUFDO0FBQzNHLE9BQU8sRUFBRSxrQ0FBa0MsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBQzdGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtEQUErRCxDQUFDO0FBQ3RHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBRXpILE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSwyQ0FBMkMsQ0FBQztBQUMzRSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sK0NBQStDLENBQUM7QUFDNUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3JGLE9BQU8sRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSwrREFBK0QsQ0FBQztBQUNqSCxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFDM0UsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDbEYsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sbUVBQW1FLENBQUM7QUFDdEcsT0FBTyxFQUFFLHdCQUF3QixFQUFFLE1BQU0sK0VBQStFLENBQUM7QUFFekgsS0FBSyxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtJQUVwQyxNQUFNLFdBQVcsR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO0lBQzFDLElBQUksZUFBaUMsQ0FBQztJQUN0QyxJQUFJLHVCQUFpRCxDQUFDO0lBQ3RELElBQUksaUJBQW9DLENBQUM7SUFFekMsS0FBSyxDQUFDLEdBQUcsRUFBRTtRQUNWLE1BQU0sYUFBYSxHQUFHLElBQUksd0JBQXdCLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSxvQkFBb0IsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDL0YsTUFBTSxZQUFZLEdBQUcsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO1FBQzVDLFlBQVksQ0FBQyxRQUFRLENBQUMsSUFBSSxjQUFjLENBQUMsRUFBRSxFQUFFLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN0RSx1QkFBdUIsR0FBRyxJQUFJLHVCQUF1QixFQUFFLENBQUM7UUFDeEQsZUFBZSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsSUFBSSxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUU5RCxNQUFNLFVBQVUsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ3hDLE1BQU0sNEJBQTRCLEdBQUcsSUFBSSw0QkFBNEIsQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ2pILE1BQU0sVUFBVSxHQUFHLElBQUksS0FBTSxTQUFRLElBQUksRUFBdUI7WUFBekM7O2dCQUNiLFlBQU8sR0FBWSxJQUFJLENBQUM7Z0JBQ3hCLDJCQUFzQixHQUFZLEtBQUssQ0FBQztZQUNsRCxDQUFDO1NBQUEsQ0FBQztRQUNGLE1BQU0sOEJBQThCLEdBQUcsSUFBSSw4QkFBOEIsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFFbEcsaUJBQWlCLEdBQUcsSUFBSSxpQkFBaUIsQ0FDeEMsQ0FBQyx3QkFBd0IsRUFBRSx1QkFBdUIsQ0FBQyxFQUNuRCxDQUFDLCtCQUErQixFQUFFLDhCQUE4QixDQUFDLEVBQ2pFLENBQUMsNkJBQTZCLEVBQUUsNEJBQTRCLENBQUMsRUFDN0QsQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLEVBQzdCLENBQUMscUJBQXFCLEVBQUUsYUFBYSxDQUFDLENBQ3RDLENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILFFBQVEsQ0FBQyxHQUFHLEVBQUU7UUFDYixXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDckIsQ0FBQyxDQUFDLENBQUM7SUFFSCx1Q0FBdUMsRUFBRSxDQUFDO0lBRTFDLElBQUksQ0FBQywrRUFBK0UsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNoRyxNQUFNLGtCQUFrQixDQUFDLEVBQUUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUV2QyxXQUFXLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFdEUsTUFBTSxXQUFXLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNsQyxNQUFNLGFBQWEsR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBRXBDLE1BQU0sT0FBTyxHQUFHLElBQUksT0FBTyxFQUFRLENBQUM7WUFDcEMsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQ3JCLFdBQVcsQ0FBQyxHQUFHLENBQUMsdUJBQXVCLENBQUMsbUNBQW1DLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRSxJQUFJO2dCQUFBO29CQUNwRyxnQkFBVyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUM7Z0JBZTdCLENBQUM7Z0JBZEEsU0FBUztvQkFDUixPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsY0FBYyxFQUFFLEVBQUUsRUFBRSxDQUFDO2dCQUN0RCxDQUFDO2dCQUNELEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxLQUFpQixFQUFFLEtBQVksRUFBRSxLQUF3QjtvQkFDakcsWUFBWSxFQUFFLENBQUM7b0JBQ2YsSUFBSSxZQUFZLEtBQUssQ0FBQyxFQUFFLENBQUM7d0JBQ3hCLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDcEIsQ0FBQzt5QkFBTSxJQUFJLFlBQVksS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDL0IsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUN0QixDQUFDO29CQUNELE9BQU87d0JBQ04sSUFBSSxFQUFFLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO3FCQUN0QyxDQUFDO2dCQUNILENBQUM7YUFDRCxDQUFDLENBQUMsQ0FBQztZQUVKLE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzlFLE1BQU0sTUFBTSxHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdkYsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLHdCQUF3QixDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDN0UsV0FBVyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsQ0FBQyxjQUFjLENBQUMsa0NBQWtDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUVqRyxTQUFTLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUU3QixNQUFNLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUV6QixNQUFNLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUUsdUNBQXVDLENBQUMsQ0FBQztZQUU3RSwwREFBMEQ7WUFDMUQsTUFBTSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxFQUFFLDhDQUE4QyxDQUFDLENBQUM7WUFFcEYsd0NBQXdDO1lBQ3hDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUVmLE1BQU0sYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDO1lBRTNCLE1BQU0sQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSwyRUFBMkUsQ0FBQyxDQUFDO1FBQ2xILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9