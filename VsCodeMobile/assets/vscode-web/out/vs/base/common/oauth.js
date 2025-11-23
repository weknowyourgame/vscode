/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { decodeBase64 } from './buffer.js';
const WELL_KNOWN_ROUTE = '/.well-known';
export const AUTH_PROTECTED_RESOURCE_METADATA_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/oauth-protected-resource`;
export const AUTH_SERVER_METADATA_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/oauth-authorization-server`;
export const OPENID_CONNECT_DISCOVERY_PATH = `${WELL_KNOWN_ROUTE}/openid-configuration`;
export const AUTH_SCOPE_SEPARATOR = ' ';
//#region types
/**
 * Base OAuth 2.0 error codes as specified in RFC 6749.
 */
export var AuthorizationErrorType;
(function (AuthorizationErrorType) {
    AuthorizationErrorType["InvalidRequest"] = "invalid_request";
    AuthorizationErrorType["InvalidClient"] = "invalid_client";
    AuthorizationErrorType["InvalidGrant"] = "invalid_grant";
    AuthorizationErrorType["UnauthorizedClient"] = "unauthorized_client";
    AuthorizationErrorType["UnsupportedGrantType"] = "unsupported_grant_type";
    AuthorizationErrorType["InvalidScope"] = "invalid_scope";
})(AuthorizationErrorType || (AuthorizationErrorType = {}));
/**
 * Device authorization grant specific error codes as specified in RFC 8628 section 3.5.
 */
export var AuthorizationDeviceCodeErrorType;
(function (AuthorizationDeviceCodeErrorType) {
    /**
     * The authorization request is still pending as the end user hasn't completed the user interaction steps.
     */
    AuthorizationDeviceCodeErrorType["AuthorizationPending"] = "authorization_pending";
    /**
     * A variant of "authorization_pending", polling should continue but interval must be increased by 5 seconds.
     */
    AuthorizationDeviceCodeErrorType["SlowDown"] = "slow_down";
    /**
     * The authorization request was denied.
     */
    AuthorizationDeviceCodeErrorType["AccessDenied"] = "access_denied";
    /**
     * The "device_code" has expired and the device authorization session has concluded.
     */
    AuthorizationDeviceCodeErrorType["ExpiredToken"] = "expired_token";
})(AuthorizationDeviceCodeErrorType || (AuthorizationDeviceCodeErrorType = {}));
/**
 * Dynamic client registration specific error codes as specified in RFC 7591.
 */
export var AuthorizationRegistrationErrorType;
(function (AuthorizationRegistrationErrorType) {
    /**
     * The value of one or more redirection URIs is invalid.
     */
    AuthorizationRegistrationErrorType["InvalidRedirectUri"] = "invalid_redirect_uri";
    /**
     * The value of one of the client metadata fields is invalid and the server has rejected this request.
     */
    AuthorizationRegistrationErrorType["InvalidClientMetadata"] = "invalid_client_metadata";
    /**
     * The software statement presented is invalid.
     */
    AuthorizationRegistrationErrorType["InvalidSoftwareStatement"] = "invalid_software_statement";
    /**
     * The software statement presented is not approved for use by this authorization server.
     */
    AuthorizationRegistrationErrorType["UnapprovedSoftwareStatement"] = "unapproved_software_statement";
})(AuthorizationRegistrationErrorType || (AuthorizationRegistrationErrorType = {}));
//#endregion
//#region is functions
export function isAuthorizationProtectedResourceMetadata(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const metadata = obj;
    if (!metadata.resource) {
        return false;
    }
    if (metadata.scopes_supported !== undefined && !Array.isArray(metadata.scopes_supported)) {
        return false;
    }
    return true;
}
const urisToCheck = [
    'issuer',
    'authorization_endpoint',
    'token_endpoint',
    'registration_endpoint',
    'jwks_uri'
];
export function isAuthorizationServerMetadata(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const metadata = obj;
    if (!metadata.issuer) {
        throw new Error('Authorization server metadata must have an issuer');
    }
    for (const uri of urisToCheck) {
        if (!metadata[uri]) {
            continue;
        }
        if (typeof metadata[uri] !== 'string') {
            throw new Error(`Authorization server metadata '${uri}' must be a string`);
        }
        if (!metadata[uri].startsWith('https://') && !metadata[uri].startsWith('http://')) {
            throw new Error(`Authorization server metadata '${uri}' must start with http:// or https://`);
        }
    }
    return true;
}
export function isAuthorizationDynamicClientRegistrationResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.client_id !== undefined;
}
export function isAuthorizationAuthorizeResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.code !== undefined && response.state !== undefined;
}
export function isAuthorizationTokenResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.access_token !== undefined && response.token_type !== undefined;
}
export function isAuthorizationDeviceResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.device_code !== undefined && response.user_code !== undefined && response.verification_uri !== undefined && response.expires_in !== undefined;
}
export function isAuthorizationErrorResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.error !== undefined;
}
export function isAuthorizationRegistrationErrorResponse(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }
    const response = obj;
    return response.error !== undefined;
}
//#endregion
export function getDefaultMetadataForUrl(authorizationServer) {
    return {
        issuer: authorizationServer.toString(),
        authorization_endpoint: new URL('/authorize', authorizationServer).toString(),
        token_endpoint: new URL('/token', authorizationServer).toString(),
        registration_endpoint: new URL('/register', authorizationServer).toString(),
        // Default values for Dynamic OpenID Providers
        // https://openid.net/specs/openid-connect-discovery-1_0.html
        response_types_supported: ['code', 'id_token', 'id_token token'],
    };
}
/**
 * The grant types that we support
 */
const grantTypesSupported = ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'];
/**
 * Default port for the authorization flow. We try to use this port so that
 * the redirect URI does not change when running on localhost. This is useful
 * for servers that only allow exact matches on the redirect URI. The spec
 * says that the port should not matter, but some servers do not follow
 * the spec and require an exact match.
 */
export const DEFAULT_AUTH_FLOW_PORT = 33418;
export async function fetchDynamicRegistration(serverMetadata, clientName, scopes) {
    if (!serverMetadata.registration_endpoint) {
        throw new Error('Server does not support dynamic registration');
    }
    const requestBody = {
        client_name: clientName,
        client_uri: 'https://code.visualstudio.com',
        grant_types: serverMetadata.grant_types_supported
            ? serverMetadata.grant_types_supported.filter(gt => grantTypesSupported.includes(gt))
            : grantTypesSupported,
        response_types: ['code'],
        redirect_uris: [
            'https://insiders.vscode.dev/redirect',
            'https://vscode.dev/redirect',
            'http://127.0.0.1/',
            // Added these for any server that might do
            // only exact match on the redirect URI even
            // though the spec says it should not care
            // about the port.
            `http://127.0.0.1:${DEFAULT_AUTH_FLOW_PORT}/`
        ],
        scope: scopes?.join(AUTH_SCOPE_SEPARATOR),
        token_endpoint_auth_method: 'none',
        application_type: 'native'
    };
    const response = await fetch(serverMetadata.registration_endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        const result = await response.text();
        let errorDetails = result;
        try {
            const errorResponse = JSON.parse(result);
            if (isAuthorizationRegistrationErrorResponse(errorResponse)) {
                errorDetails = `${errorResponse.error}${errorResponse.error_description ? `: ${errorResponse.error_description}` : ''}`;
            }
        }
        catch {
            // JSON parsing failed, use raw text
        }
        throw new Error(`Registration to ${serverMetadata.registration_endpoint} failed: ${errorDetails}`);
    }
    const registration = await response.json();
    if (isAuthorizationDynamicClientRegistrationResponse(registration)) {
        return registration;
    }
    throw new Error(`Invalid authorization dynamic client registration response: ${JSON.stringify(registration)}`);
}
export function parseWWWAuthenticateHeader(wwwAuthenticateHeaderValue) {
    const challenges = [];
    // According to RFC 7235, multiple challenges are separated by commas
    // But parameters within a challenge can also be separated by commas
    // We need to identify scheme names to know where challenges start
    // First, split by commas while respecting quoted strings
    const tokens = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < wwwAuthenticateHeaderValue.length; i++) {
        const char = wwwAuthenticateHeaderValue[i];
        if (char === '"') {
            inQuotes = !inQuotes;
            current += char;
        }
        else if (char === ',' && !inQuotes) {
            if (current.trim()) {
                tokens.push(current.trim());
            }
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current.trim()) {
        tokens.push(current.trim());
    }
    // Now process tokens to identify challenges
    // A challenge starts with a scheme name (a token that doesn't contain '=' and is followed by parameters or is standalone)
    let currentChallenge;
    for (const token of tokens) {
        const hasEquals = token.includes('=');
        if (!hasEquals) {
            // This token doesn't have '=', so it's likely a scheme name
            if (currentChallenge) {
                challenges.push(currentChallenge);
            }
            currentChallenge = { scheme: token.trim(), params: {} };
        }
        else {
            // This token has '=', it could be:
            // 1. A parameter for the current challenge
            // 2. A new challenge that starts with "Scheme param=value"
            const spaceIndex = token.indexOf(' ');
            if (spaceIndex > 0) {
                const beforeSpace = token.substring(0, spaceIndex);
                const afterSpace = token.substring(spaceIndex + 1);
                // Check if what's before the space looks like a scheme name (no '=')
                if (!beforeSpace.includes('=') && afterSpace.includes('=')) {
                    // This is a new challenge starting with "Scheme param=value"
                    if (currentChallenge) {
                        challenges.push(currentChallenge);
                    }
                    currentChallenge = { scheme: beforeSpace.trim(), params: {} };
                    // Parse the parameter part
                    const equalIndex = afterSpace.indexOf('=');
                    if (equalIndex > 0) {
                        const key = afterSpace.substring(0, equalIndex).trim();
                        const value = afterSpace.substring(equalIndex + 1).trim().replace(/^"|"$/g, '');
                        if (key && value !== undefined) {
                            currentChallenge.params[key] = value;
                        }
                    }
                    continue;
                }
            }
            // This is a parameter for the current challenge
            if (currentChallenge) {
                const equalIndex = token.indexOf('=');
                if (equalIndex > 0) {
                    const key = token.substring(0, equalIndex).trim();
                    const value = token.substring(equalIndex + 1).trim().replace(/^"|"$/g, '');
                    if (key && value !== undefined) {
                        currentChallenge.params[key] = value;
                    }
                }
            }
        }
    }
    // Don't forget the last challenge
    if (currentChallenge) {
        challenges.push(currentChallenge);
    }
    return challenges;
}
export function getClaimsFromJWT(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT token format: token must have three parts separated by dots');
    }
    const [header, payload, _signature] = parts;
    try {
        const decodedHeader = JSON.parse(decodeBase64(header).toString());
        if (typeof decodedHeader !== 'object') {
            throw new Error('Invalid JWT token format: header is not a JSON object');
        }
        const decodedPayload = JSON.parse(decodeBase64(payload).toString());
        if (typeof decodedPayload !== 'object') {
            throw new Error('Invalid JWT token format: payload is not a JSON object');
        }
        return decodedPayload;
    }
    catch (e) {
        if (e instanceof Error) {
            throw new Error(`Failed to parse JWT token: ${e.message}`);
        }
        throw new Error('Failed to parse JWT token');
    }
}
/**
 * Checks if two scope lists are equivalent, regardless of order.
 * This is useful for comparing OAuth scopes where the order should not matter.
 *
 * @param scopes1 First list of scopes to compare (can be undefined)
 * @param scopes2 Second list of scopes to compare (can be undefined)
 * @returns true if the scope lists contain the same scopes (order-independent), false otherwise
 *
 * @example
 * ```typescript
 * scopesMatch(['read', 'write'], ['write', 'read']) // Returns: true
 * scopesMatch(['read'], ['write']) // Returns: false
 * scopesMatch(undefined, undefined) // Returns: true
 * scopesMatch(['read'], undefined) // Returns: false
 * ```
 */
export function scopesMatch(scopes1, scopes2) {
    if (scopes1 === scopes2) {
        return true;
    }
    if (!scopes1 || !scopes2) {
        return false;
    }
    if (scopes1.length !== scopes2.length) {
        return false;
    }
    // Sort both arrays for comparison to handle different orderings
    const sortedScopes1 = [...scopes1].sort();
    const sortedScopes2 = [...scopes2].sort();
    return sortedScopes1.every((scope, index) => scope === sortedScopes2[index]);
}
/**
 * Fetches and validates OAuth 2.0 protected resource metadata from the given URL.
 *
 * @param targetResource The target resource URL to compare origins with (e.g., the MCP server URL)
 * @param resourceMetadataUrl Optional URL to fetch the resource metadata from. If not provided, will try well-known URIs.
 * @param options Configuration options for the fetch operation
 * @returns Promise that resolves to the validated resource metadata
 * @throws Error if the fetch fails, returns non-200 status, or the response is invalid
 */
export async function fetchResourceMetadata(targetResource, resourceMetadataUrl, options = {}) {
    const { sameOriginHeaders = {}, fetch: fetchImpl = fetch } = options;
    const targetResourceUrlObj = new URL(targetResource);
    // If no resourceMetadataUrl is provided, try well-known URIs as per RFC 9728
    let urlsToTry;
    if (!resourceMetadataUrl) {
        // Try in order: 1) with path appended, 2) at root
        const pathComponent = targetResourceUrlObj.pathname === '/' ? undefined : targetResourceUrlObj.pathname;
        const rootUrl = `${targetResourceUrlObj.origin}${AUTH_PROTECTED_RESOURCE_METADATA_DISCOVERY_PATH}`;
        if (pathComponent) {
            // Only try both URLs if we have a path component
            urlsToTry = [
                `${rootUrl}${pathComponent}`,
                rootUrl
            ];
        }
        else {
            // If target is already at root, only try the root URL once
            urlsToTry = [rootUrl];
        }
    }
    else {
        urlsToTry = [resourceMetadataUrl];
    }
    const errors = [];
    for (const urlToTry of urlsToTry) {
        try {
            // Determine if we should include same-origin headers
            let headers = {
                'Accept': 'application/json'
            };
            const resourceMetadataUrlObj = new URL(urlToTry);
            if (resourceMetadataUrlObj.origin === targetResourceUrlObj.origin) {
                headers = {
                    ...headers,
                    ...sameOriginHeaders
                };
            }
            const response = await fetchImpl(urlToTry, { method: 'GET', headers });
            if (response.status !== 200) {
                let errorText;
                try {
                    errorText = await response.text();
                }
                catch {
                    errorText = response.statusText;
                }
                errors.push(new Error(`Failed to fetch resource metadata from ${urlToTry}: ${response.status} ${errorText}`));
                continue;
            }
            const body = await response.json();
            if (isAuthorizationProtectedResourceMetadata(body)) {
                // Use URL constructor for normalization - it handles hostname case and trailing slashes
                const prmValue = new URL(body.resource).toString();
                const targetValue = targetResourceUrlObj.toString();
                if (prmValue !== targetValue) {
                    throw new Error(`Protected Resource Metadata resource property value "${prmValue}" (length: ${prmValue.length}) does not match target server url "${targetValue}" (length: ${targetValue.length}). These MUST match to follow OAuth spec https://datatracker.ietf.org/doc/html/rfc9728#PRConfigurationValidation`);
                }
                return body;
            }
            else {
                errors.push(new Error(`Invalid resource metadata from ${urlToTry}. Expected to follow shape of https://datatracker.ietf.org/doc/html/rfc9728#name-protected-resource-metadata (Hints: is scopes_supported an array? Is resource a string?). Current payload: ${JSON.stringify(body)}`));
                continue;
            }
        }
        catch (e) {
            errors.push(e instanceof Error ? e : new Error(String(e)));
            continue;
        }
    }
    // If we've tried all URLs and none worked, throw the error(s)
    if (errors.length === 1) {
        throw errors[0];
    }
    else {
        throw new AggregateError(errors, 'Failed to fetch resource metadata from all attempted URLs');
    }
}
/** Helper to try parsing the response as authorization server metadata */
async function tryParseAuthServerMetadata(response) {
    if (response.status !== 200) {
        return undefined;
    }
    try {
        const body = await response.json();
        if (isAuthorizationServerMetadata(body)) {
            return body;
        }
    }
    catch {
        // Failed to parse as JSON or not valid metadata
    }
    return undefined;
}
/** Helper to get error text from response */
async function getErrText(res) {
    try {
        return await res.text();
    }
    catch {
        return res.statusText;
    }
}
/**
 * Fetches and validates OAuth 2.0 authorization server metadata from the given authorization server URL.
 *
 * This function tries multiple discovery endpoints in the following order:
 * 1. OAuth 2.0 Authorization Server Metadata with path insertion (RFC 8414)
 * 2. OpenID Connect Discovery with path insertion
 * 3. OpenID Connect Discovery with path addition
 *
 * Path insertion: For issuer URLs with path components (e.g., https://example.com/tenant),
 * the well-known path is inserted after the origin and before the path:
 * https://example.com/.well-known/oauth-authorization-server/tenant
 *
 * Path addition: The well-known path is simply appended to the existing path:
 * https://example.com/tenant/.well-known/openid-configuration
 *
 * @param authorizationServer The authorization server URL (issuer identifier)
 * @param options Configuration options for the fetch operation
 * @returns Promise that resolves to the validated authorization server metadata
 * @throws Error if all discovery attempts fail or the response is invalid
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414#section-3
 */
export async function fetchAuthorizationServerMetadata(authorizationServer, options = {}) {
    const { additionalHeaders = {}, fetch: fetchImpl = fetch } = options;
    const authorizationServerUrl = new URL(authorizationServer);
    const extraPath = authorizationServerUrl.pathname === '/' ? '' : authorizationServerUrl.pathname;
    const errors = [];
    const doFetch = async (url) => {
        try {
            const rawResponse = await fetchImpl(url, {
                method: 'GET',
                headers: {
                    ...additionalHeaders,
                    'Accept': 'application/json'
                }
            });
            const metadata = await tryParseAuthServerMetadata(rawResponse);
            if (metadata) {
                return metadata;
            }
            // No metadata found, collect error from response
            errors.push(new Error(`Failed to fetch authorization server metadata from ${url}: ${rawResponse.status} ${await getErrText(rawResponse)}`));
            return undefined;
        }
        catch (e) {
            // Collect error from fetch failure
            errors.push(e instanceof Error ? e : new Error(String(e)));
            return undefined;
        }
    };
    // For the oauth server metadata discovery path, we _INSERT_
    // the well known path after the origin and before the path.
    // https://datatracker.ietf.org/doc/html/rfc8414#section-3
    const pathToFetch = new URL(AUTH_SERVER_METADATA_DISCOVERY_PATH, authorizationServer).toString() + extraPath;
    let metadata = await doFetch(pathToFetch);
    if (metadata) {
        return metadata;
    }
    // Try fetching the OpenID Connect Discovery with path insertion.
    // For issuer URLs with path components, this inserts the well-known path
    // after the origin and before the path.
    const openidPathInsertionUrl = new URL(OPENID_CONNECT_DISCOVERY_PATH, authorizationServer).toString() + extraPath;
    metadata = await doFetch(openidPathInsertionUrl);
    if (metadata) {
        return metadata;
    }
    // Try fetching the other discovery URL. For the openid metadata discovery
    // path, we _ADD_ the well known path after the existing path.
    // https://datatracker.ietf.org/doc/html/rfc8414#section-3
    const openidPathAdditionUrl = authorizationServer.endsWith('/')
        ? authorizationServer + OPENID_CONNECT_DISCOVERY_PATH.substring(1) // Remove leading slash if authServer ends with slash
        : authorizationServer + OPENID_CONNECT_DISCOVERY_PATH;
    metadata = await doFetch(openidPathAdditionUrl);
    if (metadata) {
        return metadata;
    }
    // If we've tried all URLs and none worked, throw the error(s)
    if (errors.length === 1) {
        throw errors[0];
    }
    else {
        throw new AggregateError(errors, 'Failed to fetch authorization server metadata from all attempted URLs');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib2F1dGguanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvYmFzZS9jb21tb24vb2F1dGgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGFBQWEsQ0FBQztBQUUzQyxNQUFNLGdCQUFnQixHQUFHLGNBQWMsQ0FBQztBQUN4QyxNQUFNLENBQUMsTUFBTSwrQ0FBK0MsR0FBRyxHQUFHLGdCQUFnQiwyQkFBMkIsQ0FBQztBQUM5RyxNQUFNLENBQUMsTUFBTSxtQ0FBbUMsR0FBRyxHQUFHLGdCQUFnQiw2QkFBNkIsQ0FBQztBQUNwRyxNQUFNLENBQUMsTUFBTSw2QkFBNkIsR0FBRyxHQUFHLGdCQUFnQix1QkFBdUIsQ0FBQztBQUN4RixNQUFNLENBQUMsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLENBQUM7QUFFeEMsZUFBZTtBQUVmOztHQUVHO0FBQ0gsTUFBTSxDQUFOLElBQWtCLHNCQU9qQjtBQVBELFdBQWtCLHNCQUFzQjtJQUN2Qyw0REFBa0MsQ0FBQTtJQUNsQywwREFBZ0MsQ0FBQTtJQUNoQyx3REFBOEIsQ0FBQTtJQUM5QixvRUFBMEMsQ0FBQTtJQUMxQyx5RUFBK0MsQ0FBQTtJQUMvQyx3REFBOEIsQ0FBQTtBQUMvQixDQUFDLEVBUGlCLHNCQUFzQixLQUF0QixzQkFBc0IsUUFPdkM7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFrQixnQ0FpQmpCO0FBakJELFdBQWtCLGdDQUFnQztJQUNqRDs7T0FFRztJQUNILGtGQUE4QyxDQUFBO0lBQzlDOztPQUVHO0lBQ0gsMERBQXNCLENBQUE7SUFDdEI7O09BRUc7SUFDSCxrRUFBOEIsQ0FBQTtJQUM5Qjs7T0FFRztJQUNILGtFQUE4QixDQUFBO0FBQy9CLENBQUMsRUFqQmlCLGdDQUFnQyxLQUFoQyxnQ0FBZ0MsUUFpQmpEO0FBRUQ7O0dBRUc7QUFDSCxNQUFN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