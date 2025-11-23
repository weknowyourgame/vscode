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
import { AbstractTree } from './abstractTree.js';
import { CompressibleObjectTreeModel } from './compressedObjectTreeModel.js';
import { ObjectTreeModel } from './objectTreeModel.js';
import { memoize } from '../../../common/decorators.js';
import { Iterable } from '../../../common/iterator.js';
export class ObjectTree extends AbstractTree {
    get onDidChangeCollapseState() { return this.model.onDidChangeCollapseState; }
    constructor(user, container, delegate, renderers, options = {}) {
        super(user, container, delegate, renderers, options);
        this.user = user;
    }
    setChildren(element, children = Iterable.empty(), options) {
        this.model.setChildren(element, children, options);
    }
    rerender(element) {
        if (element === undefined) {
            this.view.rerender();
            return;
        }
        this.model.rerender(element);
    }
    updateElementHeight(element, height) {
        const elementIndex = this.model.getListIndex(element);
        if (elementIndex === -1) {
            return;
        }
        this.view.updateElementHeight(elementIndex, height);
    }
    resort(element, recursive = true) {
        this.model.resort(element, recursive);
    }
    hasElement(element) {
        return this.model.has(element);
    }
    createModel(user, options) {
        return new ObjectTreeModel(user, options);
    }
}
class CompressibleRenderer {
    get compressedTreeNodeProvider() {
        return this._compressedTreeNodeProvider();
    }
    constructor(_compressedTreeNodeProvider, stickyScrollDelegate, renderer) {
        this._compressedTreeNodeProvider = _compressedTreeNodeProvider;
        this.stickyScrollDelegate = stickyScrollDelegate;
        this.renderer = renderer;
        this.templateId = renderer.templateId;
        if (renderer.onDidChangeTwistieState) {
            this.onDidChangeTwistieState = renderer.onDidChangeTwistieState;
        }
    }
    renderTemplate(container) {
        const data = this.renderer.renderTemplate(container);
        return { compressedTreeNode: undefined, data };
    }
    renderElement(node, index, templateData, details) {
        let compressedTreeNode = this.stickyScrollDelegate.getCompressedNode(node);
        if (!compressedTreeNode) {
            compressedTreeNode = this.compressedTreeNodeProvider.getCompressedTreeNode(node.element);
        }
        if (compressedTreeNode.element.elements.length === 1) {
            templateData.compressedTreeNode = undefined;
            this.renderer.renderElement(node, index, templateData.data, details);
        }
        else {
            templateData.compressedTreeNode = compressedTreeNode;
            this.renderer.renderCompressedElements(compressedTreeNode, index, templateData.data, details);
        }
    }
    disposeElement(node, index, templateData, details) {
        if (templateData.compressedTreeNode) {
            this.renderer.disposeCompressedElements?.(templateData.compressedTreeNode, index, templateData.data, details);
        }
        else {
            this.renderer.disposeElement?.(node, index, templateData.data, details);
        }
    }
    disposeTemplate(templateData) {
        this.renderer.disposeTemplate(templateData.data);
    }
    renderTwistie(element, twistieElement) {
        return this.renderer.renderTwistie?.(element, twistieElement) ?? false;
    }
}
__decorate([
    memoize
], CompressibleRenderer.prototype, "compressedTreeNodeProvider", null);
class CompressibleStickyScrollDelegate {
    constructor(modelProvider) {
        this.modelProvider = modelProvider;
        this.compressedStickyNodes = new Map();
    }
    getCompressedNode(node) {
        return this.compressedStickyNodes.get(node);
    }
    constrainStickyScrollNodes(stickyNodes, stickyScrollMaxItemCount, maxWidgetHeight) {
        this.compressedStickyNodes.clear();
        if (stickyNodes.length === 0) {
            return [];
        }
        for (let i = 0; i < stickyNodes.length; i++) {
            const stickyNode = stickyNodes[i];
            const stickyNodeBottom = stickyNode.position + stickyNode.height;
            const followingReachesMaxHeight = i + 1 < stickyNodes.length && stickyNodeBottom + stickyNodes[i + 1].height > maxWidgetHeight;
            if (followingReachesMaxHeight || i >= stickyScrollMaxItemCount - 1 && stickyScrollMaxItemCount < stickyNodes.length) {
                const uncompressedStickyNodes = stickyNodes.slice(0, i);
                const overflowingStickyNodes = stickyNodes.slice(i);
                const compressedStickyNode = this.compressStickyNodes(overflowingStickyNodes);
                return [...uncompressedStickyNodes, compressedStickyNode];
            }
        }
        return stickyNodes;
    }
    compressStickyNodes(stickyNodes) {
        if (stickyNodes.length === 0) {
            throw new Error('Can\'t compress empty sticky nodes');
        }
        const compressionModel = this.modelProvider();
        if (!compressionModel.isCompressionEnabled()) {
            return stickyNodes[0];
        }
        // Collect all elements to be compressed
        const elements = [];
        for (let i = 0; i < stickyNodes.length; i++) {
            const stickyNode = stickyNodes[i];
            const compressedNode = compressionModel.getCompressedTreeNode(stickyNode.node.element);
            if (compressedNode.element) {
                // if an element is incompressible, it can't be compressed with it's parent element
                if (i !== 0 && compressedNode.element.incompressible) {
                    break;
                }
                elements.push(...compressedNode.element.elements);
            }
        }
        if (elements.length < 2) {
            return stickyNodes[0];
        }
        // Compress the elements
        const lastStickyNode = stickyNodes[stickyNodes.length - 1];
        const compressedElement = { elements, incompressible: false };
        const compressedNode = { ...lastStickyNode.node, children: [], element: compressedElement };
        const stickyTreeNode = new Proxy(stickyNodes[0].node, {});
        const compressedStickyNode = {
            node: stickyTreeNode,
            startIndex: stickyNodes[0].startIndex,
            endIndex: lastStickyNode.endIndex,
            position: stickyNodes[0].position,
            height: stickyNodes[0].height,
        };
        this.compressedStickyNodes.set(stickyTreeNode, compressedNode);
        return compressedStickyNode;
    }
}
function asObjectTreeOptions(compressedTreeNodeProvider, options) {
    return options && {
        ...options,
        keyboardNavigationLabelProvider: options.keyboardNavigationLabelProvider && {
            getKeyboardNavigationLabel(e) {
                let compressedTreeNode;
                try {
                    compressedTreeNode = compressedTreeNodeProvider().getCompressedTreeNode(e);
                }
                catch {
                    return options.keyboardNavigationLabelProvider.getKeyboardNavigationLabel(e);
                }
                if (compressedTreeNode.element.elements.length === 1) {
                    return options.keyboardNavigationLabelProvider.getKeyboardNavigationLabel(e);
                }
                else {
                    return options.keyboardNavigationLabelProvider.getCompressedNodeKeyboardNavigationLabel(compressedTreeNode.element.elements);
                }
            }
        }
    };
}
export class CompressibleObjectTree extends ObjectTree {
    constructor(user, container, delegate, renderers, options = {}) {
        const compressedTreeNodeProvider = () => this;
        const stickyScrollDelegate = new CompressibleStickyScrollDelegate(() => this.model);
        const compressibleRenderers = renderers.map(r => new CompressibleRenderer(compressedTreeNodeProvider, stickyScrollDelegate, r));
        super(user, container, delegate, compressibleRenderers, { ...asObjectTreeOptions(compressedTreeNodeProvider, options), stickyScrollDelegate });
    }
    setChildren(element, children = Iterable.empty(), options) {
        this.model.setChildren(element, children, options);
    }
    createModel(user, options) {
        return new CompressibleObjectTreeModel(user, options);
    }
    updateOptions(optionsUpdate = {}) {
        super.updateOptions(optionsUpdate);
        if (typeof optionsUpdate.compressionEnabled !== 'undefined') {
            this.model.setCompressionEnabled(optionsUpdate.compressionEnabled);
        }
    }
    getCompressedTreeNode(element = null) {
        return this.model.getCompressedTreeNode(element);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2JqZWN0VHJlZS5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9vYmplY3RUcmVlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHOzs7Ozs7O0FBR2hHLE9BQU8sRUFBRSxZQUFZLEVBQTZGLE1BQU0sbUJBQW1CLENBQUM7QUFDNUksT0FBTyxFQUFFLDJCQUEyQixFQUE4RCxNQUFNLGdDQUFnQyxDQUFDO0FBQ3pJLE9BQU8sRUFBb0IsZUFBZSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFFekUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBRXhELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQXlCdkQsTUFBTSxPQUFPLFVBQWtDLFNBQVEsWUFBNkM7SUFJbkcsSUFBYSx3QkFBd0IsS0FBOEQsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLHdCQUF3QixDQUFDLENBQUMsQ0FBQztJQUVoSixZQUNvQixJQUFZLEVBQy9CLFNBQXNCLEVBQ3RCLFFBQWlDLEVBQ2pDLFNBQW1ELEVBQ25ELFVBQThDLEVBQUU7UUFFaEQsS0FBSyxDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxPQUFvRCxDQUFDLENBQUM7UUFOL0UsU0FBSSxHQUFKLElBQUksQ0FBUTtJQU9oQyxDQUFDO0lBRUQsV0FBVyxDQUFDLE9BQWlCLEVBQUUsV0FBNEMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQTBDO1FBQ3RJLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELFFBQVEsQ0FBQyxPQUFXO1FBQ25CLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxJ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