/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ExplorerTestCoverageBars_1;
import { h } from '../../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Lazy } from '../../../../base/common/lazy.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { autorun, observableValue } from '../../../../base/common/observable.js';
import { isDefined } from '../../../../base/common/types.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import * as coverUtils from './codeCoverageDisplayUtils.js';
import { getTestingConfiguration, observeTestingConfiguration } from '../common/configuration.js';
import { ITestCoverageService } from '../common/testCoverageService.js';
import { safeIntl } from '../../../../base/common/date.js';
let ManagedTestCoverageBars = class ManagedTestCoverageBars extends Disposable {
    /** Gets whether coverage is currently visible for the resource. */
    get visible() {
        return !!this._coverage;
    }
    constructor(options, configurationService, hoverService) {
        super();
        this.options = options;
        this.configurationService = configurationService;
        this.hoverService = hoverService;
        this.el = new Lazy(() => {
            if (this.options.compact) {
                const el = h('.test-coverage-bars.compact', [
                    h('.tpc@overall'),
                    h('.bar@tpcBar'),
                ]);
                this.attachHover(el.tpcBar, getOverallHoverText);
                return el;
            }
            else {
                const el = h('.test-coverage-bars', [
                    h('.tpc@overall'),
                    h('.bar@statement'),
                    h('.bar@function'),
                    h('.bar@branch'),
                ]);
                this.attachHover(el.statement, stmtCoverageText);
                this.attachHover(el.function, fnCoverageText);
                this.attachHover(el.branch, branchCoverageText);
                return el;
            }
        });
        this.visibleStore = this._register(new DisposableStore());
        this.customHovers = [];
    }
    attachHover(target, factory) {
        this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('element'), target, () => this._coverage && factory(this._coverage)));
    }
    setCoverageInfo(coverage) {
        const ds = this.visibleStore;
        if (!coverage) {
            if (this._coverage) {
                this._coverage = undefined;
                this.customHovers.forEach(c => c.hide());
                ds.clear();
            }
            return;
        }
        if (!this._coverage) {
            const root = this.el.value.root;
            ds.add(toDisposable(() => root.remove()));
            this.options.container.appendChild(root);
            ds.add(this.configurationService.onDidChangeConfiguration(c => {
                if (!this._coverage) {
                    return;
                }
                if (c.affectsConfiguration("testing.displayedCoveragePercent" /* TestingConfigKeys.CoveragePercent */) || c.affectsConfiguration("testing.coverageBarThresholds" /* TestingConfigKeys.CoverageBarThresholds */)) {
                    this.doRender(this._coverage);
                }
            }));
        }
        this._coverage = coverage;
        this.doRender(coverage);
    }
    doRender(coverage) {
        const el = this.el.value;
        const precision = this.options.compact ? 0 : 2;
        const thresholds = getTestingConfiguration(this.configurationService, "testing.coverageBarThresholds" /* TestingConfigKeys.CoverageBarThresholds */);
        const overallStat = coverUtils.calculateDisplayedStat(coverage, getTestingConfiguration(this.configurationService, "testing.displayedCoveragePercent" /* TestingConfigKeys.CoveragePercent */));
        if (this.options.overall !== false) {
            el.overall.textContent = coverUtils.displayPercent(overallStat, precision);
        }
        else {
            el.overall.style.display = 'none';
        }
        if ('tpcBar' in el) { // compact mode
            renderBar(el.tpcBar, overallStat, false, thresholds);
        }
        else {
            renderBar(el.statement, coverUtils.percent(coverage.statement), coverage.statement.total === 0, thresholds);
            renderBar(el.function, coverage.declaration && coverUtils.percent(coverage.declaration), coverage.declaration?.total === 0, thresholds);
            renderBar(el.branch, coverage.branch && coverUtils.percent(coverage.branch), coverage.branch?.total === 0, thresholds);
        }
    }
};
ManagedTestCoverageBars = __decorate([
    __param(1, IConfigurationService),
    __param(2, IHoverService)
], ManagedTestCoverageBars);
export { ManagedTestCoverageBars };
const barWidth = 16;
const renderBar = (bar, pct, isZero, thresholds) => {
    if (pct === undefined) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'block';
    bar.style.width = `${barWidth}px`;
    // this is floored so the bar is only completely filled at 100% and not 99.9%
    bar.style.setProperty('--test-bar-width', `${Math.floor(pct * 16)}px`);
    if (isZero) {
        bar.style.color = 'currentColor';
        bar.style.opacity = '0.5';
        return;
    }
    bar.style.color = coverUtils.getCoverageColor(pct, thresholds);
    bar.style.opacity = '1';
};
const nf = safeIntl.NumberFormat();
const stmtCoverageText = (coverage) => localize('statementCoverage', '{0}/{1} statements covered ({2})', nf.value.format(coverage.statement.covered), nf.value.format(coverage.statement.total), coverUtils.displayPercent(coverUtils.percent(coverage.statement)));
const fnCoverageText = (coverage) => coverage.declaration && localize('functionCoverage', '{0}/{1} functions covered ({2})', nf.value.format(coverage.declaration.covered), nf.value.format(coverage.declaration.total), coverUtils.displayPercent(coverUtils.percent(coverage.declaration)));
const branchCoverageText = (coverage) => coverage.branch && localize('branchCoverage', '{0}/{1} branches covered ({2})', nf.value.format(coverage.branch.covered), nf.value.format(coverage.branch.total), coverUtils.displayPercent(coverUtils.percent(coverage.branch)));
const getOverallHoverText = (coverage) => {
    const str = [
        stmtCoverageText(coverage),
        fnCoverageText(coverage),
        branchCoverageText(coverage),
    ].filter(isDefined).join('\n\n');
    return {
        markdown: new MarkdownString().appendText(str),
        markdownNotSupportedFallback: str
    };
};
/**
 * Renders test coverage bars for a resource in the given container. It will
 * not render anything unless a test coverage report has been opened.
 */
let ExplorerTestCoverageBars = class ExplorerTestCoverageBars extends ManagedTestCoverageBars {
    static { ExplorerTestCoverageBars_1 = this; }
    static { this.hasRegistered = false; }
    static register() {
        if (this.hasRegistered) {
            return;
        }
        this.hasRegistered = true;
        Registry.as("workbench.registry.explorer.fileContributions" /* ExplorerExtensions.FileContributionRegistry */).register({
            create(insta, container) {
                return insta.createInstance(ExplorerTestCoverageBars_1, { compact: true, container });
            },
        });
    }
    constructor(options, configurationService, hoverService, testCoverageService) {
        super(options, configurationService, hoverService);
        this.resource = observableValue(this, undefined);
        const isEnabled = observeTestingConfiguration(configurationService, "testing.showCoverageInExplorer" /* TestingConfigKeys.ShowCoverageInExplorer */);
        this._register(autorun(async (reader) => {
            let info;
            const coverage = testCoverageService.selected.read(reader);
            if (coverage && isEnabled.read(reader)) {
                const resource = this.resource.read(reader);
                if (resource) {
                    info = coverage.getComputedForUri(resource);
                }
            }
            this.setCoverageInfo(info);
        }));
    }
    /** @inheritdoc */
    setResource(resource, transaction) {
        this.resource.set(resource, transaction);
    }
    setCoverageInfo(coverage) {
        super.setCoverageInfo(coverage);
        this.options.container?.classList.toggle('explorer-item-with-test-coverage', this.visible);
    }
};
ExplorerTestCoverageBars = ExplorerTestCoverageBars_1 = __decorate([
    __param(1, IConfigurationService),
    __param(2, IHoverService),
    __param(3, ITestCoverageService)
], ExplorerTestCoverageBars);
export { ExplorerTestCoverageBars };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdENvdmVyYWdlQmFycy5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2Jyb3dzZXIvdGVzdENvdmVyYWdlQmFycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRzs7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLENBQUMsRUFBRSxNQUFNLGlDQUFpQyxDQUFDO0FBRXBELE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLDJEQUEyRCxDQUFDO0FBQ3BHLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx3Q0FBd0MsQ0FBQztBQUN4RSxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFDdkQsT0FBTyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLE1BQU0sc0NBQXNDLENBQUM7QUFDakcsT0FBTyxFQUFnQixPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sdUNBQXVDLENBQUM7QUFDL0YsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBRTdELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM5QyxPQUFPLEVBQUUscUJBQXFCLEVBQUUsTUFBTSw0REFBNEQsQ0FBQztBQUNuRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sNkNBQTZDLENBQUM7QUFDNUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtEQUFrRCxDQUFDO0FBRTVFLE9BQU8sS0FBSyxVQUFVLE1BQU0sK0JBQStCLENBQUM7QUFDNUQsT0FBTyxFQUFvRCx1QkFBdUIsRUFBRSwyQkFBMkIsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBRXBKLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQ3hFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQztB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