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
import { WeakCachedFunction } from '../../../../../base/common/cache.js';
import { Event } from '../../../../../base/common/event.js';
import { observableSignalFromEvent, derived } from '../../../../../base/common/observable.js';
import { ISCMService } from '../../../scm/common/scm.js';
let ScmAdapter = class ScmAdapter {
    constructor(_scmService) {
        this._scmService = _scmService;
        this._repos = new WeakCachedFunction((repo) => new ScmRepoAdapter(repo));
        this._reposChangedSignal = observableSignalFromEvent(this, Event.any(this._scmService.onDidAddRepository, this._scmService.onDidRemoveRepository));
    }
    getRepo(uri, reader) {
        this._reposChangedSignal.read(reader);
        const repo = this._scmService.getRepository(uri);
        if (!repo) {
            return undefined;
        }
        return this._repos.get(repo);
    }
};
ScmAdapter = __decorate([
    __param(0, ISCMService)
], ScmAdapter);
export { ScmAdapter };
export class ScmRepoAdapter {
    constructor(_repo) {
        this._repo = _repo;
        this.headBranchNameObs = derived(reader => this._repo.provider.historyProvider.read(reader)?.historyItemRef.read(reader)?.name);
        this.headCommitHashObs = derived(reader => this._repo.provider.historyProvider.read(reader)?.historyItemRef.read(reader)?.revision);
    }
    async isIgnored(uri) {
        return false;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NtQWRhcHRlci5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy93b3JrYmVuY2gvY29udHJpYi9lZGl0VGVsZW1ldHJ5L2Jyb3dzZXIvdGVsZW1ldHJ5L3NjbUFkYXB0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7Ozs7Ozs7Ozs7QUFFaEcsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0scUNBQXFDLENBQUM7QUFDekUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLHFDQUFxQyxDQUFDO0FBQzVELE9BQU8sRUFBRSx5QkFBeUIsRUFBd0IsT0FBTyxFQUFFLE1BQU0sMENBQTBDLENBQUM7QUFFcEgsT0FBTyxFQUFrQixXQUFXLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQztBQUVsRSxJQUFNLFVBQVUsR0FBaEIsTUFBTSxVQUFVO0lBS3RCLFlBQ2MsV0FBeUM7UUFBeEIsZ0JBQVcsR0FBWCxXQUFXLENBQWE7UUFMdEMsV0FBTSxHQUFHLElBQUksa0JBQWtCLENBQUMsQ0FBQyxJQUFvQixFQUFFLEVBQUUsQ0FBQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBT3BHLElBQUksQ0FBQyxtQkFBbUIsR0FBRyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0lBQ3BKLENBQUM7SUFFTSxPQUFPLENBQUMsR0FBUSxFQUFFLE1BQTJCO1FBQ25ELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1gsT0FBTyxTQUFTLENBQUM7UUFDbEIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztDQUNELENBQUE7QUFuQlksVUFBVTtJQU1wQixXQUFBLFdBQVcsQ0FBQTtHQU5ELFVBQVUsQ0FtQnRCOztBQUVELE1BQU0sT0FBTyxjQUFjO0lBSTFCLFlBQ2tCLEtBQXFCO1FBQXJCLFVBQUssR0FBTCxLQUFLLENBQWdCO1FBSnZCLHNCQUFpQixHQUFvQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDNUosc0JBQWlCLEdBQW9DLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUtoTCxDQUFDO0lBRUQsS0FBSyxDQUFDLFNBQVMsQ0FBQyxHQUFRO1FBQ3ZCLE9BQU8sS0FBSyxDQUFDO0lBQ2QsQ0FBQztDQUNEIn0=