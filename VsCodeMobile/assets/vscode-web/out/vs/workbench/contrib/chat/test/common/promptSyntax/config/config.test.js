/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import assert from 'assert';
import { mockService } from '../utils/mock.js';
import { PromptsConfig } from '../../../../common/promptSyntax/config/config.js';
import { PromptsType } from '../../../../common/promptSyntax/promptTypes.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../../base/test/common/utils.js';
/**
 * Mocked instance of {@link IConfigurationService}.
 */
function createMock(value) {
    return mockService({
        getValue(key) {
            assert(typeof key === 'string', `Expected string configuration key, got '${typeof key}'.`);
            assert([PromptsConfig.PROMPT_LOCATIONS_KEY, PromptsConfig.INSTRUCTIONS_LOCATION_KEY, PromptsConfig.MODE_LOCATION_KEY].includes(key), `Unsupported configuration key '${key}'.`);
            return value;
        },
    });
}
suite('PromptsConfig', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('getLocationsValue', () => {
        test('undefined', () => {
            const configService = createMock(undefined);
            assert.strictEqual(PromptsConfig.getLocationsValue(configService, PromptsType.prompt), undefined, 'Must read correct value.');
        });
        test('null', () => {
            const configService = createMock(null);
            assert.strictEqual(PromptsConfig.getLocationsValue(configService, PromptsType.prompt), undefined, 'Must read correct value.');
        });
        suite('object', () => {
            test('empty', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({}), PromptsType.prompt), {}, 'Must read correct value.');
            });
            test('only valid strings', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({
                    '/root/.bashrc': true,
                    '../../folder/.hidden-folder/config.xml': true,
                    '/srv/www/Public_html/.htaccess': true,
                    '../../another.folder/.WEIRD_FILE.log': true,
                    './folder.name/file.name': true,
                    '/media/external/backup.tar.gz': true,
                    '/Media/external/.secret.backup': true,
                    '../relative/path.to.file': true,
                    './folderName.with.dots/more.dots.extension': true,
                    'some/folder.with.dots/another.file': true,
                    '/var/logs/app.01.05.error': true,
                    './.tempfile': true,
                }), PromptsType.prompt), {
                    '/root/.bashrc': true,
                    '../../folder/.hidden-folder/config.xml': true,
                    '/srv/www/Public_html/.htaccess': true,
                    '../../another.folder/.WEIRD_FILE.log': true,
                    './folder.name/file.name': true,
                    '/media/external/backup.tar.gz': true,
                    '/Media/external/.secret.backup': true,
                    '../relative/path.to.file': true,
                    './folderName.with.dots/more.dots.extension': true,
                    'some/folder.with.dots/another.file': true,
                    '/var/logs/app.01.05.error': true,
                    './.tempfile': true,
                }, 'Must read correct value.');
            });
            test('filters out non valid entries', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    '../../development/branch.name/some.test': true,
                    '/Home/user/.ssh/config': true,
                    './hidden.dir/.subhidden': '\f',
                    '/tmp/.temp.folder/cache.db': true,
                    '/opt/software/v3.2.1/build.log': '  ',
                    '': true,
                    './scripts/.old.build.sh': true,
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '\n\n': true,
                    '\t': true,
                    '\v': true,
                    '\f': true,
                    '\r\n': true,
                    '\f\f': true,
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': 1234,
                }), PromptsType.prompt), {
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '../../development/branch.name/some.test': true,
                    '/Home/user/.ssh/config': true,
                    '/tmp/.temp.folder/cache.db': true,
                    './scripts/.old.build.sh': true,
                }, 'Must read correct value.');
            });
            test('only invalid or false values', () => {
                assert.deepStrictEqual(PromptsConfig.getLocationsValue(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/IMG/logo.v2.png': '',
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    './hidden.dir/.subhidden': '\f',
                    '/opt/Software/v3.2.1/build.log': '  ',
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': 2345,
                }), PromptsType.prompt), {
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                }, 'Must read correct value.');
            });
        });
    });
    suite('sourceLocations', () => {
        test('undefined', () => {
            const configService = createMock(undefined);
            assert.deepStrictEqual(PromptsConfig.promptSourceFolders(configService, PromptsType.prompt), [], 'Must read correct value.');
        });
        test('null', () => {
            const configService = createMock(null);
            assert.deepStrictEqual(PromptsConfig.promptSourceFolders(configService, PromptsType.prompt), [], 'Must read correct value.');
        });
        suite('object', () => {
            test('empty', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({}), PromptsType.prompt), ['.github/prompts'], 'Must read correct value.');
            });
            test('only valid strings', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/root/.bashrc': true,
                    '../../folder/.hidden-folder/config.xml': true,
                    '/srv/www/Public_html/.htaccess': true,
                    '../../another.folder/.WEIRD_FILE.log': true,
                    './folder.name/file.name': true,
                    '/media/external/backup.tar.gz': true,
                    '/Media/external/.secret.backup': true,
                    '../relative/path.to.file': true,
                    './folderName.with.dots/more.dots.extension': true,
                    'some/folder.with.dots/another.file': true,
                    '/var/logs/app.01.05.error': true,
                    '.GitHub/prompts': true,
                    './.tempfile': true,
                }), PromptsType.prompt), [
                    '.github/prompts',
                    '/root/.bashrc',
                    '../../folder/.hidden-folder/config.xml',
                    '/srv/www/Public_html/.htaccess',
                    '../../another.folder/.WEIRD_FILE.log',
                    './folder.name/file.name',
                    '/media/external/backup.tar.gz',
                    '/Media/external/.secret.backup',
                    '../relative/path.to.file',
                    './folderName.with.dots/more.dots.extension',
                    'some/folder.with.dots/another.file',
                    '/var/logs/app.01.05.error',
                    '.GitHub/prompts',
                    './.tempfile',
                ], 'Must read correct value.');
            });
            test('filters out non valid entries', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    '../../development/branch.name/some.test': true,
                    '.giThub/prompts': true,
                    '/Home/user/.ssh/config': true,
                    './hidden.dir/.subhidden': '\f',
                    '/tmp/.temp.folder/cache.db': true,
                    '.github/prompts': true,
                    '/opt/software/v3.2.1/build.log': '  ',
                    '': true,
                    './scripts/.old.build.sh': true,
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '\n\n': true,
                    '\t': true,
                    '\v': true,
                    '\f': true,
                    '\r\n': true,
                    '\f\f': true,
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': 2345,
                }), PromptsType.prompt), [
                    '.github/prompts',
                    '../assets/img/logo.v2.png',
                    '../.local/bin/script.sh',
                    '../../development/branch.name/some.test',
                    '.giThub/prompts',
                    '/Home/user/.ssh/config',
                    '/tmp/.temp.folder/cache.db',
                    './scripts/.old.build.sh',
                ], 'Must read correct value.');
            });
            test('only invalid or false values', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '../assets/IMG/logo.v2.png': '',
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    './hidden.dir/.subhidden': '\f',
                    '/opt/Software/v3.2.1/build.log': '  ',
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': 7654,
                }), PromptsType.prompt), [
                    '.github/prompts',
                ], 'Must read correct value.');
            });
            test('filters out disabled default location', () => {
                assert.deepStrictEqual(PromptsConfig.promptSourceFolders(createMock({
                    '/etc/hosts.backup': '\t\n\t',
                    './run.tests.sh': '\v',
                    '.github/prompts': false,
                    '../assets/img/logo.v2.png': true,
                    '/mnt/storage/video.archive/episode.01.mkv': false,
                    '../.local/bin/script.sh': true,
                    '/usr/local/share/.fonts/CustomFont.otf': '',
                    '../../development/branch.name/some.test': true,
                    '.giThub/prompts': true,
                    '/Home/user/.ssh/config': true,
                    './hidden.dir/.subhidden': '\f',
                    '/tmp/.temp.folder/cache.db': true,
                    '/opt/software/v3.2.1/build.log': '  ',
                    '': true,
                    './scripts/.old.build.sh': true,
                    '/var/data/datafile.2025-02-05.json': '\n',
                    '\n\n': true,
                    '\t': true,
                    '\v': true,
                    '\f': true,
                    '\r\n': true,
                    '\f\f': true,
                    '../lib/some_library.v1.0.1.so': '\r\n',
                    '/dev/shm/.shared_resource': 853,
                }), PromptsType.prompt), [
                    '../assets/img/logo.v2.png',
                    '../.local/bin/script.sh',
                    '../../development/branch.name/some.test',
                    '.giThub/prompts',
                    '/Home/user/.ssh/config',
                    '/tmp/.temp.folder/cache.db',
                    './scripts/.old.build.sh',
                ], 'Must read correct value.');
            });
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLnRlc3QuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvd29ya2JlbmNoL2NvbnRyaWIvY2hhdC90ZXN0L2NvbW1vbi9wcm9tcHRTeW50YXgvY29uZmlnL2NvbmZpZy50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM1QixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGFBQWEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBQ2pGLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUM3RSxPQUFPLEVBQUUsdUNBQXVDLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUd6Rzs7R0FFRztBQUNILFNBQVMsVUFBVSxDQUFJLEtBQVE7SUFDOUIsT0FBTyxXQUFXLENBQXdCO1FBQ3pDLFFBQVEsQ0FBQyxHQUFzQztZQUM5QyxNQUFNLENBQ0wsT0FBTyxHQUFHLEtBQUssUUFBUSxFQUN2QiwyQ0FBMkMsT0FBTyxHQUFHLElBQUksQ0FDekQsQ0FBQztZQUVGLE1BQU0sQ0FDTCxDQUFDLGFBQWEsQ0FBQyxvQkFBb0IsRUFBRSxhQUFhLENBQUMseUJBQXlCLEVBQUUsYUFBYSxDQUFDLGlCQUFpQixDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUM1SCxrQ0FBa0MsR0FBRyxJQUFJLENBQ3pDLENBQUM7WUFFRixPQUFPLEtBQUssQ0FBQztRQUNkLENBQUM7S0FDRCxDQUFDLENBQUM7QUFDSixDQUFDO0FBRUQsS0FBSyxDQUFDLGVBQWUsRUFBRSxHQUFHLEVBQUU7SUFDM0IsdUNBQXVDLEVBQUUsQ0FBQztJQUUxQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO1FBQy9CLElBQUksQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO1lBQ3RCLE1BQU0sYUFBYSxHQUFHLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU1QyxNQUFNLENBQUMsV0FBVyxDQUNqQixhQUFhLENBQUMsaUJBQWlCLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFDbEUsU0FBUyxFQUNULDBCQUEwQixDQUMxQixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRTtZQUNqQixNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFdkMsTUFBTSxDQUFDLFdBQVcsQ0FDakIsYUFBYSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQ2xFLFNBQVMsRUFDVCwwQkFBMEIsQ0FDMUIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7WUFDcEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7Z0JBQ2xCLE1BQU0sQ0FBQyxlQUFlLENBQ3JCLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUNuRSxFQUFFLEVBQ0YsMEJBQTBCLENBQzFCLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxvQkFBb0IsRUFBRSxHQUFHLEVBQUU7Z0JBQy9CLE1BQU0sQ0FBQyxlQUFlLENBQ3JCLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLENBQUM7b0JBQzFDLGVBQWUsRUFBRSxJQUFJO29CQUNyQix3Q0FBd0MsRUFBRSxJQUFJO29CQUM5QyxnQ0FBZ0MsRUFBRSxJQUFJO29CQUN0QyxzQ0FBc0MsRUFBRSxJQUFJO29CQUM1Qyx5QkFBeUIsRUFBRSxJQUFJO29CQUMvQiwrQkFBK0IsRUFBRSxJQUFJO29CQUNyQyxnQ0FBZ0MsRUFBRSxJQUFJO29CQUN0QywwQkFBMEIsRUFBRSxJQUFJO29CQUNoQyw0Q0FBNEMsRUFBRSxJQUFJO29CQUNsRCxvQ0FBb0MsRUFBRSxJQUFJO29CQUMxQywyQkFBMkIsRUFBRSxJQUFJO29CQUNqQyxhQUFhLEVBQUUsSUFBSTtpQkFDbkIsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFDdkI7b0JBQ0MsZUFBZSxFQUFFLElBQUk7b0JBQ3JCLHdDQUF3QyxFQUFFLElBQUk7b0JBQzlDLGdDQUFnQyxFQUFFLElBQUk7b0JBQ3RDLHNDQUFzQyxFQUFFLElBQUk7b0JBQzVDLHlCQUF5QixFQUFFLElBQUk7b0JBQy9CLCtCQUErQixFQUFFLElBQUk7b0JBQ3JDLGdDQUFnQyxFQUFFLElBQUk7b0JBQ3RDLDBCQUEwQixFQUFFLElBQUk7b0JBQ2hDLDRDQUE0QyxFQUFFLElBQUk7b0JBQ2xELG9DQUFvQyxFQUFFLElBQUk7b0JBQzFDLDJCQUEyQixFQUFFLElBQUk7b0JBQ2pDLGFBQWEsRUFBRSxJQUFJO2lCQUNuQixFQUNELDBCQUEwQixDQUMxQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsK0JBQStCLEVBQUUsR0FBRyxFQUFFO2dCQUMxQyxNQUFNLENBQUMsZUFBZSxDQUNyQixhQUFhLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDO29CQUMxQyxtQkFBbUIsRUFBRSxRQUFRO29CQUM3QixnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QiwyQkFBMkIsRUFBRSxJQUFJO29CQUNqQywyQ0FBMkMsRUFBRSxLQUFLO29CQUNsRCx5QkFBeUIsRUFBRSxJQUFJO29CQUMvQix3Q0FBd0MsRUFBRSxFQUFFO29CQUM1Qyx5Q0FBeUMsRUFBRSxJQUFJO29CQUMvQyx3QkFBd0IsRUFBRSxJQUFJO29CQUM5Qix5QkFBeUIsRUFBRSxJQUFJO29CQUMvQiw0QkFBNEIsRUFBRSxJQUFJO29CQUNsQyxnQ0FBZ0MsRUFBRSxJQUFJO29CQUN0QyxFQUFFLEVBQUUsSUFBSTtvQkFDUix5QkFBeUIsRUFBRSxJQUFJO29CQUMvQixvQ0FBb0MsRUFBRSxJQUFJO29CQUMxQyxNQUFNLEVBQUUsSUFBSTtvQkFDWixJQUFJLEVBQUUsSUFBSTtvQkFDVixJQUFJLEVBQUUsSUFBSTtvQkFDVixJQUFJLEVBQUUsSUFBSTtvQkFDVixNQUFNLEVBQUUsSUFBSTtvQkFDWixNQUFNLEVBQUUsSUFBSTtvQkFDWiwrQkFBK0IsRUFBRSxNQUFNO29CQUN2QywyQkFBMkIsRUFBRSxJQUFJO2lCQUNqQyxDQUFDLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUN2QjtvQkFDQywyQkFBMkIsRUFBRSxJQUFJO29CQUNqQywyQ0FBMkMsRUFBRSxLQUFLO29CQUNsRCx5QkFBeUIsRUFBRSxJQUFJO29CQUMvQix5Q0FBeUMsRUFBRSxJQUFJO29CQUMvQyx3QkFBd0IsRUFBRSxJQUFJO29CQUM5Qiw0QkFBNEIsRUFBRSxJQUFJO29CQUNsQyx5QkFBeUIsRUFBRSxJQUFJO2lCQUMvQixFQUNELDBCQUEwQixDQUMxQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsOEJBQThCLEVBQUUsR0FBRyxFQUFFO2dCQUN6QyxNQUFNLENBQUMsZUFBZSxDQUNyQixhQUFhLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDO29CQUMxQyxtQkFBbUIsRUFBRSxRQUFRO29CQUM3QixnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QiwyQkFBMkIsRUFBRSxFQUFFO29CQUMvQiwyQ0FBMkMsRUFBRSxLQUFLO29CQUNsRCx3Q0FBd0MsRUFBRSxFQUFFO29CQUM1Qyx5QkFBeUIsRUFBRSxJQUFJO29CQUMvQixnQ0FBZ0MsRUFBRSxJQUFJO29CQUN0QyxvQ0FBb0MsRUFBRSxJQUFJO29CQUMxQywrQkFBK0IsRUFBRSxNQUFNO29CQUN2QywyQkFBMkIsRUFBRSxJQUFJO2lCQUNqQyxDQUFDLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUN2QjtvQkFDQywyQ0FBMkMsRUFBRSxLQUFLO2lCQUNsRCxFQUNELDBCQUEwQixDQUMxQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsS0FBSyxDQUFDLGlCQUFpQixFQUFFLEdBQUcsRUFBRTtRQUM3QixJQUFJLENBQUMsV0FBVyxFQUFFLEdBQUcsRUFBRTtZQUN0QixNQUFNLGFBQWEsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFNUMsTUFBTSxDQUFDLGVBQWUsQ0FDckIsYUFBYSxDQUFDLG1CQUFtQixDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQ3BFLEVBQUUsRUFDRiwwQkFBMEIsQ0FDMUIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUU7WUFDakIsTUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXZDLE1BQU0sQ0FBQyxlQUFlLENBQ3JCLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUNwRSxFQUFFLEVBQ0YsMEJBQTBCLENBQzFCLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILEtBQUssQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO1lBQ3BCLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUNsQixNQUFNLENBQUMsZUFBZSxDQUNyQixhQUFhLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFDckUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUNuQiwwQkFBMEIsQ0FDMUIsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLG9CQUFvQixFQUFFLEdBQUcsRUFBRTtnQkFDL0IsTUFBTSxDQUFDLGVBQWUsQ0FDckIsYUFBYSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQztvQkFDNUMsZUFBZSxFQUFFLElBQUk7b0JBQ3JCLHdDQUF3QyxFQUFFLElBQUk7b0JBQzlDLGdDQUFnQyxFQUFFLElBQUk7b0JBQ3RDLHNDQUFzQyxFQUFFLElBQUk7b0JBQzVDLHlCQUF5QixFQUFFLElBQUk7b0JBQy9CLCtCQUErQixFQUFFLElBQUk7b0JBQ3JDLGdDQUFnQyxFQUFFLElBQUk7b0JBQ3RDLDBCQUEwQixFQUFFLElBQUk7b0JBQ2hDLDRDQUE0QyxFQUFFLElBQUk7b0JBQ2xELG9DQUFvQyxFQUFFLElBQUk7b0JBQzFDLDJCQUEyQixFQUFFLElBQUk7b0JBQ2pDLGlCQUFpQixFQUFFLElBQUk7b0JBQ3ZCLGFBQWEsRUFBRSxJQUFJO2lCQUNuQixDQUFDLEVBQUUsV0FBVyxDQUFDLE1BQU0sQ0FBQyxFQUN2QjtvQkFDQyxpQkFBaUI7b0JBQ2pCLGVBQWU7b0JBQ2Ysd0NBQXdDO29CQUN4QyxnQ0FBZ0M7b0JBQ2hDLHNDQUFzQztvQkFDdEMseUJBQXlCO29CQUN6QiwrQkFBK0I7b0JBQy9CLGdDQUFnQztvQkFDaEMsMEJBQTBCO29CQUMxQiw0Q0FBNEM7b0JBQzVDLG9DQUFvQztvQkFDcEMsMkJBQTJCO29CQUMzQixpQkFBaUI7b0JBQ2pCLGFBQWE7aUJBQ2IsRUFDRCwwQkFBMEIsQ0FDMUIsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLCtCQUErQixFQUFFLEdBQUcsRUFBRTtnQkFDMUMsTUFBTSxDQUFDLGVBQWUsQ0FDckIsYUFBYSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQztvQkFDNUMsbUJBQW1CLEVBQUUsUUFBUTtvQkFDN0IsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIsMkJBQTJCLEVBQUUsSUFBSTtvQkFDakMsMkNBQTJDLEVBQUUsS0FBSztvQkFDbEQseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0Isd0NBQXdDLEVBQUUsRUFBRTtvQkFDNUMseUNBQXlDLEVBQUUsSUFBSTtvQkFDL0MsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsd0JBQXdCLEVBQUUsSUFBSTtvQkFDOUIseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0IsNEJBQTRCLEVBQUUsSUFBSTtvQkFDbEMsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsZ0NBQWdDLEVBQUUsSUFBSTtvQkFDdEMsRUFBRSxFQUFFLElBQUk7b0JBQ1IseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0Isb0NBQW9DLEVBQUUsSUFBSTtvQkFDMUMsTUFBTSxFQUFFLElBQUk7b0JBQ1osSUFBSSxFQUFFLElBQUk7b0JBQ1YsSUFBSSxFQUFFLElBQUk7b0JBQ1YsSUFBSSxFQUFFLElBQUk7b0JBQ1YsTUFBTSxFQUFFLElBQUk7b0JBQ1osTUFBTSxFQUFFLElBQUk7b0JBQ1osK0JBQStCLEVBQUUsTUFBTTtvQkFDdkMsMkJBQTJCLEVBQUUsSUFBSTtpQkFDakMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFDdkI7b0JBQ0MsaUJBQWlCO29CQUNqQiwyQkFBMkI7b0JBQzNCLHlCQUF5QjtvQkFDekIseUNBQXlDO29CQUN6QyxpQkFBaUI7b0JBQ2pCLHdCQUF3QjtvQkFDeEIsNEJBQTRCO29CQUM1Qix5QkFBeUI7aUJBQ3pCLEVBQ0QsMEJBQTBCLENBQzFCLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyw4QkFBOEIsRUFBRSxHQUFHLEVBQUU7Z0JBQ3pDLE1BQU0sQ0FBQyxlQUFlLENBQ3JCLGFBQWEsQ0FBQyxtQkFBbUIsQ0FBQyxVQUFVLENBQUM7b0JBQzVDLG1CQUFtQixFQUFFLFFBQVE7b0JBQzdCLGdCQUFnQixFQUFFLElBQUk7b0JBQ3RCLDJCQUEyQixFQUFFLEVBQUU7b0JBQy9CLDJDQUEyQyxFQUFFLEtBQUs7b0JBQ2xELHdDQUF3QyxFQUFFLEVBQUU7b0JBQzVDLHlCQUF5QixFQUFFLElBQUk7b0JBQy9CLGdDQUFnQyxFQUFFLElBQUk7b0JBQ3RDLG9DQUFvQyxFQUFFLElBQUk7b0JBQzFDLCtCQUErQixFQUFFLE1BQU07b0JBQ3ZDLDJCQUEyQixFQUFFLElBQUk7aUJBQ2pDLENBQUMsRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLEVBQ3ZCO29CQUNDLGlCQUFpQjtpQkFDakIsRUFDRCwwQkFBMEIsQ0FDMUIsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDLHVDQUF1QyxFQUFFLEdBQUcsRUFBRTtnQkFDbEQsTUFBTSxDQUFDLGVBQWUsQ0FDckIsYUFBYSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQztvQkFDNUMsbUJBQW1CLEVBQUUsUUFBUTtvQkFDN0IsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIsaUJBQWlCLEVBQUUsS0FBSztvQkFDeEIsMkJBQTJCLEVBQUUsSUFBSTtvQkFDakMsMkNBQTJDLEVBQUUsS0FBSztvQkFDbEQseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0Isd0NBQXdDLEVBQUUsRUFBRTtvQkFDNUMseUNBQXlDLEVBQUUsSUFBSTtvQkFDL0MsaUJBQWlCLEVBQUUsSUFBSTtvQkFDdkIsd0JBQXdCLEVBQUUsSUFBSTtvQkFDOUIseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0IsNEJBQTRCLEVBQUUsSUFBSTtvQkFDbEMsZ0NBQWdDLEVBQUUsSUFBSTtvQkFDdEMsRUFBRSxFQUFFLElBQUk7b0JBQ1IseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0Isb0NBQW9DLEVBQUUsSUFBSTtvQkFDMUMsTUFBTSxFQUFFLElBQUk7b0JBQ1osSUFBSSxFQUFFLElBQUk7b0JBQ1YsSUFBSSxFQUFFLElBQUk7b0JBQ1YsSUFBSSxFQUFFLElBQUk7b0JBQ1YsTUFBTSxFQUFFLElBQUk7b0JBQ1osTUFBTSxFQUFFLElBQUk7b0JBQ1osK0JBQStCLEVBQUUsTUFBTTtvQkFDdkMsMkJBQTJCLEVBQUUsR0FBRztpQkFDaEMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxNQUFNLENBQUMsRUFDdkI7b0JBQ0MsMkJBQTJCO29CQUMzQix5QkFBeUI7b0JBQ3pCLHlDQUF5QztvQkFDekMsaUJBQWlCO29CQUNqQix3QkFBd0I7b0JBQ3hCLDRCQUE0QjtvQkFDNUIseUJBQXlCO2lCQUN6QixFQUNELDBCQUEwQixDQUMxQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0FBQ0osQ0FBQyxDQUFDLENBQUMifQ==