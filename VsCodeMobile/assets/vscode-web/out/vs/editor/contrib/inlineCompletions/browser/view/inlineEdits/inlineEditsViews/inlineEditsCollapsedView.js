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
import { n } from '../../../../../../../base/browser/dom.js';
import { Emitter } from '../../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../../base/common/lifecycle.js';
import { constObservable, derived } from '../../../../../../../base/common/observable.js';
import { IAccessibilityService } from '../../../../../../../platform/accessibility/common/accessibility.js';
import { asCssVariable } from '../../../../../../../platform/theme/common/colorUtils.js';
import { observableCodeEditor } from '../../../../../../browser/observableCodeEditor.js';
import { Point } from '../../../../../../common/core/2d/point.js';
import { singleTextRemoveCommonPrefix } from '../../../model/singleTextEditHelpers.js';
import { inlineEditIndicatorPrimaryBorder } from '../theme.js';
import { getEditorValidOverlayRect, PathBuilder, rectToProps } from '../utils/utils.js';
let InlineEditsCollapsedView = class InlineEditsCollapsedView extends Disposable {
    constructor(_editor, _edit, _accessibilityService) {
        super();
        this._editor = _editor;
        this._edit = _edit;
        this._accessibilityService = _accessibilityService;
        this._onDidClick = this._register(new Emitter());
        this.onDidClick = this._onDidClick.event;
        this._iconRef = n.ref();
        this.isHovered = constObservable(false);
        this._editorObs = observableCodeEditor(this._editor);
        const firstEdit = this._edit.map(inlineEdit => inlineEdit?.edit.replacements[0] ?? null);
        const startPosition = firstEdit.map(edit => edit ? singleTextRemoveCommonPrefix(edit, this._editor.getModel()).range.getStartPosition() : null);
        const observedStartPoint = this._editorObs.observePosition(startPosition, this._store);
        const startPoint = derived(reader => {
            const point = observedStartPoint.read(reader);
            if (!point) {
                return null;
            }
            const contentLeft = this._editorObs.layoutInfoContentLeft.read(reader);
            const scrollLeft = this._editorObs.scrollLeft.read(reader);
            return new Point(contentLeft + point.x - scrollLeft, point.y);
        });
        const overlayElement = n.div({
            class: 'inline-edits-collapsed-view',
            style: {
                position: 'absolute',
                overflow: 'visible',
                top: '0px',
                left: '0px',
                display: 'block',
            },
        }, [
            [this.getCollapsedIndicator(startPoint)],
        ]).keepUpdated(this._store).element;
        this._register(this._editorObs.createOverlayWidget({
            domNode: overlayElement,
            position: constObservable(null),
            allowEditorOverflow: false,
            minContentWidthInPx: constObservable(0),
        }));
        this.isVisible = this._edit.map((inlineEdit, reader) => !!inlineEdit && startPoint.read(reader) !== null);
    }
    triggerAnimation() {
        if (this._accessibilityService.isMotionReduced()) {
            return new Animation(null, null).finished;
        }
        // PULSE ANIMATION:
        const animation = this._iconRef.element.animate([
            { offset: 0.00, transform: 'translateY(-3px)', },
            { offset: 0.20, transform: 'translateY(1px)', },
            { offset: 0.36, transform: 'translateY(-1px)', },
            { offset: 0.52, transform: 'translateY(1px)', },
            { offset: 0.68, transform: 'translateY(-1px)', },
            { offset: 0.84, transform: 'translateY(1px)', },
            { offset: 1.00, transform: 'translateY(0px)', },
        ], { duration: 2000 });
        return animation.finished;
    }
    getCollapsedIndicator(startPoint) {
        const contentLeft = this._editorObs.layoutInfoContentLeft;
        const startPointTranslated = startPoint.map((p, reader) => p ? p.deltaX(-contentLeft.read(reader)) : null);
        const iconPath = this.createIconPath(startPointTranslated);
        return n.svg({
            class: 'collapsedView',
            ref: this._iconRef,
            style: {
                position: 'absolute',
                ...rectToProps((r) => getEditorValidOverlayRect(this._editorObs).read(r)),
                overflow: 'hidden',
                pointerEvents: 'none',
            }
        }, [
            n.svgElem('path', {
                class: 'collapsedViewPath',
                d: iconPath,
                fill: asCssVariable(inlineEditIndicatorPrimaryBorder),
            }),
        ]);
    }
    createIconPath(indicatorPoint) {
        const width = 6;
        const triangleHeight = 3;
        const baseHeight = 1;
        return indicatorPoint.map(point => {
            if (!point) {
                return new PathBuilder().build();
            }
            const baseTopLeft = point.deltaX(-width / 2).deltaY(-baseHeight);
            const baseTopRight = baseTopLeft.deltaX(width);
            const baseBottomLeft = baseTopLeft.deltaY(baseHeight);
            const baseBottomRight = baseTopRight.deltaY(baseHeight);
            const triangleBottomCenter = baseBottomLeft.deltaX(width / 2).deltaY(triangleHeight);
            return new PathBuilder()
                .moveTo(baseTopLeft)
                .lineTo(baseTopRight)
                .lineTo(baseBottomRight)
                .lineTo(triangleBottomCenter)
                .lineTo(baseBottomLeft)
                .lineTo(baseTopLeft)
                .build();
        });
    }
};
InlineEditsCollapsedView = __decorate([
    __param(2, IAccessibilityService)
], InlineEditsCollapsedView);
export { InlineEditsCollapsedView };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5saW5lRWRpdHNDb2xsYXBzZWRWaWV3LmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvdmlldy9pbmxpbmVFZGl0cy9pbmxpbmVFZGl0c1ZpZXdzL2lubGluZUVkaXRzQ29sbGFwc2VkVmlldy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7O2dHQUdnRztBQUNoRyxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFN0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ3BFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSwrQ0FBK0MsQ0FBQztBQUMzRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBZSxNQUFNLGdEQUFnRCxDQUFDO0FBQ3ZHLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLHFFQUFxRSxDQUFDO0FBQzVHLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSwwREFBMEQsQ0FBQztBQUV6RixPQUFPLEVBQXdCLG9CQUFvQixFQUFFLE1BQU0sbURBQW1ELENBQUM7QUFDL0csT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLDJDQUEyQyxDQUFDO0FBQ2xFLE9BQU8sRUFBRSw0QkFBNEIsRUFBRSxNQUFNLHlDQUF5QyxDQUFDO0FBR3ZGLE9BQU8sRUFBRSxnQ0FBZ0MsRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUMvRCxPQUFPLEVBQUUseUJBQXlCLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRWpGLElBQU0sd0JBQXdCLEdBQTlCLE1BQU0sd0JBQXlCLFNBQVEsVUFBVTtJQVV2RCxZQUNrQixPQUFvQixFQUNwQixLQUFxRCxFQUMvQyxxQkFBNkQ7UUFFcEYsS0FBSyxFQUFFLENBQUM7UUFKUyxZQUFPLEdBQVAs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