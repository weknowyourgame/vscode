/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { assertSnapshot } from '../../../../../base/test/common/snapshot.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { ContextMenuService } from '../../../../../platform/contextview/browser/contextMenuService.js';
import { IContextMenuService } from '../../../../../platform/contextview/browser/contextView.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { SimpleSettingRenderer } from '../../../markdown/browser/markdownSettingRenderer.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { renderReleaseNotesMarkdown } from '../../browser/releaseNotesEditor.js';
import { URI } from '../../../../../base/common/uri.js';
import { Emitter } from '../../../../../base/common/event.js';
suite('Release notes renderer', () => {
    const store = ensureNoDisposablesAreLeakedInTestSuite();
    let instantiationService;
    let extensionService;
    let languageService;
    setup(() => {
        instantiationService = store.add(new TestInstantiationService());
        extensionService = instantiationService.get(IExtensionService);
        languageService = instantiationService.get(ILanguageService);
        instantiationService.stub(IContextMenuService, store.add(instantiationService.createInstance(ContextMenuService)));
    });
    test('Should render TOC', async () => {
        const content = `<table class="highlights-table">
	<tr>
		<th>a</th>
	</tr>
</table>

<br>

> text

<!-- TOC
<div class="toc-nav-layout">
	<nav id="toc-nav">
		<div>In this update</div>
		<ul>
			<li><a href="#chat">test</a></li>
		</ul>
	</nav>
	<div class="notes-main">
Navigation End -->

## Test`;
        const result = await renderReleaseNotesMarkdown(content, extensionService, languageService, instantiationService.createInstance(SimpleSettingRenderer));
        await assertSnapshot(result.toString());
    });
    test('Should render code settings', async () => {
        // Stub preferences service with a known setting so the SimpleSettingRenderer treats it as valid
        const testSettingId = 'editor.wordWrap';
        instantiationService.stub(IPreferencesService, {
            _serviceBrand: undefined,
            onDidDefaultSettingsContentChanged: new Emitter().event,
            userSettingsResource: URI.parse('test://test'),
            workspaceSettingsResource: null,
            getFolderSettingsResource: () => null,
            createPreferencesEditorModel: async () => null,
            getDefaultSettingsContent: () => undefined,
            hasDefaultSettingsContent: () => false,
            createSettings2EditorModel: () => { throw new Error('not needed'); },
            openPreferences: async () => undefined,
            openRawDefaultSettings: async () => undefined,
            openSettings: async () => undefined,
            openApplicationSettings: async () => undefined,
            openUserSettings: async () => undefined,
            openRemoteSettings: async () => undefined,
            openWorkspaceSettings: async () => undefined,
            openFolderSettings: async () => undefined,
            openGlobalKeybindingSettings: async () => undefined,
            openDefaultKeybindingsFile: async () => undefined,
            openLanguageSpecificSettings: async () => undefined,
            getEditableSettingsURI: async () => null,
            getSetting: (id) => {
                if (id === testSettingId) {
                    // Provide the minimal fields accessed by SimpleSettingRenderer
                    return {
                        key: testSettingId,
                        value: 'off',
                        type: 'string'
                    };
                }
                return undefined;
            },
            createSplitJsonEditorInput: () => { throw new Error('not needed'); }
        });
        const content = `Here is a setting: \`setting(${testSettingId}:on)\` and another \`setting(${testSettingId}:off)\``;
        const result = await renderReleaseNotesMarkdown(content, extensionService, languageService, instantiationService.createInstance(SimpleSettingRenderer));
        await assertSnapshot(result.toString());
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsZWFzZU5vdGVzUmVuZGVyZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi91cGRhdGUvdGVzdC9icm93c2VyL3JlbGVhc2VOb3Rlc1JlbmRlcmVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFDaEcsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLDZDQUE2QyxDQUFDO0FBQzdFLE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLDBDQUEwQyxDQUFDO0FBQ25HLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9EQUFvRCxDQUFDO0FBQ3RGLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLG1FQUFtRSxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDREQUE0RCxDQUFDO0FBQ2pHLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtFQUErRSxDQUFDO0FBQ3pILE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQ3pGLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHNEQUFzRCxDQUFDO0FBQzdGLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHdEQUF3RCxDQUFDO0FBQzdGLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQztBQUN4RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFHOUQsS0FBSyxDQUFDLHdCQUF3QixFQUFFLEdBQUcsRUFBRTtJQUNwQyxNQUFNLEtBQUssR0FBRyx1Q0FBdUMsRUFBRSxDQUFDO0lBRXhELElBQUksb0JBQThDLENBQUM7SUFDbkQsSUFBSSxnQkFBbUMsQ0FBQztJQUN4QyxJQUFJLGVBQWlDLENBQUM7SUFF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