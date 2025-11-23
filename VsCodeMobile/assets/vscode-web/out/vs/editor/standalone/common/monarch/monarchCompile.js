/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*
 * This module only exports 'compile' which compiles a JSON language definition
 * into a typed and checked ILexer definition.
 */
import { isString } from '../../../../base/common/types.js';
import * as monarchCommon from './monarchCommon.js';
/*
 * Type helpers
 *
 * Note: this is just for sanity checks on the JSON description which is
 * helpful for the programmer. No checks are done anymore once the lexer is
 * already 'compiled and checked'.
 *
 */
function isArrayOf(elemType, obj) {
    if (!obj) {
        return false;
    }
    if (!(Array.isArray(obj))) {
        return false;
    }
    for (const el of obj) {
        if (!(elemType(el))) {
            return false;
        }
    }
    return true;
}
function bool(prop, defValue) {
    if (typeof prop === 'boolean') {
        return prop;
    }
    return defValue;
}
function string(prop, defValue) {
    if (typeof (prop) === 'string') {
        return prop;
    }
    return defValue;
}
function arrayToHash(array) {
    const result = {};
    for (const e of array) {
        result[e] = true;
    }
    return result;
}
function createKeywordMatcher(arr, caseInsensitive = false) {
    if (caseInsensitive) {
        arr = arr.map(function (x) { return x.toLowerCase(); });
    }
    const hash = arrayToHash(arr);
    if (caseInsensitive) {
        return function (word) {
            return hash[word.toLowerCase()] !== undefined && hash.hasOwnProperty(word.toLowerCase());
        };
    }
    else {
        return function (word) {
            return hash[word] !== undefined && hash.hasOwnProperty(word);
        };
    }
}
function compileRegExp(lexer, str, handleSn) {
    // @@ must be interpreted as a literal @, so we replace all occurences of @@ with a placeholder character
    str = str.replace(/@@/g, `\x01`);
    let n = 0;
    let hadExpansion;
    do {
        hadExpansion = false;
        str = str.replace(/@(\w+)/g, function (s, attr) {
            hadExpansion = true;
            let sub = '';
            if (typeof (lexer[attr]) === 'string') {
                sub = lexer[attr];
            }
            else if (lexer[attr] && lexer[attr] instanceof RegExp) {
                sub = lexer[attr].source;
            }
            else {
                if (lexer[attr] === undefined) {
                    throw monarchCommon.createError(lexer, 'language definition does not contain attribute \'' + attr + '\', used at: ' + str);
                }
                else {
                    throw monarchCommon.createError(lexer, 'attribute reference \'' + attr + '\' must be a string, used at: ' + str);
                }
            }
            return (monarchCommon.empty(sub) ? '' : '(?:' + sub + ')');
        });
        n++;
    } while (hadExpansion && n < 5);
    // handle escaped @@
    str = str.replace(/\x01/g, '@');
    const flags = (lexer.ignoreCase ? 'i' : '') + (lexer.unicode ? 'u' : '');
    // handle $Sn
    if (handleSn) {
        const match = str.match(/\$[sS](\d\d?)/g);
        if (match) {
            let lastState = null;
            let lastRegEx = null;
            return (state) => {
                if (lastRegEx && lastState === state) {
                    return lastRegEx;
                }
                lastState = state;
                lastRegEx = new RegExp(monarchCommon.substituteMatchesRe(lexer, str, state), flags);
                return lastRegEx;
            };
        }
    }
    return new RegExp(str, flags);
}
/**
 * Compiles guard functions for case matches.
 * This compiles 'cases' attributes into efficient match functions.
 *
 */
function selectScrutinee(id, matches, state, num) {
    if (num < 0) {
        return id;
    }
    if (num < matches.length) {
        return matches[num];
    }
    if (num >= 100) {
        num = num - 100;
        const parts = state.split('.');
        parts.unshift(state);
        if (num < parts.length) {
            return parts[num];
        }
    }
    return null;
}
function createGuard(lexer, ruleName, tkey, val) {
    // get the scrutinee and pattern
    let scrut = -1; // -1: $!, 0-99: $n, 100+n: $Sn
    let oppat = tkey;
    let matches = tkey.match(/^\$(([sS]?)(\d\d?)|#)(.*)$/);
    if (matches) {
        if (matches[3]) { // if digits
            scrut = parseInt(matches[3]);
            if (matches[2]) {
                scrut = scrut + 100; // if [sS] present
            }
        }
        oppat = matches[4];
    }
    // get operator
    let op = '~';
    let pat = oppat;
    if (!oppat || oppat.length === 0) {
        op = '!=';
        pat = '';
    }
    else if (/^\w*$/.test(pat)) { // just a word
        op = '==';
    }
    else {
        matches = oppat.match(/^(@|!@|~|!~|==|!=)(.*)$/);
        if (matches) {
            op = matches[1];
            pat = matches[2];
        }
    }
    // set the tester function
    let tester;
    // special case a regexp that matches just words
    if ((op === '~' || op === '!~') && /^(\w|\|)*$/.test(pat)) {
        const inWords = createKeywordMatcher(pat.split('|'), lexer.ignoreCase);
        tester = function (s) { return (op === '~' ? inWords(s) : !inWords(s)); };
    }
    else if (op === '@' || op === '!@') {
        const words = lexer[pat];
        if (!words) {
            throw monarchCommon.createError(lexer, 'the @ match target \'' + pat + '\' is not defined, in rule: ' + ruleName);
        }
        if (!(isArrayOf(function (elem) { return (typeof (elem) === 'string'); }, words))) {
            throw monarchCommon.createError(lexer, 'the @ match target \'' + pat + '\' must be an array of strings, in rule: ' + ruleName);
        }
        const inWords = createKeywordMatcher(words, lexer.ignoreCase);
        tester = function (s) { return (op === '@' ? inWords(s) : !inWords(s)); };
    }
    else if (op === '~' || op === '!~') {
        if (pat.indexOf('$') < 0) {
            // precompile regular expression
            const re = compileRegExp(lexer, '^' + pat + '$', false);
            tester = function (s) { return (op === '~' ? re.test(s) : !re.test(s)); };
        }
        else {
            tester = function (s, id, matches, state) {
                const re = compileRegExp(lexer, '^' + monarchCommon.substituteMatches(lexer, pat, id, matches, state) + '$', false);
                return re.test(s);
            };
        }
    }
    else { // if (op==='==' || op==='!=') {
        if (pat.indexOf('$') < 0) {
            const patx = monarchCommon.fixCase(lexer, pat);
            tester = function (s) { return (op === '==' ? s === patx : s !== patx); };
        }
        else {
            const patx = monarchCommon.fixCase(lexer, pat);
            tester = function (s, id, matches, state, eos) {
                const patexp = monarchCommon.substituteMatches(lexer, patx, id, matches, state);
                return (op === '==' ? s === patexp : s !== patexp);
            };
        }
    }
    // return the branch object
    if (scrut === -1) {
        return {
            name: tkey, value: val, test: function (id, matches, state, eos) {
                return tester(id, id, matches, state, eos);
            }
        };
    }
    else {
        return {
            name: tkey, value: val, test: function (id, matches, state, eos) {
                const scrutinee = selectScrutinee(id, matches, state, scrut);
                return tester(!scrutinee ? '' : scrutinee, id, matches, state, eos);
            }
        };
    }
}
/**
 * Compiles an action: i.e. optimize regular expressions and case matches
 * and do many sanity checks.
 *
 * This is called only during compilation but if the lexer definition
 * contains user functions as actions (which is usually not allowed), then this
 * may be called during lexing. It is important therefore to compile common cases efficiently
 */
function compileAction(lexer, ruleName, action) {
    if (!action) {
        return { token: '' };
    }
    else if (typeof (action) === 'string') {
        return action; // { token: action };
    }
    else if (action.token || action.token === '') {
        if (typeof (action.token) !== 'string') {
            throw monarchCommon.createError(lexer, 'a \'token\' attribute must be of type string, in rule: ' + ruleName);
        }
        else {
            // only copy specific typed fields (only happens once during compile Lexer)
            const newAction = { token: action.token };
            if (action.token.indexOf('$') >= 0) {
                newAction.tokenSubst = true;
            }
            if (typeof (action.bracket) === 'string') {
                if (action.bracket === '@open') {
                    newAction.bracket = 1 /* monarchCommon.MonarchBracket.Open */;
                }
                else if (action.bracket === '@close') {
                    newAction.bracket = -1 /* monarchCommon.MonarchBracket.Close */;
                }
                else {
                    throw monarchCommon.createError(lexer, 'a \'bracket\' attribute must be either \'@open\' or \'@close\', in rule: ' + ruleName);
                }
            }
            if (action.next) {
                if (typeof (action.next) !== 'string') {
                    throw monarchCommon.createError(lexer, 'the next state must be a string value in rule: ' + ruleName);
                }
                else {
                    let next = action.next;
                    if (!/^(@pop|@push|@popall)$/.test(next)) {
                        if (next[0] === '@') {
                            next = next.substr(1); // peel off starting @ sign
                        }
                        if (next.indexOf('$') < 0) { // no dollar substitution, we can check if the state exists
                            if (!monarchCommon.stateExists(lexer, monarchCommon.substituteMatches(lexer, next, '', [], ''))) {
                                throw monarchCommon.createError(lexer, 'the next state \'' + action.next + '\' is not defined in rule: ' + ruleName);
                            }
                        }
                    }
                    newAction.next = next;
                }
            }
            if (typeof (action.goBack) === 'number') {
                newAction.goBack = action.goBack;
            }
            if (typeof (action.switchTo) === 'string') {
                newAction.switchTo = action.switchTo;
            }
            if (typeof (action.log) === 'string') {
                newAction.log = action.log;
            }
            if (typeof (action.nextEmbedded) === 'string') {
                newAction.nextEmbedded = action.nextEmbedded;
                lexer.usesEmbedded = true;
            }
            return newAction;
        }
    }
    else if (Array.isArray(action)) {
        const results = [];
        for (let i = 0, len = action.length; i < len; i++) {
            results[i] = compileAction(lexer, ruleName, action[i]);
        }
        return { group: results };
    }
    else if (action.cases) {
        // build an array of test cases
        const cases = [];
        let hasEmbeddedEndInCases = false;
        // for each case, push a test function and result value
        for (const tkey in action.cases) {
            if (action.cases.hasOwnProperty(tkey)) {
                const val = compileAction(lexer, ruleName, action.cases[tkey]);
                // what kind of case
                if (tkey === '@default' || tkey === '@' || tkey === '') {
                    cases.push({ test: undefined, value: val, name: tkey });
                }
                else if (tkey === '@eos') {
                    cases.push({ test: function (id, matches, state, eos) { return eos; }, value: val, name: tkey });
                }
                else {
                    cases.push(createGuard(lexer, ruleName, tkey, val)); // call separate function to avoid local variable capture
                }
                if (!hasEmbeddedEndInCases) {
                    hasEmbeddedEndInCases = !isString(val) && (val.hasEmbeddedEndInCases || ['@pop', '@popall'].includes(val.nextEmbedded || ''));
                }
            }
        }
        // create a matching function
        const def = lexer.defaultToken;
        return {
            hasEmbeddedEndInCases,
            test: function (id, matches, state, eos) {
                for (const _case of cases) {
                    const didmatch = (!_case.test || _case.test(id, matches, state, eos));
                    if (didmatch) {
                        return _case.value;
                    }
                }
                return def;
            }
        };
    }
    else {
        throw monarchCommon.createError(lexer, 'an action must be a string, an object with a \'token\' or \'cases\' attribute, or an array of actions; in rule: ' + ruleName);
    }
}
/**
 * Helper class for creating matching rules
 */
class Rule {
    constructor(name) {
        this.regex = new RegExp('');
        this.action = { token: '' };
        this.matchOnlyAtLineStart = false;
        this.name = '';
        this.name = name;
    }
    setRegex(lexer, re) {
        let sregex;
        if (typeof (re) === 'string') {
            sregex = re;
        }
        else if (re instanceof RegExp) {
            sregex = re.source;
        }
        else {
            throw monarchCommon.createError(lexer, 'rules must start with a match string or regular expression: ' + this.name);
        }
        this.matchOnlyAtLineStart = (sregex.length > 0 && sregex[0] === '^');
        this.name = this.name + ': ' + sregex;
        this.regex = compileRegExp(lexer, '^(?:' + (this.matchOnlyAtLineStart ? sregex.substr(1) : sregex) + ')', true);
    }
    setAction(lexer, act) {
        this.action = compileAction(lexer, this.name, act);
    }
    resolveRegex(state) {
        if (this.regex instanceof RegExp) {
            return this.regex;
        }
        else {
            return this.regex(state);
        }
    }
}
/**
 * Compiles a json description function into json where all regular expressions,
 * case matches etc, are compiled and all include rules are expanded.
 * We also compile the bracket definitions, supply defaults, and do many sanity checks.
 * If the 'jsonStrict' parameter is 'false', we allow at certain locations
 * regular expression objects and functions that get called during lexing.
 * (Currently we have no samples that need this so perhaps we should always have
 * jsonStrict to true).
 */
export function compile(languageId, json) {
    if (!json || typeof (json) !== 'object') {
        throw new Error('Monarch: expecting a language definition object');
    }
    // Create our lexer
    const lexer = {
        languageId: languageId,
        includeLF: bool(json.includeLF, false),
        noThrow: false, // raise exceptions during compilation
        maxStack: 100,
        start: (typeof json.start === 'string' ? json.start : null),
        ignoreCase: bool(json.ignoreCase, false),
        unicode: bool(json.unicode, false),
        tokenPostfix: string(json.tokenPostfix, '.' + languageId),
        defaultToken: string(json.defaultToken, 'source'),
        usesEmbedded: false, // becomes true if we find a nextEmbedded action
        stateNames: {},
        tokenizer: {},
        brackets: []
    };
    // For calling compileAction later on
    // eslint-disable-next-line local/code-no-any-casts
    const lexerMin = json;
    lexerMin.languageId = languageId;
    lexerMin.includeLF = lexer.includeLF;
    lexerMin.ignoreCase = lexer.ignoreCase;
    lexerMin.unicode = lexer.unicode;
    lexerMin.noThrow = lexer.noThrow;
    lexerMin.usesEmbedded = lexer.usesEmbedded;
    lexerMin.stateNames = json.tokenizer;
    lexerMin.defaultToken = lexer.defaultToken;
    // Compile an array of rules into newrules where RegExp objects are created.
    function addRules(state, newrules, rules) {
        for (const rule of rules) {
            let include = rule.include;
            if (include) {
                if (typeof (include) !== 'string') {
                    throw monarchCommon.createError(lexer, 'an \'include\' attribute must be a string at: ' + state);
                }
                if (include[0] === '@') {
                    include = include.substr(1); // peel off starting @
                }
                if (!json.tokenizer[include]) {
                    throw monarchCommon.createError(lexer, 'include target \'' + include + '\' is not defined at: ' + state);
                }
                addRules(state + '.' + include, newrules, json.tokenizer[include]);
            }
            else {
                const newrule = new Rule(state);
                // Set up new rule attributes
                if (Array.isArray(rule) && rule.length >= 1 && rule.length <= 3) {
                    newrule.setRegex(lexerMin, rule[0]);
                    if (rule.length >= 3) {
                        if (typeof (rule[1]) === 'string') {
                            newrule.setAction(lexerMin, { token: rule[1], next: rule[2] });
                        }
                        else if (typeof (rule[1]) === 'object') {
                            const rule1 = rule[1];
                            rule1.next = rule[2];
                            newrule.setAction(lexerMin, rule1);
                        }
                        else {
                            throw monarchCommon.createError(lexer, 'a next state as the last element of a rule can only be given if the action is either an object or a string, at: ' + state);
                        }
                    }
                    else {
                        newrule.setAction(lexerMin, rule[1]);
                    }
                }
                else {
                    if (!rule.regex) {
                        throw monarchCommon.createError(lexer, 'a rule must either be an array, or an object with a \'regex\' or \'include\' field at: ' + state);
                    }
                    if (rule.name) {
                        if (typeof rule.name === 'string') {
                            newrule.name = rule.name;
                        }
                    }
                    if (rule.matchOnlyAtStart) {
                        newrule.matchOnlyAtLineStart = bool(rule.matchOnlyAtLineStart, false);
                    }
                    newrule.setRegex(lexerMin, rule.regex);
                    newrule.setAction(lexerMin, rule.action);
                }
                newrules.push(newrule);
            }
        }
    }
    // compile the tokenizer rules
    if (!json.tokenizer || typeof (json.tokenizer) !== 'object') {
        throw monarchCommon.createError(lexer, 'a language definition must define the \'tokenizer\' attribute as an object');
    }
    // eslint-disable-next-line local/code-no-any-casts
    lexer.tokenizer = [];
    for (const key in json.tokenizer) {
        if (json.tokenizer.hasOwnProperty(key)) {
            if (!lexer.start) {
                lexer.start = key;
            }
            const rules = json.tokenizer[key];
            lexer.tokenizer[key] = new Array();
            addRules('tokenizer.' + key, lexer.tokenizer[key], rules);
        }
    }
    lexer.usesEmbedded = lexerMin.usesEmbedded; // can be set during compileAction
    // Set simple brackets
    if (json.brackets) {
        // eslint-disable-next-line local/code-no-any-casts
        if (!(Array.isArray(json.brackets))) {
            throw monarchCommon.createError(lexer, 'the \'brackets\' attribute must be defined as an array');
        }
    }
    else {
        json.brackets = [
            { open: '{', close: '}', token: 'delimiter.curly' },
            { open: '[', close: ']', token: 'delimiter.square' },
            { open: '(', close: ')', token: 'delimiter.parenthesis' },
            { open: '<', close: '>', token: 'delimiter.angle' }
        ];
    }
    const brackets = [];
    for (const el of json.brackets) {
        let desc = el;
        if (desc && Array.isArray(desc) && desc.length === 3) {
            desc = { token: desc[2], open: desc[0], close: desc[1] };
        }
        if (desc.open === desc.close) {
            throw monarchCommon.createError(lexer, 'open and close brackets in a \'brackets\' attribute must be different: ' + desc.open +
                '\n hint: use the \'bracket\' attribute if matching on equal brackets is required.');
        }
        if (typeof desc.open === 'string' && typeof desc.token === 'string' && typeof desc.close === 'string') {
            brackets.push({
                token: desc.token + lexer.tokenPostfix,
                open: monarchCommon.fixCase(lexer, desc.open),
                close: monarchCommon.fixCase(lexer, desc.close)
            });
        }
        else {
            throw monarchCommon.createError(lexer, 'every element in the \'brackets\' array must be a \'{open,close,token}\' object or array');
        }
    }
    lexer.brackets = brackets;
    // Disable throw so the syntax highlighter goes, no matter what
    lexer.noThrow = true;
    return lexer;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uYXJjaENvbXBpbGUuanMiLCJzb3VyY2VSb290IjoiZmlsZTovLy9ob21lL2Zyb3N0eS92c2NvZGUvc3JjLyIsInNvdXJjZXMiOlsidnMvZWRpdG9yL3N0YW5kYWxvbmUvY29tbW9uL21vbmFyY2gvbW9uYXJjaENvbXBpbGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEc7OztHQUdHO0FBRUgsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLGtDQUFrQyxDQUFDO0FBQzVELE9BQU8sS0FBSyxhQUFhLE1BQU0sb0JBQW9CLENBQUM7QUFHcEQ7Ozs7Ozs7R0FPRztBQUVILFNBQVMsU0FBUyxDQUFDLFFBQTZCLEVBQUUsR0FBUTtJQUN6RCxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDVixPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFDRCxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUMzQixPQUFPLEtBQUssQ0FBQztJQUNkLENBQUM7SUFDRCxLQUFLLE1BQU0sRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDckIsT0FBTyxLQUFLLENBQUM7UUFDZCxDQUFDO0lBQ0YsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQVMsSUFBSSxDQUFDLElBQVMsRUFBRSxRQUFpQjtJQUN6QyxJQUFJLE9BQU8sSUFBSSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQy9CLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUNELE9BQU8sUUFBUSxDQUFDO0FBQ2pCLENBQUM7QUFFRCxTQUFTLE1BQU0sQ0FBQyxJQUFTLEVBQUUsUUFBZ0I7SUFDMUMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDaEMsT0FBTyxJ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