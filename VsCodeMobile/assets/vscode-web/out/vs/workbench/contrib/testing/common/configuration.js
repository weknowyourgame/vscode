/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { observableFromEvent } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions } from '../../../common/configuration.js';
export var TestingConfigKeys;
(function (TestingConfigKeys) {
    TestingConfigKeys["AutoOpenPeekView"] = "testing.automaticallyOpenPeekView";
    TestingConfigKeys["AutoOpenPeekViewDuringContinuousRun"] = "testing.automaticallyOpenPeekViewDuringAutoRun";
    TestingConfigKeys["OpenResults"] = "testing.automaticallyOpenTestResults";
    TestingConfigKeys["FollowRunningTest"] = "testing.followRunningTest";
    TestingConfigKeys["DefaultGutterClickAction"] = "testing.defaultGutterClickAction";
    TestingConfigKeys["GutterEnabled"] = "testing.gutterEnabled";
    TestingConfigKeys["SaveBeforeTest"] = "testing.saveBeforeTest";
    TestingConfigKeys["AlwaysRevealTestOnStateChange"] = "testing.alwaysRevealTestOnStateChange";
    TestingConfigKeys["CountBadge"] = "testing.countBadge";
    TestingConfigKeys["ShowAllMessages"] = "testing.showAllMessages";
    TestingConfigKeys["CoveragePercent"] = "testing.displayedCoveragePercent";
    TestingConfigKeys["ShowCoverageInExplorer"] = "testing.showCoverageInExplorer";
    TestingConfigKeys["CoverageBarThresholds"] = "testing.coverageBarThresholds";
    TestingConfigKeys["CoverageToolbarEnabled"] = "testing.coverageToolbarEnabled";
    TestingConfigKeys["ResultsViewLayout"] = "testing.resultsView.layout";
})(TestingConfigKeys || (TestingConfigKeys = {}));
export var AutoOpenTesting;
(function (AutoOpenTesting) {
    AutoOpenTesting["NeverOpen"] = "neverOpen";
    AutoOpenTesting["OpenOnTestStart"] = "openOnTestStart";
    AutoOpenTesting["OpenOnTestFailure"] = "openOnTestFailure";
    AutoOpenTesting["OpenExplorerOnTestStart"] = "openExplorerOnTestStart";
})(AutoOpenTesting || (AutoOpenTesting = {}));
export var AutoOpenPeekViewWhen;
(function (AutoOpenPeekViewWhen) {
    AutoOpenPeekViewWhen["FailureVisible"] = "failureInVisibleDocument";
    AutoOpenPeekViewWhen["FailureAnywhere"] = "failureAnywhere";
    AutoOpenPeekViewWhen["Never"] = "never";
})(AutoOpenPeekViewWhen || (AutoOpenPeekViewWhen = {}));
export var DefaultGutterClickAction;
(function (DefaultGutterClickAction) {
    DefaultGutterClickAction["Run"] = "run";
    DefaultGutterClickAction["Debug"] = "debug";
    DefaultGutterClickAction["Coverage"] = "runWithCoverage";
    DefaultGutterClickAction["ContextMenu"] = "contextMenu";
})(DefaultGutterClickAction || (DefaultGutterClickAction = {}));
export var TestingCountBadge;
(function (TestingCountBadge) {
    TestingCountBadge["Failed"] = "failed";
    TestingCountBadge["Off"] = "off";
    TestingCountBadge["Passed"] = "passed";
    TestingCountBadge["Skipped"] = "skipped";
})(TestingCountBadge || (TestingCountBadge = {}));
export var TestingDisplayedCoveragePercent;
(function (TestingDisplayedCoveragePercent) {
    TestingDisplayedCoveragePercent["TotalCoverage"] = "totalCoverage";
    TestingDisplayedCoveragePercent["Statement"] = "statement";
    TestingDisplayedCoveragePercent["Minimum"] = "minimum";
})(TestingDisplayedCoveragePercent || (TestingDisplayedCoveragePercent = {}));
export var TestingResultsViewLayout;
(function (TestingResultsViewLayout) {
    TestingResultsViewLayout["TreeLeft"] = "treeLeft";
    TestingResultsViewLayout["TreeRight"] = "treeRight";
})(TestingResultsViewLayout || (TestingResultsViewLayout = {}));
export const testingConfiguration = {
    id: 'testing',
    order: 21,
    title: localize('testConfigurationTitle', "Testing"),
    type: 'object',
    properties: {
        ["testing.automaticallyOpenPeekView" /* TestingConfigKeys.AutoOpenPeekView */]: {
            description: localize('testing.automaticallyOpenPeekView', "Configures when the error Peek view is automatically opened."),
            enum: [
                "failureAnywhere" /* AutoOpenPeekViewWhen.FailureAnywhere */,
                "failureInVisibleDocument" /* AutoOpenPeekViewWhen.FailureVisible */,
                "never" /* AutoOpenPeekViewWhen.Never */,
            ],
            default: "never" /* AutoOpenPeekViewWhen.Never */,
            enumDescriptions: [
                localize('testing.automaticallyOpenPeekView.failureAnywhere', "Open automatically no matter where the failure is."),
                localize('testing.automaticallyOpenPeekView.failureInVisibleDocument', "Open automatically when a test fails in a visible document."),
                localize('testing.automaticallyOpenPeekView.never', "Never automatically open."),
            ],
        },
        ["testing.showAllMessages" /* TestingConfigKeys.ShowAllMessages */]: {
            description: localize('testing.showAllMessages', "Controls whether to show messages from all test runs."),
            type: 'boolean',
            default: false,
        },
        ["testing.automaticallyOpenPeekViewDuringAutoRun" /* TestingConfigKeys.AutoOpenPeekViewDuringContinuousRun */]: {
            description: localize('testing.automaticallyOpenPeekViewDuringContinuousRun', "Controls whether to automatically open the Peek view during continuous run mode."),
            type: 'boolean',
            default: false,
        },
        ["testing.countBadge" /* TestingConfigKeys.CountBadge */]: {
            description: localize('testing.countBadge', 'Controls the count badge on the Testing icon on the Activity Bar.'),
            enum: [
                "failed" /* TestingCountBadge.Failed */,
                "off" /* TestingCountBadge.Off */,
                "passed" /* TestingCountBadge.Passed */,
                "skipped" /* TestingCountBadge.Skipped */,
            ],
            enumDescriptions: [
                localize('testing.countBadge.failed', 'Show the number of failed tests'),
                localize('testing.countBadge.off', 'Disable the testing count badge'),
                localize('testing.countBadge.passed', 'Show the number of passed tests'),
                localize('testing.countBadge.skipped', 'Show the number of skipped tests'),
            ],
            default: "failed" /* TestingCountBadge.Failed */,
        },
        ["testing.followRunningTest" /* TestingConfigKeys.FollowRunningTest */]: {
            description: localize('testing.followRunningTest', 'Controls whether the running test should be followed in the Test Explorer view.'),
            type: 'boolean',
            default: false,
        },
        ["testing.defaultGutterClickAction" /* TestingConfigKeys.DefaultGutterClickAction */]: {
            description: localize('testing.defaultGutterClickAction', 'Controls the action to take when left-clicking on a test decoration in the gutter.'),
            enum: [
                "run" /* DefaultGutterClickAction.Run */,
                "debug" /* DefaultGutterClickAction.Debug */,
                "runWithCoverage" /* DefaultGutterClickAction.Coverage */,
                "contextMenu" /* DefaultGutterClickAction.ContextMenu */,
            ],
            enumDescriptions: [
                localize('testing.defaultGutterClickAction.run', 'Run the test.'),
                localize('testing.defaultGutterClickAction.debug', 'Debug the test.'),
                localize('testing.defaultGutterClickAction.coverage', 'Run the test with coverage.'),
                localize('testing.defaultGutterClickAction.contextMenu', 'Open the context menu for more options.'),
            ],
            default: "run" /* DefaultGutterClickAction.Run */,
        },
        ["testing.gutterEnabled" /* TestingConfigKeys.GutterEnabled */]: {
            description: localize('testing.gutterEnabled', 'Controls whether test decorations are shown in the editor gutter.'),
            type: 'boolean',
            default: true,
        },
        ["testing.saveBeforeTest" /* TestingConfigKeys.SaveBeforeTest */]: {
            description: localize('testing.saveBeforeTest', 'Control whether save all dirty editors before running a test.'),
            type: 'boolean',
            default: true,
        },
        ["testing.automaticallyOpenTestResults" /* TestingConfigKeys.OpenResults */]: {
            enum: [
                "neverOpen" /* AutoOpenTesting.NeverOpen */,
                "openOnTestStart" /* AutoOpenTesting.OpenOnTestStart */,
                "openOnTestFailure" /* AutoOpenTesting.OpenOnTestFailure */,
                "openExplorerOnTestStart" /* AutoOpenTesting.OpenExplorerOnTestStart */,
            ],
            enumDescriptions: [
                localize('testing.openTesting.neverOpen', 'Never automatically open the testing views'),
                localize('testing.openTesting.openOnTestStart', 'Open the test results view when tests start'),
                localize('testing.openTesting.openOnTestFailure', 'Open the test result view on any test failure'),
                localize('testing.openTesting.openExplorerOnTestStart', 'Open the test explorer when tests start'),
            ],
            default: 'openOnTestStart',
            description: localize('testing.openTesting', "Controls when the testing view should open.")
        },
        ["testing.alwaysRevealTestOnStateChange" /* TestingConfigKeys.AlwaysRevealTestOnStateChange */]: {
            markdownDescription: localize('testing.alwaysRevealTestOnStateChange', "Always reveal the executed test when {0} is on. If this setting is turned off, only failed tests will be revealed.", '`#testing.followRunningTest#`'),
            type: 'boolean',
            default: false,
        },
        ["testing.showCoverageInExplorer" /* TestingConfigKeys.ShowCoverageInExplorer */]: {
            description: localize('testing.ShowCoverageInExplorer', "Whether test coverage should be down in the File Explorer view."),
            type: 'boolean',
            default: true,
        },
        ["testing.displayedCoveragePercent" /* TestingConfigKeys.CoveragePercent */]: {
            markdownDescription: localize('testing.displayedCoveragePercent', "Configures what percentage is displayed by default for test coverage."),
            default: "totalCoverage" /* TestingDisplayedCoveragePercent.TotalCoverage */,
            enum: [
                "totalCoverage" /* TestingDisplayedCoveragePercent.TotalCoverage */,
                "statement" /* TestingDisplayedCoveragePercent.Statement */,
                "minimum" /* TestingDisplayedCoveragePercent.Minimum */,
            ],
            enumDescriptions: [
                localize('testing.displayedCoveragePercent.totalCoverage', 'A calculation of the combined statement, function, and branch coverage.'),
                localize('testing.displayedCoveragePercent.statement', 'The statement coverage.'),
                localize('testing.displayedCoveragePercent.minimum', 'The minimum of statement, function, and branch coverage.'),
            ],
        },
        ["testing.coverageBarThresholds" /* TestingConfigKeys.CoverageBarThresholds */]: {
            markdownDescription: localize('testing.coverageBarThresholds', "Configures the colors used for percentages in test coverage bars."),
            default: { red: 0, yellow: 60, green: 90 },
            properties: {
                red: { type: 'number', minimum: 0, maximum: 100, default: 0 },
                yellow: { type: 'number', minimum: 0, maximum: 100, default: 60 },
                green: { type: 'number', minimum: 0, maximum: 100, default: 90 },
            },
        },
        ["testing.coverageToolbarEnabled" /* TestingConfigKeys.CoverageToolbarEnabled */]: {
            description: localize('testing.coverageToolbarEnabled', 'Controls whether the coverage toolbar is shown in the editor.'),
            type: 'boolean',
            default: false, // todo@connor4312: disabled by default until UI sync
        },
        ["testing.resultsView.layout" /* TestingConfigKeys.ResultsViewLayout */]: {
            description: localize('testing.resultsView.layout', 'Controls the layout of the Test Results view.'),
            enum: [
                "treeRight" /* TestingResultsViewLayout.TreeRight */,
                "treeLeft" /* TestingResultsViewLayout.TreeLeft */,
            ],
            enumDescriptions: [
                localize('testing.resultsView.layout.treeRight', 'Show the test run tree on the right side with details on the left.'),
                localize('testing.resultsView.layout.treeLeft', 'Show the test run tree on the left side with details on the right.'),
            ],
            default: "treeRight" /* TestingResultsViewLayout.TreeRight */,
        },
    }
};
Registry.as(Extensions.ConfigurationMigration)
    .registerConfigurationMigrations([{
        key: 'testing.openTesting',
        migrateFn: (value) => {
            return [["testing.automaticallyOpenTestResults" /* TestingConfigKeys.OpenResults */, { value }]];
        }
    }, {
        key: 'testing.automaticallyOpenResults', // insiders only during 1.96, remove after 1.97
        migrateFn: (value) => {
            return [["testing.automaticallyOpenTestResults" /* TestingConfigKeys.OpenResults */, { value }]];
        }
    }]);
export const getTestingConfiguration = (config, key) => config.getValue(key);
export const observeTestingConfiguration = (config, key) => observableFromEvent(config.onDidChangeConfiguration, () => getTestingConfiguration(config, key));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlndXJhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi9jb25maWd1cmF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHVDQUF1QyxDQUFDO0FBQzVFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUc5QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sa0RBQWtELENBQUM7QUFDNUUsT0FBTyxFQUE4QixVQUFVLEVBQW1DLE1BQU0sa0NBQWtDLENBQUM7QUFFM0gsTUFBTSxDQUFOLElBQWtCLGlCQWdCakI7QUFoQkQsV0FBa0IsaUJBQWlCO0lBQ2xDLDJFQUFzRCxDQUFBO0lBQ3RELDJHQUFzRixDQUFBO0lBQ3RGLHlFQUFvRCxDQUFBO0lBQ3BELG9FQUErQyxDQUFBO0lBQy9DLGtGQUE2RCxDQUFBO0lBQzdELDREQUF1QyxDQUFBO0lBQ3ZDLDhEQUF5QyxDQUFBO0lBQ3pDLDRGQUF1RSxDQUFBO0lBQ3ZFLHNEQUFpQyxDQUFBO0lBQ2pDLGdFQUEyQyxDQUFBO0lBQzNDLHlFQUFvRCxDQUFBO0lBQ3BELDhFQUF5RCxDQUFBO0lBQ3pELDRFQUF1RCxDQUFBO0lBQ3ZELDhFQUF5RCxDQUFBO0lBQ3pELHFFQUFnRCxDQUFBO0FBQ2pELENBQUMsRUFoQmlCLGlCQUFpQixLQUFqQixpQkFBaUIsUUFnQmxDO0FBRUQsTUFBTSxDQUFOLElBQWtCLGVBS2pCO0FBTEQsV0FBa0IsZUFBZTtJQUNoQywwQ0FBdUIsQ0FBQTtJQUN2QixzREFBbUMsQ0FBQTtJQUNuQywwREFBdUMsQ0FBQTtJQUN2QyxzRUFBbUQsQ0FBQTtBQUNwRCxDQUFDLEVBTGlCLGVBQWUsS0FBZixlQUFlLFFBS2hDO0FBRUQsTUFBTSxDQUFOLElB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