"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// ####################################
// ###                              ###
// ### !!! PLEASE DO NOT MODIFY !!! ###
// ###                              ###
// ####################################
// TODO@esm remove me once we stop supporting our web-esm-bridge
(function () {
    //#endregion
    // eslint-disable-next-line local/code-no-any-casts
    const define = globalThis.define;
    // eslint-disable-next-line local/code-no-any-casts
    const require = globalThis.require;
    if (!define || !require || typeof require.getConfig !== 'function') {
        throw new Error('Expected global define() and require() functions. Please only load this module in an AMD context!');
    }
    let baseUrl = require?.getConfig().baseUrl;
    if (!baseUrl) {
        throw new Error('Failed to determine baseUrl for loading AMD modules (tried require.getConfig().baseUrl)');
    }
    if (!baseUrl.endsWith('/')) {
        baseUrl = baseUrl + '/';
    }
    globalThis._VSCODE_FILE_ROOT = baseUrl;
    const trustedTypesPolicy = require.getConfig().trustedTypesPolicy;
    if (trustedTypesPolicy) {
        globalThis._VSCODE_WEB_PACKAGE_TTP = trustedTypesPolicy;
    }
    const promise = new Promise(resolve => {
        // eslint-disable-next-line local/code-no-any-casts
        globalThis.__VSCODE_WEB_ESM_PROMISE = resolve;
    });
    define('vs/web-api', [], () => {
        return {
            load: (_name, _req, _load, _config) => {
                const script = document.createElement('script');
                script.type = 'module';
                // eslint-disable-next-line local/code-no-any-casts
                script.src = trustedTypesPolicy ? trustedTypesPolicy.createScriptURL(`${baseUrl}vs/workbench/workbench.web.main.internal.js`) : `${baseUrl}vs/workbench/workbench.web.main.internal.js`;
                document.head.appendChild(script);
                return promise.then(mod => _load(mod));
            }
        };
    });
    define('vs/workbench/workbench.web.main', ['require', 'exports', 'vs/web-api!'], function (_require, exports, webApi) {
        Object.assign(exports, webApi);
    });
})();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoLndlYi5tYWluLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC93b3JrYmVuY2gud2ViLm1haW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Z0dBR2dHO0FBR2hHLHVDQUF1QztBQUN2Qyx1Q0FBdUM7QUFDdkMsdUNBQXVDO0FBQ3ZDLHVDQUF1QztBQUN2Qyx1Q0FBdUM7QUFFdkMsZ0VBQWdFO0FBRWhFLENBQUM7SUF5Q0EsWUFBWTtJQUVaLG1EQUFtRDtJQUNuRCxNQUFNLE1BQU0sR0FBbUIsVUFBa0IsQ0FBQyxNQUFNLENBQUM7SUFDekQsbURBQW1EO0lBQ25ELE1BQU0sT0FBTyxHQUF1QyxVQUFrQixDQUFDLE9BQU8sQ0FBQztJQUUvRSxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsT0FBTyxJQUFJLE9BQU8sT0FBTyxDQUFDLFNBQVMsS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUNwRSxNQUFNLElBQUksS0FBSyxDQUFDLG1HQUFtRyxDQUFDLENBQUM7SUFDdEgsQ0FBQztJQUVELElBQUksT0FBTyxHQUFHLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxPQUFPLENBQUM7SUFDM0MsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2QsTUFBTSxJQUFJLEtBQUssQ0FBQyx5RkFBeUYsQ0FBQyxDQUFDO0lBQzVHLENBQUM7SUFDRCxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQzVCLE9BQU8sR0FBRyxPQUFPLEdBQUcsR0FBRyxDQUFDO0lBQ3pCLENBQUM7SUFDRCxVQUFVLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDO0lBRXZDLE1BQU0sa0JBQWtCLEdBQXFKLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztJQUNwTixJQUFJLGtCQUFrQixFQUFFLENBQUM7UUFDeEIsVUFBVSxDQUFDLHVCQUF1QixHQUFHLGtCQUFrQixDQUFDO0lBQ3pELENBQUM7SUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtRQUNyQyxtREFBbUQ7UUFDbEQsVUFBa0IsQ0FBQyx3QkFBd0IsR0FBRyxPQUFPLENBQUM7SUFDeEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLENBQUMsWUFBWSxFQUFFLEVBQUUsRUFBRSxHQUFrQixFQUFFO1FBQzVDLE9BQU87WUFDTixJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRTtnQkFDckMsTUFBTSxNQUFNLEdBQVEsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDckQsTUFBTSxDQUFDLElBQUksR0FBRyxRQUFRLENBQUM7Z0JBQ3ZCLG1EQUFtRDtnQkFDbkQsTUFBTSxDQUFDLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsZUFBZSxDQUFDLEdBQUcsT0FBTyw2Q0FBNkMsQ0FBa0IsQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLDZDQUE2QyxDQUFDO2dCQUN6TSxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFFbEMsT0FBTyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDeEMsQ0FBQztTQUNELENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FDTCxpQ0FBaUMsRUFDakMsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLGFBQWEsQ0FBQyxFQUNyQyxVQUFVLFFBQVEsRUFBRSxPQUFPLEVBQUUsTUFBTTtRQUNsQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNoQyxDQUFDLENBQ0QsQ0FBQztBQUNILENBQUMsQ0FBQyxFQUFFLENBQUMifQ==