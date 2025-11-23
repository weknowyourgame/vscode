var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { $, isHTMLInputElement, isHTMLTextAreaElement, reset } from '../../../../base/browser/dom.js';
import { createStyleSheet } from '../../../../base/browser/domStylesheets.js';
import { Button, ButtonWithDropdown, unthemedButtonStyles } from '../../../../base/browser/ui/button/button.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Delayer, RunOnceScheduler } from '../../../../base/common/async.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { groupBy } from '../../../../base/common/collections.js';
import { debounce } from '../../../../base/common/decorators.js';
import { CancellationError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { isLinuxSnap, isMacintosh } from '../../../../base/common/platform.js';
import { joinPath } from '../../../../base/common/resources.js';
import { escape } from '../../../../base/common/strings.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { Action } from '../../../../base/common/actions.js';
import { localize } from '../../../../nls.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { getIconsStyleSheet } from '../../../../platform/theme/browser/iconsStyleSheet.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IIssueFormService } from '../common/issue.js';
import { normalizeGitHubUrl } from '../common/issueReporterUtil.js';
import { IssueReporterModel } from './issueReporterModel.js';
import { IAuthenticationService } from '../../../services/authentication/common/authentication.js';
const MAX_URL_LENGTH = 7500;
// Github API and issues on web has a limit of 65536. If extension data is too large, we will allow users to downlaod and attach it as a file.
// We round down to be safe.
// ref https://github.com/github/issues/issues/12858
const MAX_EXTENSION_DATA_LENGTH = 60000;
var IssueSource;
(function (IssueSource) {
    IssueSource["VSCode"] = "vscode";
    IssueSource["Extension"] = "extension";
    IssueSource["Marketplace"] = "marketplace";
    IssueSource["Unknown"] = "unknown";
})(IssueSource || (IssueSource = {}));
let BaseIssueReporterService = class BaseIssueReporterService extends Disposable {
    constructor(disableExtensions, data, os, product, window, isWeb, issueFormService, themeService, fileService, fileDialogService, contextMenuService, authenticationService, openerService) {
        super();
        this.disableExtensions = disableExtensions;
        this.data = data;
        this.os = os;
        this.product = product;
        this.window = window;
        this.isWeb = isWeb;
        this.issueFormService = issueFormService;
        this.themeService = themeService;
        this.fileService = fileService;
        this.fileDialogService = fileDialogService;
        this.contextMenuService = contextMenuService;
        this.authenticationService = authenticationService;
        this.openerService = openerService;
        this.receivedSystemInfo = false;
        this.numberOfSearchResultsDisplayed = 0;
        this.receivedPerformanceInfo = false;
        this.shouldQueueSearch = false;
        this.hasBeenSubmitted = false;
        this.openReporter = false;
        this.loadingExtensionData = false;
        this.selectedExtension = '';
        this.delayedSubmit = new Delayer(300);
        this.nonGitHubIssueUrl = false;
        this.needsUpdate = false;
        this.acknowledged = false;
        const targetExtension = data.extensionId ? data.enabledExtensions.find(extension => extension.id.toLocaleLowerCase() === data.extensionId?.toLocaleLowerCase()) : undefined;
        this.issueReporterModel = new IssueReporterModel({
            ...data,
            issueType: data.issueType || 0 /* IssueType.Bug */,
            versionInfo: {
                vscodeVersion: `${product.nameShort} ${!!product.darwinUniversalAssetId ? `${product.version} (Universal)` : product.version} (${product.commit || 'Commit unknown'}, ${product.date || 'Date unknown'})`,
                os: `${this.os.type} ${this.os.arch} ${this.os.release}${isLinuxSnap ? ' snap' : ''}`
            },
            extensionsDisabled: !!this.disableExtensions,
            fileOnExtension: data.extensionId ? !targetExtension?.isBuiltin : undefined,
            selectedExtension: targetExtension
        });
        this._register(this.authenticationService.onDidChangeSessions(async () => {
            const previousAuthState = !!this.data.githubAccessToken;
            let githubAccessToken = '';
            try {
                const githubSessions = await this.authenticationService.getSessions('github');
                const potentialSessions = githubSessions.filter(session => session.scopes.includes('repo'));
                githubAccessToken = potentialSessions[0]?.accessToken;
            }
            catch (e) {
                // Ignore
            }
            this.data.githubAccessToken = githubAccessToken;
            const currentAuthState = !!githubAccessToken;
            if (previousAuthState !== currentAuthState) {
                this.updateButtonStates();
            }
        }));
        const fileOnMarketplace = data.issueSource === IssueSource.Marketplace;
        const fileOnProduct = data.issueSource === IssueSource.VSCode;
        this.issueReporterModel.update({ fileOnMarketplace, fileOnProduct });
        this.createAction = this._register(new Action('issueReporter.create', localize('create', "Create on GitHub"), undefined, true, async () => {
            this.delayedSubmit.trigger(async () => {
                this.createIssue(true); // create issue
            });
        }));
        this.previewAction = this._register(new Action('issueReporter.preview', localize('preview', "Preview on GitHub"), undefined, true, async () => {
            this.delayedSubmit.trigger(async () => {
                this.createIssue(false); // preview issue
            });
        }));
        this.privateAction = this._register(new Action('issueReporter.privateCreate', localize('privateCreate', "Create Internally"), undefined, true, async () => {
            this.delayedSubmit.trigger(async () => {
                this.createIssue(true, true); // create private issue
            });
        }));
        const issueTitle = data.issueTitle;
        if (issueTitle) {
            // eslint-disable-next-line no-restricted-syntax
            const issueTitleElement = this.getElementById('issue-title');
            if (issueTitleElement) {
                issueTitleElement.value = issueTitle;
            }
        }
        const issueBody = data.issueBody;
        if (issueBody) {
            // eslint-disable-next-line no-restricted-syntax
            const description = this.getElementById('description');
            if (description) {
                description.value = issueBody;
                this.issueReporterModel.update({ issueDescription: issueBody });
            }
        }
        if (this.window.document.documentElement.lang !== 'en') {
            // eslint-disable-next-line no-restricted-syntax
            show(this.getElementById('english'));
        }
        const codiconStyleSheet = createStyleSheet();
        codiconStyleSheet.id = 'codiconStyles';
        const iconsStyleSheet = this._register(getIconsStyleSheet(this.themeService));
        function updateAll() {
            codiconStyleSheet.textContent = iconsStyleSheet.getCSS();
        }
        const delayer = new RunOnceScheduler(updateAll, 0);
        this._register(iconsStyleSheet.onDidChange(() => delayer.schedule()));
        delayer.schedule();
        this.handleExtensionData(data.enabledExtensions);
        this.setUpTypes();
        // Handle case where extension is pre-selected through the command
        if ((data.data || data.uri) && targetExtension) {
            this.updateExtensionStatus(targetExtension);
        }
        // initialize the reporting button(s)
        // eslint-disable-next-line no-restricted-syntax
        const issueReporterElement = this.getElementById('issue-reporter');
        if (issueReporterElement) {
            this.updateButtonStates();
        }
    }
    render() {
        this.renderBlocks();
    }
    setInitialFocus() {
        const { fileOnExtension } = this.issueReporterModel.getData();
        if (fileOnExtension) {
            // eslint-disable-next-line no-restricted-syntax
            const issueTitle = this.window.document.getElementById('issue-title');
            issueTitle?.focus();
        }
        else {
            // eslint-disable-next-line no-restricted-syntax
            const issueType = this.window.document.getElementById('issue-type');
            issueType?.focus();
        }
    }
    updateButtonStates() {
        // eslint-disable-next-line no-restricted-syntax
        const issueReporterElement = this.getElementById('issue-reporter');
        if (!issueReporterElement) {
            // shouldn't occur -- throw?
            return;
        }
        // public elements section
        // eslint-disable-next-line no-restricted-syntax
        let publicElements = this.getElementById('public-elements');
        if (!publicElements) {
            publicElements = document.createElement('div');
            publicElements.id = 'public-elements';
            publicElements.classList.add('public-elements');
            issueReporterElement.appendChild(publicElements);
        }
        this.updatePublicGithubButton(publicElements);
        this.updatePublicRepoLink(publicElements);
        // private filing section
        // eslint-disable-next-line no-restricted-syntax
        let internalElements = this.getElementById('internal-elements');
        if (!internalElements) {
            internalElements = document.createElement('div');
            internalElements.id = 'internal-elements';
            internalElements.classList.add('internal-elements');
            internalElements.classList.add('hidden');
            issueReporterElement.appendChild(internalElements);
        }
        // eslint-disable-next-line no-restricted-syntax
        let filingRow = this.getElementById('internal-top-row');
        if (!filingRow) {
            filingRow = document.createElement('div');
            filingRow.id = 'internal-top-row';
            filingRow.classList.add('internal-top-row');
            internalElements.appendChild(filingRow);
        }
        this.updateInternalFilingNote(filingRow);
        this.updateInternalGithubButton(filingRow);
        this.updateInternalElementsVisibility();
    }
    updateInternalFilingNote(container) {
        // eslint-disable-next-line no-restricted-syntax
        let filingNote = this.getElementById('internal-preview-message');
        if (!filingNote) {
            filingNote = document.createElement('span');
            filingNote.id = 'internal-preview-message';
            filingNote.classList.add('internal-preview-message');
            container.appendChild(filingNote);
        }
        filingNote.textContent = escape(localize('internalPreviewMessage', 'If your copilot debug logs contain private information:'));
    }
    updatePublicGithubButton(container) {
        // eslint-disable-next-line no-restricted-syntax
        const issueReporterElement = this.getElementById('issue-reporter');
        if (!issueReporterElement) {
            return;
        }
        // Dispose of the existing button
        if (this.publicGithubButton) {
            this.publicGithubButton.dispose();
        }
        // setup button + dropdown if applicable
        if (!this.acknowledged && this.needsUpdate) { // * old version and hasn't ack'd
            this.publicGithubButton = this._register(new Button(container, unthemedButtonStyles));
            this.publicGithubButton.label = localize('acknowledge', "Confirm Version Acknowledgement");
            this.publicGithubButton.enabled = false;
        }
        else if (this.data.githubAccessToken && this.isPreviewEnabled()) { // * has access token, create by default, preview dropdown
            this.publicGithubButton = this._register(new ButtonWithDropdown(container, {
                contextMenuProvider: this.contextMenuService,
                actions: [this.previewAction],
                addPrimaryActionToDropdown: false,
                ...unthemedButtonStyles
            }));
            this._register(this.publicGithubButton.onDidClick(() => {
                this.createAction.run();
            }));
            this.publicGithubButton.label = localize('createOnGitHub', "Create on GitHub");
            this.publicGithubButton.enabled = true;
        }
        else if (this.data.githubAccessToken && !this.isPreviewEnabled()) { // * Access token but invalid preview state: simple Button (create only)
            this.publicGithubButton = this._register(new Button(container, unthemedButtonStyles));
            this._register(this.publicGithubButton.onDidClick(() => {
                this.createAction.run();
            }));
            this.publicGithubButton.label = localize('createOnGitHub', "Create on GitHub");
            this.publicGithubButton.enabled = true;
        }
        else { // * No access token: simple Button (preview only)
            this.publicGithubButton = this._register(new Button(container, unthemedButtonStyles));
            this._register(this.publicGithubButton.onDidClick(() => {
                this.previewAction.run();
            }));
            this.publicGithubButton.label = localize('previewOnGitHub', "Preview on GitHub");
            this.publicGithubButton.enabled = true;
        }
        // make sure that the repo link is after the button
        // eslint-disable-next-line no-restricted-syntax
        const repoLink = this.getElementById('show-repo-name');
        if (repoLink) {
            container.insertBefore(this.publicGithubButton.element, repoLink);
        }
    }
    updatePublicRepoLink(container) {
        // eslint-disable-next-line no-restricted-syntax
        let issueRepoName = this.getElementById('show-repo-name');
        if (!issueRepoName) {
            issueRepoName = document.createElement('a');
            issueRepoName.id = 'show-repo-name';
            issueRepoName.classList.add('hidden');
            container.appendChild(issueRepoName);
        }
        const selectedExtension = this.issueReporterModel.getData().selectedExtension;
        if (selectedExtension && selectedExtension.uri) {
            const urlString = URI.revive(selectedExtension.uri).toString();
            issueRepoName.href = urlString;
            issueRepoName.addEventListener('click', (e) => this.openLink(e));
            issueRepoName.addEventListener('auxclick', (e) => this.openLink(e));
            const gitHubInfo = this.parseGitHubUrl(urlString);
            issueRepoName.textContent = gitHubInfo ? gitHubInfo.owner + '/' + gitHubInfo.repositoryName : urlString;
            Object.assign(issueRepoName.style, {
                alignSelf: 'flex-end',
                display: 'block',
                fontSize: '13px',
                padding: '4px 0px',
                textDecoration: 'none',
                width: 'auto'
            });
            show(issueRepoName);
        }
        else if (issueRepoName) {
            // clear styles
            issueRepoName.removeAttribute('style');
            hide(issueRepoName);
        }
    }
    updateInternalGithubButton(container) {
        // eslint-disable-next-line no-restricted-syntax
        const issueReporterElement = this.getElementById('issue-reporter');
        if (!issueReporterElement) {
            return;
        }
        // Dispose of the existing button
        if (this.internalGithubButton) {
            this.internalGithubButton.dispose();
        }
        if (this.data.githubAccessToken && this.data.privateUri) {
            this.internalGithubButton = this._register(new Button(container, unthemedButtonStyles));
            this._register(this.internalGithubButton.onDidClick(() => {
                this.privateAction.run();
            }));
            this.internalGithubButton.element.id = 'internal-create-btn';
            this.internalGithubButton.element.classList.add('internal-create-subtle');
            this.internalGithubButton.label = localize('createInternally', "Create Internally");
            this.internalGithubButton.enabled = true;
            this.internalGithubButton.setTitle(this.data.privateUri.path.slice(1));
        }
    }
    updateInternalElementsVisibility() {
        // eslint-disable-next-line no-restricted-syntax
        const container = this.getElementById('internal-elements');
        if (!container) {
            // shouldn't happen
            return;
        }
        if (this.data.githubAccessToken && this.data.privateUri) {
            show(container);
            container.style.display = ''; //todo: necessary even with show?
            if (this.internalGithubButton) {
                this.internalGithubButton.enabled = this.publicGithubButton?.enabled ?? false;
            }
        }
        else {
            hide(container);
            container.style.display = 'none'; //todo: necessary even with hide?
        }
    }
    async updateIssueReporterUri(extension) {
        try {
            if (extension.uri) {
                const uri = URI.revive(extension.uri);
                extension.bugsUrl = uri.toString();
            }
        }
        catch (e) {
            this.renderBlocks();
        }
    }
    handleExtensionData(extensions) {
        const installedExtensions = extensions.filter(x => !x.isBuiltin);
        const { nonThemes, themes } = groupBy(installedExtensions, ext => {
            return ext.isTheme ? 'themes' : 'nonThemes';
        });
        const numberOfThemeExtesions = (themes && themes.length) ?? 0;
        this.issueReporterModel.update({ numberOfThemeExtesions, enabledNonThemeExtesions: nonThemes, allExtensions: installedExtensions });
        this.updateExtensionTable(nonThemes ?? [], numberOfThemeExtesions);
        if (this.disableExtensions || installedExtensions.length === 0) {
            // eslint-disable-next-line no-restricted-syntax
            this.getElementById('disableExtensions').disabled = true;
        }
        this.updateExtensionSelector(installedExtensions);
    }
    updateExtensionSelector(extensions) {
        const extensionOptions = extensions.map(extension => {
            return {
                name: extension.displayName || extension.name || '',
                id: extension.id
            };
        });
        // Sort extensions by name
        extensionOptions.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            if (aName > bName) {
                return 1;
            }
            if (aName < bName) {
                return -1;
            }
            return 0;
        });
        const makeOption = (extension, selectedExtension) => {
            const selected = selectedExtension && extension.id === selectedExtension.id;
            return $('option', {
                'value': extension.id,
                'selected': selected || ''
            }, extension.name);
        };
        // eslint-disable-next-line no-restricted-syntax
        const extensionsSelector = this.getElementById('extension-selector');
        if (extensionsSelector) {
            const { selectedExtension } = this.issueReporterModel.getData();
            reset(extensionsSelector, this.makeOption('', localize('selectExtension', "Select extension"), true), ...extensionOptions.map(extension => makeOption(extension, selectedExtension)));
            if (!selectedExtension) {
                extensionsSelector.selectedIndex = 0;
            }
            this.addEventListener('extension-selector', 'change', async (e) => {
                this.clearExtensionData();
                const selectedExtensionId = e.target.value;
                this.selectedExtension = selectedExtensionId;
                const extensions = this.issueReporterModel.getData().allExtensions;
                const matches = extensions.filter(extension => extension.id === selectedExtensionId);
                if (matches.length) {
                    this.issueReporterModel.update({ selectedExtension: matches[0] });
                    const selectedExtension = this.issueReporterModel.getData().selectedExtension;
                    if (selectedExtension) {
                        const iconElement = document.createElement('span');
                        iconElement.classList.add(...ThemeIcon.asClassNameArray(Codicon.loading), 'codicon-modifier-spin');
                        this.setLoading(iconElement);
                        const openReporterData = await this.sendReporterMenu(selectedExtension);
                        if (openReporterData) {
                            if (this.selectedExtension === selectedExtensionId) {
                                this.removeLoading(iconElement, true);
                                this.data = openReporterData;
                            }
                        }
                        else {
                            if (!this.loadingExtensionData) {
                                iconElement.classList.remove(...ThemeIcon.asClassNameArray(Codicon.loading), 'codicon-modifier-spin');
                            }
                            this.removeLoading(iconElement);
                            // if not using command, should have no configuration data in fields we care about and check later.
                            this.clearExtensionData();
                            // case when previous extension was opened from normal openIssueReporter command
                            selectedExtension.data = undefined;
                            selectedExtension.uri = undefined;
                        }
                        if (this.selectedExtension === selectedExtensionId) {
                            // repopulates the fields with the new data given the selected extension.
                            this.updateExtensionStatus(matches[0]);
                            this.openReporter = false;
                        }
                    }
                    else {
                        this.issueReporterModel.update({ selectedExtension: undefined });
                        this.clearSearchResults();
                        this.clearExtensionData();
                        this.validateSelectedExtension();
                        this.updateExtensionStatus(matches[0]);
                    }
                }
                // Update internal action visibility after explicit selection
                this.updateInternalElementsVisibility();
            });
        }
        this.addEventListener('problem-source', 'change', (_) => {
            this.clearExtensionData();
            this.validateSelectedExtension();
        });
    }
    async sendReporterMenu(extension) {
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('sendReporterMenu timed out')), 10000));
            const data = await Promise.race([
                this.issueFormService.sendReporterMenu(extension.id),
                timeoutPromise
            ]);
            return data;
        }
        catch (e) {
            console.error(e);
            return undefined;
        }
    }
    updateAcknowledgementState() {
        // eslint-disable-next-line no-restricted-syntax
        const acknowledgementCheckbox = this.getElementById('includeAcknowledgement');
        if (acknowledgementCheckbox) {
            this.acknowledged = acknowledgementCheckbox.checked;
            this.updateButtonStates();
        }
    }
    setEventHandlers() {
        ['includeSystemInfo', 'includeProcessInfo', 'includeWorkspaceInfo', 'includeExtensions', 'includeExperiments', 'includeExtensionData'].forEach(elementId => {
            this.addEventListener(elementId, 'click', (event) => {
                event.stopPropagation();
                this.issueReporterModel.update({ [elementId]: !this.issueReporterModel.getData()[elementId] });
            });
        });
        this.addEventListener('includeAcknowledgement', 'click', (event) => {
            event.stopPropagation();
            this.updateAcknowledgementState();
        });
        // eslint-disable-next-line no-restricted-syntax
        const showInfoElements = this.window.document.getElementsByClassName('showInfo');
        for (let i = 0; i < showInfoElements.length; i++) {
            const showInfo = showInfoElements.item(i);
            showInfo.addEventListener('click', (e) => {
                e.preventDefault();
                const label = e.target;
                if (label) {
                    const containingElement = label.parentElement && label.parentElement.parentElement;
                    const info = containingElement && containingElement.lastElementChild;
                    if (info && info.classList.contains('hidden')) {
                        show(info);
                        label.textContent = localize('hide', "hide");
                    }
                    else {
                        hide(info);
                        label.textContent = localize('show', "show");
                    }
                }
            });
        }
        this.addEventListener('issue-source', 'change', (e) => {
            const value = e.target.value;
            // eslint-disable-next-line no-restricted-syntax
            const problemSourceHelpText = this.getElementById('problem-source-help-text');
            if (value === '') {
                this.issueReporterModel.update({ fileOnExtension: undefined });
                show(problemSourceHelpText);
                this.clearSearchResults();
                this.render();
                return;
            }
            else {
                hide(problemSourceHelpText);
            }
            // eslint-disable-next-line no-restricted-syntax
            const descriptionTextArea = this.getElementById('issue-title');
            if (value === IssueSource.VSCode) {
                descriptionTextArea.placeholder = localize('vscodePlaceholder', "E.g Workbench is missing problems panel");
            }
            else if (value === IssueSource.Extension) {
                descriptionTextArea.placeholder = localize('extensionPlaceholder', "E.g. Missing alt text on extension readme image");
            }
            else if (value === IssueSource.Marketplace) {
                descriptionTextArea.placeholder = localize('marketplacePlaceholder', "E.g Cannot disable installed extension");
            }
            else {
                descriptionTextArea.placeholder = localize('undefinedPlaceholder', "Please enter a title");
            }
            let fileOnExtension, fileOnMarketplace, fileOnProduct = false;
            if (value === IssueSource.Extension) {
                fileOnExtension = true;
            }
            else if (value === IssueSource.Marketplace) {
                fileOnMarketplace = true;
            }
            else if (value === IssueSource.VSCode) {
                fileOnProduct = true;
            }
            this.issueReporterModel.update({ fileOnExtension, fileOnMarketplace, fileOnProduct });
            this.render();
            // eslint-disable-next-line no-restricted-syntax
            const title = this.getElementById('issue-title').value;
            this.searchIssues(title, fileOnExtension, fileOnMarketplace);
        });
        this.addEventListener('description', 'input', (e) => {
            const issueDescription = e.target.value;
            this.issueReporterModel.update({ issueDescription });
            // Only search for extension issues on title change
            if (this.issueReporterModel.fileOnExtension() === false) {
                // eslint-disable-next-line no-restricted-syntax
                const title = this.getElementById('issue-title').value;
                this.searchVSCodeIssues(title, issueDescription);
            }
        });
        this.addEventListener('issue-title', 'input', _ => {
            // eslint-disable-next-line no-restricted-syntax
            const titleElement = this.getElementById('issue-title');
            if (titleElement) {
                const title = titleElement.value;
                this.issueReporterModel.update({ issueTitle: title });
            }
        });
        this.addEventListener('issue-title', 'input', (e) => {
            const title = e.target.value;
            // eslint-disable-next-line no-restricted-syntax
            const lengthValidationMessage = this.getElementById('issue-title-length-validation-error');
            const issueUrl = this.getIssueUrl();
            if (title && this.getIssueUrlWithTitle(title, issueUrl).length > MAX_URL_LENGTH) {
                show(lengthValidationMessage);
            }
            else {
                hide(lengthValidationMessage);
            }
            // eslint-disable-next-line no-restricted-syntax
            const issueSource = this.getElementById('issue-source');
            if (!issueSource || issueSource.value === '') {
                return;
            }
            const { fileOnExtension, fileOnMarketplace } = this.issueReporterModel.getData();
            this.searchIssues(title, fileOnExtension, fileOnMarketplace);
        });
        // We handle clicks in the dropdown actions now
        this.addEventListener('disableExtensions', 'click', () => {
            this.issueFormService.reloadWithExtensionsDisabled();
        });
        this.addEventListener('extensionBugsLink', 'click', (e) => {
            const url = e.target.innerText;
            this.openLink(url);
        });
        this.addEventListener('disableExtensions', 'keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter' || e.key === ' ') {
                this.issueFormService.reloadWithExtensionsDisabled();
            }
        });
        this.window.document.onkeydown = async (e) => {
            const cmdOrCtrlKey = isMacintosh ? e.metaKey : e.ctrlKey;
            // Cmd/Ctrl+Enter previews issue and closes window
            if (cmdOrCtrlKey && e.key === 'Enter') {
                this.delayedSubmit.trigger(async () => {
                    if (await this.createIssue()) {
                        this.close();
                    }
                });
            }
            // Cmd/Ctrl + w closes issue window
            if (cmdOrCtrlKey && e.key === 'w') {
                e.stopPropagation();
                e.preventDefault();
                // eslint-disable-next-line no-restricted-syntax
                const issueTitle = this.getElementById('issue-title').value;
                const { issueDescription } = this.issueReporterModel.getData();
                if (!this.hasBeenSubmitted && (issueTitle || issueDescription)) {
                    // fire and forget
                    this.issueFormService.showConfirmCloseDialog();
                }
                else {
                    this.close();
                }
            }
            // With latest electron upgrade, cmd+a is no longer propagating correctly for inputs in this window on mac
            // Manually perform the selection
            if (isMacintosh) {
                if (cmdOrCtrlKey && e.key === 'a' && e.target) {
                    if (isHTMLInputElement(e.target) || isHTMLTextAreaElement(e.target)) {
                        e.target.select();
                    }
                }
            }
        };
        // Handle the guidance link specifically to use openerService
        this.addEventListener('review-guidance-help-text', 'click', (e) => {
            const target = e.target;
            if (target.tagName === 'A' && target.getAttribute('target') === '_blank') {
                this.openLink(e);
            }
        });
    }
    updatePerformanceInfo(info) {
        this.issueReporterModel.update(info);
        this.receivedPerformanceInfo = true;
        const state = this.issueReporterModel.getData();
        this.updateProcessInfo(state);
        this.updateWorkspaceInfo(state);
        this.updateButtonStates();
    }
    isPreviewEnabled() {
        const issueType = this.issueReporterModel.getData().issueType;
        if (this.loadingExtensionData) {
            return false;
        }
        if (this.isWeb) {
            if (issueType === 2 /* IssueType.FeatureRequest */ || issueType === 1 /* IssueType.PerformanceIssue */ || issueType === 0 /* IssueType.Bug */) {
                return true;
            }
        }
        else {
            if (issueType === 0 /* IssueType.Bug */ && this.receivedSystemInfo) {
                return true;
            }
            if (issueType === 1 /* IssueType.PerformanceIssue */ && this.receivedSystemInfo && this.receivedPerformanceInfo) {
                return true;
            }
            if (issueType === 2 /* IssueType.FeatureRequest */) {
                return true;
            }
        }
        return false;
    }
    getExtensionRepositoryUrl() {
        const selectedExtension = this.issueReporterModel.getData().selectedExtension;
        return selectedExtension && selectedExtension.repositoryUrl;
    }
    getExtensionBugsUrl() {
        const selectedExtension = this.issueReporterModel.getData().selectedExtension;
        return selectedExtension && selectedExtension.bugsUrl;
    }
    searchVSCodeIssues(title, issueDescription) {
        if (title) {
            this.searchDuplicates(title, issueDescription);
        }
        else {
            this.clearSearchResults();
        }
    }
    searchIssues(title, fileOnExtension, fileOnMarketplace) {
        if (fileOnExtension) {
            return this.searchExtensionIssues(title);
        }
        if (fileOnMarketplace) {
            return this.searchMarketplaceIssues(title);
        }
        const description = this.issueReporterModel.getData().issueDescription;
        this.searchVSCodeIssues(title, description);
    }
    searchExtensionIssues(title) {
        const url = this.getExtensionGitHubUrl();
        if (title) {
            const matches = /^https?:\/\/github\.com\/(.*)/.exec(url);
            if (matches && matches.length) {
                const repo = matches[1];
                return this.searchGitHub(repo, title);
            }
            // If the extension has no repository, display empty search results
            if (this.issueReporterModel.getData().selectedExtension) {
                this.clearSearchResults();
                return this.displaySearchResults([]);
            }
        }
        this.clearSearchResults();
    }
    searchMarketplaceIssues(title) {
        if (title) {
            const gitHubInfo = this.parseGitHubUrl(this.product.reportMarketplaceIssueUrl);
            if (gitHubInfo) {
                return this.searchGitHub(`${gitHubInfo.owner}/${gitHubInfo.repositoryName}`, title);
            }
        }
    }
    async close() {
        await this.issueFormService.closeReporter();
    }
    clearSearchResults() {
        // eslint-disable-next-line no-restricted-syntax
        const similarIssues = this.getElementById('similar-issues');
        similarIssues.innerText = '';
        this.numberOfSearchResultsDisplayed = 0;
    }
    searchGitHub(repo, title) {
        const query = `is:issue+repo:${repo}+${title}`;
        // eslint-disable-next-line no-restricted-syntax
        const similarIssues = this.getElementById('similar-issues');
        fetch(`https://api.github.com/search/issues?q=${query}`).then((response) => {
            response.json().then(result => {
                similarIssues.innerText = '';
                if (result && result.items) {
                    this.displaySearchResults(result.items);
                }
            }).catch(_ => {
                console.warn('Timeout or query limit exceeded');
            });
        }).catch(_ => {
            console.warn('Error fetching GitHub issues');
        });
    }
    searchDuplicates(title, body) {
        const url = 'https://vscode-probot.westus.cloudapp.azure.com:7890/duplicate_candidates';
        const init = {
            method: 'POST',
            body: JSON.stringify({
                title,
                body
            }),
            headers: new Headers({
                'Content-Type': 'application/json'
            })
        };
        fetch(url, init).then((response) => {
            response.json().then(result => {
                this.clearSearchResults();
                if (result && result.candidates) {
                    this.displaySearchResults(result.candidates);
                }
                else {
                    throw new Error('Unexpected response, no candidates property');
                }
            }).catch(_ => {
                // Ignore
            });
        }).catch(_ => {
            // Ignore
        });
    }
    displaySearchResults(results) {
        // eslint-disable-next-line no-restricted-syntax
        const similarIssues = this.getElementById('similar-issues');
        if (results.length) {
            const issues = $('div.issues-container');
            const issuesText = $('div.list-title');
            issuesText.textContent = localize('similarIssues', "Similar issues");
            this.numberOfSearchResultsDisplayed = results.length < 5 ? results.length : 5;
            for (let i = 0; i < this.numberOfSearchResultsDisplayed; i++) {
                const issue = results[i];
                const link = $('a.issue-link', { href: issue.html_url });
                link.textContent = issue.title;
                link.title = issue.title;
                link.addEventListener('click', (e) => this.openLink(e));
                link.addEventListener('auxclick', (e) => this.openLink(e));
                let issueState;
                let item;
                if (issue.state) {
                    issueState = $('span.issue-state');
                    const issueIcon = $('span.issue-icon');
                    issueIcon.appendChild(renderIcon(issue.state === 'open' ? Codicon.issueOpened : Codicon.issueClosed));
                    const issueStateLabel = $('span.issue-state.label');
                    issueStateLabel.textContent = issue.state === 'open' ? localize('open', "Open") : localize('closed', "Closed");
                    issueState.title = issue.state === 'open' ? localize('open', "Open") : localize('closed', "Closed");
                    issueState.appendChild(issueIcon);
                    issueState.appendChild(issueStateLabel);
                    item = $('div.issue', undefined, issueState, link);
                }
                else {
                    item = $('div.issue', undefined, link);
                }
                issues.appendChild(item);
            }
            similarIssues.appendChild(issuesText);
            similarIssues.appendChild(issues);
        }
    }
    setUpTypes() {
        const makeOption = (issueType, description) => $('option', { 'value': issueType.valueOf() }, escape(description));
        // eslint-disable-next-line no-restricted-syntax
        const typeSelect = this.getElementById('issue-type');
        const { issueType } = this.issueReporterModel.getData();
        reset(typeSelect, makeOption(0 /* IssueType.Bug */, localize('bugReporter', "Bug Report")), makeOption(2 /* IssueType.FeatureRequest */, localize('featureRequest', "Feature Request")), makeOption(1 /* IssueType.PerformanceIssue */, localize('performanceIssue', "Performance Issue (freeze, slow, crash)")));
        typeSelect.value = issueType.toString();
        this.setSourceOptions();
    }
    makeOption(value, description, disabled) {
        const option = document.createElement('option');
        option.disabled = disabled;
        option.value = value;
        option.textContent = description;
        return option;
    }
    setSourceOptions() {
        // eslint-disable-next-line no-restricted-syntax
        const sourceSelect = this.getElementById('issue-source');
        const { issueType, fileOnExtension, selectedExtension, fileOnMarketplace, fileOnProduct } = this.issueReporterModel.getData();
        let selected = sourceSelect.selectedIndex;
        if (selected === -1) {
            if (fileOnExtension !== undefined) {
                selected = fileOnExtension ? 2 : 1;
            }
            else if (selectedExtension?.isBuiltin) {
                selected = 1;
            }
            else if (fileOnMarketplace) {
                selected = 3;
            }
            else if (fileOnProduct) {
                selected = 1;
            }
        }
        sourceSelect.innerText = '';
        sourceSelect.append(this.makeOption('', localize('selectSource', "Select source"), true));
        sourceSelect.append(this.makeOption(IssueSource.VSCode, localize('vscode', "Visual Studio Code"), false));
        sourceSelect.append(this.makeOption(IssueSource.Extension, localize('extension', "A VS Code extension"), false));
        if (this.product.reportMarketplaceIssueUrl) {
            sourceSelect.append(this.makeOption(IssueSource.Marketplace, localize('marketplace', "Extensions Marketplace"), false));
        }
        if (issueType !== 2 /* IssueType.FeatureRequest */) {
            sourceSelect.append(this.makeOption(IssueSource.Unknown, localize('unknown', "Don't know"), false));
        }
        if (selected !== -1 && selected < sourceSelect.options.length) {
            sourceSelect.selectedIndex = selected;
        }
        else {
            sourceSelect.selectedIndex = 0;
            // eslint-disable-next-line no-restricted-syntax
            hide(this.getElementById('problem-source-help-text'));
        }
    }
    async renderBlocks() {
        // Depending on Issue Type, we render different blocks and text
        const { issueType, fileOnExtension, fileOnMarketplace, selectedExtension } = this.issueReporterModel.getData();
        // eslint-disable-next-line no-restricted-syntax
        const blockContainer = this.getElementById('block-container');
        // eslint-disable-next-line no-restricted-syntax
        const systemBlock = this.window.document.querySelector('.block-system');
        // eslint-disable-next-line no-restricted-syntax
        const processBlock = this.window.document.querySelector('.block-process');
        // eslint-disable-next-line no-restricted-syntax
        const workspaceBlock = this.window.document.querySelector('.block-workspace');
        // eslint-disable-next-line no-restricted-syntax
        const extensionsBlock = this.window.document.querySelector('.block-extensions');
        // eslint-disable-next-line no-restricted-syntax
        const experimentsBlock = this.window.document.querySelector('.block-experiments');
        // eslint-disable-next-line no-restricted-syntax
        const extensionDataBlock = this.window.document.querySelector('.block-extension-data');
        // eslint-disable-next-line no-restricted-syntax
        const problemSource = this.getElementById('problem-source');
        // eslint-disable-next-line no-restricted-syntax
        const descriptionTitle = this.getElementById('issue-description-label');
        // eslint-disable-next-line no-restricted-syntax
        const descriptionSubtitle = this.getElementById('issue-description-subtitle');
        // eslint-disable-next-line no-restricted-syntax
        const extensionSelector = this.getElementById('extension-selection');
        // eslint-disable-next-line no-restricted-syntax
        const downloadExtensionDataLink = this.getElementById('extension-data-download');
        // eslint-disable-next-line no-restricted-syntax
        const titleTextArea = this.getElementById('issue-title-container');
        // eslint-disable-next-line no-restricted-syntax
        const descriptionTextArea = this.getElementById('description');
        // eslint-disable-next-line no-restricted-syntax
        const extensionDataTextArea = this.getElementById('extension-data');
        // Hide all by default
        hide(blockContainer);
        hide(systemBlock);
        hide(processBlock);
        hide(workspaceBlock);
        hide(extensionsBlock);
        hide(experimentsBlock);
        hide(extensionSelector);
        hide(extensionDataTextArea);
        hide(extensionDataBlock);
        hide(downloadExtensionDataLink);
        show(problemSource);
        show(titleTextArea);
        show(descriptionTextArea);
        if (fileOnExtension) {
            show(extensionSelector);
        }
        const extensionData = this.issueReporterModel.getData().extensionData;
        if (extensionData && extensionData.length > MAX_EXTENSION_DATA_LENGTH) {
            show(downloadExtensionDataLink);
            const date = new Date();
            const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const formattedTime = date.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
            const fileName = `extensionData_${formattedDate}_${formattedTime}.md`;
            const handleLinkClick = async () => {
                const downloadPath = await this.fileDialogService.showSaveDialog({
                    title: localize('saveExtensionData', "Save Extension Data"),
                    availableFileSystems: [Schemas.file],
                    defaultUri: joinPath(await this.fileDialogService.defaultFilePath(Schemas.file), fileName),
                });
                if (downloadPath) {
                    await this.fileService.writeFile(downloadPath, VSBuffer.fromString(extensionData));
                }
            };
            downloadExtensionDataLink.addEventListener('click', handleLinkClick);
            this._register({
                dispose: () => downloadExtensionDataLink.removeEventListener('click', handleLinkClick)
            });
        }
        if (selectedExtension && this.nonGitHubIssueUrl) {
            hide(titleTextArea);
            hide(descriptionTextArea);
            reset(descriptionTitle, localize('handlesIssuesElsewhere', "This extension handles issues outside of VS Code"));
            reset(descriptionSubtitle, localize('elsewhereDescription', "The '{0}' extension prefers to use an external issue reporter. To be taken to that issue reporting experience, click the button below.", selectedExtension.displayName));
            this.publicGithubButton.label = localize('openIssueReporter', "Open External Issue Reporter");
            return;
        }
        if (fileOnExtension && selectedExtension?.data) {
            const data = selectedExtension?.data;
            extensionDataTextArea.innerText = data.toString();
            extensionDataTextArea.readOnly = true;
            show(extensionDataBlock);
        }
        // only if we know comes from the open reporter command
        if (fileOnExtension && this.openReporter) {
            extensionDataTextArea.readOnly = true;
            setTimeout(() => {
                // delay to make sure from command or not
                if (this.openReporter) {
                    show(extensionDataBlock);
                }
            }, 100);
            show(extensionDataBlock);
        }
        if (issueType === 0 /* IssueType.Bug */) {
            if (!fileOnMarketplace) {
                show(blockContainer);
                show(systemBlock);
                show(experimentsBlock);
                if (!fileOnExtension) {
                    show(extensionsBlock);
                }
            }
            reset(descriptionTitle, localize('stepsToReproduce', "Steps to Reproduce") + ' ', $('span.required-input', undefined, '*'));
            reset(descriptionSubtitle, localize('bugDescription', "Share the steps needed to reliably reproduce the problem. Please include actual and expected results. We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
        }
        else if (issueType === 1 /* IssueType.PerformanceIssue */) {
            if (!fileOnMarketplace) {
                show(blockContainer);
                show(systemBlock);
                show(processBlock);
                show(workspaceBlock);
                show(experimentsBlock);
            }
            if (fileOnExtension) {
                show(extensionSelector);
            }
            else if (!fileOnMarketplace) {
                show(extensionsBlock);
            }
            reset(descriptionTitle, localize('stepsToReproduce', "Steps to Reproduce") + ' ', $('span.required-input', undefined, '*'));
            reset(descriptionSubtitle, localize('performanceIssueDesciption', "When did this performance issue happen? Does it occur on startup or after a specific series of actions? We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
        }
        else if (issueType === 2 /* IssueType.FeatureRequest */) {
            reset(descriptionTitle, localize('description', "Description") + ' ', $('span.required-input', undefined, '*'));
            reset(descriptionSubtitle, localize('featureRequestDescription', "Please describe the feature you would like to see. We support GitHub-flavored Markdown. You will be able to edit your issue and add screenshots when we preview it on GitHub."));
        }
    }
    validateInput(inputId) {
        // eslint-disable-next-line no-restricted-syntax
        const inputElement = this.getElementById(inputId);
        // eslint-disable-next-line no-restricted-syntax
        const inputValidationMessage = this.getElementById(`${inputId}-empty-error`);
        // eslint-disable-next-line no-restricted-syntax
        const descriptionShortMessage = this.getElementById(`description-short-error`);
        if (inputId === 'description' && this.nonGitHubIssueUrl && this.data.extensionId) {
            return true;
        }
        else if (!inputElement.value) {
            inputElement.classList.add('invalid-input');
            inputValidationMessage?.classList.remove('hidden');
            descriptionShortMessage?.classList.add('hidden');
            return false;
        }
        else if (inputId === 'description' && inputElement.value.length < 10) {
            inputElement.classList.add('invalid-input');
            descriptionShortMessage?.classList.remove('hidden');
            inputValidationMessage?.classList.add('hidden');
            return false;
        }
        else {
            inputElement.classList.remove('invalid-input');
            inputValidationMessage?.classList.add('hidden');
            if (inputId === 'description') {
                descriptionShortMessage?.classList.add('hidden');
            }
            return true;
        }
    }
    validateInputs() {
        let isValid = true;
        ['issue-title', 'description', 'issue-source'].forEach(elementId => {
            isValid = this.validateInput(elementId) && isValid;
        });
        if (this.issueReporterModel.fileOnExtension()) {
            isValid = this.validateInput('extension-selector') && isValid;
        }
        return isValid;
    }
    async submitToGitHub(issueTitle, issueBody, gitHubDetails) {
        const url = `https://api.github.com/repos/${gitHubDetails.owner}/${gitHubDetails.repositoryName}/issues`;
        const init = {
            method: 'POST',
            body: JSON.stringify({
                title: issueTitle,
                body: issueBody
            }),
            headers: new Headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.data.githubAccessToken}`,
                'User-Agent': 'request'
            })
        };
        const response = await fetch(url, init);
        if (!response.ok) {
            console.error('Invalid GitHub URL provided.');
            return false;
        }
        const result = await response.json();
        await this.openLink(result.html_url);
        this.close();
        return true;
    }
    async createIssue(shouldCreate, privateUri) {
        const selectedExtension = this.issueReporterModel.getData().selectedExtension;
        // Short circuit if the extension provides a custom issue handler
        if (this.nonGitHubIssueUrl) {
            const url = this.getExtensionBugsUrl();
            if (url) {
                this.hasBeenSubmitted = true;
                return true;
            }
        }
        if (!this.validateInputs()) {
            // If inputs are invalid, set focus to the first one and add listeners on them
            // to detect further changes
            // eslint-disable-next-line no-restricted-syntax
            const invalidInput = this.window.document.getElementsByClassName('invalid-input');
            if (invalidInput.length) {
                invalidInput[0].focus();
            }
            this.addEventListener('issue-title', 'input', _ => {
                this.validateInput('issue-title');
            });
            this.addEventListener('description', 'input', _ => {
                this.validateInput('description');
            });
            this.addEventListener('issue-source', 'change', _ => {
                this.validateInput('issue-source');
            });
            if (this.issueReporterModel.fileOnExtension()) {
                this.addEventListener('extension-selector', 'change', _ => {
                    this.validateInput('extension-selector');
                });
            }
            return false;
        }
        this.hasBeenSubmitted = true;
        // eslint-disable-next-line no-restricted-syntax
        const issueTitle = this.getElementById('issue-title').value;
        const issueBody = this.issueReporterModel.serialize();
        let issueUrl = privateUri ? this.getPrivateIssueUrl() : this.getIssueUrl();
        if (!issueUrl) {
            console.error(`No ${privateUri ? 'private ' : ''}issue url found`);
            return false;
        }
        if (selectedExtension?.uri) {
            const uri = URI.revive(selectedExtension.uri);
            issueUrl = uri.toString();
        }
        const gitHubDetails = this.parseGitHubUrl(issueUrl);
        if (this.data.githubAccessToken && gitHubDetails && shouldCreate) {
            return this.submitToGitHub(issueTitle, issueBody, gitHubDetails);
        }
        // eslint-disable-next-line no-restricted-syntax
        const baseUrl = this.getIssueUrlWithTitle(this.getElementById('issue-title').value, issueUrl);
        let url = baseUrl + `&body=${encodeURIComponent(issueBody)}`;
        url = this.addTemplateToUrl(url, gitHubDetails?.owner, gitHubDetails?.repositoryName);
        if (url.length > MAX_URL_LENGTH) {
            try {
                url = await this.writeToClipboard(baseUrl, issueBody);
                url = this.addTemplateToUrl(url, gitHubDetails?.owner, gitHubDetails?.repositoryName);
            }
            catch (_) {
                console.error('Writing to clipboard failed');
                return false;
            }
        }
        await this.openLink(url);
        return true;
    }
    async writeToClipboard(baseUrl, issueBody) {
        const shouldWrite = await this.issueFormService.showClipboardDialog();
        if (!shouldWrite) {
            throw new CancellationError();
        }
        return baseUrl + `&body=${encodeURIComponent(localize('pasteData', "We have written the needed data into your clipboard because it was too large to send. Please paste."))}`;
    }
    addTemplateToUrl(baseUrl, owner, repositoryName) {
        const isVscode = this.issueReporterModel.getData().fileOnProduct;
        const isMicrosoft = owner?.toLowerCase() === 'microsoft';
        const needsTemplate = isVscode || (isMicrosoft && (repositoryName === 'vscode' || repositoryName === 'vscode-python'));
        if (needsTemplate) {
            try {
                const url = new URL(baseUrl);
                url.searchParams.set('template', 'bug_report.md');
                return url.toString();
            }
            catch {
                // fallback if baseUrl is not a valid URL
                return baseUrl + '&template=bug_report.md';
            }
        }
        return baseUrl;
    }
    getIssueUrl() {
        return this.issueReporterModel.fileOnExtension()
            ? this.getExtensionGitHubUrl()
            : this.issueReporterModel.getData().fileOnMarketplace
                ? this.product.reportMarketplaceIssueUrl
                : this.product.reportIssueUrl;
    }
    // for when command 'workbench.action.openIssueReporter' passes along a
    // `privateUri` UriComponents value
    getPrivateIssueUrl() {
        return URI.revive(this.data.privateUri)?.toString();
    }
    parseGitHubUrl(url) {
        // Assumes a GitHub url to a particular repo, https://github.com/repositoryName/owner.
        // Repository name and owner cannot contain '/'
        const match = /^https?:\/\/github\.com\/([^\/]*)\/([^\/]*).*/.exec(url);
        if (match && match.length) {
            return {
                owner: match[1],
                repositoryName: match[2]
            };
        }
        else {
            console.error('No GitHub issues match');
        }
        return undefined;
    }
    getExtensionGitHubUrl() {
        let repositoryUrl = '';
        const bugsUrl = this.getExtensionBugsUrl();
        const extensionUrl = this.getExtensionRepositoryUrl();
        // If given, try to match the extension's bug url
        if (bugsUrl && bugsUrl.match(/^https?:\/\/github\.com\/([^\/]*)\/([^\/]*)\/?(\/issues)?$/)) {
            // matches exactly: https://github.com/owner/repo/issues
            repositoryUrl = normalizeGitHubUrl(bugsUrl);
        }
        else if (extensionUrl && extensionUrl.match(/^https?:\/\/github\.com\/([^\/]*)\/([^\/]*)$/)) {
            // matches exactly: https://github.com/owner/repo
            repositoryUrl = normalizeGitHubUrl(extensionUrl);
        }
        else {
            this.nonGitHubIssueUrl = true;
            repositoryUrl = bugsUrl || extensionUrl || '';
        }
        return repositoryUrl;
    }
    getIssueUrlWithTitle(issueTitle, repositoryUrl) {
        if (this.issueReporterModel.fileOnExtension()) {
            repositoryUrl = repositoryUrl + '/issues/new';
        }
        const queryStringPrefix = repositoryUrl.indexOf('?') === -1 ? '?' : '&';
        return `${repositoryUrl}${queryStringPrefix}title=${encodeURIComponent(issueTitle)}`;
    }
    clearExtensionData() {
        this.nonGitHubIssueUrl = false;
        this.issueReporterModel.update({ extensionData: undefined });
        this.data.issueBody = this.data.issueBody || '';
        this.data.data = undefined;
        this.data.uri = undefined;
        this.data.privateUri = undefined;
    }
    async updateExtensionStatus(extension) {
        this.issueReporterModel.update({ selectedExtension: extension });
        // uses this.configuuration.data to ensure that data is coming from `openReporter` command.
        const template = this.data.issueBody;
        if (template) {
            // eslint-disable-next-line no-restricted-syntax
            const descriptionTextArea = this.getElementById('description');
            const descriptionText = descriptionTextArea.value;
            if (descriptionText === '' || !descriptionText.includes(template.toString())) {
                const fullTextArea = descriptionText + (descriptionText === '' ? '' : '\n') + template.toString();
                descriptionTextArea.value = fullTextArea;
                this.issueReporterModel.update({ issueDescription: fullTextArea });
            }
        }
        const data = this.data.data;
        if (data) {
            this.issueReporterModel.update({ extensionData: data });
            extension.data = data;
            // eslint-disable-next-line no-restricted-syntax
            const extensionDataBlock = this.window.document.querySelector('.block-extension-data');
            show(extensionDataBlock);
            this.renderBlocks();
        }
        const uri = this.data.uri;
        if (uri) {
            extension.uri = uri;
            this.updateIssueReporterUri(extension);
        }
        this.validateSelectedExtension();
        // eslint-disable-next-line no-restricted-syntax
        const title = this.getElementById('issue-title').value;
        this.searchExtensionIssues(title);
        this.updateButtonStates();
        this.renderBlocks();
    }
    validateSelectedExtension() {
        // eslint-disable-next-line no-restricted-syntax
        const extensionValidationMessage = this.getElementById('extension-selection-validation-error');
        // eslint-disable-next-line no-restricted-syntax
        const extensionValidationNoUrlsMessage = this.getElementById('extension-selection-validation-error-no-url');
        hide(extensionValidationMessage);
        hide(extensionValidationNoUrlsMessage);
        const extension = this.issueReporterModel.getData().selectedExtension;
        if (!extension) {
            this.publicGithubButton.enabled = true;
            return;
        }
        if (this.loadingExtensionData) {
            return;
        }
        const hasValidGitHubUrl = this.getExtensionGitHubUrl();
        if (hasValidGitHubUrl) {
            this.publicGithubButton.enabled = true;
        }
        else {
            this.setExtensionValidationMessage();
            this.publicGithubButton.enabled = false;
        }
    }
    setLoading(element) {
        // Show loading
        this.openReporter = true;
        this.loadingExtensionData = true;
        this.updateButtonStates();
        // eslint-disable-next-line no-restricted-syntax
        const extensionDataCaption = this.getElementById('extension-id');
        hide(extensionDataCaption);
        // eslint-disable-next-line no-restricted-syntax
        const extensionDataCaption2 = Array.from(this.window.document.querySelectorAll('.ext-parens'));
        extensionDataCaption2.forEach(extensionDataCaption2 => hide(extensionDataCaption2));
        // eslint-disable-next-line no-restricted-syntax
        const showLoading = this.getElementById('ext-loading');
        show(showLoading);
        while (showLoading.firstChild) {
            showLoading.firstChild.remove();
        }
        showLoading.append(element);
        this.renderBlocks();
    }
    removeLoading(element, fromReporter = false) {
        this.openReporter = fromReporter;
        this.loadingExtensionData = false;
        this.updateButtonStates();
        // eslint-disable-next-line no-restricted-syntax
        const extensionDataCaption = this.getElementById('extension-id');
        show(extensionDataCaption);
        // eslint-disable-next-line no-restricted-syntax
        const extensionDataCaption2 = Array.from(this.window.document.querySelectorAll('.ext-parens'));
        extensionDataCaption2.forEach(extensionDataCaption2 => show(extensionDataCaption2));
        // eslint-disable-next-line no-restricted-syntax
        const hideLoading = this.getElementById('ext-loading');
        hide(hideLoading);
        if (hideLoading.firstChild) {
            element.remove();
        }
        this.renderBlocks();
    }
    setExtensionValidationMessage() {
        // eslint-disable-next-line no-restricted-syntax
        const extensionValidationMessage = this.getElementById('extension-selection-validation-error');
        // eslint-disable-next-line no-restricted-syntax
        const extensionValidationNoUrlsMessage = this.getElementById('extension-selection-validation-error-no-url');
        const bugsUrl = this.getExtensionBugsUrl();
        if (bugsUrl) {
            show(extensionValidationMessage);
            // eslint-disable-next-line no-restricted-syntax
            const link = this.getElementById('extensionBugsLink');
            link.textContent = bugsUrl;
            return;
        }
        const extensionUrl = this.getExtensionRepositoryUrl();
        if (extensionUrl) {
            show(extensionValidationMessage);
            // eslint-disable-next-line no-restricted-syntax
            const link = this.getElementById('extensionBugsLink');
            link.textContent = extensionUrl;
            return;
        }
        show(extensionValidationNoUrlsMessage);
    }
    updateProcessInfo(state) {
        // eslint-disable-next-line no-restricted-syntax
        const target = this.window.document.querySelector('.block-process .block-info');
        if (target) {
            reset(target, $('code', undefined, state.processInfo ?? ''));
        }
    }
    updateWorkspaceInfo(state) {
        // eslint-disable-next-line no-restricted-syntax
        this.window.document.querySelector('.block-workspace .block-info code').textContent = '\n' + state.workspaceInfo;
    }
    updateExtensionTable(extensions, numThemeExtensions) {
        // eslint-disable-next-line no-restricted-syntax
        const target = this.window.document.querySelector('.block-extensions .block-info');
        if (target) {
            if (this.disableExtensions) {
                reset(target, localize('disabledExtensions', "Extensions are disabled"));
                return;
            }
            const themeExclusionStr = numThemeExtensions ? `\n(${numThemeExtensions} theme extensions excluded)` : '';
            extensions = extensions || [];
            if (!extensions.length) {
                target.innerText = 'Extensions: none' + themeExclusionStr;
                return;
            }
            reset(target, this.getExtensionTableHtml(extensions), document.createTextNode(themeExclusionStr));
        }
    }
    getExtensionTableHtml(extensions) {
        return $('table', undefined, $('tr', undefined, $('th', undefined, 'Extension'), $('th', undefined, 'Author (truncated)'), $('th', undefined, 'Version')), ...extensions.map(extension => $('tr', undefined, $('td', undefined, extension.name), $('td', undefined, extension.publisher?.substr(0, 3) ?? 'N/A'), $('td', undefined, extension.version))));
    }
    async openLink(eventOrUrl) {
        if (typeof eventOrUrl === 'string') {
            // Direct URL call
            await this.openerService.open(eventOrUrl, { openExternal: true });
        }
        else {
            // MouseEvent call
            const event = eventOrUrl;
            event.preventDefault();
            event.stopPropagation();
            // Exclude right click
            if (event.which < 3) {
                await this.openerService.open(event.target.href, { openExternal: true });
            }
        }
    }
    getElementById(elementId) {
        // eslint-disable-next-line no-restricted-syntax
        const element = this.window.document.getElementById(elementId);
        if (element) {
            return element;
        }
        else {
            return undefined;
        }
    }
    addEventListener(elementId, eventType, handler) {
        // eslint-disable-next-line no-restricted-syntax
        const element = this.getElementById(elementId);
        element?.addEventListener(eventType, handler);
    }
};
__decorate([
    debounce(300)
], BaseIssueReporterService.prototype, "searchGitHub", null);
__decorate([
    debounce(300)
], BaseIssueReporterService.prototype, "searchDuplicates", null);
BaseIssueReporterService = __decorate([
    __param(6, IIssueFormService),
    __param(7, IThemeService),
    __param(8, IFileService),
    __param(9, IFileDialogService),
    __param(10, IContextMenuService),
    __param(11, IAuthenticationService),
    __param(12, IOpenerService)
], BaseIssueReporterService);
export { BaseIssueReporterService };
// helper functions
export function hide(el) {
    el?.classList.add('hidden');
}
export function show(el) {
    el?.classList.remove('hidden');
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZUlzc3VlUmVwb3J0ZXJTZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9jb250cmliL2lzc3VlL2Jyb3dzZXIvYmFzZUlzc3VlUmVwb3J0ZXJTZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7Z0dBR2dHO0FBQ2hHLE9BQU8sRUFBRSxDQUFDLEVBQUUsa0JBQWtCLEVBQUUscUJBQXFCLEVBQUUsS0FBSyxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdEcsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFDOUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLDhDQUE4QyxDQUFDO0FBQ2hILE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxxREFBcUQsQ0FBQztBQUNqRixPQUFPLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDN0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQzdELE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUM5RCxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sd0NBQXdDLENBQUM7QUFDakUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQ2pFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxNQUFNLG1DQUFtQyxDQUFDO0FBQ3RFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxzQ0FBc0MsQ0FBQztBQUNsRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sb0NBQW9DLENBQUM7QUFDN0QsT0FBTyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsTUFBTSxxQ0FBcUMsQ0FBQztBQUUvRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sc0NBQXND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