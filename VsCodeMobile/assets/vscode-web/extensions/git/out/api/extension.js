"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitExtensionImpl = void 0;
const api1_1 = require("./api1");
const vscode_1 = require("vscode");
function deprecated(original, context) {
    if (typeof original !== 'function' || context.kind !== 'method') {
        throw new Error('not supported');
    }
    const key = context.name.toString();
    return function (...args) {
        console.warn(`Git extension API method '${key}' is deprecated.`);
        return original.apply(this, args);
    };
}
let GitExtensionImpl = (() => {
    let _instanceExtraInitializers = [];
    let _getGitPath_decorators;
    let _getRepositories_decorators;
    return class GitExtensionImpl {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _getGitPath_decorators = [deprecated];
            _getRepositories_decorators = [deprecated];
            __esDecorate(this, null, _getGitPath_decorators, { kind: "method", name: "getGitPath", static: false, private: false, access: { has: obj => "getGitPath" in obj, get: obj => obj.getGitPath }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _getRepositories_decorators, { kind: "method", name: "getRepositories", static: false, private: false, access: { has: obj => "getRepositories" in obj, get: obj => obj.getRepositories }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        enabled = (__runInitializers(this, _instanceExtraInitializers), false);
        _onDidChangeEnablement = new vscode_1.EventEmitter();
        onDidChangeEnablement = this._onDidChangeEnablement.event;
        _model = undefined;
        _cloneManager = undefined;
        set model(model) {
            this._model = model;
            const enabled = !!model;
            if (this.enabled === enabled) {
                return;
            }
            this.enabled = enabled;
            this._onDidChangeEnablement.fire(this.enabled);
        }
        get model() {
            return this._model;
        }
        set cloneManager(cloneManager) {
            this._cloneManager = cloneManager;
        }
        constructor(privates) {
            if (privates) {
                this.enabled = true;
                this._model = privates.model;
                this._cloneManager = privates.cloneManager;
            }
        }
        async getGitPath() {
            if (!this._model) {
                throw new Error('Git model not found');
            }
            return this._model.git.path;
        }
        async getRepositories() {
            if (!this._model) {
                throw new Error('Git model not found');
            }
            return this._model.repositories.map(repository => new api1_1.ApiRepository(repository));
        }
        getAPI(version) {
            if (!this._model || !this._cloneManager) {
                throw new Error('Git model not found');
            }
            if (version !== 1) {
                throw new Error(`No API version ${version} found.`);
            }
            return new api1_1.ApiImpl({ model: this._model, cloneManager: this._cloneManager });
        }
    };
})();
exports.GitExtensionImpl = GitExtensionImpl;
//# sourceMappingURL=extension.js.map