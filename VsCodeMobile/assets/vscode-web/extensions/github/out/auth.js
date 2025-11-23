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
import { EventEmitter, authentication, window } from 'vscode';
import { globalAgent } from 'https';
import { httpsOverHttp } from 'tunnel';
import { URL } from 'url';
import { DisposableStore, sequentialize } from './util.js';
export class AuthenticationError extends Error {
}
function getAgent(url = process.env.HTTPS_PROXY) {
    if (!url) {
        return globalAgent;
    }
    try {
        const { hostname, port, username, password } = new URL(url);
        const auth = username && password && `${username}:${password}`;
        return httpsOverHttp({ proxy: { host: hostname, port, proxyAuth: auth } });
    }
    catch (e) {
        window.showErrorMessage(`HTTPS_PROXY environment variable ignored: ${e.message}`);
        return globalAgent;
    }
}
const scopes = ['repo', 'workflow', 'user:email', 'read:user'];
export async function getSession() {
    return await authentication.getSession('github', scopes, { createIfNone: true });
}
let _octokit;
export function getOctokit() {
    if (!_octokit) {
        _octokit = getSession().then(async (session) => {
            const token = session.accessToken;
            const agent = getAgent();
            const { Octokit } = await import('@octokit/rest');
            return new Octokit({
                request: { agent },
                userAgent: 'GitHub VSCode',
                auth: `token ${token}`
            });
        }).then(null, async (err) => {
            _octokit = undefined;
            throw err;
        });
    }
    return _octokit;
}
let OctokitService = (() => {
    let _instanceExtraInitializers = [];
    let _getOctokitGraphql_decorators;
    return class OctokitService {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _getOctokitGraphql_decorators = [sequentialize];
            __esDecorate(this, null, _getOctokitGraphql_decorators, { kind: "method", name: "getOctokitGraphql", static: false, private: false, access: { has: obj => "getOctokitGraphql" in obj, get: obj => obj.getOctokitGraphql }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        _octokitGraphql = __runInitializers(this, _instanceExtraInitializers);
        _onDidChangeSessions = new EventEmitter();
        onDidChangeSessions = this._onDidChangeSessions.event;
        _disposables = new DisposableStore();
        constructor() {
            this._disposables.add(this._onDidChangeSessions);
            this._disposables.add(authentication.onDidChangeSessions(e => {
                if (e.provider.id === 'github') {
                    this._octokitGraphql = undefined;
                    this._onDidChangeSessions.fire();
                }
            }));
        }
        async getOctokitGraphql() {
            if (!this._octokitGraphql) {
                try {
                    const session = await authentication.getSession('github', scopes, { silent: true });
                    if (!session) {
                        throw new AuthenticationError('No GitHub authentication session available.');
                    }
                    const token = session.accessToken;
                    const { graphql } = await import('@octokit/graphql');
                    this._octokitGraphql = graphql.defaults({
                        headers: {
                            authorization: `token ${token}`
                        },
                        request: {
                            agent: getAgent()
                        }
                    });
                    return this._octokitGraphql;
                }
                catch (err) {
                    this._octokitGraphql = undefined;
                    throw new AuthenticationError(err.message);
                }
            }
            return this._octokitGraphql;
        }
        dispose() {
            this._octokitGraphql = undefined;
            this._disposables.dispose();
        }
    };
})();
export { OctokitService };
//# sourceMappingURL=auth.js.map