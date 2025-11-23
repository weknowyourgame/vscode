/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { isHTMLElement } from '../../../base/browser/dom.js';
import { isManagedHoverTooltipMarkdownString } from '../../../base/browser/ui/hover/hover.js';
import { CancellationTokenSource } from '../../../base/common/cancellation.js';
import { isMarkdownString } from '../../../base/common/htmlContent.js';
import { isFunction, isString } from '../../../base/common/types.js';
import { localize } from '../../../nls.js';
export class ManagedHoverWidget {
    constructor(hoverDelegate, target, fadeInAnimation) {
        this.hoverDelegate = hoverDelegate;
        this.target = target;
        this.fadeInAnimation = fadeInAnimation;
    }
    onDidHide() {
        if (this._cancellationTokenSource) {
            // there's an computation ongoing, cancel it
            this._cancellationTokenSource.dispose(true);
            this._cancellationTokenSource = undefined;
        }
    }
    async update(content, focus, options) {
        if (this._cancellationTokenSource) {
            // there's an computation ongoing, cancel it
            this._cancellationTokenSource.dispose(true);
            this._cancellationTokenSource = undefined;
        }
        if (this.isDisposed) {
            return;
        }
        let resolvedContent;
        if (isString(content) || isHTMLElement(content) || content === undefined) {
            resolvedContent = content;
        }
        else {
            // compute the content, potentially long-running
            this._cancellationTokenSource = new CancellationTokenSource();
            const token = this._cancellationTokenSource.token;
            let managedContent;
            if (isManagedHoverTooltipMarkdownString(content)) {
                if (isFunction(content.markdown)) {
                    managedContent = content.markdown(token).then(resolvedContent => resolvedContent ?? content.markdownNotSupportedFallback);
                }
                else {
                    managedContent = content.markdown ?? content.markdownNotSupportedFallback;
                }
            }
            else {
                managedContent = content.element(token);
            }
            // compute the content
            if (managedContent instanceof Promise) {
                // show 'Loading' if no hover is up yet
                if (!this._hoverWidget) {
                    this.show(localize('iconLabel.loading', "Loading..."), focus, options);
                }
                resolvedContent = await managedContent;
            }
            else {
                resolvedContent = managedContent;
            }
            if (this.isDisposed || token.isCancellationRequested) {
                // either the widget has been closed in the meantime
                // or there has been a new call to `update`
                return;
            }
        }
        this.show(resolvedContent, focus, options);
    }
    show(content, focus, options) {
        const oldHoverWidget = this._hoverWidget;
        if (this.hasContent(content)) {
            const hoverOptions = {
                content,
                target: this.target,
                actions: options?.actions,
                linkHandler: options?.linkHandler,
                trapFocus: options?.trapFocus,
                appearance: {
                    showPointer: this.hoverDelegate.placement === 'element',
                    skipFadeInAnimation: !this.fadeInAnimation || !!oldHoverWidget, // do not fade in if the hover is already showing
                    showHoverHint: options?.appearance?.showHoverHint,
                },
                position: {
                    hoverPosition: 2 /* HoverPosition.BELOW */,
                },
            };
            this._hoverWidget = this.hoverDelegate.showHover(hoverOptions, focus);
        }
        oldHoverWidget?.dispose();
    }
    hasContent(content) {
        if (!content) {
            return false;
        }
        if (isMarkdownString(content)) {
            return !!content.value;
        }
        return true;
    }
    get isDisposed() {
        return this._hoverWidget?.isDisposed;
    }
    dispose() {
        this._hoverWidget?.dispose();
        this._cancellationTokenSource?.dispose(true);
        this._cancellationTokenSource = undefined;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRhYmxlSG92ZXJXaWRnZXQuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci91cGRhdGFibGVIb3ZlcldpZGdldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O2dHQUdnRztBQUVoRyxPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFDN0QsT0FBTyxFQUFFLG1DQUFtQyxFQUEyRSxNQUFNLHlDQUF5QyxDQUFDO0FBR3ZLLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBQy9FLE9BQU8sRUFBRSxnQkFBZ0IsRUFBd0IsTUFBTSxxQ0FBcUMsQ0FBQztBQUU3RixPQUFPLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBQ3JFLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUkzQyxNQUFNLE9BQU8sa0JBQWtCO0lBSzlCLFlBQW9CLGFBQTZCLEVBQVUsTUFBMEMsRUFBVSxlQUF3QjtRQUFuSCxrQkFBYSxHQUFiLGFBQWEsQ0FBZ0I7UUFBVSxXQUFNLEdBQU4sTUFBTSxDQUFvQztRQUFVLG9CQUFlLEdBQWYsZUFBZSxDQUFTO0lBQUksQ0FBQztJQUU1SSxTQUFTO1FBQ1IsSUFBSSxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUNuQyw0Q0FBNEM7WUFDNUMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM1QyxJQUFJLENBQUMsd0JBQXdCLEdBQUcsU0FBUyxDQUFDO1FBQzNDLENBQUM7SUFDRixDQUFDO0lBRUQsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUE2QixFQUFFLEtBQWUsRUFBRSxPQUE4QjtRQUMxRixJQUFJLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ25DLDRDQUE0QztZ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