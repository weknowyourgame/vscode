/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from '../../../nls.js';
import { URL } from 'url';
import { ExtHostAuthentication, DynamicAuthProvider } from '../common/extHostAuthentication.js';
import { isAuthorizationDeviceResponse, isAuthorizationTokenResponse } from '../../../base/common/oauth.js';
import { raceCancellationError } from '../../../base/common/async.js';
import { CancellationError, isCancellationError } from '../../../base/common/errors.js';
import { URI } from '../../../base/common/uri.js';
import { LoopbackAuthServer } from './loopbackServer.js';
export class NodeDynamicAuthProvider extends DynamicAuthProvider {
    constructor(extHostWindow, extHostUrls, initData, extHostProgress, loggerService, proxy, authorizationServer, serverMetadata, resourceMetadata, clientId, clientSecret, onDidDynamicAuthProviderTokensChange, initialTokens) {
        super(extHostWindow, extHostUrls, initData, extHostProgress, loggerService, proxy, authorizationServer, serverMetadata, resourceMetadata, clientId, clientSecret, onDidDynamicAuthProviderTokensChange, initialTokens);
        // Prepend Node-specific flows to the existing flows
        if (!initData.remote.isRemote && serverMetadata.authorization_endpoint) {
            // If we are not in a remote environment, we can use the loopback server for authentication
            this._createFlows.unshift({
                label: nls.localize('loopback', "Loopback Server"),
                handler: (scopes, progress, token) => this._createWithLoopbackServer(scopes, progress, token)
            });
        }
        // Add device code flow to the end since it's not as streamlined
        if (serverMetadata.device_authorization_endpoint) {
            this._createFlows.push({
                label: nls.localize('device code', "Device Code"),
                handler: (scopes, progress, token) => this._createWithDeviceCode(scopes, progress, token)
            });
        }
    }
    async _createWithLoopbackServer(scopes, progress, token) {
        if (!this._serverMetadata.authorization_endpoint) {
            throw new Error('Authorization Endpoint required');
        }
        if (!this._serverMetadata.token_endpoint) {
            throw new Error('Token endpoint not available in server metadata');
        }
        // Generate PKCE code verifier (random string) and code challenge (SHA-256 hash of verifier)
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        // Generate a random state value to prevent CSRF
        const nonce = this.generateRandomString(32);
        const callbackUri = URI.parse(`${this._initData.environment.appUriScheme}://dynamicauthprovider/${this.authorizationServer.authority}/redirect?nonce=${nonce}`);
        let appUri;
        try {
            appUri = await this._extHostUrls.createAppUri(callbackUri);
        }
        catch (error) {
            throw new Error(`Failed to create external URI: ${error}`);
        }
        // Prepare the authorization request URL
        const authorizationUrl = new URL(this._serverMetadata.authorization_endpoint);
        authorizationUrl.searchParams.append('client_id', this._clientId);
        authorizationUrl.searchParams.append('response_type', 'code');
        authorizationUrl.searchParams.append('code_challenge', codeChallenge);
        authorizationUrl.searchParams.append('code_challenge_method', 'S256');
        const scopeString = scopes.join(' ');
        if (scopeString) {
            authorizationUrl.searchParams.append('scope', scopeString);
        }
        if (this._resourceMetadata?.resource) {
            // If a resource is specified, include it in the request
            authorizationUrl.searchParams.append('resource', this._resourceMetadata.resource);
        }
        // Create and start the loopback server
        const server = new LoopbackAuthServer(this._logger, appUri, this._initData.environment.appName);
        try {
            await server.start();
        }
        catch (err) {
            throw new Error(`Failed to start loopback server: ${err}`);
        }
        // Update the authorization URL with the actual redirect URI
        authorizationUrl.searchParams.set('redirect_uri', server.redirectUri);
        authorizationUrl.searchParams.set('state', server.state);
        const promise = server.waitForOAuthResponse();
        // Set up a Uri Handler but it's just to redirect not to handle the code
        void this._proxy.$waitForUriHandler(appUri);
        try {
            // Open the browser for user authorization
            this._logger.info(`Opening authorization URL for scopes: ${scopeString}`);
            this._logger.trace(`Authorization URL: ${authorizationUrl.toString()}`);
            const opened = await this._extHostWindow.openUri(authorizationUrl.toString(), {});
            if (!opened) {
                throw new CancellationError();
            }
            progress.report({
                message: nls.localize('completeAuth', "Complete the authentication in the browser window that has opened."),
            });
            // Wait for the authorization code via the loopback server
            let code;
            try {
                const response = await raceCancellationError(promise, token);
                code = response.code;
            }
            catch (err) {
                if (isCancellationError(err)) {
                    this._logger.info('Authorization code request was cancelled by the user.');
                    throw err;
                }
                this._logger.error(`Failed to receive authorization code: ${err}`);
                throw new Error(`Failed to receive authorization code: ${err}`);
            }
            this._logger.info(`Authorization code received for scopes: ${scopeString}`);
            // Exchange the authorization code for tokens
            const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier, server.redirectUri);
            return tokenResponse;
        }
        finally {
            // Clean up the server
            setTimeout(() => {
                void server.stop();
            }, 5000);
        }
    }
    async _createWithDeviceCode(scopes, progress, token) {
        if (!this._serverMetadata.token_endpoint) {
            throw new Error('Token endpoint not available in server metadata');
        }
        if (!this._serverMetadata.device_authorization_endpoint) {
            throw new Error('Device authorization endpoint not available in server metadata');
        }
        const deviceAuthUrl = this._serverMetadata.device_authorization_endpoint;
        const scopeString = scopes.join(' ');
        this._logger.info(`Starting device code flow for scopes: ${scopeString}`);
        // Step 1: Request device and user codes
        const deviceCodeRequest = new URLSearchParams();
        deviceCodeRequest.append('client_id', this._clientId);
        if (scopeString) {
            deviceCodeRequest.append('scope', scopeString);
        }
        if (this._resourceMetadata?.resource) {
            // If a resource is specified, include it in the request
            deviceCodeRequest.append('resource', this._resourceMetadata.resource);
        }
        let deviceCodeResponse;
        try {
            deviceCodeResponse = await fetch(deviceAuthUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: deviceCodeRequest.toString()
            });
        }
        catch (error) {
            this._logger.error(`Failed to request device code: ${error}`);
            throw new Error(`Failed to request device code: ${error}`);
        }
        if (!deviceCodeResponse.ok) {
            const text = await deviceCodeResponse.text();
            throw new Error(`Device code request failed: ${deviceCodeResponse.status} ${deviceCodeResponse.statusText} - ${text}`);
        }
        const deviceCodeData = await deviceCodeResponse.json();
        if (!isAuthorizationDeviceResponse(deviceCodeData)) {
            this._logger.error('Invalid device code response received from server');
            throw new Error('Invalid device code response received from server');
        }
        this._logger.info(`Device code received: ${deviceCodeData.user_code}`);
        // Step 2: Show the device code modal
        const userConfirmed = await this._proxy.$showDeviceCodeModal(deviceCodeData.user_code, deviceCodeData.verification_uri);
        if (!userConfirmed) {
            throw new CancellationError();
        }
        // Step 3: Poll for token
        progress.report({
            message: nls.localize('waitingForAuth', "Open [{0}]({0}) in a new tab and paste your one-time code: {1}", deviceCodeData.verification_uri, deviceCodeData.user_code)
        });
        const pollInterval = (deviceCodeData.interval || 5) * 1000; // Convert to milliseconds
        const expiresAt = Date.now() + (deviceCodeData.expires_in * 1000);
        while (Date.now() < expiresAt) {
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            // Wait for the specified interval
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            if (token.isCancellationRequested) {
                throw new CancellationError();
            }
            // Poll the token endpoint
            const tokenRequest = new URLSearchParams();
            tokenRequest.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
            tokenRequest.append('device_code', deviceCodeData.device_code);
            tokenRequest.append('client_id', this._clientId);
            // Add resource indicator if available (RFC 8707)
            if (this._resourceMetadata?.resource) {
                tokenRequest.append('resource', this._resourceMetadata.resource);
            }
            try {
                const tokenResponse = await fetch(this._serverMetadata.token_endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                    body: tokenRequest.toString()
                });
                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    if (!isAuthorizationTokenResponse(tokenData)) {
                        this._logger.error('Invalid token response received from server');
                        throw new Error('Invalid token response received from server');
                    }
                    this._logger.info(`Device code flow completed successfully for scopes: ${scopeString}`);
                    return tokenData;
                }
                else {
                    let errorData;
                    try {
                        errorData = await tokenResponse.json();
                    }
                    catch (e) {
                        this._logger.error(`Failed to parse error response: ${e}`);
                        throw new Error(`Token request failed with status ${tokenResponse.status}: ${tokenResponse.statusText}`);
                    }
                    // Handle known error cases
                    if (errorData.error === "authorization_pending" /* AuthorizationDeviceCodeErrorType.AuthorizationPending */) {
                        // User hasn't completed authorization yet, continue polling
                        continue;
                    }
                    else if (errorData.error === "slow_down" /* AuthorizationDeviceCodeErrorType.SlowDown */) {
                        // Server is asking us to slow down
                        await new Promise(resolve => setTimeout(resolve, pollInterval));
                        continue;
                    }
                    else if (errorData.error === "expired_token" /* AuthorizationDeviceCodeErrorType.ExpiredToken */) {
                        throw new Error('Device code expired. Please try again.');
                    }
                    else if (errorData.error === "access_denied" /* AuthorizationDeviceCodeErrorType.AccessDenied */) {
                        throw new CancellationError();
                    }
                    else if (errorData.error === "invalid_client" /* AuthorizationErrorType.InvalidClient */) {
                        this._logger.warn(`Client ID (${this._clientId}) was invalid, generated a new one.`);
                        await this._generateNewClientId();
                        throw new Error(`Client ID was invalid, generated a new one. Please try again.`);
                    }
                    else {
                        throw new Error(`Token request failed: ${errorData.error_description || errorData.error || 'Unknown error'}`);
                    }
                }
            }
            catch (error) {
                if (isCancellationError(error)) {
                    throw error;
                }
                throw new Error(`Error polling for token: ${error}`);
            }
        }
        throw new Error('Device code flow timed out. Please try again.');
    }
}
export class NodeExtHostAuthentication extends ExtHostAuthentication {
    constructor(extHostRpc, initData, extHostWindow, extHostUrls, extHostProgress, extHostLoggerService, extHostLogService) {
        super(extHostRpc, initData, extHostWindow, extHostUrls, extHostProgress, extHostLoggerService, extHostLogService);
        this._dynamicAuthProviderCtor = NodeDynamicAuthProvider;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0SG9zdEF1dGhlbnRpY2F0aW9uLmpzIiwic291cmNlUm9vdCI6ImZpbGU6Ly8vaG9tZS9mcm9zdHkvdnNjb2RlL3NyYy8iLCJzb3VyY2VzIjpbInZzL3dvcmtiZW5jaC9hcGkvbm9kZS9leHRIb3N0QXV0aGVudGljYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLEdBQUcsTUFBTSxpQkFBaUIsQ0FBQztBQUV2QyxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBQzFCLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxtQkFBbUIsRUFBMEIsTUFBTSxvQ0FBb0MsQ0FBQztBQU94SCxPQUFPLEVBQW9JLDZCQUE2QixFQUFFLDRCQUE0QixFQUFvRyxNQUFNLCtCQUErQixDQUFDO0FBRWhWLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLCtCQUErQixDQUFDO0FBR3RFLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLGdDQUFnQyxDQUFDO0FBQ3hGLE9BQU8sRUFBRSxHQUFHLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQztBQUNsRCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUV6RCxNQUFNLE9BQU8sdUJBQXdCLFNBQVEsbUJBQW1CO0lBRS9ELFlBQ0MsYUFBNkIsRUFDN0IsV0FBZ0MsRUFDaEMsUUFBaUMsRUFDakMsZUFBaUMsRUFDakMsYUFBNkIsRUFDN0IsS0FBb0MsRUFDcEMsbUJBQXdCLEVBQ3hCLGNBQTRDLEVBQzVDLGdCQUFxRSxFQUNyRSxRQUFnQixFQUNoQixZQUFnQyxFQUNoQyxvQ0FBMEcsRUFDMUcsYUFBb0I7UUFFcEIsS0FBSyxDQUNKLGFBQWEsRUFDYixXQUFXLEVBQ1gsUUFBUSxFQUNSLGVBQWUsRUFDZixhQUFhLEVBQ2IsS0FBSyxFQUNMLG1CQUFtQixFQUNuQixjQUFjLEVBQ2QsZ0JBQWdCLEVBQ2hCLFFBQVEsRUFDUixZ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