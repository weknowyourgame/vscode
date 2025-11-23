/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../platform/configuration/test/common/testConfigurationService.js';
import { ResourceGlobMatcher } from '../../common/resources.js';
import { TestContextService } from './workbenchTestServices.js';
suite('ResourceGlobMatcher', () => {
    const SETTING = 'test.matcher';
    let contextService;
    let configurationService;
    const disposables = new DisposableStore();
    setup(() => {
        contextService = new TestContextService();
        configurationService = new TestConfigurationService({
            [SETTING]: {
                '**/*.md': true,
                '**/*.txt': false
            }
        });
    });
    teardown(() => {
        disposables.clear();
    });
    test('Basics', async () => {
        const matcher = disposables.add(new ResourceGlobMatcher(() => configurationService.getValue(SETTING), e => e.affectsConfiguration(SETTING), contextService, configurationService));
        // Matching
        assert.equal(matcher.matches(URI.file('/foo/bar')), false);
        assert.equal(matcher.matches(URI.file('/foo/bar.md')), true);
        assert.equal(matcher.matches(URI.file('/foo/bar.txt')), false);
        // Events
        let eventCounter = 0;
        disposables.add(matcher.onExpressionChange(() => eventCounter++));
        await configurationService.setUserConfiguration(SETTING, { '**/*.foo': true });
        // eslint-disable-next-line local/code-no-any-casts
        configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: (key) => key === SETTING });
        assert.equal(eventCounter, 1);
        assert.equal(matcher.matches(URI.file('/foo/bar.md')), false);
        assert.equal(matcher.matches(URI.file('/foo/bar.foo')), true);
        await configurationService.setUserConfiguration(SETTING, undefined);
        // eslint-disable-next-line local/code-no-any-casts
        configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: (key) => key === SETTING });
        assert.equal(eventCounter, 2);
        assert.equal(matcher.matches(URI.file('/foo/bar.md')), false);
        assert.equal(matcher.matches(URI.file('/foo/bar.foo')), false);
        await configurationService.setUserConfiguration(SETTING, {
            '**/*.md': true,
            '**/*.txt': false,
            'C:/bar/**': true,
            '/bar/**': true
        });
        // eslint-disable-next-line local/code-no-any-casts
        configurationService.onDidChangeConfigurationEmitter.fire({ affectsConfiguration: (key) => key === SETTING });
        assert.equal(matcher.matches(URI.file('/bar/foo.1')), true);
        assert.equal(matcher.matches(URI.file('C:/bar/foo.1')), true);
    });
    ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2VzLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL3Rlc3QvY29tbW9uL3Jlc291cmNlcy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sbUNBQW1DLENBQUM7QUFDcEUsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLDZCQUE2QixDQUFDO0FBQ2xELE9BQU8sRUFBRSx1Q0FBdUMsRUFBRSxNQUFNLG9DQUFvQyxDQUFDO0FBQzdGLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLHlFQUF5RSxDQUFDO0FBRW5ILE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDJCQUEyQixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBRWhFLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLEVBQUU7SUFFakMsTUFBTSxPQUFPLEdBQUcsY0FBYyxDQUFDO0lBRS9CLElBQUksY0FBd0MsQ0FBQztJQUM3QyxJQUFJLG9CQUE4QyxDQUFDO0lBRW5ELE1BQU0sV0FBVyxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7SUFFMUMsS0FBSyxDQUFDLEdBQUcsRUFBRTtRQUNWLGNBQWMsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFDMUMsb0JBQW9CLEdBQUcsSUFBSSx3QkFBd0IsQ0FBQztZQUNuRCxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNWLFNBQVMsRUFBRSxJQUFJO2dCQUNmLFVBQVUsRUFBRSxLQUFLO2FBQ2pCO1NBQ0QsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxRQUFRLENBQUMsR0FBRyxFQUFFO1FBQ2IsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3JC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