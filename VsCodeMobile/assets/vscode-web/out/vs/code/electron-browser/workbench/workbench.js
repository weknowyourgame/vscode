"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-restricted-globals */
(async function () {
    // Add a perf entry right from the top
    performance.mark('code/didStartRenderer');
    const preloadGlobals = window.vscode; // defined by preload.ts
    const safeProcess = preloadGlobals.process;
    //#region Splash Screen Helpers
    function showSplash(configuration) {
        performance.mark('code/willShowPartsSplash');
        let data = configuration.partsSplash;
        if (data) {
            if (configuration.autoDetectHighContrast && configuration.colorScheme.highContrast) {
                if ((configuration.colorScheme.dark && data.baseTheme !== 'hc-black') || (!configuration.colorScheme.dark && data.baseTheme !== 'hc-light')) {
                    data = undefined; // high contrast mode has been turned by the OS -> ignore stored colors and layouts
                }
            }
            else if (configuration.autoDetectColorScheme) {
                if ((configuration.colorScheme.dark && data.baseTheme !== 'vs-dark') || (!configuration.colorScheme.dark && data.baseTheme !== 'vs')) {
                    data = undefined; // OS color scheme is tracked and has changed
                }
            }
        }
        // developing an extension -> ignore stored layouts
        if (data && configuration.extensionDevelopmentPath) {
            data.layoutInfo = undefined;
        }
        // minimal color configuration (works with or without persisted data)
        let baseTheme;
        let shellBackground;
        let shellForeground;
        if (data) {
            baseTheme = data.baseTheme;
            shellBackground = data.colorInfo.editorBackground;
            shellForeground = data.colorInfo.foreground;
        }
        else if (configuration.autoDetectHighContrast && configuration.colorScheme.highContrast) {
            if (configuration.colorScheme.dark) {
                baseTheme = 'hc-black';
                shellBackground = '#000000';
                shellForeground = '#FFFFFF';
            }
            else {
                baseTheme = 'hc-light';
                shellBackground = '#FFFFFF';
                shellForeground = '#000000';
            }
        }
        else if (configuration.autoDetectColorScheme) {
            if (configuration.colorScheme.dark) {
                baseTheme = 'vs-dark';
                shellBackground = '#1E1E1E';
                shellForeground = '#CCCCCC';
            }
            else {
                baseTheme = 'vs';
                shellBackground = '#FFFFFF';
                shellForeground = '#000000';
            }
        }
        const style = document.createElement('style');
        style.className = 'initialShellColors';
        window.document.head.appendChild(style);
        style.textContent = `body {	background-color: ${shellBackground}; color: ${shellForeground}; margin: 0; padding: 0; }`;
        // set zoom level as soon as possible
        if (typeof data?.zoomLevel === 'number' && typeof preloadGlobals?.webFrame?.setZoomLevel === 'function') {
            preloadGlobals.webFrame.setZoomLevel(data.zoomLevel);
        }
        // restore parts if possible (we might not always store layout info)
        if (data?.layoutInfo) {
            const { layoutInfo, colorInfo } = data;
            const splash = document.createElement('div');
            splash.id = 'monaco-parts-splash';
            splash.className = baseTheme ?? 'vs-dark';
            if (layoutInfo.windowBorder && colorInfo.windowBorder) {
                const borderElement = document.createElement('div');
                borderElement.style.position = 'absolute';
                borderElement.style.width = 'calc(100vw - 2px)';
                borderElement.style.height = 'calc(100vh - 2px)';
                borderElement.style.zIndex = '1'; // allow border above other elements
                borderElement.style.border = `1px solid var(--window-border-color)`;
                borderElement.style.setProperty('--window-border-color', colorInfo.windowBorder);
                if (layoutInfo.windowBorderRadius) {
                    borderElement.style.borderRadius = layoutInfo.windowBorderRadius;
                }
                splash.appendChild(borderElement);
            }
            if (layoutInfo.auxiliaryBarWidth === Number.MAX_SAFE_INTEGER) {
                // if auxiliary bar is maximized, it goes as wide as the
                // window width but leaving room for activity bar
                layoutInfo.auxiliaryBarWidth = window.innerWidth - layoutInfo.activityBarWidth;
            }
            else {
                // otherwise adjust for other parts sizes if not maximized
                layoutInfo.auxiliaryBarWidth = Math.min(layoutInfo.auxiliaryBarWidth, window.innerWidth - (layoutInfo.activityBarWidth + layoutInfo.editorPartMinWidth + layoutInfo.sideBarWidth));
            }
            layoutInfo.sideBarWidth = Math.min(layoutInfo.sideBarWidth, window.innerWidth - (layoutInfo.activityBarWidth + layoutInfo.editorPartMinWidth + layoutInfo.auxiliaryBarWidth));
            // part: title
            if (layoutInfo.titleBarHeight > 0) {
                const titleDiv = document.createElement('div');
                titleDiv.style.position = 'absolute';
                titleDiv.style.width = '100%';
                titleDiv.style.height = `${layoutInfo.titleBarHeight}px`;
                titleDiv.style.left = '0';
                titleDiv.style.top = '0';
                titleDiv.style.backgroundColor = `${colorInfo.titleBarBackground}`;
                titleDiv.style['-webkit-app-region'] = 'drag';
                splash.appendChild(titleDiv);
                if (colorInfo.titleBarBorder) {
                    const titleBorder = document.createElement('div');
                    titleBorder.style.position = 'absolute';
                    titleBorder.style.width = '100%';
                    titleBorder.style.height = '1px';
                    titleBorder.style.left = '0';
                    titleBorder.style.bottom = '0';
                    titleBorder.style.borderBottom = `1px solid ${colorInfo.titleBarBorder}`;
                    titleDiv.appendChild(titleBorder);
                }
            }
            // part: activity bar
            if (layoutInfo.activityBarWidth > 0) {
                const activityDiv = document.createElement('div');
                activityDiv.style.position = 'absolute';
                activityDiv.style.width = `${layoutInfo.activityBarWidth}px`;
                activityDiv.style.height = `calc(100% - ${layoutInfo.titleBarHeight + layoutInfo.statusBarHeight}px)`;
                activityDiv.style.top = `${layoutInfo.titleBarHeight}px`;
                if (layoutInfo.sideBarSide === 'left') {
                    activityDiv.style.left = '0';
                }
                else {
                    activityDiv.style.right = '0';
                }
                activityDiv.style.backgroundColor = `${colorInfo.activityBarBackground}`;
                splash.appendChild(activityDiv);
                if (colorInfo.activityBarBorder) {
                    const activityBorderDiv = document.createElement('div');
                    activityBorderDiv.style.position = 'absolute';
                    activityBorderDiv.style.width = '1px';
                    activityBorderDiv.style.height = '100%';
                    activityBorderDiv.style.top = '0';
                    if (layoutInfo.sideBarSide === 'left') {
                        activityBorderDiv.style.right = '0';
                        activityBorderDiv.style.borderRight = `1px solid ${colorInfo.activityBarBorder}`;
                    }
                    else {
                        activityBorderDiv.style.left = '0';
                        activityBorderDiv.style.borderLeft = `1px solid ${colorInfo.activityBarBorder}`;
                    }
                    activityDiv.appendChild(activityBorderDiv);
                }
            }
            // part: side bar
            if (layoutInfo.sideBarWidth > 0) {
                const sideDiv = document.createElement('div');
                sideDiv.style.position = 'absolute';
                sideDiv.style.width = `${layoutInfo.sideBarWidth}px`;
                sideDiv.style.height = `calc(100% - ${layoutInfo.titleBarHeight + layoutInfo.statusBarHeight}px)`;
                sideDiv.style.top = `${layoutInfo.titleBarHeight}px`;
                if (layoutInfo.sideBarSide === 'left') {
                    sideDiv.style.left = `${layoutInfo.activityBarWidth}px`;
                }
                else {
                    sideDiv.style.right = `${layoutInfo.activityBarWidth}px`;
                }
                sideDiv.style.backgroundColor = `${colorInfo.sideBarBackground}`;
                splash.appendChild(sideDiv);
                if (colorInfo.sideBarBorder) {
                    const sideBorderDiv = document.createElement('div');
                    sideBorderDiv.style.position = 'absolute';
                    sideBorderDiv.style.width = '1px';
                    sideBorderDiv.style.height = '100%';
                    sideBorderDiv.style.top = '0';
                    sideBorderDiv.style.right = '0';
                    if (layoutInfo.sideBarSide === 'left') {
                        sideBorderDiv.style.borderRight = `1px solid ${colorInfo.sideBarBorder}`;
                    }
                    else {
                        sideBorderDiv.style.left = '0';
                        sideBorderDiv.style.borderLeft = `1px solid ${colorInfo.sideBarBorder}`;
                    }
                    sideDiv.appendChild(sideBorderDiv);
                }
            }
            // part: auxiliary sidebar
            if (layoutInfo.auxiliaryBarWidth > 0) {
                const auxSideDiv = document.createElement('div');
                auxSideDiv.style.position = 'absolute';
                auxSideDiv.style.width = `${layoutInfo.auxiliaryBarWidth}px`;
                auxSideDiv.style.height = `calc(100% - ${layoutInfo.titleBarHeight + layoutInfo.statusBarHeight}px)`;
                auxSideDiv.style.top = `${layoutInfo.titleBarHeight}px`;
                if (layoutInfo.sideBarSide === 'left') {
                    auxSideDiv.style.right = '0';
                }
                else {
                    auxSideDiv.style.left = '0';
                }
                auxSideDiv.style.backgroundColor = `${colorInfo.sideBarBackground}`;
                splash.appendChild(auxSideDiv);
                if (colorInfo.sideBarBorder) {
                    const auxSideBorderDiv = document.createElement('div');
                    auxSideBorderDiv.style.position = 'absolute';
                    auxSideBorderDiv.style.width = '1px';
                    auxSideBorderDiv.style.height = '100%';
                    auxSideBorderDiv.style.top = '0';
                    if (layoutInfo.sideBarSide === 'left') {
                        auxSideBorderDiv.style.left = '0';
                        auxSideBorderDiv.style.borderLeft = `1px solid ${colorInfo.sideBarBorder}`;
                    }
                    else {
                        auxSideBorderDiv.style.right = '0';
                        auxSideBorderDiv.style.borderRight = `1px solid ${colorInfo.sideBarBorder}`;
                    }
                    auxSideDiv.appendChild(auxSideBorderDiv);
                }
            }
            // part: statusbar
            if (layoutInfo.statusBarHeight > 0) {
                const statusDiv = document.createElement('div');
                statusDiv.style.position = 'absolute';
                statusDiv.style.width = '100%';
                statusDiv.style.height = `${layoutInfo.statusBarHeight}px`;
                statusDiv.style.bottom = '0';
                statusDiv.style.left = '0';
                if (configuration.workspace && colorInfo.statusBarBackground) {
                    statusDiv.style.backgroundColor = colorInfo.statusBarBackground;
                }
                else if (!configuration.workspace && colorInfo.statusBarNoFolderBackground) {
                    statusDiv.style.backgroundColor = colorInfo.statusBarNoFolderBackground;
                }
                splash.appendChild(statusDiv);
                if (colorInfo.statusBarBorder) {
                    const statusBorderDiv = document.createElement('div');
                    statusBorderDiv.style.position = 'absolute';
                    statusBorderDiv.style.width = '100%';
                    statusBorderDiv.style.height = '1px';
                    statusBorderDiv.style.top = '0';
                    statusBorderDiv.style.borderTop = `1px solid ${colorInfo.statusBarBorder}`;
                    statusDiv.appendChild(statusBorderDiv);
                }
            }
            window.document.body.appendChild(splash);
        }
        performance.mark('code/didShowPartsSplash');
    }
    //#endregion
    //#region Window Helpers
    async function load(options) {
        // Window Configuration from Preload Script
        const configuration = await resolveWindowConfiguration();
        // Signal before import()
        options?.beforeImport?.(configuration);
        // Developer settings
        const { enableDeveloperKeybindings, removeDeveloperKeybindingsAfterLoad, developerDeveloperKeybindingsDisposable, forceDisableShowDevtoolsOnError } = setupDeveloperKeybindings(configuration, options);
        // NLS
        setupNLS(configuration);
        // Compute base URL and set as global
        const baseUrl = new URL(`${fileUriFromPath(configuration.appRoot, { isWindows: safeProcess.platform === 'win32', scheme: 'vscode-file', fallbackAuthority: 'vscode-app' })}/out/`);
        globalThis._VSCODE_FILE_ROOT = baseUrl.toString();
        // Dev only: CSS import map tricks
        setupCSSImportMaps(configuration, baseUrl);
        // ESM Import
        try {
            let workbenchUrl;
            if (!!safeProcess.env['VSCODE_DEV'] && globalThis._VSCODE_USE_RELATIVE_IMPORTS) {
                workbenchUrl = '../../../workbench/workbench.desktop.main.js'; // for dev purposes only
            }
            else {
                workbenchUrl = new URL(`vs/workbench/workbench.desktop.main.js`, baseUrl).href;
            }
            const result = await import(workbenchUrl);
            if (developerDeveloperKeybindingsDisposable && removeDeveloperKeybindingsAfterLoad) {
                developerDeveloperKeybindingsDisposable();
            }
            return { result, configuration };
        }
        catch (error) {
            onUnexpectedError(error, enableDeveloperKeybindings && !forceDisableShowDevtoolsOnError);
            throw error;
        }
    }
    async function resolveWindowConfiguration() {
        const timeout = setTimeout(() => { console.error(`[resolve window config] Could not resolve window configuration within 10 seconds, but will continue to wait...`); }, 10000);
        performance.mark('code/willWaitForWindowConfig');
        const configuration = await preloadGlobals.context.resolveConfiguration();
        performance.mark('code/didWaitForWindowConfig');
        clearTimeout(timeout);
        return configuration;
    }
    function setupDeveloperKeybindings(configuration, options) {
        const { forceEnableDeveloperKeybindings, disallowReloadKeybinding, removeDeveloperKeybindingsAfterLoad, forceDisableShowDevtoolsOnError } = typeof options?.configureDeveloperSettings === 'function' ? options.configureDeveloperSettings(configuration) : {
            forceEnableDeveloperKeybindings: false,
            disallowReloadKeybinding: false,
            removeDeveloperKeybindingsAfterLoad: false,
            forceDisableShowDevtoolsOnError: false
        };
        const isDev = !!safeProcess.env['VSCODE_DEV'];
        const enableDeveloperKeybindings = Boolean(isDev || forceEnableDeveloperKeybindings);
        let developerDeveloperKeybindingsDisposable = undefined;
        if (enableDeveloperKeybindings) {
            developerDeveloperKeybindingsDisposable = registerDeveloperKeybindings(disallowReloadKeybinding);
        }
        return {
            enableDeveloperKeybindings,
            removeDeveloperKeybindingsAfterLoad,
            developerDeveloperKeybindingsDisposable,
            forceDisableShowDevtoolsOnError
        };
    }
    function registerDeveloperKeybindings(disallowReloadKeybinding) {
        const ipcRenderer = preloadGlobals.ipcRenderer;
        const extractKey = function (e) {
            return [
                e.ctrlKey ? 'ctrl-' : '',
                e.metaKey ? 'meta-' : '',
                e.altKey ? 'alt-' : '',
                e.shiftKey ? 'shift-' : '',
                e.keyCode
            ].join('');
        };
        // Devtools & reload support
        const TOGGLE_DEV_TOOLS_KB = (safeProcess.platform === 'darwin' ? 'meta-alt-73' : 'ctrl-shift-73'); // mac: Cmd-Alt-I, rest: Ctrl-Shift-I
        const TOGGLE_DEV_TOOLS_KB_ALT = '123'; // F12
        const RELOAD_KB = (safeProcess.platform === 'darwin' ? 'meta-82' : 'ctrl-82'); // mac: Cmd-R, rest: Ctrl-R
        let listener = function (e) {
            const key = extractKey(e);
            if (key === TOGGLE_DEV_TOOLS_KB || key === TOGGLE_DEV_TOOLS_KB_ALT) {
                ipcRenderer.send('vscode:toggleDevTools');
            }
            else if (key === RELOAD_KB && !disallowReloadKeybinding) {
                ipcRenderer.send('vscode:reloadWindow');
            }
        };
        window.addEventListener('keydown', listener);
        return function () {
            if (listener) {
                window.removeEventListener('keydown', listener);
                listener = undefined;
            }
        };
    }
    function setupNLS(configuration) {
        globalThis._VSCODE_NLS_MESSAGES = configuration.nls.messages;
        globalThis._VSCODE_NLS_LANGUAGE = configuration.nls.language;
        let language = configuration.nls.language || 'en';
        if (language === 'zh-tw') {
            language = 'zh-Hant';
        }
        else if (language === 'zh-cn') {
            language = 'zh-Hans';
        }
        window.document.documentElement.setAttribute('lang', language);
    }
    function onUnexpectedError(error, showDevtoolsOnError) {
        if (showDevtoolsOnError) {
            const ipcRenderer = preloadGlobals.ipcRenderer;
            ipcRenderer.send('vscode:openDevTools');
        }
        console.error(`[uncaught exception]: ${error}`);
        if (error && typeof error !== 'string' && error.stack) {
            console.error(error.stack);
        }
    }
    function fileUriFromPath(path, config) {
        // Since we are building a URI, we normalize any backslash
        // to slashes and we ensure that the path begins with a '/'.
        let pathName = path.replace(/\\/g, '/');
        if (pathName.length > 0 && pathName.charAt(0) !== '/') {
            pathName = `/${pathName}`;
        }
        let uri;
        // Windows: in order to support UNC paths (which start with '//')
        // that have their own authority, we do not use the provided authority
        // but rather preserve it.
        if (config.isWindows && pathName.startsWith('//')) {
            uri = encodeURI(`${config.scheme || 'file'}:${pathName}`);
        }
        // Otherwise we optionally add the provided authority if specified
        else {
            uri = encodeURI(`${config.scheme || 'file'}://${config.fallbackAuthority || ''}${pathName}`);
        }
        return uri.replace(/#/g, '%23');
    }
    function setupCSSImportMaps(configuration, baseUrl) {
        // DEV ---------------------------------------------------------------------------------------
        // DEV: This is for development and enables loading CSS via import-statements via import-maps.
        // DEV: For each CSS modules that we have we defined an entry in the import map that maps to
        // DEV: a blob URL that loads the CSS via a dynamic @import-rule.
        // DEV ---------------------------------------------------------------------------------------
        if (globalThis._VSCODE_DISABLE_CSS_IMPORT_MAP) {
            return; // disabled in certain development setups
        }
        if (Array.isArray(configuration.cssModules) && configuration.cssModules.length > 0) {
            performance.mark('code/willAddCssLoader');
            globalThis._VSCODE_CSS_LOAD = function (url) {
                const link = document.createElement('link');
                link.setAttribute('rel', 'stylesheet');
                link.setAttribute('type', 'text/css');
                link.setAttribute('href', url);
                window.document.head.appendChild(link);
            };
            const importMap = { imports: {} };
            for (const cssModule of configuration.cssModules) {
                const cssUrl = new URL(cssModule, baseUrl).href;
                const jsSrc = `globalThis._VSCODE_CSS_LOAD('${cssUrl}');\n`;
                const blob = new Blob([jsSrc], { type: 'application/javascript' });
                importMap.imports[cssUrl] = URL.createObjectURL(blob);
            }
            const ttp = window.trustedTypes?.createPolicy('vscode-bootstrapImportMap', { createScript(value) { return value; }, });
            const importMapSrc = JSON.stringify(importMap, undefined, 2);
            const importMapScript = document.createElement('script');
            importMapScript.type = 'importmap';
            importMapScript.setAttribute('nonce', '0c6a828f1297');
            // @ts-expect-error
            importMapScript.textContent = ttp?.createScript(importMapSrc) ?? importMapSrc;
            window.document.head.appendChild(importMapScript);
            performance.mark('code/didAddCssLoader');
        }
    }
    //#endregion
    const { result, configuration } = await load({
        configureDeveloperSettings: function (windowConfig) {
            return {
                // disable automated devtools opening on error when running extension tests
                // as this can lead to nondeterministic test execution (devtools steals focus)
                forceDisableShowDevtoolsOnError: typeof windowConfig.extensionTestsPath === 'string' || windowConfig['enable-smoke-test-driver'] === true,
                // enable devtools keybindings in extension development window
                forceEnableDeveloperKeybindings: Array.isArray(windowConfig.extensionDevelopmentPath) && windowConfig.extensionDevelopmentPath.length > 0,
                removeDeveloperKeybindingsAfterLoad: true
            };
        },
        beforeImport: function (windowConfig) {
            // Show our splash as early as possible
            showSplash(windowConfig);
            // Code windows have a `vscodeWindowId` property to identify them
            Object.defineProperty(window, 'vscodeWindowId', {
                get: () => windowConfig.windowId
            });
            // It looks like browsers only lazily enable
            // the <canvas> element when needed. Since we
            // leverage canvas elements in our code in many
            // locations, we try to help the browser to
            // initialize canvas when it is idle, right
            // before we wait for the scripts to be loaded.
            window.requestIdleCallback(() => {
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                context?.clearRect(0, 0, canvas.width, canvas.height);
                canvas.remove();
            }, { timeout: 50 });
            // Track import() perf
            performance.mark('code/willLoadWorkbenchMain');
        }
    });
    // Mark start of workbench
    performance.mark('code/didLoadWorkbenchMain');
    // Load workbench
    result.main(configuration);
}());
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya2JlbmNoLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2NvZGUvZWxlY3Ryb24tYnJvd3Nlci93b3JrYmVuY2gvd29ya2JlbmNoLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O2dHQUdnRztBQUVoRywwQ0FBMEM7QUFFMUMsQ0FBQyxLQUFLO0lBRUwsc0NBQXNDO0lBQ3RDLFdBQVcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztJQVMxQyxNQUFNLGNBQWMsR0FBSSxNQUEyRCxDQUFDLE1BQU0sQ0FBQyxDQUFDLHdCQUF3QjtJQUNwSCxNQUFNLFdBQVcsR0FBRyxjQUFjLENBQUMsT0FBTyxDQUFDO0lBRTNDLCtCQUErQjtJQUUvQixTQUFTLFVBQVUsQ0FBQyxhQUF5QztRQUM1RCxXQUFXLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLENBQUM7UUFFN0MsSUFBSSxJQUFJLEdBQUcsYUFBYSxDQUFDLFdBQVcsQ0FBQztRQUNyQyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ1YsSUFBSSxhQUFhLENBQUMsc0JBQXNCLElBQUksYUFBYSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDcEYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDN0ksSUFBSSxHQUFHLFNBQVMsQ0FBQyxDQUFDLG1GQUFtRjtnQkFDdEcsQ0FBQztZQUNGLENBQUM7aUJBQU0sSUFBSSxhQUFhLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDaEQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQztvQkFDdEksSUFBSSxHQUFHLFNBQVMsQ0FBQyxDQUFDLDZDQUE2QztnQkFDaEUsQ0FBQztZQUNGLENBQUM7UUFDRixDQUFDO1FBRUQsbURBQW1EO1FBQ25ELElBQUksSUFBSSxJQUFJLGFBQWEsQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ3BELElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQzdCLENBQUM7UUFFRCxxRUFBcUU7UUFDckUsSUFBSSxTQUFTLENBQUM7UUFDZCxJQUFJLGVBQWUsQ0FBQztRQUNwQixJQUFJLGVBQWUsQ0FBQztRQUNwQixJQUFJLElBQUksRUFBRSxDQUFDO1lBQ1YsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDM0IsZUFBZSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7WUFDbEQsZUFBZSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO1FBQzdDLENBQUM7YUFBTSxJQUFJLGFBQWEsQ0FBQyxzQkFBc0IsSUFBSSxhQUFhLENBQUMsV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzNGLElBQUksYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDcEMsU0FBUyxHQUFHLFVBQVUsQ0FBQztnQkFDdkIsZUFBZSxHQUFHLFNBQVMsQ0FBQztnQkFDNUIsZUFBZSxHQUFHLFNBQVMsQ0FBQztZQUM3QixDQUFDO2lCQUFNLENBQUM7Z0JBQ1AsU0FBUyxHQUFHLFVBQVUsQ0FBQztnQkFDdkIsZUFBZSxHQUFHLFNBQVMsQ0FBQztnQkFDNUIsZUFBZSxHQUFHLFNBQVMsQ0FBQztZQUM3QixDQUFDO1FBQ0YsQ0FBQzthQUFNLElBQUksYUFBYSxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFDaEQsSUFBSSxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNwQyxTQUFTLEdBQUcsU0FBUyxDQUFDO2dCQUN0QixlQUFlLEdBQUcsU0FBUyxDQUFDO2dCQUM1QixlQUFlLEdBQUcsU0FBUyxDQUFDO1lBQzdCLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxTQUFTLEdBQUcsSUFBSSxDQUFDO2dCQUNqQixlQUFlLEdBQUcsU0FBUyxDQUFDO2dCQUM1QixlQUFlLEdBQUcsU0FBUyxDQUFDO1lBQzdCLENBQUM7UUFDRixDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5QyxLQUFLLENBQUMsU0FBUyxHQUFHLG9CQUFvQixDQUFDO1FBQ3ZDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN4QyxLQUFLLENBQUMsV0FBVyxHQUFHLDRCQUE0QixlQUFlLFlBQVksZUFBZSw0QkFBNEIsQ0FBQztRQUV2SCxxQ0FBcUM7UUFDckMsSUFBSSxPQUFPLElBQUksRUFBRSxTQUFTLEtBQUssUUFBUSxJQUFJLE9BQU8sY0FBYyxFQUFFLFFBQVEsRUFBRSxZQUFZLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDekcsY0FBYyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFFRCxvRUFBb0U7UUFDcEUsSUFBSSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUM7WUFDdEIsTUFBTSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7WUFFdkMsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM3QyxNQUFNLENBQUMsRUFBRSxHQUFHLHFCQUFxQixDQUFDO1lBQ2xDLE1BQU0sQ0FBQyxTQUFTLEdBQUcsU0FBUyxJQUFJLFNBQVMsQ0FBQztZQUUxQyxJQUFJLFVBQVUsQ0FBQyxZQUFZLElBQUksU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDO2dCQUN2RCxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUNwRCxhQUFhLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7Z0JBQzFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLG1CQUFtQixDQUFDO2dCQUNoRCxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxtQkFBbUIsQ0FBQztnQkFDakQsYUFBYSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsb0NBQW9DO2dCQUN0RSxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxzQ0FBc0MsQ0FBQztnQkFDcEUsYUFBYSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsdUJBQXVCLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUVqRixJQUFJLFVBQVUsQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO29CQUNuQyxhQUFhLENBQUMsS0FBSyxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsa0JBQWtCLENBQUM7Z0JBQ2xFLENBQUM7Z0JBRUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNuQyxDQUFDO1lBRUQsSUFBSSxVQUFVLENBQUMsaUJBQWlCLEtBQUssTUFBTSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQzlELHdEQUF3RDtnQkFDeEQsaURBQWlEO2dCQUNqRCxVQUFVLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsZ0JBQWdCLENBQUM7WUFDaEYsQ0FBQztpQkFBTSxDQUFDO2dCQUNQLDBEQUEwRDtnQkFDMUQsVUFBVSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxVQUFVLEdBQUcsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLGtCQUFrQixHQUFHLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ3BMLENBQUM7WUFDRCxVQUFVLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFlBQVksRUFBRSxNQUFNLENBQUMsVUFBVSxHQUFHLENBQUMsVUFBVSxDQUFDLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxrQkFBa0IsR0FBRyxVQUFVLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1lBRTlLLGNBQWM7WUFDZCxJQUFJLFVBQVUsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ25DLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQy9DLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztnQkFDckMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDO2dCQUM5QixRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQyxjQUFjLElBQUksQ0FBQztnQkFDekQsUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO2dCQUMxQixRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7Z0JBQ3pCLFFBQVEsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLEdBQUcsU0FBUyxDQUFDLGtCQUFrQixFQUFFLENBQUM7Z0JBQ2xFLFFBQVEsQ0FBQyxLQUFnRSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsTUFBTSxDQUFDO2dCQUMxRyxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUU3QixJQUFJLFNBQVMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztvQkFDOUIsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDbEQsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO29CQUN4QyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUM7b0JBQ2pDLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztvQkFDakMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO29CQUM3QixXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7b0JBQy9CLFdBQVcsQ0FBQyxLQUFLLENBQUMsWUFBWSxHQUFHLGFBQWEsU0FBUyxDQUFDLGNBQWMsRUFBRSxDQUFDO29CQUN6RSxRQUFRLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUNuQyxDQUFDO1lBQ0YsQ0FBQztZQUVELHFCQUFxQjtZQUNyQixJQUFJLFVBQVUsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDckMsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDbEQsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO2dCQUN4QyxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLFVBQVUsQ0FBQyxnQkFBZ0IsSUFBSSxDQUFDO2dCQUM3RCxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxlQUFlLFVBQVUsQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDLGVBQWUsS0FBSyxDQUFDO2dCQUN0RyxXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLFVBQVUsQ0FBQyxjQUFjLElBQUksQ0FBQztnQkFDekQsSUFBSSxVQUFVLENBQUMsV0FBVyxLQUFLLE1BQU0sRUFBRSxDQUFDO29CQUN2QyxXQUFXLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7Z0JBQzlCLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxXQUFXLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUM7Z0JBQy9CLENBQUM7Z0JBQ0QsV0FBVyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsR0FBRyxTQUFTLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDekUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztnQkFFaEMsSUFBSSxTQUFTLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztvQkFDakMsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN4RCxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztvQkFDOUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7b0JBQ3RDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO29CQUN4QyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztvQkFDbEMsSUFBSSxVQUFVLENBQUMsV0FBVyxLQUFLLE1BQU0sRUFBRSxDQUFDO3dCQUN2QyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQzt3QkFDcEMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxhQUFhLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO29CQUNsRixDQUFDO3lCQUFNLENBQUM7d0JBQ1AsaUJBQWlCLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7d0JBQ25DLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsYUFBYSxTQUFTLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztvQkFDakYsQ0FBQztvQkFDRCxXQUFXLENBQUMsV0FBVyxDQUFDLGlCQUFpQixDQUFDLENBQUM7Z0JBQzVDLENBQUM7WUFDRixDQUFDO1lBRUQsaUJBQWlCO1lBQ2pCLElBQUksVUFBVSxDQUFDLFlBQVksR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDOUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO2dCQUNwQyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLFVBQVUsQ0FBQyxZQUFZLElBQUksQ0FBQztnQkFDckQsT0FBTyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsZUFBZSxVQUFVLENBQUMsY0FBYyxHQUFHLFVBQVUsQ0FBQyxlQUFlLEtBQUssQ0FBQztnQkFDbEcsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxVQUFVLENBQUMsY0FBYyxJQUFJLENBQUM7Z0JBQ3JELElBQUksVUFBVSxDQUFDLFdBQVcsS0FBSyxNQUFNLEVBQUUsQ0FBQztvQkFDdkMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUMsZ0JBQWdCLElBQUksQ0FBQztnQkFDekQsQ0FBQztxQkFBTSxDQUFDO29CQUNQLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsVUFBVSxDQUFDLGdCQUFnQixJQUFJLENBQUM7Z0JBQzFELENBQUM7Z0JBQ0QsT0FBTyxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsR0FBRyxTQUFTLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDakUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFFNUIsSUFBSSxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQzdCLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3BELGFBQWEsQ0FBQyxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQztvQkFDMUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO29CQUNsQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7b0JBQ3BDLGFBQWEsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztvQkFDOUIsYUFBYSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDO29CQUNoQyxJQUFJLFVBQVUsQ0FBQyxXQUFXLEtBQUssTUFBTSxFQUFFLENBQUM7d0JBQ3ZDLGFBQWEsQ0FBQyxLQUFLLENBQUMsV0FBVyxHQUFHLGFBQWEsU0FBUyxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUMxRSxDQUFDO3lCQUFNLENBQUM7d0JBQ1AsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDO3dCQUMvQixhQUFhLENBQUMsS0FBSyxDQUFDLFVBQVUsR0FBRyxhQUFhLFNBQVMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztvQkFDekUsQ0FBQztvQkFDRCxPQUFPLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUNwQyxDQUFDO1lBQ0YsQ0FBQztZQUVELDBCQUEwQjtZQUMxQixJQUFJLFVBQVUsQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDdEMsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDakQsVUFBVSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO2dCQUN2QyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLFVBQVUsQ0FBQyxpQkFBaUIsSUFBSSxDQUFDO2dCQUM3RCxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxlQUFlLFVBQVUsQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDLGVBQWUsS0FBSyxDQUFDO2dCQUNyRyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLFVBQVUsQ0FBQyxjQUFjLElBQUksQ0FBQztnQkFDeEQsSUFBSSxVQUFVLENBQUMsV0FBVyxLQUFLLE1BQU0sRUFBRSxDQUFDO29CQUN2QyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUM7Z0JBQzlCLENBQUM7cUJBQU0sQ0FBQztvQkFDUCxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7Z0JBQzdCLENBQUM7Z0JBQ0QsVUFBVSxDQUFDLEtBQUssQ0FBQyxlQUFlLEdBQUcsR0FBRyxTQUFTLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztnQkFDcEUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFFL0IsSUFBSSxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQzdCLE1BQU0sZ0JBQWdCLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDdkQsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLFFBQVEsR0FBRyxVQUFVLENBQUM7b0JBQzdDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO29CQUNyQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztvQkFDdkMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUM7b0JBQ2pDLElBQUksVUFBVSxDQUFDLFdBQVcsS0FBSyxNQUFNLEVBQUUsQ0FBQzt3QkFDdkMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxHQUFHLENBQUM7d0JBQ2xDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsYUFBYSxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQzVFLENBQUM7eUJBQU0sQ0FBQzt3QkFDUCxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQzt3QkFDbkMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxhQUFhLFNBQVMsQ0FBQyxhQUFhLEVBQUUsQ0FBQztvQkFDN0UsQ0FBQztvQkFDRCxVQUFVLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLENBQUM7Z0JBQzFDLENBQUM7WUFDRixDQUFDO1lBRUQsa0JBQWtCO1lBQ2xCLElBQUksVUFBVSxDQUFDLGVBQWUsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDcEMsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDaEQsU0FBUyxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO2dCQUN0QyxTQUFTLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUM7Z0JBQy9CLFNBQVMsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEdBQUcsVUFBVSxDQUFDLGVBQWUsSUFBSSxDQUFDO2dCQUMzRCxTQUFTLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7Z0JBQzdCLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztnQkFDM0IsSUFBSSxhQUFhLENBQUMsU0FBUyxJQUFJLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO29CQUM5RCxTQUFTLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxTQUFTLENBQUMsbUJBQW1CLENBQUM7Z0JBQ2pFLENBQUM7cUJBQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLElBQUksU0FBUyxDQUFDLDJCQUEyQixFQUFFLENBQUM7b0JBQzlFLFNBQVMsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQywyQkFBMkIsQ0FBQztnQkFDekUsQ0FBQztnQkFDRCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUU5QixJQUFJLFNBQVMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDL0IsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDdEQsZUFBZSxDQUFDLEtBQUssQ0FBQyxRQUFRLEdBQUcsVUFBVSxDQUFDO29CQUM1QyxlQUFlLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUM7b0JBQ3JDLGVBQWUsQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLEtBQUssQ0FBQztvQkFDckMsZUFBZSxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO29CQUNoQyxlQUFlLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxhQUFhLFNBQVMsQ0FBQyxlQUFlLEVBQUUsQ0FBQztvQkFDM0UsU0FBUyxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsQ0FBQztnQkFDeEMsQ0FBQztZQUNGLENBQUM7WUFFRCxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUMsQ0FBQztRQUVELFdBQVcsQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBRUQsWUFBWTtJQUVaLHdCQUF3QjtJQUV4QixLQUFLLFVBQVUsSUFBSSxDQUFxQyxPQUF3QjtRQUUvRSwyQ0FBMkM7UUFDM0MsTUFBTSxhQUFhLEdBQUcsTUFBTSwwQkFBMEIsRUFBSyxDQUFDO1FBRTVELHlCQUF5QjtRQUN6QixPQUFPLEVBQUUsWUFBWSxFQUFFLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFdkMscUJBQXFCO1FBQ3JCLE1BQU0sRUFBRSwwQkFBMEIsRUFBRSxtQ0FBbUMsRUFBRSx1Q0FBdUMsRUFBRSwrQkFBK0IsRUFBRSxHQUFHLHlCQUF5QixDQUFDLGFBQWEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUV4TSxNQUFNO1FBQ04sUUFBUSxDQUFJLGFBQWEsQ0FBQyxDQUFDO1FBRTNCLHFDQUFxQztRQUNyQyxNQUFNLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLEVBQUUsU0FBUyxFQUFFLFdBQVcsQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsWUFBWSxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbkwsVUFBVSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUVsRCxrQ0FBa0M7UUFDbEMsa0JBQWtCLENBQUksYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRTlDLGFBQWE7UUFDYixJQUFJLENBQUM7WUFDSixJQUFJLFlBQW9CLENBQUM7WUFDekIsSUFBSSxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxVQUFVLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztnQkFDaEYsWUFBWSxHQUFHLDhDQUE4QyxDQUFDLENBQUMsd0JBQXdCO1lBQ3hGLENBQUM7aUJBQU0sQ0FBQztnQkFDUCxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsd0NBQXdDLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2hGLENBQUM7WUFFRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUMxQyxJQUFJLHVDQUF1QyxJQUFJLG1DQUFtQyxFQUFFLENBQUM7Z0JBQ3BGLHVDQUF1QyxFQUFFLENBQUM7WUFDM0MsQ0FBQztZQUVELE9BQU8sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLENBQUM7UUFDbEMsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDaEIsaUJBQWlCLENBQUMsS0FBSyxFQUFFLDBCQUEwQixJQUFJLENBQUMsK0JBQStCLENBQUMsQ0FBQztZQUV6RixNQUFNLEtBQUssQ0FBQztRQUNiLENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxVQUFVLDBCQUEwQjtRQUN4QyxNQUFNLE9BQU8sR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxnSEFBZ0gsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlLLFdBQVcsQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUVqRCxNQUFNLGFBQWEsR0FBRyxNQUFNLGNBQWMsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLEVBQU8sQ0FBQztRQUMvRSxXQUFXLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFFaEQsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXRCLE9BQU8sYUFBYSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxTQUFTLHlCQUF5QixDQUFrQyxhQUFnQixFQUFFLE9BQXdCO1FBQzdHLE1BQU0sRUFDTCwrQkFBK0IsRUFDL0Isd0JBQXdCLEVBQ3hCLG1DQUFtQyxFQUNuQywrQkFBK0IsRUFDL0IsR0FBRyxPQUFPLE9BQU8sRUFBRSwwQkFBMEIsS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbkgsK0JBQStCLEVBQUUsS0FBSztZQUN0Qyx3QkFBd0IsRUFBRSxLQUFLO1lBQy9CLG1DQUFtQyxFQUFFLEtBQUs7WUFDMUMsK0JBQStCLEVBQUUsS0FBSztTQUN0QyxDQUFDO1FBRUYsTUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDOUMsTUFBTSwwQkFBMEIsR0FBRyxPQUFPLENBQUMsS0FBSyxJQUFJLCtCQUErQixDQUFDLENBQUM7UUFDckYsSUFBSSx1Q0FBdUMsR0FBeUIsU0FBUyxDQUFDO1FBQzlFLElBQUksMEJBQTBCLEVBQUUsQ0FBQztZQUNoQyx1Q0FBdUMsR0FBRyw0QkFBNEIsQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBQ2xHLENBQUM7UUFFRCxPQUFPO1lBQ04sMEJBQTBCO1lBQzFCLG1DQUFtQztZQUNuQyx1Q0FBdUM7WUFDdkMsK0JBQStCO1NBQy9CLENBQUM7SUFDSCxDQUFDO0lBRUQsU0FBUyw0QkFBNEIsQ0FBQyx3QkFBNkM7UUFDbEYsTUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQztRQUUvQyxNQUFNLFVBQVUsR0FDZixVQUFVLENBQWdCO1lBQ3pCLE9BQU87Z0JBQ04sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUN4QixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ3hCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDdEIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUMxQixDQUFDLENBQUMsT0FBTzthQUNULENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ1osQ0FBQyxDQUFDO1FBRUgsNEJBQTRCO1FBQzVCLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLHFDQUFxQztRQUN4SSxNQUFNLHVCQUF1QixHQUFHLEtBQUssQ0FBQyxDQUFDLE1BQU07UUFDN0MsTUFBTSxTQUFTLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLDJCQUEyQjtRQUUxRyxJQUFJLFFBQVEsR0FBNkMsVUFBVSxDQUFDO1lBQ25FLE1BQU0sR0FBRyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQixJQUFJLEdBQUcsS0FBSyxtQkFBbUIsSUFBSSxHQUFHLEtBQUssdUJBQXVCLEVBQUUsQ0FBQztnQkFDcEUsV0FBVyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1lBQzNDLENBQUM7aUJBQU0sSUFBSSxHQUFHLEtBQUssU0FBUyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztnQkFDM0QsV0FBVyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBQ3pDLENBQUM7UUFDRixDQUFDLENBQUM7UUFFRixNQUFNLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRTdDLE9BQU87WUFDTixJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNkLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ2hELFFBQVEsR0FBRyxTQUFTLENBQUM7WUFDdEIsQ0FBQztRQUNGLENBQUMsQ0FBQztJQUNILENBQUM7SUFFRCxTQUFTLFFBQVEsQ0FBa0MsYUFBZ0I7UUFDbEUsVUFBVSxDQUFDLG9CQUFvQixHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDO1FBQzdELFVBQVUsQ0FBQyxvQkFBb0IsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztRQUU3RCxJQUFJLFFBQVEsR0FBRyxhQUFhLENBQUMsR0FBRyxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUM7UUFDbEQsSUFBSSxRQUFRLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDMUIsUUFBUSxHQUFHLFNBQVMsQ0FBQztRQUN0QixDQUFDO2FBQU0sSUFBSSxRQUFRLEtBQUssT0FBTyxFQUFFLENBQUM7WUFDakMsUUFBUSxHQUFHLFNBQVMsQ0FBQztRQUN0QixDQUFDO1FBRUQsTUFBTSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQsU0FBUyxpQkFBaUIsQ0FBQyxLQUFxQixFQUFFLG1CQUE0QjtRQUM3RSxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDekIsTUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDLFdBQVcsQ0FBQztZQUMvQyxXQUFXLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDekMsQ0FBQztRQUVELE9BQU8sQ0FBQyxLQUFLLENBQUMseUJBQXlCLEtBQUssRUFBRSxDQUFDLENBQUM7UUFFaEQsSUFBSSxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUN2RCxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM1QixDQUFDO0lBQ0YsQ0FBQztJQUVELFNBQVMsZUFBZSxDQUFDLElBQVksRUFBRSxNQUE0RTtRQUVsSCwwREFBMEQ7UUFDMUQsNERBQTREO1FBQzVELElBQUksUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3hDLElBQUksUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztZQUN2RCxRQUFRLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUMzQixDQUFDO1FBRUQsSUFBSSxHQUFXLENBQUM7UUFFaEIsaUVBQWlFO1FBQ2pFLHNFQUFzRTtRQUN0RSwwQkFBMEI7UUFDMUIsSUFBSSxNQUFNLENBQUMsU0FBUyxJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUNuRCxHQUFHLEdBQUcsU0FBUyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLElBQUksUUFBUSxFQUFFLENBQUMsQ0FBQztRQUMzRCxDQUFDO1FBRUQsa0VBQWtFO2FBQzdELENBQUM7WUFDTCxHQUFHLEdBQUcsU0FBUyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sSUFBSSxNQUFNLE1BQU0sTUFBTSxDQUFDLGlCQUFpQixJQUFJLEVBQUUsR0FBRyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQzlGLENBQUM7UUFFRCxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRCxTQUFTLGtCQUFrQixDQUFrQyxhQUFnQixFQUFFLE9BQVk7UUFFMUYsOEZBQThGO1FBQzlGLDhGQUE4RjtRQUM5Riw0RkFBNEY7UUFDNUYsaUVBQWlFO1FBQ2pFLDhGQUE4RjtRQUU5RixJQUFJLFVBQVUsQ0FBQyw4QkFBOEIsRUFBRSxDQUFDO1lBQy9DLE9BQU8sQ0FBQyx5Q0FBeUM7UUFDbEQsQ0FBQztRQUVELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLElBQUksYUFBYSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDcEYsV0FBVyxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1lBRTFDLFVBQVUsQ0FBQyxnQkFBZ0IsR0FBRyxVQUFVLEdBQUc7Z0JBQzFDLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzVDLElBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBRS9CLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QyxDQUFDLENBQUM7WUFFRixNQUFNLFNBQVMsR0FBd0MsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUM7WUFDdkUsS0FBSyxNQUFNLFNBQVMsSUFBSSxhQUFhLENBQUMsVUFBVSxFQUFFLENBQUM7Z0JBQ2xELE1BQU0sTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUM7Z0JBQ2hELE1BQU0sS0FBSyxHQUFHLGdDQUFnQyxNQUFNLE9BQU8sQ0FBQztnQkFDNUQsTUFBTSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7Z0JBQ25FLFNBQVMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBRUQsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLFlBQVksRUFBRSxZQUFZLENBQUMsMkJBQTJCLEVBQUUsRUFBRSxZQUFZLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN2SCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDN0QsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN6RCxlQUFlLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQztZQUNuQyxlQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUMsQ0FBQztZQUN0RCxtQkFBbUI7WUFDbkIsZUFBZSxDQUFDLFdBQVcsR0FBRyxHQUFHLEVBQUUsWUFBWSxDQUFDLFlBQVksQ0FBQyxJQUFJLFlBQVksQ0FBQztZQUM5RSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7WUFFbEQsV0FBVyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQzFDLENBQUM7SUFDRixDQUFDO0lBRUQsWUFBWTtJQUVaLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLEdBQUcsTUFBTSxJQUFJLENBQzNDO1FBQ0MsMEJBQTBCLEVBQUUsVUFBVSxZQUFZO1lBQ2pELE9BQU87Z0JBQ04sMkVBQTJFO2dCQUMzRSw4RUFBOEU7Z0JBQzlFLCtCQUErQixFQUFFLE9BQU8sWUFBWSxDQUFDLGtCQUFrQixLQUFLLFFBQVEsSUFBSSxZQUFZLENBQUMsMEJBQTBCLENBQUMsS0FBSyxJQUFJO2dCQUN6SSw4REFBOEQ7Z0JBQzlELCtCQUErQixFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLHdCQUF3QixDQUFDLElBQUksWUFBWSxDQUFDLHdCQUF3QixDQUFDLE1BQU0sR0FBRyxDQUFDO2dCQUN6SSxtQ0FBbUMsRUFBRSxJQUFJO2FBQ3pDLENBQUM7UUFDSCxDQUFDO1FBQ0QsWUFBWSxFQUFFLFVBQVUsWUFBWTtZQUVuQyx1Q0FBdUM7WUFDdkMsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRXpCLGlFQUFpRTtZQUNqRSxNQUFNLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRTtnQkFDL0MsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRO2FBQ2hDLENBQUMsQ0FBQztZQUVILDRDQUE0QztZQUM1Qyw2Q0FBNkM7WUFDN0MsK0NBQStDO1lBQy9DLDJDQUEyQztZQUMzQywyQ0FBMkM7WUFDM0MsK0NBQStDO1lBQy9DLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLEVBQUU7Z0JBQy9CLE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ2hELE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3hDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDdEQsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2pCLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRXBCLHNCQUFzQjtZQUN0QixXQUFXLENBQUMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLENBQUM7UUFDaEQsQ0FBQztLQUNELENBQ0QsQ0FBQztJQUVGLDBCQUEwQjtJQUMxQixXQUFXLENBQUMsSUFBSSxDQUFDLDJCQUEyQixDQUFDLENBQUM7SUFFOUMsaUJBQWlCO0lBQ2pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDNUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyJ9