/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import * as sinon from 'sinon';
import { getClaimsFromJWT, getDefaultMetadataForUrl, isAuthorizationAuthorizeResponse, isAuthorizationDeviceResponse, isAuthorizationErrorResponse, isAuthorizationDynamicClientRegistrationResponse, isAuthorizationProtectedResourceMetadata, isAuthorizationServerMetadata, isAuthorizationTokenResponse, parseWWWAuthenticateHeader, fetchDynamicRegistration, fetchResourceMetadata, fetchAuthorizationServerMetadata, scopesMatch, DEFAULT_AUTH_FLOW_PORT } from '../../common/oauth.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
import { encodeBase64, VSBuffer } from '../../common/buffer.js';
suite('OAuth', () => {
    ensureNoDisposablesAreLeakedInTestSuite();
    suite('Type Guards', () => {
        test('isAuthorizationProtectedResourceMetadata should correctly identify protected resource metadata', () => {
            // Valid metadata with minimal required fields
            assert.strictEqual(isAuthorizationProtectedResourceMetadata({ resource: 'https://example.com' }), true);
            // Valid metadata with scopes_supported as array
            assert.strictEqual(isAuthorizationProtectedResourceMetadata({
                resource: 'https://example.com',
                scopes_supported: ['read', 'write']
            }), true);
            // Invalid cases - missing resource
            assert.strictEqual(isAuthorizationProtectedResourceMetadata(null), false);
            assert.strictEqual(isAuthorizationProtectedResourceMetadata(undefined), false);
            assert.strictEqual(isAuthorizationProtectedResourceMetadata({}), false);
            assert.strictEqual(isAuthorizationProtectedResourceMetadata('not an object'), false);
            // Invalid cases - scopes_supported is not an array when provided
            assert.strictEqual(isAuthorizationProtectedResourceMetadata({
                resource: 'https://example.com',
                scopes_supported: 'not an array'
            }), false);
        });
        test('isAuthorizationServerMetadata should correctly identify server metadata', () => {
            // Valid metadata with minimal required fields
            assert.strictEqual(isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                response_types_supported: ['code']
            }), true);
            // Valid metadata with valid URLs
            assert.strictEqual(isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                authorization_endpoint: 'https://example.com/auth',
                token_endpoint: 'https://example.com/token',
                registration_endpoint: 'https://example.com/register',
                jwks_uri: 'https://example.com/jwks',
                response_types_supported: ['code']
            }), true);
            // Valid metadata with http URLs (for localhost/testing)
            assert.strictEqual(isAuthorizationServerMetadata({
                issuer: 'http://localhost:8080',
                authorization_endpoint: 'http://localhost:8080/auth',
                token_endpoint: 'http://localhost:8080/token',
                response_types_supported: ['code']
            }), true);
            // Invalid cases - not an object
            assert.strictEqual(isAuthorizationServerMetadata(null), false);
            assert.strictEqual(isAuthorizationServerMetadata(undefined), false);
            assert.strictEqual(isAuthorizationServerMetadata('not an object'), false);
            // Invalid cases - missing issuer should throw
            assert.throws(() => isAuthorizationServerMetadata({}), /Authorization server metadata must have an issuer/);
            assert.throws(() => isAuthorizationServerMetadata({ response_types_supported: ['code'] }), /Authorization server metadata must have an issuer/);
            // Invalid cases - URI fields must be strings when provided (truthy values)
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                authorization_endpoint: 123,
                response_types_supported: ['code']
            }), /Authorization server metadata 'authorization_endpoint' must be a string/);
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                token_endpoint: 123,
                response_types_supported: ['code']
            }), /Authorization server metadata 'token_endpoint' must be a string/);
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                registration_endpoint: [],
                response_types_supported: ['code']
            }), /Authorization server metadata 'registration_endpoint' must be a string/);
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                jwks_uri: {},
                response_types_supported: ['code']
            }), /Authorization server metadata 'jwks_uri' must be a string/);
            // Invalid cases - URI fields must start with http:// or https://
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'ftp://example.com',
                response_types_supported: ['code']
            }), /Authorization server metadata 'issuer' must start with http:\/\/ or https:\/\//);
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                authorization_endpoint: 'ftp://example.com/auth',
                response_types_supported: ['code']
            }), /Authorization server metadata 'authorization_endpoint' must start with http:\/\/ or https:\/\//);
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                token_endpoint: 'file:///path/to/token',
                response_types_supported: ['code']
            }), /Authorization server metadata 'token_endpoint' must start with http:\/\/ or https:\/\//);
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                registration_endpoint: 'mailto:admin@example.com',
                response_types_supported: ['code']
            }), /Authorization server metadata 'registration_endpoint' must start with http:\/\/ or https:\/\//);
            assert.throws(() => isAuthorizationServerMetadata({
                issuer: 'https://example.com',
                jwks_uri: 'data:application/json,{}',
                response_types_supported: ['code']
            }), /Authorization server metadata 'jwks_uri' must start with http:\/\/ or https:\/\//);
        });
        test('isAuthorizationDynamicClientRegistrationResponse should correctly identify registration response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({
                client_id: 'client-123',
                client_name: 'Test Client'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse(null), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse(undefined), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({}), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({ client_id: 'just-id' }), true);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse({ client_name: 'missing-id' }), false);
            assert.strictEqual(isAuthorizationDynamicClientRegistrationResponse('not an object'), false);
        });
        test('isAuthorizationAuthorizeResponse should correctly identify authorization response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationAuthorizeResponse({
                code: 'auth-code-123',
                state: 'state-123'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationAuthorizeResponse(null), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse(undefined), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse({}), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse({ code: 'missing-state' }), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse({ state: 'missing-code' }), false);
            assert.strictEqual(isAuthorizationAuthorizeResponse('not an object'), false);
        });
        test('isAuthorizationTokenResponse should correctly identify token response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationTokenResponse({
                access_token: 'token-123',
                token_type: 'Bearer'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationTokenResponse(null), false);
            assert.strictEqual(isAuthorizationTokenResponse(undefined), false);
            assert.strictEqual(isAuthorizationTokenResponse({}), false);
            assert.strictEqual(isAuthorizationTokenResponse({ access_token: 'missing-type' }), false);
            assert.strictEqual(isAuthorizationTokenResponse({ token_type: 'missing-token' }), false);
            assert.strictEqual(isAuthorizationTokenResponse('not an object'), false);
        });
        test('isAuthorizationDeviceResponse should correctly identify device authorization response', () => {
            // Valid response
            assert.strictEqual(isAuthorizationDeviceResponse({
                device_code: 'device-code-123',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://example.com/verify',
                expires_in: 1800
            }), true);
            // Valid response with optional fields
            assert.strictEqual(isAuthorizationDeviceResponse({
                device_code: 'device-code-123',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://example.com/verify',
                verification_uri_complete: 'https://example.com/verify?user_code=ABCD-EFGH',
                expires_in: 1800,
                interval: 5
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationDeviceResponse(null), false);
            assert.strictEqual(isAuthorizationDeviceResponse(undefined), false);
            assert.strictEqual(isAuthorizationDeviceResponse({}), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ device_code: 'missing-others' }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ user_code: 'missing-others' }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ verification_uri: 'missing-others' }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({ expires_in: 1800 }), false);
            assert.strictEqual(isAuthorizationDeviceResponse({
                device_code: 'device-code-123',
                user_code: 'ABCD-EFGH',
                verification_uri: 'https://example.com/verify'
                // Missing expires_in
            }), false);
            assert.strictEqual(isAuthorizationDeviceResponse('not an object'), false);
        });
        test('isAuthorizationErrorResponse should correctly identify error response', () => {
            // Valid error response
            assert.strictEqual(isAuthorizationErrorResponse({
                error: 'authorization_pending',
                error_description: 'The authorization request is still pending'
            }), true);
            // Valid error response with different error codes
            assert.strictEqual(isAuthorizationErrorResponse({
                error: 'slow_down',
                error_description: 'Polling too fast'
            }), true);
            assert.strictEqual(isAuthorizationErrorResponse({
                error: 'access_denied',
                error_description: 'The user denied the request'
            }), true);
            assert.strictEqual(isAuthorizationErrorResponse({
                error: 'expired_token',
                error_description: 'The device code has expired'
            }), true);
            // Valid response with optional error_uri
            assert.strictEqual(isAuthorizationErrorResponse({
                error: 'invalid_request',
                error_description: 'The request is missing a required parameter',
                error_uri: 'https://example.com/error'
            }), true);
            // Invalid cases
            assert.strictEqual(isAuthorizationErrorResponse(null), false);
            assert.strictEqual(isAuthorizationErrorResponse(undefined), false);
            assert.strictEqual(isAuthorizationErrorResponse({}), false);
            assert.strictEqual(isAuthorizationErrorResponse({ error_description: 'missing-error' }), false);
            assert.strictEqual(isAuthorizationErrorResponse('not an object'), false);
        });
    });
    suite('Scope Matching', () => {
        test('scopesMatch should return true for identical scopes', () => {
            const scopes1 = ['test', 'scopes'];
            const scopes2 = ['test', 'scopes'];
            assert.strictEqual(scopesMatch(scopes1, scopes2), true);
        });
        test('scopesMatch should return true for scopes in different order', () => {
            const scopes1 = ['6f1cc985-85e8-487e-b0dd-aa633302a731/.default', 'VSCODE_TENANT:organizations'];
            const scopes2 = ['VSCODE_TENANT:organizations', '6f1cc985-85e8-487e-b0dd-aa633302a731/.default'];
            assert.strictEqual(scopesMatch(scopes1, scopes2), true);
        });
        test('scopesMatch should return false for different scopes', () => {
            const scopes1 = ['test', 'scopes'];
            const scopes2 = ['different', 'scopes'];
            assert.strictEqual(scopesMatch(scopes1, scopes2), false);
        });
        test('scopesMatch should return false for different length arrays', () => {
            const scopes1 = ['test'];
            const scopes2 = ['test', 'scopes'];
            assert.strictEqual(scopesMatch(scopes1, scopes2), false);
        });
        test('scopesMatch should handle complex Microsoft scopes', () => {
            const scopes1 = ['6f1cc985-85e8-487e-b0dd-aa633302a731/.default', 'VSCODE_TENANT:organizations'];
            const scopes2 = ['VSCODE_TENANT:organizations', '6f1cc985-85e8-487e-b0dd-aa633302a731/.default'];
            assert.strictEqual(scopesMatch(scopes1, scopes2), true);
        });
        test('scopesMatch should handle empty arrays', () => {
            assert.strictEqual(scopesMatch([], []), true);
        });
        test('scopesMatch should handle single scope arrays', () => {
            assert.strictEqual(scopesMatch(['single'], ['single']), true);
            assert.strictEqual(scopesMatch(['single'], ['different']), false);
        });
        test('scopesMatch should handle duplicate scopes within arrays', () => {
            const scopes1 = ['scope1', 'scope2', 'scope1'];
            const scopes2 = ['scope2', 'scope1', 'scope1'];
            assert.strictEqual(scopesMatch(scopes1, scopes2), true);
        });
        test('scopesMatch should handle undefined values', () => {
            assert.strictEqual(scopesMatch(undefined, undefined), true);
            assert.strictEqual(scopesMatch(['read'], undefined), false);
            assert.strictEqual(scopesMatch(undefined, ['write']), false);
        });
        test('scopesMatch should handle mixed undefined and empty arrays', () => {
            assert.strictEqual(scopesMatch([], undefined), false);
            assert.strictEqual(scopesMatch(undefined, []), false);
            assert.strictEqual(scopesMatch([], []), true);
        });
    });
    suite('Utility Functions', () => {
        test('getDefaultMetadataForUrl should return correct default endpoints', () => {
            const authorizationServer = new URL('https://auth.example.com');
            const metadata = getDefaultMetadataForUrl(authorizationServer);
            assert.strictEqual(metadata.issuer, 'https://auth.example.com/');
            assert.strictEqual(metadata.authorization_endpoint, 'https://auth.example.com/authorize');
            assert.strictEqual(metadata.token_endpoint, 'https://auth.example.com/token');
            assert.strictEqual(metadata.registration_endpoint, 'https://auth.example.com/register');
            assert.deepStrictEqual(metadata.response_types_supported, ['code', 'id_token', 'id_token token']);
        });
    });
    suite('Parsing Functions', () => {
        test('parseWWWAuthenticateHeader should correctly parse simple header', () => {
            const result = parseWWWAuthenticateHeader('Bearer');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].scheme, 'Bearer');
            assert.deepStrictEqual(result[0].params, {});
        });
        test('parseWWWAuthenticateHeader should correctly parse header with parameters', () => {
            const result = parseWWWAuthenticateHeader('Bearer realm="api", error="invalid_token", error_description="The access token expired"');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].scheme, 'Bearer');
            assert.deepStrictEqual(result[0].params, {
                realm: 'api',
                error: 'invalid_token',
                error_description: 'The access token expired'
            });
        });
        test('parseWWWAuthenticateHeader should correctly parse parameters with equal signs', () => {
            const result = parseWWWAuthenticateHeader('Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource?v=1"');
            assert.strictEqual(result.length, 1);
            assert.strictEqual(result[0].scheme, 'Bearer');
            assert.deepStrictEqual(result[0].params, {
                resource_metadata: 'https://example.com/.well-known/oauth-protected-resource?v=1'
            });
        });
        test('parseWWWAuthenticateHeader should correctly parse multiple', () => {
            const result = parseWWWAuthenticateHeader('Bearer realm="api", error="invalid_token", error_description="The access token expired", Basic realm="hi"');
            assert.strictEqual(result.length, 2);
            assert.strictEqual(result[0].scheme, 'Bearer');
            assert.deepStrictEqual(result[0].params, {
                realm: 'api',
                error: 'invalid_token',
                error_description: 'The access token expired'
            });
            assert.strictEqual(result[1].scheme, 'Basic');
            assert.deepStrictEqual(result[1].params, {
                realm: 'hi'
            });
        });
        test('getClaimsFromJWT should correctly parse a JWT token', () => {
            // Create a sample JWT with known payload
            const payload = {
                jti: 'id123',
                sub: 'user123',
                iss: 'https://example.com',
                aud: 'client123',
                exp: 1716239022,
                iat: 1716235422,
                name: 'Test User'
            };
            // Create fake but properly formatted JWT
            const header = { alg: 'HS256', typ: 'JWT' };
            const encodedHeader = encodeBase64(VSBuffer.fromString(JSON.stringify(header)));
            const encodedPayload = encodeBase64(VSBuffer.fromString(JSON.stringify(payload)));
            const fakeSignature = 'fake-signature';
            const token = `${encodedHeader}.${encodedPayload}.${fakeSignature}`;
            const claims = getClaimsFromJWT(token);
            assert.deepStrictEqual(claims, payload);
        });
        test('getClaimsFromJWT should throw for invalid JWT format', () => {
            // Test with wrong number of parts - should throw "Invalid JWT token format"
            assert.throws(() => getClaimsFromJWT('only.two'), /Invalid JWT token format.*three parts/);
            assert.throws(() => getClaimsFromJWT('one'), /Invalid JWT token format.*three parts/);
            assert.throws(() => getClaimsFromJWT('has.four.parts.here'), /Invalid JWT token format.*three parts/);
        });
        test('getClaimsFromJWT should throw for invalid header content', () => {
            // Create JWT with invalid header
            const encodedHeader = encodeBase64(VSBuffer.fromString('not-json'));
            const encodedPayload = encodeBase64(VSBuffer.fromString(JSON.stringify({ sub: 'test' })));
            const token = `${encodedHeader}.${encodedPayload}.signature`;
            assert.throws(() => getClaimsFromJWT(token), /Failed to parse JWT token/);
        });
        test('getClaimsFromJWT should throw for invalid payload content', () => {
            // Create JWT with valid header but invalid payload
            const header = { alg: 'HS256', typ: 'JWT' };
            const encodedHeader = encodeBase64(VSBuffer.fromString(JSON.stringify(header)));
            const encodedPayload = encodeBase64(VSBuffer.fromString('not-json'));
            const token = `${encodedHeader}.${encodedPayload}.signature`;
            assert.throws(() => getClaimsFromJWT(token), /Failed to parse JWT token/);
        });
    });
    suite('Network Functions', () => {
        let sandbox;
        let fetchStub;
        setup(() => {
            sandbox = sinon.createSandbox();
            fetchStub = sandbox.stub(globalThis, 'fetch');
        });
        teardown(() => {
            sandbox.restore();
        });
        test('fetchDynamicRegistration should make correct request and parse response', async () => {
            // Setup successful response
            const mockResponse = {
                client_id: 'generated-client-id',
                client_name: 'Test Client',
                client_uri: 'https://code.visualstudio.com'
            };
            fetchStub.resolves({
                ok: true,
                json: async () => mockResponse
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            const result = await fetchDynamicRegistration(serverMetadata, 'Test Client');
            // Verify fetch was called correctly
            assert.strictEqual(fetchStub.callCount, 1);
            const [url, options] = fetchStub.firstCall.args;
            assert.strictEqual(url, 'https://auth.example.com/register');
            assert.strictEqual(options.method, 'POST');
            assert.strictEqual(options.headers['Content-Type'], 'application/json');
            // Verify request body
            const requestBody = JSON.parse(options.body);
            assert.strictEqual(requestBody.client_name, 'Test Client');
            assert.strictEqual(requestBody.client_uri, 'https://code.visualstudio.com');
            assert.deepStrictEqual(requestBody.grant_types, ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code']);
            assert.deepStrictEqual(requestBody.response_types, ['code']);
            assert.deepStrictEqual(requestBody.redirect_uris, [
                'https://insiders.vscode.dev/redirect',
                'https://vscode.dev/redirect',
                'http://127.0.0.1/',
                `http://127.0.0.1:${DEFAULT_AUTH_FLOW_PORT}/`
            ]);
            // Verify response is processed correctly
            assert.deepStrictEqual(result, mockResponse);
        });
        test('fetchDynamicRegistration should throw error on non-OK response', async () => {
            fetchStub.resolves({
                ok: false,
                statusText: 'Bad Request',
                text: async () => 'Bad Request'
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Registration to https:\/\/auth\.example\.com\/register failed: Bad Request/);
        });
        test('fetchDynamicRegistration should throw error on invalid response format', async () => {
            fetchStub.resolves({
                ok: true,
                json: async () => ({ invalid: 'response' }) // Missing required fields
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Invalid authorization dynamic client registration response/);
        });
        test('fetchDynamicRegistration should filter grant types based on server metadata', async () => {
            // Setup successful response
            const mockResponse = {
                client_id: 'generated-client-id',
                client_name: 'Test Client'
            };
            fetchStub.resolves({
                ok: true,
                json: async () => mockResponse
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code'],
                grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token'] // Mix of supported and unsupported
            };
            await fetchDynamicRegistration(serverMetadata, 'Test Client');
            // Verify fetch was called correctly
            assert.strictEqual(fetchStub.callCount, 1);
            const [, options] = fetchStub.firstCall.args;
            // Verify request body contains only the intersection of supported grant types
            const requestBody = JSON.parse(options.body);
            assert.deepStrictEqual(requestBody.grant_types, ['authorization_code', 'refresh_token']); // client_credentials should be filtered out
        });
        test('fetchDynamicRegistration should use default grant types when server metadata has none', async () => {
            // Setup successful response
            const mockResponse = {
                client_id: 'generated-client-id',
                client_name: 'Test Client'
            };
            fetchStub.resolves({
                ok: true,
                json: async () => mockResponse
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
                // No grant_types_supported specified
            };
            await fetchDynamicRegistration(serverMetadata, 'Test Client');
            // Verify fetch was called correctly
            assert.strictEqual(fetchStub.callCount, 1);
            const [, options] = fetchStub.firstCall.args;
            // Verify request body contains default grant types
            const requestBody = JSON.parse(options.body);
            assert.deepStrictEqual(requestBody.grant_types, ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code']);
        });
        test('fetchDynamicRegistration should throw error when registration endpoint is missing', async () => {
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                response_types_supported: ['code']
                // registration_endpoint is missing
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Server does not support dynamic registration/);
        });
        test('fetchDynamicRegistration should handle structured error response', async () => {
            const errorResponse = {
                error: 'invalid_client_metadata',
                error_description: 'The client metadata is invalid'
            };
            fetchStub.resolves({
                ok: false,
                text: async () => JSON.stringify(errorResponse)
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Registration to https:\/\/auth\.example\.com\/register failed: invalid_client_metadata: The client metadata is invalid/);
        });
        test('fetchDynamicRegistration should handle structured error response without description', async () => {
            const errorResponse = {
                error: 'invalid_redirect_uri'
            };
            fetchStub.resolves({
                ok: false,
                text: async () => JSON.stringify(errorResponse)
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Registration to https:\/\/auth\.example\.com\/register failed: invalid_redirect_uri/);
        });
        test('fetchDynamicRegistration should handle malformed JSON error response', async () => {
            fetchStub.resolves({
                ok: false,
                text: async () => 'Invalid JSON {'
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Registration to https:\/\/auth\.example\.com\/register failed: Invalid JSON \{/);
        });
        test('fetchDynamicRegistration should include scopes in request when provided', async () => {
            const mockResponse = {
                client_id: 'generated-client-id',
                client_name: 'Test Client'
            };
            fetchStub.resolves({
                ok: true,
                json: async () => mockResponse
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await fetchDynamicRegistration(serverMetadata, 'Test Client', ['read', 'write']);
            // Verify request includes scopes
            const [, options] = fetchStub.firstCall.args;
            const requestBody = JSON.parse(options.body);
            assert.strictEqual(requestBody.scope, 'read write');
        });
        test('fetchDynamicRegistration should omit scope from request when not provided', async () => {
            const mockResponse = {
                client_id: 'generated-client-id',
                client_name: 'Test Client'
            };
            fetchStub.resolves({
                ok: true,
                json: async () => mockResponse
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await fetchDynamicRegistration(serverMetadata, 'Test Client');
            // Verify request does not include scope when not provided
            const [, options] = fetchStub.firstCall.args;
            const requestBody = JSON.parse(options.body);
            assert.strictEqual(requestBody.scope, undefined);
        });
        test('fetchDynamicRegistration should handle empty scopes array', async () => {
            const mockResponse = {
                client_id: 'generated-client-id',
                client_name: 'Test Client'
            };
            fetchStub.resolves({
                ok: true,
                json: async () => mockResponse
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await fetchDynamicRegistration(serverMetadata, 'Test Client', []);
            // Verify request includes empty scope
            const [, options] = fetchStub.firstCall.args;
            const requestBody = JSON.parse(options.body);
            assert.strictEqual(requestBody.scope, '');
        });
        test('fetchDynamicRegistration should handle network fetch failure', async () => {
            fetchStub.rejects(new Error('Network error'));
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Network error/);
        });
        test('fetchDynamicRegistration should handle response.json() failure', async () => {
            fetchStub.resolves({
                ok: true,
                json: async () => {
                    throw new Error('JSON parsing failed');
                }
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /JSON parsing failed/);
        });
        test('fetchDynamicRegistration should handle response.text() failure for error cases', async () => {
            fetchStub.resolves({
                ok: false,
                text: async () => {
                    throw new Error('Text parsing failed');
                }
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Text parsing failed/);
        });
    });
    suite('Client ID Fallback Scenarios', () => {
        let sandbox;
        let fetchStub;
        setup(() => {
            sandbox = sinon.createSandbox();
            fetchStub = sandbox.stub(globalThis, 'fetch');
        });
        teardown(() => {
            sandbox.restore();
        });
        test('fetchDynamicRegistration should throw specific error for missing registration endpoint', async () => {
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                response_types_supported: ['code']
                // registration_endpoint is missing
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), {
                message: 'Server does not support dynamic registration'
            });
        });
        test('fetchDynamicRegistration should throw specific error for DCR failure', async () => {
            fetchStub.resolves({
                ok: false,
                text: async () => 'DCR not supported'
            });
            const serverMetadata = {
                issuer: 'https://auth.example.com',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code']
            };
            await assert.rejects(async () => await fetchDynamicRegistration(serverMetadata, 'Test Client'), /Registration to https:\/\/auth\.example\.com\/register failed: DCR not supported/);
        });
    });
    suite('fetchResourceMetadata', () => {
        let sandbox;
        let fetchStub;
        setup(() => {
            sandbox = sinon.createSandbox();
            fetchStub = sandbox.stub();
        });
        teardown(() => {
            sandbox.restore();
        });
        test('should successfully fetch and validate resource metadata', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const expectedMetadata = {
                resource: 'https://example.com/api',
                scopes_supported: ['read', 'write']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            const result = await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
            assert.strictEqual(fetchStub.firstCall.args[0], resourceMetadataUrl);
            assert.strictEqual(fetchStub.firstCall.args[1].method, 'GET');
            assert.strictEqual(fetchStub.firstCall.args[1].headers['Accept'], 'application/json');
        });
        test('should include same-origin headers when origins match', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const sameOriginHeaders = {
                'X-Test-Header': 'test-value',
                'X-Custom-Header': 'value'
            };
            const expectedMetadata = {
                resource: 'https://example.com/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub, sameOriginHeaders });
            const headers = fetchStub.firstCall.args[1].headers;
            assert.strictEqual(headers['Accept'], 'application/json');
            assert.strictEqual(headers['X-Test-Header'], 'test-value');
            assert.strictEqual(headers['X-Custom-Header'], 'value');
        });
        test('should not include same-origin headers when origins differ', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://other-domain.com/.well-known/oauth-protected-resource';
            const sameOriginHeaders = {
                'X-Test-Header': 'test-value'
            };
            const expectedMetadata = {
                resource: 'https://example.com/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub, sameOriginHeaders });
            const headers = fetchStub.firstCall.args[1].headers;
            assert.strictEqual(headers['Accept'], 'application/json');
            assert.strictEqual(headers['X-Test-Header'], undefined);
        });
        test('should throw error when fetch returns non-200 status', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            fetchStub.resolves({
                status: 404,
                text: async () => 'Not Found'
            });
            await assert.rejects(async () => fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub }), /Failed to fetch resource metadata from.*404 Not Found/);
        });
        test('should handle error when response.text() throws', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            fetchStub.resolves({
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => { throw new Error('Cannot read response'); }
            });
            await assert.rejects(async () => fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub }), /Failed to fetch resource metadata from.*500 Internal Server Error/);
        });
        test('should throw error when resource property does not match target resource', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const metadata = {
                resource: 'https://different.com/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            await assert.rejects(async () => fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub }), /Protected Resource Metadata resource property value.*does not match target server url.*These MUST match to follow OAuth spec/);
        });
        test('should normalize URLs when comparing resource values', async () => {
            const targetResource = 'https://EXAMPLE.COM/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const metadata = {
                resource: 'https://example.com/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            // URL normalization should handle hostname case differences
            const result = await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub });
            assert.deepStrictEqual(result, metadata);
        });
        test('should normalize hostnames when comparing resource values', async () => {
            const targetResource = 'https://EXAMPLE.COM/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const metadata = {
                resource: 'https://example.com/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            const result = await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub });
            assert.deepStrictEqual(result, metadata);
        });
        test('should throw error when response is not valid resource metadata', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const invalidMetadata = {
                // Missing required 'resource' property
                scopes_supported: ['read', 'write']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => invalidMetadata,
                text: async () => JSON.stringify(invalidMetadata)
            });
            await assert.rejects(async () => fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub }), /Invalid resource metadata.*Expected to follow shape of.*is scopes_supported an array\? Is resource a string\?/);
        });
        test('should throw error when scopes_supported is not an array', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const invalidMetadata = {
                resource: 'https://example.com/api',
                scopes_supported: 'not an array'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => invalidMetadata,
                text: async () => JSON.stringify(invalidMetadata)
            });
            await assert.rejects(async () => fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub }), /Invalid resource metadata/);
        });
        test('should handle metadata with optional fields', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const metadata = {
                resource: 'https://example.com/api',
                resource_name: 'Example API',
                authorization_servers: ['https://auth.example.com'],
                jwks_uri: 'https://example.com/jwks',
                scopes_supported: ['read', 'write', 'admin'],
                bearer_methods_supported: ['header', 'body'],
                resource_documentation: 'https://example.com/docs'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            const result = await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub });
            assert.deepStrictEqual(result, metadata);
        });
        test('should use global fetch when custom fetch is not provided', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const metadata = {
                resource: 'https://example.com/api'
            };
            // eslint-disable-next-line local/code-no-any-casts
            const globalFetchStub = sandbox.stub(globalThis, 'fetch').resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            const result = await fetchResourceMetadata(targetResource, resourceMetadataUrl);
            assert.deepStrictEqual(result, metadata);
            assert.strictEqual(globalFetchStub.callCount, 1);
        });
        test('should handle same origin with different ports', async () => {
            const targetResource = 'https://example.com:8080/api';
            const resourceMetadataUrl = 'https://example.com:9090/.well-known/oauth-protected-resource';
            const sameOriginHeaders = {
                'X-Test-Header': 'test-value'
            };
            const metadata = {
                resource: 'https://example.com:8080/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub, sameOriginHeaders });
            // Different ports mean different origins
            const headers = fetchStub.firstCall.args[1].headers;
            assert.strictEqual(headers['X-Test-Header'], undefined);
        });
        test('should handle same origin with different protocols', async () => {
            const targetResource = 'http://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const sameOriginHeaders = {
                'X-Test-Header': 'test-value'
            };
            const metadata = {
                resource: 'http://example.com/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub, sameOriginHeaders });
            // Different protocols mean different origins
            const headers = fetchStub.firstCall.args[1].headers;
            assert.strictEqual(headers['X-Test-Header'], undefined);
        });
        test('should include error details in message with length information', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            const metadata = {
                resource: 'https://different.com/other'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => metadata,
                text: async () => JSON.stringify(metadata)
            });
            try {
                await fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub });
                assert.fail('Should have thrown an error');
            }
            catch (error) {
                assert.ok(/length:/.test(error.message), 'Error message should include length information');
                assert.ok(/https:\/\/different\.com\/other/.test(error.message), 'Error message should include actual resource value');
                assert.ok(/https:\/\/example\.com\/api/.test(error.message), 'Error message should include expected resource value');
            }
        });
        test('should fallback to well-known URI with path when no resourceMetadataUrl provided', async () => {
            const targetResource = 'https://example.com/api/v1';
            const expectedMetadata = {
                resource: 'https://example.com/api/v1',
                scopes_supported: ['read', 'write']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            const result = await fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
            // Should try path-appended version first
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://example.com/.well-known/oauth-protected-resource/api/v1');
        });
        test('should fallback to well-known URI at root when path version fails', async () => {
            const targetResource = 'https://example.com/api/v1';
            const expectedMetadata = {
                resource: 'https://example.com/api/v1',
                scopes_supported: ['read', 'write']
            };
            // First call fails, second succeeds
            fetchStub.onFirstCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found'
            });
            fetchStub.onSecondCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            const result = await fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 2);
            // First attempt with path
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://example.com/.well-known/oauth-protected-resource/api/v1');
            // Second attempt at root
            assert.strictEqual(fetchStub.secondCall.args[0], 'https://example.com/.well-known/oauth-protected-resource');
        });
        test('should throw error when all well-known URIs fail', async () => {
            const targetResource = 'https://example.com/api/v1';
            fetchStub.resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found'
            });
            await assert.rejects(async () => fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 2, 'Should contain 2 errors');
                assert.ok(/Failed to fetch resource metadata from.*\/api\/v1.*404/.test(error.errors[0].message), 'First error should mention /api/v1 and 404');
                assert.ok(/Failed to fetch resource metadata from.*\.well-known.*404/.test(error.errors[1].message), 'Second error should mention .well-known and 404');
                return true;
            });
            assert.strictEqual(fetchStub.callCount, 2);
        });
        test('should not append path when target resource is root', async () => {
            const targetResource = 'https://example.com/';
            const expectedMetadata = {
                resource: 'https://example.com/',
                scopes_supported: ['read']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            const result = await fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
            // Both URLs should be the same when path is /
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://example.com/.well-known/oauth-protected-resource');
        });
        test('should include same-origin headers when using well-known fallback', async () => {
            const targetResource = 'https://example.com/api';
            const sameOriginHeaders = {
                'X-Test-Header': 'test-value',
                'X-Custom-Header': 'value'
            };
            const expectedMetadata = {
                resource: 'https://example.com/api'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            await fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub, sameOriginHeaders });
            const headers = fetchStub.firstCall.args[1].headers;
            assert.strictEqual(headers['Accept'], 'application/json');
            assert.strictEqual(headers['X-Test-Header'], 'test-value');
            assert.strictEqual(headers['X-Custom-Header'], 'value');
        });
        test('should handle fetchImpl throwing network error and continue to next URL', async () => {
            const targetResource = 'https://example.com/api/v1';
            const expectedMetadata = {
                resource: 'https://example.com/api/v1',
                scopes_supported: ['read', 'write']
            };
            // First call throws network error, second succeeds
            fetchStub.onFirstCall().rejects(new Error('Network connection failed'));
            fetchStub.onSecondCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata)
            });
            const result = await fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 2);
            // First attempt with path should have thrown error
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://example.com/.well-known/oauth-protected-resource/api/v1');
            // Second attempt at root should succeed
            assert.strictEqual(fetchStub.secondCall.args[0], 'https://example.com/.well-known/oauth-protected-resource');
        });
        test('should throw AggregateError when fetchImpl throws on all URLs', async () => {
            const targetResource = 'https://example.com/api/v1';
            // Both calls throw network errors
            fetchStub.rejects(new Error('Network connection failed'));
            await assert.rejects(async () => fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 2, 'Should contain 2 errors');
                assert.ok(/Network connection failed/.test(error.errors[0].message), 'First error should mention network failure');
                assert.ok(/Network connection failed/.test(error.errors[1].message), 'Second error should mention network failure');
                return true;
            });
            assert.strictEqual(fetchStub.callCount, 2);
        });
        test('should handle mix of fetch error and non-200 response', async () => {
            const targetResource = 'https://example.com/api/v1';
            // First call throws network error
            fetchStub.onFirstCall().rejects(new Error('Connection timeout'));
            // Second call returns 404
            fetchStub.onSecondCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found'
            });
            await assert.rejects(async () => fetchResourceMetadata(targetResource, undefined, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 2, 'Should contain 2 errors');
                assert.ok(/Connection timeout/.test(error.errors[0].message), 'First error should be network error');
                assert.ok(/Failed to fetch resource metadata.*404/.test(error.errors[1].message), 'Second error should be 404');
                return true;
            });
            assert.strictEqual(fetchStub.callCount, 2);
        });
        test('should handle fetchImpl throwing error with explicit resourceMetadataUrl', async () => {
            const targetResource = 'https://example.com/api';
            const resourceMetadataUrl = 'https://example.com/.well-known/oauth-protected-resource';
            fetchStub.rejects(new Error('DNS resolution failed'));
            await assert.rejects(async () => fetchResourceMetadata(targetResource, resourceMetadataUrl, { fetch: fetchStub }), /DNS resolution failed/);
            // Should only try once when explicit URL is provided
            assert.strictEqual(fetchStub.callCount, 1);
            assert.strictEqual(fetchStub.firstCall.args[0], resourceMetadataUrl);
        });
    });
    suite('fetchAuthorizationServerMetadata', () => {
        let sandbox;
        let fetchStub;
        setup(() => {
            sandbox = sinon.createSandbox();
            fetchStub = sandbox.stub();
        });
        teardown(() => {
            sandbox.restore();
        });
        test('should successfully fetch metadata from OAuth discovery endpoint with path insertion', async () => {
            const authorizationServer = 'https://auth.example.com/tenant';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant',
                authorization_endpoint: 'https://auth.example.com/tenant/authorize',
                token_endpoint: 'https://auth.example.com/tenant/token',
                response_types_supported: ['code']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
            // Should try OAuth discovery with path insertion: https://auth.example.com/.well-known/oauth-authorization-server/tenant
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://auth.example.com/.well-known/oauth-authorization-server/tenant');
            assert.strictEqual(fetchStub.firstCall.args[1].method, 'GET');
        });
        test('should fallback to OpenID Connect discovery with path insertion', async () => {
            const authorizationServer = 'https://auth.example.com/tenant';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant',
                authorization_endpoint: 'https://auth.example.com/tenant/authorize',
                token_endpoint: 'https://auth.example.com/tenant/token',
                response_types_supported: ['code']
            };
            // First call fails, second succeeds
            fetchStub.onFirstCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            fetchStub.onSecondCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 2);
            // First attempt: OAuth discovery
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://auth.example.com/.well-known/oauth-authorization-server/tenant');
            // Second attempt: OpenID Connect discovery with path insertion
            assert.strictEqual(fetchStub.secondCall.args[0], 'https://auth.example.com/.well-known/openid-configuration/tenant');
        });
        test('should fallback to OpenID Connect discovery with path addition', async () => {
            const authorizationServer = 'https://auth.example.com/tenant';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant',
                authorization_endpoint: 'https://auth.example.com/tenant/authorize',
                token_endpoint: 'https://auth.example.com/tenant/token',
                response_types_supported: ['code']
            };
            // First two calls fail, third succeeds
            fetchStub.onFirstCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            fetchStub.onSecondCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            fetchStub.onThirdCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 3);
            // First attempt: OAuth discovery
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://auth.example.com/.well-known/oauth-authorization-server/tenant');
            // Second attempt: OpenID Connect discovery with path insertion
            assert.strictEqual(fetchStub.secondCall.args[0], 'https://auth.example.com/.well-known/openid-configuration/tenant');
            // Third attempt: OpenID Connect discovery with path addition
            assert.strictEqual(fetchStub.thirdCall.args[0], 'https://auth.example.com/tenant/.well-known/openid-configuration');
        });
        test('should handle authorization server at root without extra path', async () => {
            const authorizationServer = 'https://auth.example.com';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/',
                authorization_endpoint: 'https://auth.example.com/authorize',
                token_endpoint: 'https://auth.example.com/token',
                response_types_supported: ['code']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
            // For root URLs, no extra path is added
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://auth.example.com/.well-known/oauth-authorization-server');
        });
        test('should handle authorization server with trailing slash', async () => {
            const authorizationServer = 'https://auth.example.com/tenant/';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant/',
                authorization_endpoint: 'https://auth.example.com/tenant/authorize',
                token_endpoint: 'https://auth.example.com/tenant/token',
                response_types_supported: ['code']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
        });
        test('should include additional headers in all requests', async () => {
            const authorizationServer = 'https://auth.example.com/tenant';
            const additionalHeaders = {
                'X-Custom-Header': 'custom-value',
                'Authorization': 'Bearer token123'
            };
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant',
                response_types_supported: ['code']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub, additionalHeaders });
            const headers = fetchStub.firstCall.args[1].headers;
            assert.strictEqual(headers['X-Custom-Header'], 'custom-value');
            assert.strictEqual(headers['Authorization'], 'Bearer token123');
            assert.strictEqual(headers['Accept'], 'application/json');
        });
        test('should throw AggregateError when all discovery endpoints fail', async () => {
            const authorizationServer = 'https://auth.example.com/tenant';
            fetchStub.resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            await assert.rejects(async () => fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 3, 'Should contain 3 errors (one for each URL)');
                assert.strictEqual(error.message, 'Failed to fetch authorization server metadata from all attempted URLs');
                // Verify each error includes the URL it attempted
                assert.ok(/oauth-authorization-server.*404/.test(error.errors[0].message), 'First error should mention OAuth discovery and 404');
                assert.ok(/openid-configuration.*404/.test(error.errors[1].message), 'Second error should mention OpenID path insertion and 404');
                assert.ok(/openid-configuration.*404/.test(error.errors[2].message), 'Third error should mention OpenID path addition and 404');
                return true;
            });
            // Should have tried all three endpoints
            assert.strictEqual(fetchStub.callCount, 3);
        });
        test('should throw single error (not AggregateError) when only one URL is tried and fails', async () => {
            const authorizationServer = 'https://auth.example.com';
            // First attempt succeeds on second try, so only one error is collected for first URL
            fetchStub.onFirstCall().resolves({
                status: 500,
                text: async () => 'Internal Server Error',
                statusText: 'Internal Server Error',
                json: async () => { throw new Error('Not JSON'); }
            });
            const expectedMetadata = {
                issuer: 'https://auth.example.com/',
                response_types_supported: ['code']
            };
            fetchStub.onSecondCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            // Should succeed on second attempt
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 2);
        });
        test('should throw AggregateError when multiple URLs fail with mixed error types', async () => {
            const authorizationServer = 'https://auth.example.com/tenant';
            // First call: network error
            fetchStub.onFirstCall().rejects(new Error('Connection timeout'));
            // Second call: 404
            fetchStub.onSecondCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            // Third call: 500
            fetchStub.onThirdCall().resolves({
                status: 500,
                text: async () => 'Internal Server Error',
                statusText: 'Internal Server Error',
                json: async () => { throw new Error('Not JSON'); }
            });
            await assert.rejects(async () => fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 3, 'Should contain 3 errors');
                // First error is network error
                assert.ok(/Connection timeout/.test(error.errors[0].message), 'First error should be network error');
                // Second error is 404
                assert.ok(/404.*Not Found/.test(error.errors[1].message), 'Second error should be 404');
                // Third error is 500
                assert.ok(/500.*Internal Server Error/.test(error.errors[2].message), 'Third error should be 500');
                return true;
            });
            assert.strictEqual(fetchStub.callCount, 3);
        });
        test('should handle invalid JSON response', async () => {
            const authorizationServer = 'https://auth.example.com';
            fetchStub.resolves({
                status: 200,
                json: async () => { throw new Error('Invalid JSON'); },
                text: async () => 'Invalid JSON',
                statusText: 'OK'
            });
            await assert.rejects(async () => fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub }), /Failed to fetch authorization server metadata/);
        });
        test('should handle valid JSON but invalid metadata structure', async () => {
            const authorizationServer = 'https://auth.example.com';
            const invalidMetadata = {
                // Missing required 'issuer' field
                authorization_endpoint: 'https://auth.example.com/authorize'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => invalidMetadata,
                text: async () => JSON.stringify(invalidMetadata),
                statusText: 'OK'
            });
            await assert.rejects(async () => fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub }), /Failed to fetch authorization server metadata/);
        });
        test('should use global fetch when custom fetch is not provided', async () => {
            const authorizationServer = 'https://auth.example.com';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/',
                response_types_supported: ['code']
            };
            // eslint-disable-next-line local/code-no-any-casts
            const globalFetchStub = sandbox.stub(globalThis, 'fetch').resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer);
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(globalFetchStub.callCount, 1);
        });
        test('should handle network fetch failure and continue to next endpoint', async () => {
            const authorizationServer = 'https://auth.example.com';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/',
                response_types_supported: ['code']
            };
            // First call throws network error, second succeeds
            fetchStub.onFirstCall().rejects(new Error('Network error'));
            fetchStub.onSecondCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            // Should have tried two endpoints
            assert.strictEqual(fetchStub.callCount, 2);
        });
        test('should throw error when network fails on all endpoints', async () => {
            const authorizationServer = 'https://auth.example.com';
            fetchStub.rejects(new Error('Network error'));
            await assert.rejects(async () => fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 3, 'Should contain 3 errors');
                assert.strictEqual(error.message, 'Failed to fetch authorization server metadata from all attempted URLs');
                // All errors should be network errors
                assert.ok(/Network error/.test(error.errors[0].message), 'First error should be network error');
                assert.ok(/Network error/.test(error.errors[1].message), 'Second error should be network error');
                assert.ok(/Network error/.test(error.errors[2].message), 'Third error should be network error');
                return true;
            });
            // Should have tried all three endpoints
            assert.strictEqual(fetchStub.callCount, 3);
        });
        test('should handle mix of network error and non-200 response', async () => {
            const authorizationServer = 'https://auth.example.com/tenant';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant',
                response_types_supported: ['code']
            };
            // First call throws network error
            fetchStub.onFirstCall().rejects(new Error('Connection timeout'));
            // Second call returns 404
            fetchStub.onSecondCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            // Third call succeeds
            fetchStub.onThirdCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            // Should have tried all three endpoints
            assert.strictEqual(fetchStub.callCount, 3);
        });
        test('should handle response.text() failure in error case', async () => {
            const authorizationServer = 'https://auth.example.com';
            fetchStub.resolves({
                status: 500,
                text: async () => { throw new Error('Cannot read text'); },
                statusText: 'Internal Server Error',
                json: async () => { throw new Error('Cannot read json'); }
            });
            await assert.rejects(async () => fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 3, 'Should contain 3 errors');
                // All errors should include status code and statusText (fallback when text() fails)
                for (const err of error.errors) {
                    assert.ok(/500 Internal Server Error/.test(err.message), `Error should mention 500 and statusText: ${err.message}`);
                }
                return true;
            });
        });
        test('should correctly handle path addition with trailing slash', async () => {
            const authorizationServer = 'https://auth.example.com/tenant/';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant/',
                response_types_supported: ['code']
            };
            // First two calls fail, third succeeds
            fetchStub.onFirstCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            fetchStub.onSecondCall().resolves({
                status: 404,
                text: async () => 'Not Found',
                statusText: 'Not Found',
                json: async () => { throw new Error('Not JSON'); }
            });
            fetchStub.onThirdCall().resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 3);
            // Third attempt should correctly handle trailing slash (not double-slash)
            assert.strictEqual(fetchStub.thirdCall.args[0], 'https://auth.example.com/tenant/.well-known/openid-configuration');
        });
        test('should handle deeply nested paths', async () => {
            const authorizationServer = 'https://auth.example.com/tenant/org/sub';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant/org/sub',
                response_types_supported: ['code']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
            // Should correctly insert well-known path with nested paths
            assert.strictEqual(fetchStub.firstCall.args[0], 'https://auth.example.com/.well-known/oauth-authorization-server/tenant/org/sub');
        });
        test('should handle 200 response with non-metadata JSON', async () => {
            const authorizationServer = 'https://auth.example.com';
            const invalidResponse = {
                error: 'not_supported',
                message: 'Metadata not available'
            };
            fetchStub.resolves({
                status: 200,
                json: async () => invalidResponse,
                text: async () => JSON.stringify(invalidResponse),
                statusText: 'OK'
            });
            await assert.rejects(async () => fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub }), (error) => {
                assert.ok(error instanceof AggregateError, 'Should be an AggregateError');
                assert.strictEqual(error.errors.length, 3, 'Should contain 3 errors');
                // All errors should indicate failed to fetch with status code
                for (const err of error.errors) {
                    assert.ok(/Failed to fetch authorization server metadata from/.test(err.message), `Error should mention failed fetch: ${err.message}`);
                }
                return true;
            });
            // Should try all three endpoints
            assert.strictEqual(fetchStub.callCount, 3);
        });
        test('should validate metadata according to isAuthorizationServerMetadata', async () => {
            const authorizationServer = 'https://auth.example.com';
            // Valid metadata with all required fields
            const validMetadata = {
                issuer: 'https://auth.example.com/',
                authorization_endpoint: 'https://auth.example.com/authorize',
                token_endpoint: 'https://auth.example.com/token',
                jwks_uri: 'https://auth.example.com/jwks',
                registration_endpoint: 'https://auth.example.com/register',
                response_types_supported: ['code', 'token']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => validMetadata,
                text: async () => JSON.stringify(validMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, validMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
        });
        test('should handle URLs with query parameters', async () => {
            const authorizationServer = 'https://auth.example.com/tenant?version=v2';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/tenant?version=v2',
                response_types_supported: ['code']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            const result = await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub });
            assert.deepStrictEqual(result, expectedMetadata);
            assert.strictEqual(fetchStub.callCount, 1);
        });
        test('should handle empty additionalHeaders', async () => {
            const authorizationServer = 'https://auth.example.com';
            const expectedMetadata = {
                issuer: 'https://auth.example.com/',
                response_types_supported: ['code']
            };
            fetchStub.resolves({
                status: 200,
                json: async () => expectedMetadata,
                text: async () => JSON.stringify(expectedMetadata),
                statusText: 'OK'
            });
            await fetchAuthorizationServerMetadata(authorizationServer, { fetch: fetchStub, additionalHeaders: {} });
            const headers = fetchStub.firstCall.args[1].headers;
            assert.strictEqual(headers['Accept'], 'application/json');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2F1dGgudGVzdC5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL3Rlc3QvY29tbW9uL29hdXRoLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxLQUFLLE1BQU0sTUFBTSxRQUFRLENBQUM7QUFDakMsT0FBTyxLQUFLLEtBQUssTUFBTSxPQUFPLENBQUM7QUFDL0IsT0FBTyxFQUNOLGdCQUFnQixFQUNoQix3QkFBd0IsRUFDeEIsZ0NBQWdDLEVBQ2hDLDZCQUE2QixFQUM3Qiw0QkFBNEIsRUFDNUIsZ0RBQWdELEVBQ2hELHdDQUF3QyxFQUN4Qyw2QkFBNkIsRUFDN0IsNEJBQTRCLEVBQzVCLDBCQUEwQixFQUMxQix3QkFBd0IsRUFDeEIscUJBQXFCLEVBQ3JCLGdDQUFnQyxFQUNoQyxXQUFXLEVBR1gsc0JBQXNCLEVBQ3RCLE1BQU0sdUJBQXVCLENBQUM7QUFDL0IsT0FBTyxFQUFFLHVDQUF1QyxFQUFFLE1BQU0sWUFBWSxDQUFDO0FBQ3JFLE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFFaEUsS0FBSyxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUU7SUFDbkIsdUNBQXVDLEVBQUUsQ0FBQztJQUMxQyxLQUFLLENBQUMsYUFBYSxFQUFFLEdBQUcsRUFBRTtRQUN6QixJQUFJLENBQUMsZ0dBQWdHLEVBQUUsR0FBRyxFQUFFO1lBQzNHLDhDQUE4QztZQUM5QyxNQUFNLENBQUMsV0FBVyxDQUFDLHdDQUF3QyxDQUFDLEVBQUUsUUFBUSxFQUFFLHFCQUFxQixFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUV4RyxnREFBZ0Q7WUFDaEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyx3Q0FBd0MsQ0FBQztnQkFDM0QsUUFBUSxFQUFFLHFCQUFxQjtnQkFDL0IsZ0JBQWdCLEVBQUUsQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDO2FBQ25DLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUVWLG1DQUFtQztZQUNuQyxNQUFNLENBQUMsV0FBVyxDQUFDLHdDQUF3QyxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsd0NBQXdDLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDL0UsTUFBTSxDQUFDLFdBQVcsQ0FBQyx3Q0FBd0MsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN4RSxNQUFNLENBQUMsV0FBVyxDQUFDLHdDQUF3QyxDQUFDLGVBQWUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBRXJGLGlFQUFpRTtZQUNqRSxNQUFNLENBQUMsV0FBVyxDQUFDLHdDQUF3QyxDQUFDO2dCQUMzRCxRQUFRLEVBQUUscUJBQXFCO2dCQUMvQixnQkFBZ0IsRUFBRSxjQUFjO2FBQ2hDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNaLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHlFQUF5RSxFQUFFLEdBQUcsRUFBRTtZQUNwRiw4Q0FBOEM7WUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQztnQkFDaEQsTUFBTSxFQUFFLHFCQUFxQjtnQkFDN0Isd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRVYsaUNBQWlDO1lBQ2pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsNkJBQTZCLENBQUM7Z0JBQ2hELE1BQU0sRUFBRSxxQkFBcUI7Z0JBQzdCLHNCQUFzQixFQUFFLDBCQUEwQjtnQkFDbEQsY0FBYyxFQUFFLDJCQUEyQjtnQkFDM0MscUJBQXFCLEVBQUUsOEJBQThCO2dCQUNyRCxRQUFRLEVBQUUsMEJBQTBCO2dCQUNwQyx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFVix3REFBd0Q7WUFDeEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQztnQkFDaEQsTUFBTSxFQUFFLHVCQUF1QjtnQkFDL0Isc0JBQXNCLEVBQUUsNEJBQTRCO2dCQUNwRCxjQUFjLEVBQUUsNkJBQTZCO2dCQUM3Qyx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFVixnQ0FBZ0M7WUFDaEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMvRCxNQUFNLENBQUMsV0FBVyxDQUFDLDZCQUE2QixDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3BFLE1BQU0sQ0FBQyxXQUFXLENBQUMsNkJBQTZCLENBQUMsZUFBZSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFMUUsOENBQThDO1lBQzlDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsNkJBQTZCLENBQUMsRUFBRSxDQUFDLEVBQUUsbURBQW1ELENBQUMsQ0FBQztZQUM1RyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLDZCQUE2QixDQUFDLEVBQUUsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUUsbURBQW1ELENBQUMsQ0FBQztZQUVoSiwyRUFBMkU7WUFDM0UsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQztnQkFDakQsTUFBTSxFQUFFLHFCQUFxQjtnQkFDN0Isc0JBQXNCLEVBQUUsR0FBRztnQkFDM0Isd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQyxFQUFFLHlFQUF5RSxDQUFDLENBQUM7WUFFL0UsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQztnQkFDakQsTUFBTSxFQUFFLHFCQUFxQjtnQkFDN0IsY0FBYyxFQUFFLEdBQUc7Z0JBQ25CLHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUMsRUFBRSxpRUFBaUUsQ0FBQyxDQUFDO1lBRXZFLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsNkJBQTZCLENBQUM7Z0JBQ2pELE1BQU0sRUFBRSxxQkFBcUI7Z0JBQzdCLHFCQUFxQixFQUFFLEVBQUU7Z0JBQ3pCLHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUMsRUFBRSx3RUFBd0UsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsNkJBQTZCLENBQUM7Z0JBQ2pELE1BQU0sRUFBRSxxQkFBcUI7Z0JBQzdCLFFBQVEsRUFBRSxFQUFFO2dCQUNaLHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUMsRUFBRSwyREFBMkQsQ0FBQyxDQUFDO1lBRWpFLGlFQUFpRTtZQUNqRSxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLDZCQUE2QixDQUFDO2dCQUNqRCxNQUFNLEVBQUUsbUJBQW1CO2dCQUMzQix3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDLEVBQUUsZ0ZBQWdGLENBQUMsQ0FBQztZQUV0RixNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLDZCQUE2QixDQUFDO2dCQUNqRCxNQUFNLEVBQUUscUJBQXFCO2dCQUM3QixzQkFBc0IsRUFBRSx3QkFBd0I7Z0JBQ2hELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUMsRUFBRSxnR0FBZ0csQ0FBQyxDQUFDO1lBRXRHLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsNkJBQTZCLENBQUM7Z0JBQ2pELE1BQU0sRUFBRSxxQkFBcUI7Z0JBQzdCLGNBQWMsRUFBRSx1QkFBdUI7Z0JBQ3ZDLHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUMsRUFBRSx3RkFBd0YsQ0FBQyxDQUFDO1lBRTlGLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsNkJBQTZCLENBQUM7Z0JBQ2pELE1BQU0sRUFBRSxxQkFBcUI7Z0JBQzdCLHFCQUFxQixFQUFFLDBCQUEwQjtnQkFDakQsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQyxFQUFFLCtGQUErRixDQUFDLENBQUM7WUFFckcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQztnQkFDakQsTUFBTSxFQUFFLHFCQUFxQjtnQkFDN0IsUUFBUSxFQUFFLDBCQUEwQjtnQkFDcEMsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQyxFQUFFLGtGQUFrRixDQUFDLENBQUM7UUFDekYsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsa0dBQWtHLEVBQUUsR0FBRyxFQUFFO1lBQzdHLGlCQUFpQjtZQUNqQixNQUFNLENBQUMsV0FBVyxDQUFDLGdEQUFnRCxDQUFDO2dCQUNuRSxTQUFTLEVBQUUsWUFBWTtnQkFDdkIsV0FBVyxFQUFFLGFBQWE7YUFDMUIsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRVYsZ0JBQWdCO1lBQ2hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0RBQWdELENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDbEYsTUFBTSxDQUFDLFdBQVcsQ0FBQyxnREFBZ0QsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN2RixNQUFNLENBQUMsV0FBVyxDQUFDLGdEQUFnRCxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2hGLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0RBQWdELENBQUMsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNyRyxNQUFNLENBQUMsV0FBVyxDQUFDLGdEQUFnRCxDQUFDLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDM0csTUFBTSxDQUFDLFdBQVcsQ0FBQyxnREFBZ0QsQ0FBQyxlQUFlLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5RixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxtRkFBbUYsRUFBRSxHQUFHLEVBQUU7WUFDOUYsaUJBQWlCO1lBQ2pCLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0NBQWdDLENBQUM7Z0JBQ25ELElBQUksRUFBRSxlQUFlO2dCQUNyQixLQUFLLEVBQUUsV0FBVzthQUNsQixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFVixnQkFBZ0I7WUFDaEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNsRSxNQUFNLENBQUMsV0FBVyxDQUFDLGdDQUFnQyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3ZFLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0NBQWdDLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDaEUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3ZGLE1BQU0sQ0FBQyxXQUFXLENBQUMsZ0NBQWdDLENBQUMsRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN2RixNQUFNLENBQUMsV0FBVyxDQUFDLGdDQUFnQyxDQUFDLGVBQWUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlFLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHVFQUF1RSxFQUFFLEdBQUcsRUFBRTtZQUNsRixpQkFBaUI7WUFDakIsTUFBTSxDQUFDLFdBQVcsQ0FBQyw0QkFBNEIsQ0FBQztnQkFDL0MsWUFBWSxFQUFFLFdBQVc7Z0JBQ3pCLFVBQVUsRUFBRSxRQUFRO2FBQ3BCLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUVWLGdCQUFnQjtZQUNoQixNQUFNLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzlELE1BQU0sQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDbkUsTUFBTSxDQUFDLFdBQVcsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM1RCxNQUFNLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUYsTUFBTSxDQUFDLFdBQVcsQ0FBQyw0QkFBNEIsQ0FBQyxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3pGLE1BQU0sQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUMsZUFBZSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUUsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsdUZBQXVGLEVBQUUsR0FBRyxFQUFFO1lBQ2xHLGlCQUFpQjtZQUNqQixNQUFNLENBQUMsV0FBVyxDQUFDLDZCQUE2QixDQUFDO2dCQUNoRCxXQUFXLEVBQUUsaUJBQWlCO2dCQUM5QixTQUFTLEVBQUUsV0FBVztnQkFDdEIsZ0JBQWdCLEVBQUUsNEJBQTRCO2dCQUM5QyxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFVixzQ0FBc0M7WUFDdEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQztnQkFDaEQsV0FBVyxFQUFFLGlCQUFpQjtnQkFDOUIsU0FBUyxFQUFFLFdBQVc7Z0JBQ3RCLGdCQUFnQixFQUFFLDRCQUE0QjtnQkFDOUMseUJBQXlCLEVBQUUsZ0RBQWdEO2dCQUMzRSxVQUFVLEVBQUUsSUFBSTtnQkFDaEIsUUFBUSxFQUFFLENBQUM7YUFDWCxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFVixnQkFBZ0I7WUFDaEIsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMvRCxNQUFNLENBQUMsV0FBVyxDQUFDLDZCQUE2QixDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ3BFLE1BQU0sQ0FBQyxXQUFXLENBQUMsNkJBQTZCLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDN0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDNUYsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDMUYsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQyxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNqRyxNQUFNLENBQUMsV0FBVyxDQUFDLDZCQUE2QixDQUFDLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDL0UsTUFBTSxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQztnQkFDaEQsV0FBVyxFQUFFLGlCQUFpQjtnQkFDOUIsU0FBUyxFQUFFLFdBQVc7Z0JBQ3RCLGdCQUFnQixFQUFFLDRCQUE0QjtnQkFDOUMscUJBQXFCO2FBQ3JCLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNYLE1BQU0sQ0FBQyxXQUFXLENBQUMsNkJBQTZCLENBQUMsZUFBZSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDM0UsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsdUVBQXVFLEVBQUUsR0FBRyxFQUFFO1lBQ2xGLHVCQUF1QjtZQUN2QixNQUFNLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDO2dCQUMvQyxLQUFLLEVBQUUsdUJBQXVCO2dCQUM5QixpQkFBaUIsRUFBRSw0Q0FBNEM7YUFDL0QsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRVYsa0RBQWtEO1lBQ2xELE1BQU0sQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUM7Z0JBQy9DLEtBQUssRUFBRSxXQUFXO2dCQUNsQixpQkFBaUIsRUFBRSxrQkFBa0I7YUFDckMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRVYsTUFBTSxDQUFDLFdBQVcsQ0FBQyw0QkFBNEIsQ0FBQztnQkFDL0MsS0FBSyxFQUFFLGVBQWU7Z0JBQ3RCLGlCQUFpQixFQUFFLDZCQUE2QjthQUNoRCxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFVixNQUFNLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDO2dCQUMvQyxLQUFLLEVBQUUsZUFBZTtnQkFDdEIsaUJBQWlCLEVBQUUsNkJBQTZCO2FBQ2hELENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUVWLHlDQUF5QztZQUN6QyxNQUFNLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDO2dCQUMvQyxLQUFLLEVBQUUsaUJBQWlCO2dCQUN4QixpQkFBaUIsRUFBRSw2Q0FBNkM7Z0JBQ2hFLFNBQVMsRUFBRSwyQkFBMkI7YUFDdEMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBRVYsZ0JBQWdCO1lBQ2hCLE1BQU0sQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDOUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyw0QkFBNEIsQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNuRSxNQUFNLENBQUMsV0FBVyxDQUFDLDRCQUE0QixDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzVELE1BQU0sQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2hHLE1BQU0sQ0FBQyxXQUFXLENBQUMsNEJBQTRCLENBQUMsZUFBZSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUUsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUU7UUFDNUIsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEdBQUcsRUFBRTtZQUNoRSxNQUFNLE9BQU8sR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNuQyxNQUFNLE9BQU8sR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNuQyxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDekQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsOERBQThELEVBQUUsR0FBRyxFQUFFO1lBQ3pFLE1BQU0sT0FBTyxHQUFHLENBQUMsK0NBQStDLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztZQUNqRyxNQUFNLE9BQU8sR0FBRyxDQUFDLDZCQUE2QixFQUFFLCtDQUErQyxDQUFDLENBQUM7WUFDakcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3pELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNEQUFzRCxFQUFFLEdBQUcsRUFBRTtZQUNqRSxNQUFNLE9BQU8sR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNuQyxNQUFNLE9BQU8sR0FBRyxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUN4QyxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsNkRBQTZELEVBQUUsR0FBRyxFQUFFO1lBQ3hFLE1BQU0sT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDekIsTUFBTSxPQUFPLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDbkMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzFELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLG9EQUFvRCxFQUFFLEdBQUcsRUFBRTtZQUMvRCxNQUFNLE9BQU8sR0FBRyxDQUFDLCtDQUErQyxFQUFFLDZCQUE2QixDQUFDLENBQUM7WUFDakcsTUFBTSxPQUFPLEdBQUcsQ0FBQyw2QkFBNkIsRUFBRSwrQ0FBK0MsQ0FBQyxDQUFDO1lBQ2pHLE1BQU0sQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx3Q0FBd0MsRUFBRSxHQUFHLEVBQUU7WUFDbkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLCtDQUErQyxFQUFFLEdBQUcsRUFBRTtZQUMxRCxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM5RCxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsV0FBVyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNuRSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywwREFBMEQsRUFBRSxHQUFHLEVBQUU7WUFDckUsTUFBTSxPQUFPLEdBQUcsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sT0FBTyxHQUFHLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUMvQyxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDekQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsNENBQTRDLEVBQUUsR0FBRyxFQUFFO1lBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxTQUFTLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM1RCxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzVELE1BQU0sQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDOUQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsNERBQTRELEVBQUUsR0FBRyxFQUFFO1lBQ3ZFLE1BQU0sQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN0RCxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDdEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO1FBQy9CLElBQUksQ0FBQyxrRUFBa0UsRUFBRSxHQUFHLEVBQUU7WUFDN0UsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1lBQ2hFLE1BQU0sUUFBUSxHQUFHLHdCQUF3QixDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFFL0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLDJCQUEyQixDQUFDLENBQUM7WUFDakUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsc0JBQXNCLEVBQUUsb0NBQW9DLENBQUMsQ0FBQztZQUMxRixNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsZ0NBQWdDLENBQUMsQ0FBQztZQUM5RSxNQUFNLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRSxtQ0FBbUMsQ0FBQyxDQUFDO1lBQ3hGLE1BQU0sQ0FBQyxlQUFlLENBQUMsUUFBUSxDQUFDLHdCQUF3QixFQUFFLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7UUFDbkcsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxHQUFHLEVBQUU7UUFDL0IsSUFBSSxDQUFDLGlFQUFpRSxFQUFFLEdBQUcsRUFBRTtZQUM1RSxNQUFNLE1BQU0sR0FBRywwQkFBMEIsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNwRCxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM5QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywwRUFBMEUsRUFBRSxHQUFHLEVBQUU7WUFDckYsTUFBTSxNQUFNLEdBQUcsMEJBQTBCLENBQUMseUZBQXlGLENBQUMsQ0FBQztZQUVySSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRTtnQkFDeEMsS0FBSyxFQUFFLEtBQUs7Z0JBQ1osS0FBSyxFQUFFLGVBQWU7Z0JBQ3RCLGlCQUFpQixFQUFFLDBCQUEwQjthQUM3QyxDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywrRUFBK0UsRUFBRSxHQUFHLEVBQUU7WUFDMUYsTUFBTSxNQUFNLEdBQUcsMEJBQTBCLENBQUMseUZBQXlGLENBQUMsQ0FBQztZQUNySSxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRTtnQkFDeEMsaUJBQWlCLEVBQUUsOERBQThEO2FBQ2pGLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDREQUE0RCxFQUFFLEdBQUcsRUFBRTtZQUN2RSxNQUFNLE1BQU0sR0FBRywwQkFBMEIsQ0FBQywyR0FBMkcsQ0FBQyxDQUFDO1lBRXZKLE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNyQyxNQUFNLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDL0MsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFO2dCQUN4QyxLQUFLLEVBQUUsS0FBSztnQkFDWixLQUFLLEVBQUUsZUFBZTtnQkFDdEIsaUJBQWlCLEVBQUUsMEJBQTBCO2FBQzdDLENBQUMsQ0FBQztZQUNILE1BQU0sQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztZQUM5QyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3hDLEtBQUssRUFBRSxJQUFJO2FBQ1gsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUM7UUFHSCxJQUFJLENBQUMscURBQXFELEVBQUUsR0FBRyxFQUFFO1lBQ2hFLHlDQUF5QztZQUN6QyxNQUFNLE9BQU8sR0FBNEI7Z0JBQ3hDLEdBQUcsRUFBRSxPQUFPO2dCQUNaLEdBQUcsRUFBRSxTQUFTO2dCQUNkLEdBQUcsRUFBRSxxQkFBcUI7Z0JBQzFCLEdBQUcsRUFBRSxXQUFXO2dCQUNoQixHQUFHLEVBQUUsVUFBVTtnQkFDZixHQUFHLEVBQUUsVUFBVTtnQkFDZixJQUFJLEVBQUUsV0FBVzthQUNqQixDQUFDO1lBRUYseUNBQXlDO1lBQ3pDLE1BQU0sTUFBTSxHQUFHLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLENBQUM7WUFDNUMsTUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDaEYsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDbEYsTUFBTSxhQUFhLEdBQUcsZ0JBQWdCLENBQUM7WUFDdkMsTUFBTSxLQUFLLEdBQUcsR0FBRyxhQUFhLElBQUksY0FBYyxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBRXBFLE1BQU0sTUFBTSxHQUFHLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZDLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3pDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNEQUFzRCxFQUFFLEdBQUcsRUFBRTtZQUNqRSw0RUFBNEU7WUFDNUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO1lBQzNGLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEVBQUUsdUNBQXVDLENBQUMsQ0FBQztZQUN0RixNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDLHFCQUFxQixDQUFDLEVBQUUsdUNBQXVDLENBQUMsQ0FBQztRQUN2RyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywwREFBMEQsRUFBRSxHQUFHLEVBQUU7WUFDckUsaUNBQWlDO1lBQ2pDLE1BQU0sYUFBYSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDcEUsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxRixNQUFNLEtBQUssR0FBRyxHQUFHLGFBQWEsSUFBSSxjQUFjLFlBQVksQ0FBQztZQUU3RCxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxFQUFFLDJCQUEyQixDQUFDLENBQUM7UUFDM0UsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsMkRBQTJELEVBQUUsR0FBRyxFQUFFO1lBQ3RFLG1EQUFtRDtZQUNuRCxNQUFNLE1BQU0sR0FBRyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQzVDLE1BQU0sYUFBYSxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLE1BQU0sY0FBYyxHQUFHLFlBQVksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDckUsTUFBTSxLQUFLLEdBQUcsR0FBRyxhQUFhLElBQUksY0FBYyxZQUFZLENBQUM7WUFFN0QsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO1FBQzNFLENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsbUJBQW1CLEVBQUUsR0FBRyxFQUFFO1FBQy9CLElBQUksT0FBMkIsQ0FBQztRQUNoQyxJQUFJLFNBQTBCLENBQUM7UUFFL0IsS0FBSyxDQUFDLEdBQUcsRUFBRTtZQUNWLE9BQU8sR0FBRyxLQUFLLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDaEMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNiLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx5RUFBeUUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMxRiw0QkFBNEI7WUFDNUIsTUFBTSxZQUFZLEdBQUc7Z0JBQ3BCLFNBQVMsRUFBRSxxQkFBcUI7Z0JBQ2hDLFdBQVcsRUFBRSxhQUFhO2dCQUMxQixVQUFVLEVBQUUsK0JBQStCO2FBQzNDLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsSUFBSTtnQkFDUixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxZQUFZO2FBQ2xCLENBQUMsQ0FBQztZQUVmLE1BQU0sY0FBYyxHQUFpQztnQkFDcEQsTUFBTSxFQUFFLDBCQUEwQjtnQkFDbEMscUJBQXFCLEVBQUUsbUNBQW1DO2dCQUMxRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsTUFBTSxNQUFNLEdBQUcsTUFBTSx3QkFBd0IsQ0FDNUMsY0FBYyxFQUNkLGFBQWEsQ0FDYixDQUFDO1lBRUYsb0NBQW9DO1lBQ3BDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQyxNQUFNLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1lBQ2hELE1BQU0sQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLG1DQUFtQyxDQUFDLENBQUM7WUFDN0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQzNDLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBRXhFLHNCQUFzQjtZQUN0QixNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFjLENBQUMsQ0FBQztZQUN2RCxNQUFNLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFLCtCQUErQixDQUFDLENBQUM7WUFDNUUsTUFBTSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUMsb0JBQW9CLEVBQUUsZUFBZSxFQUFFLDhDQUE4QyxDQUFDLENBQUMsQ0FBQztZQUN6SSxNQUFNLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQzdELE1BQU0sQ0FBQyxlQUFlLENBQUMsV0FBVyxDQUFDLGFBQWEsRUFBRTtnQkFDakQsc0NBQXNDO2dCQUN0Qyw2QkFBNkI7Z0JBQzdCLG1CQUFtQjtnQkFDbkIsb0JBQW9CLHNCQUFzQixHQUFHO2FBQzdDLENBQUMsQ0FBQztZQUVILHlDQUF5QztZQUN6QyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsQ0FBQztRQUM5QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxnRUFBZ0UsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNqRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsS0FBSztnQkFDVCxVQUFVLEVBQUUsYUFBYTtnQkFDekIsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsYUFBYTthQUNuQixDQUFDLENBQUM7WUFFZixNQUFNLGNBQWMsR0FBaUM7Z0JBQ3BELE1BQU0sRUFBRSwwQkFBMEI7Z0JBQ2xDLHFCQUFxQixFQUFFLG1DQUFtQztnQkFDMUQsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQztZQUVGLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxhQUFhLENBQUMsRUFDekUsNEVBQTRFLENBQzVFLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx3RUFBd0UsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN6RixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsSUFBSTtnQkFDUixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUMsMEJBQTBCO2FBQzFELENBQUMsQ0FBQztZQUVmLE1BQU0sY0FBYyxHQUFpQztnQkFDcEQsTUFBTSxFQUFFLDBCQUEwQjtnQkFDbEMscUJBQXFCLEVBQUUsbUNBQW1DO2dCQUMxRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sd0JBQXdCLENBQUMsY0FBYyxFQUFFLGFBQWEsQ0FBQyxFQUN6RSw0REFBNEQsQ0FDNUQsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDZFQUE2RSxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzlGLDRCQUE0QjtZQUM1QixNQUFNLFlBQVksR0FBRztnQkFDcEIsU0FBUyxFQUFFLHFCQUFxQjtnQkFDaEMsV0FBVyxFQUFFLGFBQWE7YUFDMUIsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLEVBQUUsRUFBRSxJQUFJO2dCQUNSLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFlBQVk7YUFDbEIsQ0FBQyxDQUFDO1lBRWYsTUFBTSxjQUFjLEdBQWlDO2dCQUNwRCxNQUFNLEVBQUUsMEJBQTBCO2dCQUNsQyxxQkFBcUIsRUFBRSxtQ0FBbUM7Z0JBQzFELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2dCQUNsQyxxQkFBcUIsRUFBRSxDQUFDLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLGVBQWUsQ0FBQyxDQUFDLG1DQUFtQzthQUN4SCxDQUFDO1lBRUYsTUFBTSx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFFOUQsb0NBQW9DO1lBQ3BDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQyxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUMsR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztZQUU3Qyw4RUFBOEU7WUFDOUUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBYyxDQUFDLENBQUM7WUFDdkQsTUFBTSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFLENBQUMsb0JBQW9CLEVBQUUsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLDRDQUE0QztRQUN2SSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx1RkFBdUYsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN4Ryw0QkFBNEI7WUFDNUIsTUFBTSxZQUFZLEdBQUc7Z0JBQ3BCLFNBQVMsRUFBRSxxQkFBcUI7Z0JBQ2hDLFdBQVcsRUFBRSxhQUFhO2FBQzFCLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsSUFBSTtnQkFDUixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxZQUFZO2FBQ2xCLENBQUMsQ0FBQztZQUVmLE1BQU0sY0FBYyxHQUFpQztnQkFDcEQsTUFBTSxFQUFFLDBCQUEwQjtnQkFDbEMscUJBQXFCLEVBQUUsbUNBQW1DO2dCQUMxRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQztnQkFDbEMscUNBQXFDO2FBQ3JDLENBQUM7WUFFRixNQUFNLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUU5RCxvQ0FBb0M7WUFDcEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNDLE1BQU0sQ0FBQyxFQUFFLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1lBRTdDLG1EQUFtRDtZQUNuRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFjLENBQUMsQ0FBQztZQUN2RCxNQUFNLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxvQkFBb0IsRUFBRSxlQUFlLEVBQUUsOENBQThDLENBQUMsQ0FBQyxDQUFDO1FBQzFJLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLG1GQUFtRixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3BHLE1BQU0sY0FBYyxHQUFpQztnQkFDcEQsTUFBTSxFQUFFLDBCQUEwQjtnQkFDbEMsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7Z0JBQ2xDLG1DQUFtQzthQUNuQyxDQUFDO1lBRUYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sd0JBQXdCLENBQUMsY0FBYyxFQUFFLGFBQWEsQ0FBQyxFQUN6RSw4Q0FBOEMsQ0FDOUMsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGtFQUFrRSxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ25GLE1BQU0sYUFBYSxHQUFHO2dCQUNyQixLQUFLLEVBQUUseUJBQXlCO2dCQUNoQyxpQkFBaUIsRUFBRSxnQ0FBZ0M7YUFDbkQsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLEVBQUUsRUFBRSxLQUFLO2dCQUNULElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDO2FBQ25DLENBQUMsQ0FBQztZQUVmLE1BQU0sY0FBYyxHQUFpQztnQkFDcEQsTUFBTSxFQUFFLDBCQUEwQjtnQkFDbEMscUJBQXFCLEVBQUUsbUNBQW1DO2dCQUMxRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sd0JBQXdCLENBQUMsY0FBYyxFQUFFLGFBQWEsQ0FBQyxFQUN6RSx3SEFBd0gsQ0FDeEgsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNGQUFzRixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3ZHLE1BQU0sYUFBYSxHQUFHO2dCQUNyQixLQUFLLEVBQUUsc0JBQXNCO2FBQzdCLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsS0FBSztnQkFDVCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQzthQUNuQyxDQUFDLENBQUM7WUFFZixNQUFNLGNBQWMsR0FBaUM7Z0JBQ3BELE1BQU0sRUFBRSwwQkFBMEI7Z0JBQ2xDLHFCQUFxQixFQUFFLG1DQUFtQztnQkFDMUQsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQztZQUVGLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxhQUFhLENBQUMsRUFDekUscUZBQXFGLENBQ3JGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzRUFBc0UsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN2RixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsS0FBSztnQkFDVCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7YUFDdEIsQ0FBQyxDQUFDO1lBRWYsTUFBTSxjQUFjLEdBQWlDO2dCQUNwRCxNQUFNLEVBQUUsMEJBQTBCO2dCQUNsQyxxQkFBcUIsRUFBRSxtQ0FBbUM7Z0JBQzFELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUM7WUFFRixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMsTUFBTSx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLEVBQ3pFLGdGQUFnRixDQUNoRixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMseUVBQXlFLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDMUYsTUFBTSxZQUFZLEdBQUc7Z0JBQ3BCLFNBQVMsRUFBRSxxQkFBcUI7Z0JBQ2hDLFdBQVcsRUFBRSxhQUFhO2FBQzFCLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsSUFBSTtnQkFDUixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxZQUFZO2FBQ2xCLENBQUMsQ0FBQztZQUVmLE1BQU0sY0FBYyxHQUFpQztnQkFDcEQsTUFBTSxFQUFFLDBCQUEwQjtnQkFDbEMscUJBQXFCLEVBQUUsbUNBQW1DO2dCQUMxRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsTUFBTSx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsYUFBYSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFFakYsaUNBQWlDO1lBQ2pDLE1BQU0sQ0FBQyxFQUFFLE9BQU8sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1lBQzdDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQWMsQ0FBQyxDQUFDO1lBQ3ZELE1BQU0sQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNyRCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywyRUFBMkUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM1RixNQUFNLFlBQVksR0FBRztnQkFDcEIsU0FBUyxFQUFFLHFCQUFxQjtnQkFDaEMsV0FBVyxFQUFFLGFBQWE7YUFDMUIsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLEVBQUUsRUFBRSxJQUFJO2dCQUNSLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFlBQVk7YUFDbEIsQ0FBQyxDQUFDO1lBRWYsTUFBTSxjQUFjLEdBQWlDO2dCQUNwRCxNQUFNLEVBQUUsMEJBQTBCO2dCQUNsQyxxQkFBcUIsRUFBRSxtQ0FBbUM7Z0JBQzFELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUM7WUFFRixNQUFNLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxhQUFhLENBQUMsQ0FBQztZQUU5RCwwREFBMEQ7WUFDMUQsTUFBTSxDQUFDLEVBQUUsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDN0MsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBYyxDQUFDLENBQUM7WUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ2xELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDJEQUEyRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzVFLE1BQU0sWUFBWSxHQUFHO2dCQUNwQixTQUFTLEVBQUUscUJBQXFCO2dCQUNoQyxXQUFXLEVBQUUsYUFBYTthQUMxQixDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsRUFBRSxFQUFFLElBQUk7Z0JBQ1IsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsWUFBWTthQUNsQixDQUFDLENBQUM7WUFFZixNQUFNLGNBQWMsR0FBaUM7Z0JBQ3BELE1BQU0sRUFBRSwwQkFBMEI7Z0JBQ2xDLHFCQUFxQixFQUFFLG1DQUFtQztnQkFDMUQsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQztZQUVGLE1BQU0sd0JBQXdCLENBQUMsY0FBYyxFQUFFLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUVsRSxzQ0FBc0M7WUFDdEMsTUFBTSxDQUFDLEVBQUUsT0FBTyxDQUFDLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDN0MsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBYyxDQUFDLENBQUM7WUFDdkQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzNDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDhEQUE4RCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQy9FLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztZQUU5QyxNQUFNLGNBQWMsR0FBaUM7Z0JBQ3BELE1BQU0sRUFBRSwwQkFBMEI7Z0JBQ2xDLHFCQUFxQixFQUFFLG1DQUFtQztnQkFDMUQsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQztZQUVGLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxhQUFhLENBQUMsRUFDekUsZUFBZSxDQUNmLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxnRUFBZ0UsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNqRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsSUFBSTtnQkFDUixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUU7b0JBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztnQkFDeEMsQ0FBQzthQUNzQixDQUFDLENBQUM7WUFFMUIsTUFBTSxjQUFjLEdBQWlDO2dCQUNwRCxNQUFNLEVBQUUsMEJBQTBCO2dCQUNsQyxxQkFBcUIsRUFBRSxtQ0FBbUM7Z0JBQzFELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUM7WUFFRixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMsTUFBTSx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLEVBQ3pFLHFCQUFxQixDQUNyQixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZ0ZBQWdGLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDakcsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsRUFBRSxFQUFFLEtBQUs7Z0JBQ1QsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFO29CQUNoQixNQUFNLElBQUksS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUM7Z0JBQ3hDLENBQUM7YUFDc0IsQ0FBQyxDQUFDO1lBRTFCLE1BQU0sY0FBYyxHQUFpQztnQkFDcEQsTUFBTSxFQUFFLDBCQUEwQjtnQkFDbEMscUJBQXFCLEVBQUUsbUNBQW1DO2dCQUMxRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLE1BQU0sd0JBQXdCLENBQUMsY0FBYyxFQUFFLGFBQWEsQ0FBQyxFQUN6RSxxQkFBcUIsQ0FDckIsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7SUFFSCxLQUFLLENBQUMsOEJBQThCLEVBQUUsR0FBRyxFQUFFO1FBQzFDLElBQUksT0FBMkIsQ0FBQztRQUNoQyxJQUFJLFNBQTBCLENBQUM7UUFFL0IsS0FBSyxDQUFDLEdBQUcsRUFBRTtZQUNWLE9BQU8sR0FBRyxLQUFLLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDaEMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNiLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx3RkFBd0YsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN6RyxNQUFNLGNBQWMsR0FBaUM7Z0JBQ3BELE1BQU0sRUFBRSwwQkFBMEI7Z0JBQ2xDLHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2dCQUNsQyxtQ0FBbUM7YUFDbkMsQ0FBQztZQUVGLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxNQUFNLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxhQUFhLENBQUMsRUFDekU7Z0JBQ0MsT0FBTyxFQUFFLDhDQUE4QzthQUN2RCxDQUNELENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzRUFBc0UsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN2RixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixFQUFFLEVBQUUsS0FBSztnQkFDVCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxtQkFBbUI7YUFDekIsQ0FBQyxDQUFDO1lBRWYsTUFBTSxjQUFjLEdBQWlDO2dCQUNwRCxNQUFNLEVBQUUsMEJBQTBCO2dCQUNsQyxxQkFBcUIsRUFBRSxtQ0FBbUM7Z0JBQzFELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUM7WUFFRixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMsTUFBTSx3QkFBd0IsQ0FBQyxjQUFjLEVBQUUsYUFBYSxDQUFDLEVBQ3pFLGtGQUFrRixDQUNsRixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDSixDQUFDLENBQUMsQ0FBQztJQUVILEtBQUssQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLEVBQUU7UUFDbkMsSUFBSSxPQUEyQixDQUFDO1FBQ2hDLElBQUksU0FBMEIsQ0FBQztRQUUvQixLQUFLLENBQUMsR0FBRyxFQUFFO1lBQ1YsT0FBTyxHQUFHLEtBQUssQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNoQyxTQUFTLEdBQUcsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzVCLENBQUMsQ0FBQyxDQUFDO1FBRUgsUUFBUSxDQUFDLEdBQUcsRUFBRTtZQUNiLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNuQixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywwREFBMEQsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMzRSxNQUFNLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQztZQUNqRCxNQUFNLG1CQUFtQixHQUFHLDBEQUEwRCxDQUFDO1lBQ3ZGLE1BQU0sZ0JBQWdCLEdBQUc7Z0JBQ3hCLFFBQVEsRUFBRSx5QkFBeUI7Z0JBQ25DLGdCQUFnQixFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQzthQUNuQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2FBQ2xELENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0scUJBQXFCLENBQ3pDLGNBQWMsRUFDZCxtQkFBbUIsRUFDbkIsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQ3BCLENBQUM7WUFFRixNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQyxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFDckUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDOUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUN2RixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx1REFBdUQsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN4RSxNQUFNLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQztZQUNqRCxNQUFNLG1CQUFtQixHQUFHLDBEQUEwRCxDQUFDO1lBQ3ZGLE1BQU0saUJBQWlCLEdBQUc7Z0JBQ3pCLGVBQWUsRUFBRSxZQUFZO2dCQUM3QixpQkFBaUIsRUFBRSxPQUFPO2FBQzFCLENBQUM7WUFDRixNQUFNLGdCQUFnQixHQUFHO2dCQUN4QixRQUFRLEVBQUUseUJBQXlCO2FBQ25DLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7Z0JBQ2xDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsTUFBTSxxQkFBcUIsQ0FDMUIsY0FBYyxFQUNkLG1CQUFtQixFQUNuQixFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsQ0FDdkMsQ0FBQztZQUVGLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUNwRCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQzFELE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQzNELE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDekQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsNERBQTRELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDN0UsTUFBTSxjQUFjLEdBQUcseUJBQXlCLENBQUM7WUFDakQsTUFBTSxtQkFBbUIsR0FBRywrREFBK0QsQ0FBQztZQUM1RixNQUFNLGlCQUFpQixHQUFHO2dCQUN6QixlQUFlLEVBQUUsWUFBWTthQUM3QixDQUFDO1lBQ0YsTUFBTSxnQkFBZ0IsR0FBRztnQkFDeEIsUUFBUSxFQUFFLHlCQUF5QjthQUNuQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2FBQ2xELENBQUMsQ0FBQztZQUVILE1BQU0scUJBQXFCLENBQzFCLGNBQWMsRUFDZCxtQkFBbUIsRUFDbkIsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFLENBQ3ZDLENBQUM7WUFFRixNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDcEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUMxRCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxzREFBc0QsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN2RSxNQUFNLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQztZQUNqRCxNQUFNLG1CQUFtQixHQUFHLDBEQUEwRCxDQUFDO1lBRXZGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVc7YUFDN0IsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUM1Rix1REFBdUQsQ0FDdkQsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGlEQUFpRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ2xFLE1BQU0sY0FBYyxHQUFHLHlCQUF5QixDQUFDO1lBQ2pELE1BQU0sbUJBQW1CLEdBQUcsMERBQTBELENBQUM7WUFFdkYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsVUFBVSxFQUFFLHVCQUF1QjtnQkFDbkMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUM5RCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsY0FBYyxFQUFFLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQzVGLG1FQUFtRSxDQUNuRSxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsMEVBQTBFLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDM0YsTUFBTSxjQUFjLEdBQUcseUJBQXlCLENBQUM7WUFDakQsTUFBTSxtQkFBbUIsR0FBRywwREFBMEQsQ0FBQztZQUN2RixNQUFNLFFBQVEsR0FBRztnQkFDaEIsUUFBUSxFQUFFLDJCQUEyQjthQUNyQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsUUFBUTtnQkFDMUIsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7YUFDMUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUM1Riw4SEFBOEgsQ0FDOUgsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNEQUFzRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3ZFLE1BQU0sY0FBYyxHQUFHLHlCQUF5QixDQUFDO1lBQ2pELE1BQU0sbUJBQW1CLEdBQUcsMERBQTBELENBQUM7WUFDdkYsTUFBTSxRQUFRLEdBQUc7Z0JBQ2hCLFFBQVEsRUFBRSx5QkFBeUI7YUFDbkMsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFFBQVE7Z0JBQzFCLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO2FBQzFDLENBQUMsQ0FBQztZQUVILDREQUE0RDtZQUM1RCxNQUFNLE1BQU0sR0FBRyxNQUFNLHFCQUFxQixDQUFDLGNBQWMsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3RHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzFDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDJEQUEyRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzVFLE1BQU0sY0FBYyxHQUFHLHlCQUF5QixDQUFDO1lBQ2pELE1BQU0sbUJBQW1CLEdBQUcsMERBQTBELENBQUM7WUFDdkYsTUFBTSxRQUFRLEdBQUc7Z0JBQ2hCLFFBQVEsRUFBRSx5QkFBeUI7YUFDbkMsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFFBQVE7Z0JBQzFCLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO2FBQzFDLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0scUJBQXFCLENBQUMsY0FBYyxFQUFFLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDdEcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsaUVBQWlFLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDbEYsTUFBTSxjQUFjLEdBQUcseUJBQXlCLENBQUM7WUFDakQsTUFBTSxtQkFBbUIsR0FBRywwREFBMEQsQ0FBQztZQUN2RixNQUFNLGVBQWUsR0FBRztnQkFDdkIsdUNBQXVDO2dCQUN2QyxnQkFBZ0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7YUFDbkMsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGVBQWU7Z0JBQ2pDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO2FBQ2pELENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFDNUYsK0dBQStHLENBQy9HLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywwREFBMEQsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMzRSxNQUFNLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQztZQUNqRCxNQUFNLG1CQUFtQixHQUFHLDBEQUEwRCxDQUFDO1lBQ3ZGLE1BQU0sZUFBZSxHQUFHO2dCQUN2QixRQUFRLEVBQUUseUJBQXlCO2dCQUNuQyxnQkFBZ0IsRUFBRSxjQUFjO2FBQ2hDLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxlQUFlO2dCQUNqQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQzthQUNqRCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsY0FBYyxFQUFFLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQzVGLDJCQUEyQixDQUMzQixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsNkNBQTZDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDOUQsTUFBTSxjQUFjLEdBQUcseUJBQXlCLENBQUM7WUFDakQsTUFBTSxtQkFBbUIsR0FBRywwREFBMEQsQ0FBQztZQUN2RixNQUFNLFFBQVEsR0FBRztnQkFDaEIsUUFBUSxFQUFFLHlCQUF5QjtnQkFDbkMsYUFBYSxFQUFFLGFBQWE7Z0JBQzVCLHFCQUFxQixFQUFFLENBQUMsMEJBQTBCLENBQUM7Z0JBQ25ELFFBQVEsRUFBRSwwQkFBMEI7Z0JBQ3BDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxPQUFPLENBQUM7Z0JBQzVDLHdCQUF3QixFQUFFLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQztnQkFDNUMsc0JBQXNCLEVBQUUsMEJBQTBCO2FBQ2xELENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxRQUFRO2dCQUMxQixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQzthQUMxQyxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLHFCQUFxQixDQUFDLGNBQWMsRUFBRSxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3RHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzFDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDJEQUEyRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzVFLE1BQU0sY0FBYyxHQUFHLHlCQUF5QixDQUFDO1lBQ2pELE1BQU0sbUJBQW1CLEdBQUcsMERBQTBELENBQUM7WUFDdkYsTUFBTSxRQUFRLEdBQUc7Z0JBQ2hCLFFBQVEsRUFBRSx5QkFBeUI7YUFDbkMsQ0FBQztZQUVGLG1EQUFtRDtZQUNuRCxNQUFNLGVBQWUsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xFLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFFBQVE7Z0JBQzFCLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDO2FBQ25DLENBQUMsQ0FBQztZQUVWLE1BQU0sTUFBTSxHQUFHLE1BQU0scUJBQXFCLENBQUMsY0FBYyxFQUFFLG1CQUFtQixDQUFDLENBQUM7WUFFaEYsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDekMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxlQUFlLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2xELENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGdEQUFnRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ2pFLE1BQU0sY0FBYyxHQUFHLDhCQUE4QixDQUFDO1lBQ3RELE1BQU0sbUJBQW1CLEdBQUcsK0RBQStELENBQUM7WUFDNUYsTUFBTSxpQkFBaUIsR0FBRztnQkFDekIsZUFBZSxFQUFFLFlBQVk7YUFDN0IsQ0FBQztZQUNGLE1BQU0sUUFBUSxHQUFHO2dCQUNoQixRQUFRLEVBQUUsOEJBQThCO2FBQ3hDLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxRQUFRO2dCQUMxQixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQzthQUMxQyxDQUFDLENBQUM7WUFFSCxNQUFNLHFCQUFxQixDQUMxQixjQUFjLEVBQ2QsbUJBQW1CLEVBQ25CLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxDQUN2QyxDQUFDO1lBRUYseUNBQXlDO1lBQ3pDLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUNwRCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxlQUFlLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxvREFBb0QsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNyRSxNQUFNLGNBQWMsR0FBRyx3QkFBd0IsQ0FBQztZQUNoRCxNQUFNLG1CQUFtQixHQUFHLDBEQUEwRCxDQUFDO1lBQ3ZGLE1BQU0saUJBQWlCLEdBQUc7Z0JBQ3pCLGVBQWUsRUFBRSxZQUFZO2FBQzdCLENBQUM7WUFDRixNQUFNLFFBQVEsR0FBRztnQkFDaEIsUUFBUSxFQUFFLHdCQUF3QjthQUNsQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsUUFBUTtnQkFDMUIsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7YUFDMUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxxQkFBcUIsQ0FDMUIsY0FBYyxFQUNkLG1CQUFtQixFQUNuQixFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsQ0FDdkMsQ0FBQztZQUVGLDZDQUE2QztZQUM3QyxNQUFNLE9BQU8sR0FBRyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDcEQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDekQsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsaUVBQWlFLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDbEYsTUFBTSxjQUFjLEdBQUcseUJBQXlCLENBQUM7WUFDakQsTUFBTSxtQkFBbUIsR0FBRywwREFBMEQsQ0FBQztZQUN2RixNQUFNLFFBQVEsR0FBRztnQkFDaEIsUUFBUSxFQUFFLDZCQUE2QjthQUN2QyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsUUFBUTtnQkFDMUIsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7YUFDMUMsQ0FBQyxDQUFDO1lBRUgsSUFBSSxDQUFDO2dCQUNKLE1BQU0scUJBQXFCLENBQUMsY0FBYyxFQUFFLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7Z0JBQ3ZGLE1BQU0sQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUM1QyxDQUFDO1lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztnQkFDckIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxpREFBaUQsQ0FBQyxDQUFDO2dCQUM1RixNQUFNLENBQUMsRUFBRSxDQUFDLGlDQUFpQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEVBQUUsb0RBQW9ELENBQUMsQ0FBQztnQkFDdkgsTUFBTSxDQUFDLEVBQUUsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHNEQUFzRCxDQUFDLENBQUM7WUFDdEgsQ0FBQztRQUNGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGtGQUFrRixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ25HLE1BQU0sY0FBYyxHQUFHLDRCQUE0QixDQUFDO1lBQ3BELE1BQU0sZ0JBQWdCLEdBQUc7Z0JBQ3hCLFFBQVEsRUFBRSw0QkFBNEI7Z0JBQ3RDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQzthQUNuQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2FBQ2xELENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0scUJBQXFCLENBQ3pDLGNBQWMsRUFDZCxTQUFTLEVBQ1QsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQ3BCLENBQUM7WUFFRixNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQyx5Q0FBeUM7WUFDekMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxpRUFBaUUsQ0FBQyxDQUFDO1FBQ3BILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLG1FQUFtRSxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3BGLE1BQU0sY0FBYyxHQUFHLDRCQUE0QixDQUFDO1lBQ3BELE1BQU0sZ0JBQWdCLEdBQUc7Z0JBQ3hCLFFBQVEsRUFBRSw0QkFBNEI7Z0JBQ3RDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQzthQUNuQyxDQUFDO1lBRUYsb0NBQW9DO1lBQ3BDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBQ2hDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVc7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2FBQ3ZCLENBQUMsQ0FBQztZQUVILFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBQ2pDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGdCQUFnQjtnQkFDbEMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQzthQUNsRCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLHFCQUFxQixDQUN6QyxjQUFjLEVBQ2QsU0FBUyxFQUNULEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUNwQixDQUFDO1lBRUYsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNqRCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDM0MsMEJBQTBCO1lBQzFCLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsaUVBQWlFLENBQUMsQ0FBQztZQUNuSCx5QkFBeUI7WUFDekIsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSwwREFBMEQsQ0FBQyxDQUFDO1FBQzlHLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGtEQUFrRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ25FLE1BQU0sY0FBYyxHQUFHLDRCQUE0QixDQUFDO1lBRXBELFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVc7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2FBQ3ZCLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLEVBQUUsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQ2xGLENBQUMsS0FBVSxFQUFFLEVBQUU7Z0JBQ2QsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLFlBQVksY0FBYyxFQUFFLDZCQUE2QixDQUFDLENBQUM7Z0JBQzFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLHlCQUF5QixDQUFDLENBQUM7Z0JBQ3RFLE1BQU0sQ0FBQyxFQUFFLENBQUMsd0RBQXdELENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsNENBQTRDLENBQUMsQ0FBQztnQkFDaEosTUFBTSxDQUFDLEVBQUUsQ0FBQywyREFBMkQsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxpREFBaUQsQ0FBQyxDQUFDO2dCQUN4SixPQUFPLElBQUksQ0FBQztZQUNiLENBQUMsQ0FDRCxDQUFDO1lBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQy9DLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3RFLE1BQU0sY0FBYyxHQUFHLHNCQUFzQixDQUFDO1lBQzlDLE1BQU0sZ0JBQWdCLEdBQUc7Z0JBQ3hCLFFBQVEsRUFBRSxzQkFBc0I7Z0JBQ2hDLGdCQUFnQixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQzFCLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7Z0JBQ2xDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsTUFBTSxxQkFBcUIsQ0FDekMsY0FBYyxFQUNkLFNBQVMsRUFDVCxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FDcEIsQ0FBQztZQUVGLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNDLDhDQUE4QztZQUM5QyxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLDBEQUEwRCxDQUFDLENBQUM7UUFDN0csQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbUVBQW1FLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDcEYsTUFBTSxjQUFjLEdBQUcseUJBQXlCLENBQUM7WUFDakQsTUFBTSxpQkFBaUIsR0FBRztnQkFDekIsZUFBZSxFQUFFLFlBQVk7Z0JBQzdCLGlCQUFpQixFQUFFLE9BQU87YUFDMUIsQ0FBQztZQUNGLE1BQU0sZ0JBQWdCLEdBQUc7Z0JBQ3hCLFFBQVEsRUFBRSx5QkFBeUI7YUFDbkMsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGdCQUFnQjtnQkFDbEMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQzthQUNsRCxDQUFDLENBQUM7WUFFSCxNQUFNLHFCQUFxQixDQUMxQixjQUFjLEVBQ2QsU0FBUyxFQUNULEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxDQUN2QyxDQUFDO1lBRUYsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3BELE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDMUQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDM0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx5RUFBeUUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMxRixNQUFNLGNBQWMsR0FBRyw0QkFBNEIsQ0FBQztZQUNwRCxNQUFNLGdCQUFnQixHQUFHO2dCQUN4QixRQUFRLEVBQUUsNEJBQTRCO2dCQUN0QyxnQkFBZ0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7YUFDbkMsQ0FBQztZQUVGLG1EQUFtRDtZQUNuRCxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUMsQ0FBQztZQUV4RSxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNqQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7Z0JBQ2xDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsTUFBTSxxQkFBcUIsQ0FDekMsY0FBYyxFQUNkLFNBQVMsRUFDVCxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FDcEIsQ0FBQztZQUVGLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNDLG1EQUFtRDtZQUNuRCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLGlFQUFpRSxDQUFDLENBQUM7WUFDbkgsd0NBQXdDO1lBQ3hDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsMERBQTBELENBQUMsQ0FBQztRQUM5RyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywrREFBK0QsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNoRixNQUFNLGNBQWMsR0FBRyw0QkFBNEIsQ0FBQztZQUVwRCxrQ0FBa0M7WUFDbEMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUM7WUFFMUQsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLGNBQWMsRUFBRSxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFDbEYsQ0FBQyxLQUFVLEVBQUUsRUFBRTtnQkFDZCxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssWUFBWSxjQUFjLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztnQkFDMUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUseUJBQXlCLENBQUMsQ0FBQztnQkFDdEUsTUFBTSxDQUFDLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSw0Q0FBNEMsQ0FBQyxDQUFDO2dCQUNuSCxNQUFNLENBQUMsRUFBRSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLDZDQUE2QyxDQUFDLENBQUM7Z0JBQ3BILE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQyxDQUNELENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsdURBQXVELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDeEUsTUFBTSxjQUFjLEdBQUcsNEJBQTRCLENBQUM7WUFFcEQsa0NBQWtDO1lBQ2xDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1lBRWpFLDBCQUEwQjtZQUMxQixTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNqQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxXQUFXO2dCQUM3QixVQUFVLEVBQUUsV0FBVzthQUN2QixDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsY0FBYyxFQUFFLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUNsRixDQUFDLEtBQVUsRUFBRSxFQUFFO2dCQUNkLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxZQUFZLGNBQWMsRUFBRSw2QkFBNkIsQ0FBQyxDQUFDO2dCQUMxRSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSx5QkFBeUIsQ0FBQyxDQUFDO2dCQUN0RSxNQUFNLENBQUMsRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHFDQUFxQyxDQUFDLENBQUM7Z0JBQ3JHLE1BQU0sQ0FBQyxFQUFFLENBQUMsd0NBQXdDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsNEJBQTRCLENBQUMsQ0FBQztnQkFDaEgsT0FBTyxJQUFJLENBQUM7WUFDYixDQUFDLENBQ0QsQ0FBQztZQUVGLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywwRUFBMEUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUMzRixNQUFNLGNBQWMsR0FBRyx5QkFBeUIsQ0FBQztZQUNqRCxNQUFNLG1CQUFtQixHQUFHLDBEQUEwRCxDQUFDO1lBRXZGLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDO1lBRXRELE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQyxjQUFjLEVBQUUsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFDNUYsdUJBQXVCLENBQ3ZCLENBQUM7WUFFRixxREFBcUQ7WUFDckQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztRQUN0RSxDQUFDLENBQUMsQ0FBQztJQUNKLENBQUMsQ0FBQyxDQUFDO0lBRUgsS0FBSyxDQUFDLGtDQUFrQyxFQUFFLEdBQUcsRUFBRTtRQUM5QyxJQUFJLE9BQTJCLENBQUM7UUFDaEMsSUFBSSxTQUEwQixDQUFDO1FBRS9CLEtBQUssQ0FBQyxHQUFHLEVBQUU7WUFDVixPQUFPLEdBQUcsS0FBSyxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ2hDLFNBQVMsR0FBRyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDNUIsQ0FBQyxDQUFDLENBQUM7UUFFSCxRQUFRLENBQUMsR0FBRyxFQUFFO1lBQ2IsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ25CLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHNGQUFzRixFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3ZHLE1BQU0sbUJBQW1CLEdBQUcsaUNBQWlDLENBQUM7WUFDOUQsTUFBTSxnQkFBZ0IsR0FBaUM7Z0JBQ3RELE1BQU0sRUFBRSxpQ0FBaUM7Z0JBQ3pDLHNCQUFzQixFQUFFLDJDQUEyQztnQkFDbkUsY0FBYyxFQUFFLHVDQUF1QztnQkFDdkQsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGdCQUFnQjtnQkFDbEMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDbEQsVUFBVSxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsTUFBTSxnQ0FBZ0MsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBRWpHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNDLHlIQUF5SDtZQUN6SCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLHdFQUF3RSxDQUFDLENBQUM7WUFDMUgsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDL0QsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsaUVBQWlFLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDbEYsTUFBTSxtQkFBbUIsR0FBRyxpQ0FBaUMsQ0FBQztZQUM5RCxNQUFNLGdCQUFnQixHQUFpQztnQkFDdEQsTUFBTSxFQUFFLGlDQUFpQztnQkFDekMsc0JBQXNCLEVBQUUsMkNBQTJDO2dCQUNuRSxjQUFjLEVBQUUsdUNBQXVDO2dCQUN2RCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsb0NBQW9DO1lBQ3BDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBQ2hDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVc7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2dCQUN2QixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNsRCxDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNqQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7Z0JBQ2xDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2xELFVBQVUsRUFBRSxJQUFJO2FBQ2hCLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0sZ0NBQWdDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUVqRyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMzQyxpQ0FBaUM7WUFDakMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSx3RUFBd0UsQ0FBQyxDQUFDO1lBQzFILCtEQUErRDtZQUMvRCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLGtFQUFrRSxDQUFDLENBQUM7UUFDdEgsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZ0VBQWdFLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDakYsTUFBTSxtQkFBbUIsR0FBRyxpQ0FBaUMsQ0FBQztZQUM5RCxNQUFNLGdCQUFnQixHQUFpQztnQkFDdEQsTUFBTSxFQUFFLGlDQUFpQztnQkFDekMsc0JBQXNCLEVBQUUsMkNBQTJDO2dCQUNuRSxjQUFjLEVBQUUsdUNBQXVDO2dCQUN2RCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsdUNBQXVDO1lBQ3ZDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBQ2hDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVc7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2dCQUN2QixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNsRCxDQUFDLENBQUM7WUFFSCxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNqQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxXQUFXO2dCQUM3QixVQUFVLEVBQUUsV0FBVztnQkFDdkIsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQztnQkFDaEMsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFFakcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNqRCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDM0MsaUNBQWlDO1lBQ2pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsd0VBQXdFLENBQUMsQ0FBQztZQUMxSCwrREFBK0Q7WUFDL0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxrRUFBa0UsQ0FBQyxDQUFDO1lBQ3JILDZEQUE2RDtZQUM3RCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLGtFQUFrRSxDQUFDLENBQUM7UUFDckgsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsK0RBQStELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDaEYsTUFBTSxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQztZQUN2RCxNQUFNLGdCQUFnQixHQUFpQztnQkFDdEQsTUFBTSxFQUFFLDJCQUEyQjtnQkFDbkMsc0JBQXNCLEVBQUUsb0NBQW9DO2dCQUM1RCxjQUFjLEVBQUUsZ0NBQWdDO2dCQUNoRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFFakcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNqRCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDM0Msd0NBQXdDO1lBQ3hDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsaUVBQWlFLENBQUMsQ0FBQztRQUNwSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx3REFBd0QsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN6RSxNQUFNLG1CQUFtQixHQUFHLGtDQUFrQyxDQUFDO1lBQy9ELE1BQU0sZ0JBQWdCLEdBQWlDO2dCQUN0RCxNQUFNLEVBQUUsa0NBQWtDO2dCQUMxQyxzQkFBc0IsRUFBRSwyQ0FBMkM7Z0JBQ25FLGNBQWMsRUFBRSx1Q0FBdUM7Z0JBQ3ZELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7Z0JBQ2xDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2xELFVBQVUsRUFBRSxJQUFJO2FBQ2hCLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0sZ0NBQWdDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUVqRyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxtREFBbUQsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNwRSxNQUFNLG1CQUFtQixHQUFHLGlDQUFpQyxDQUFDO1lBQzlELE1BQU0saUJBQWlCLEdBQUc7Z0JBQ3pCLGlCQUFpQixFQUFFLGNBQWM7Z0JBQ2pDLGVBQWUsRUFBRSxpQkFBaUI7YUFDbEMsQ0FBQztZQUNGLE1BQU0sZ0JBQWdCLEdBQWlDO2dCQUN0RCxNQUFNLEVBQUUsaUNBQWlDO2dCQUN6Qyx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7WUFFckcsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3BELE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDL0QsTUFBTSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsZUFBZSxDQUFDLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUNoRSxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQzNELENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxDQUFDLCtEQUErRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ2hGLE1BQU0sbUJBQW1CLEdBQUcsaUNBQWlDLENBQUM7WUFFOUQsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsV0FBVztnQkFDN0IsVUFBVSxFQUFFLFdBQVc7Z0JBQ3ZCLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2xELENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FDbkIsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQ0FBZ0MsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUN2RixDQUFDLEtBQVUsRUFBRSxFQUFFO2dCQUNkLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxZQUFZLGNBQWMsRUFBRSw2QkFBNkIsQ0FBQyxDQUFDO2dCQUMxRSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSw0Q0FBNEMsQ0FBQyxDQUFDO2dCQUN6RixNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsdUVBQXVFLENBQUMsQ0FBQztnQkFDM0csa0RBQWtEO2dCQUNsRCxNQUFNLENBQUMsRUFBRSxDQUFDLGlDQUFpQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLG9EQUFvRCxDQUFDLENBQUM7Z0JBQ2pJLE1BQU0sQ0FBQyxFQUFFLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsMkRBQTJELENBQUMsQ0FBQztnQkFDbEksTUFBTSxDQUFDLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSx5REFBeUQsQ0FBQyxDQUFDO2dCQUNoSSxPQUFPLElBQUksQ0FBQztZQUNiLENBQUMsQ0FDRCxDQUFDO1lBRUYsd0NBQXdDO1lBQ3hDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxxRkFBcUYsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN0RyxNQUFNLG1CQUFtQixHQUFHLDBCQUEwQixDQUFDO1lBRXZELHFGQUFxRjtZQUNyRixTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNoQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyx1QkFBdUI7Z0JBQ3pDLFVBQVUsRUFBRSx1QkFBdUI7Z0JBQ25DLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2xELENBQUMsQ0FBQztZQUVILE1BQU0sZ0JBQWdCLEdBQWlDO2dCQUN0RCxNQUFNLEVBQUUsMkJBQTJCO2dCQUNuQyx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLFFBQVEsQ0FBQztnQkFDakMsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxtQ0FBbUM7WUFDbkMsTUFBTSxNQUFNLEdBQUcsTUFBTSxnQ0FBZ0MsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ2pHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDRFQUE0RSxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzdGLE1BQU0sbUJBQW1CLEdBQUcsaUNBQWlDLENBQUM7WUFFOUQsNEJBQTRCO1lBQzVCLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDO1lBRWpFLG1CQUFtQjtZQUNuQixTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNqQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxXQUFXO2dCQUM3QixVQUFVLEVBQUUsV0FBVztnQkFDdkIsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsa0JBQWtCO1lBQ2xCLFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBQ2hDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLHVCQUF1QjtnQkFDekMsVUFBVSxFQUFFLHVCQUF1QjtnQkFDbkMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQ3ZGLENBQUMsS0FBVSxFQUFFLEVBQUU7Z0JBQ2QsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLFlBQVksY0FBYyxFQUFFLDZCQUE2QixDQUFDLENBQUM7Z0JBQzFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLHlCQUF5QixDQUFDLENBQUM7Z0JBQ3RFLCtCQUErQjtnQkFDL0IsTUFBTSxDQUFDLEVBQUUsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxxQ0FBcUMsQ0FBQyxDQUFDO2dCQUNyRyxzQkFBc0I7Z0JBQ3RCLE1BQU0sQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsNEJBQTRCLENBQUMsQ0FBQztnQkFDeEYscUJBQXFCO2dCQUNyQixNQUFNLENBQUMsRUFBRSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLDJCQUEyQixDQUFDLENBQUM7Z0JBQ25HLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQyxDQUNELENBQUM7WUFFRixNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMscUNBQXFDLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDdEQsTUFBTSxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQztZQUV2RCxTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdEQsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsY0FBYztnQkFDaEMsVUFBVSxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQ3ZGLCtDQUErQyxDQUMvQyxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMseURBQXlELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDMUUsTUFBTSxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQztZQUN2RCxNQUFNLGVBQWUsR0FBRztnQkFDdkIsa0NBQWtDO2dCQUNsQyxzQkFBc0IsRUFBRSxvQ0FBb0M7YUFDNUQsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGVBQWU7Z0JBQ2pDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO2dCQUNqRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMsZ0NBQWdDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFDdkYsK0NBQStDLENBQy9DLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQywyREFBMkQsRUFBRSxLQUFLLElBQUksRUFBRTtZQUM1RSxNQUFNLG1CQUFtQixHQUFHLDBCQUEwQixDQUFDO1lBQ3ZELE1BQU0sZ0JBQWdCLEdBQWlDO2dCQUN0RCxNQUFNLEVBQUUsMkJBQTJCO2dCQUNuQyx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsbURBQW1EO1lBQ25ELE1BQU0sZUFBZSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQztnQkFDbEUsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsSUFBSTthQUNULENBQUMsQ0FBQztZQUVWLE1BQU0sTUFBTSxHQUFHLE1BQU0sZ0NBQWdDLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUUzRSxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNsRCxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxtRUFBbUUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUNwRixNQUFNLG1CQUFtQixHQUFHLDBCQUEwQixDQUFDO1lBQ3ZELE1BQU0sZ0JBQWdCLEdBQWlDO2dCQUN0RCxNQUFNLEVBQUUsMkJBQTJCO2dCQUNuQyx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsbURBQW1EO1lBQ25ELFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztZQUM1RCxTQUFTLENBQUMsWUFBWSxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNqQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7Z0JBQ2xDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2xELFVBQVUsRUFBRSxJQUFJO2FBQ2hCLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0sZ0NBQWdDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUVqRyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELGtDQUFrQztZQUNsQyxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsd0RBQXdELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDekUsTUFBTSxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQztZQUV2RCxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUM7WUFFOUMsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUNuQixLQUFLLElBQUksRUFBRSxDQUFDLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQ3ZGLENBQUMsS0FBVSxFQUFFLEVBQUU7Z0JBQ2QsTUFBTSxDQUFDLEVBQUUsQ0FBQyxLQUFLLFlBQVksY0FBYyxFQUFFLDZCQUE2QixDQUFDLENBQUM7Z0JBQzFFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLHlCQUF5QixDQUFDLENBQUM7Z0JBQ3RFLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRSx1RUFBdUUsQ0FBQyxDQUFDO2dCQUMzRyxzQ0FBc0M7Z0JBQ3RDLE1BQU0sQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHFDQUFxQyxDQUFDLENBQUM7Z0JBQ2hHLE1BQU0sQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHNDQUFzQyxDQUFDLENBQUM7Z0JBQ2pHLE1BQU0sQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHFDQUFxQyxDQUFDLENBQUM7Z0JBQ2hHLE9BQU8sSUFBSSxDQUFDO1lBQ2IsQ0FBQyxDQUNELENBQUM7WUFFRix3Q0FBd0M7WUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHlEQUF5RCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzFFLE1BQU0sbUJBQW1CLEdBQUcsaUNBQWlDLENBQUM7WUFDOUQsTUFBTSxnQkFBZ0IsR0FBaUM7Z0JBQ3RELE1BQU0sRUFBRSxpQ0FBaUM7Z0JBQ3pDLHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUM7WUFFRixrQ0FBa0M7WUFDbEMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7WUFFakUsMEJBQTBCO1lBQzFCLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBQ2pDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVc7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2dCQUN2QixJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsR0FBRyxNQUFNLElBQUksS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUNsRCxDQUFDLENBQUM7WUFFSCxzQkFBc0I7WUFDdEIsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQztnQkFDaEMsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFFakcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNqRCx3Q0FBd0M7WUFDeEMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLHFEQUFxRCxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3RFLE1BQU0sbUJBQW1CLEdBQUcsMEJBQTBCLENBQUM7WUFFdkQsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDMUQsVUFBVSxFQUFFLHVCQUF1QjtnQkFDbkMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUMxRCxDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMsZ0NBQWdDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFDdkYsQ0FBQyxLQUFVLEVBQUUsRUFBRTtnQkFDZCxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssWUFBWSxjQUFjLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztnQkFDMUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUseUJBQXlCLENBQUMsQ0FBQztnQkFDdEUsb0ZBQW9GO2dCQUNwRixLQUFLLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDaEMsTUFBTSxDQUFDLEVBQUUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLDRDQUE0QyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDckgsQ0FBQztnQkFDRCxPQUFPLElBQUksQ0FBQztZQUNiLENBQUMsQ0FDRCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsMkRBQTJELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDNUUsTUFBTSxtQkFBbUIsR0FBRyxrQ0FBa0MsQ0FBQztZQUMvRCxNQUFNLGdCQUFnQixHQUFpQztnQkFDdEQsTUFBTSxFQUFFLGtDQUFrQztnQkFDMUMsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQztZQUVGLHVDQUF1QztZQUN2QyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNoQyxNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxXQUFXO2dCQUM3QixVQUFVLEVBQUUsV0FBVztnQkFDdkIsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLEdBQUcsTUFBTSxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDbEQsQ0FBQyxDQUFDO1lBRUgsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLFFBQVEsQ0FBQztnQkFDakMsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsV0FBVztnQkFDN0IsVUFBVSxFQUFFLFdBQVc7Z0JBQ3ZCLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxHQUFHLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2xELENBQUMsQ0FBQztZQUVILFNBQVMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUM7Z0JBQ2hDLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGdCQUFnQjtnQkFDbEMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDbEQsVUFBVSxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsTUFBTSxnQ0FBZ0MsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBRWpHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNDLDBFQUEwRTtZQUMxRSxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLGtFQUFrRSxDQUFDLENBQUM7UUFDckgsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbUNBQW1DLEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDcEQsTUFBTSxtQkFBbUIsR0FBRyx5Q0FBeUMsQ0FBQztZQUN0RSxNQUFNLGdCQUFnQixHQUFpQztnQkFDdEQsTUFBTSxFQUFFLHlDQUF5QztnQkFDakQsd0JBQXdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDbEMsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGdCQUFnQjtnQkFDbEMsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQztnQkFDbEQsVUFBVSxFQUFFLElBQUk7YUFDaEIsQ0FBQyxDQUFDO1lBRUgsTUFBTSxNQUFNLEdBQUcsTUFBTSxnQ0FBZ0MsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBRWpHLE1BQU0sQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDakQsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzNDLDREQUE0RDtZQUM1RCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLGdGQUFnRixDQUFDLENBQUM7UUFDbkksQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsbURBQW1ELEVBQUUsS0FBSyxJQUFJLEVBQUU7WUFDcEUsTUFBTSxtQkFBbUIsR0FBRywwQkFBMEIsQ0FBQztZQUN2RCxNQUFNLGVBQWUsR0FBRztnQkFDdkIsS0FBSyxFQUFFLGVBQWU7Z0JBQ3RCLE9BQU8sRUFBRSx3QkFBd0I7YUFDakMsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGVBQWU7Z0JBQ2pDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDO2dCQUNqRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQ25CLEtBQUssSUFBSSxFQUFFLENBQUMsZ0NBQWdDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFDdkYsQ0FBQyxLQUFVLEVBQUUsRUFBRTtnQkFDZCxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssWUFBWSxjQUFjLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztnQkFDMUUsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUseUJBQXlCLENBQUMsQ0FBQztnQkFDdEUsOERBQThEO2dCQUM5RCxLQUFLLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDaEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxvREFBb0QsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLHNDQUFzQyxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDeEksQ0FBQztnQkFDRCxPQUFPLElBQUksQ0FBQztZQUNiLENBQUMsQ0FDRCxDQUFDO1lBRUYsaUNBQWlDO1lBQ2pDLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxxRUFBcUUsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN0RixNQUFNLG1CQUFtQixHQUFHLDBCQUEwQixDQUFDO1lBQ3ZELDBDQUEwQztZQUMxQyxNQUFNLGFBQWEsR0FBaUM7Z0JBQ25ELE1BQU0sRUFBRSwyQkFBMkI7Z0JBQ25DLHNCQUFzQixFQUFFLG9DQUFvQztnQkFDNUQsY0FBYyxFQUFFLGdDQUFnQztnQkFDaEQsUUFBUSxFQUFFLCtCQUErQjtnQkFDekMscUJBQXFCLEVBQUUsbUNBQW1DO2dCQUMxRCx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7YUFDM0MsQ0FBQztZQUVGLFNBQVMsQ0FBQyxRQUFRLENBQUM7Z0JBQ2xCLE1BQU0sRUFBRSxHQUFHO2dCQUNYLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLGFBQWE7Z0JBQy9CLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDO2dCQUMvQyxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLE1BQU0sR0FBRyxNQUFNLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFFakcsTUFBTSxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDOUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLDBDQUEwQyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQzNELE1BQU0sbUJBQW1CLEdBQUcsNENBQTRDLENBQUM7WUFDekUsTUFBTSxnQkFBZ0IsR0FBaUM7Z0JBQ3RELE1BQU0sRUFBRSw0Q0FBNEM7Z0JBQ3BELHdCQUF3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ2xDLENBQUM7WUFFRixTQUFTLENBQUMsUUFBUSxDQUFDO2dCQUNsQixNQUFNLEVBQUUsR0FBRztnQkFDWCxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxnQkFBZ0I7Z0JBQ2xDLElBQUksRUFBRSxLQUFLLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7Z0JBQ2xELFVBQVUsRUFBRSxJQUFJO2FBQ2hCLENBQUMsQ0FBQztZQUVILE1BQU0sTUFBTSxHQUFHLE1BQU0sZ0NBQWdDLENBQUMsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztZQUVqRyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ2pELE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyx1Q0FBdUMsRUFBRSxLQUFLLElBQUksRUFBRTtZQUN4RCxNQUFNLG1CQUFtQixHQUFHLDBCQUEwQixDQUFDO1lBQ3ZELE1BQU0sZ0JBQWdCLEdBQWlDO2dCQUN0RCxNQUFNLEVBQUUsMkJBQTJCO2dCQUNuQyx3QkFBd0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNsQyxDQUFDO1lBRUYsU0FBUyxDQUFDLFFBQVEsQ0FBQztnQkFDbEIsTUFBTSxFQUFFLEdBQUc7Z0JBQ1gsSUFBSSxFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsZ0JBQWdCO2dCQUNsQyxJQUFJLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDO2dCQUNsRCxVQUFVLEVBQUUsSUFBSTthQUNoQixDQUFDLENBQUM7WUFFSCxNQUFNLGdDQUFnQyxDQUFDLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRXpHLE1BQU0sT0FBTyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUNwRCxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1FBQzNELENBQUMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDLENBQUM7QUFDSixDQUFDLENBQUMsQ0FBQyJ9