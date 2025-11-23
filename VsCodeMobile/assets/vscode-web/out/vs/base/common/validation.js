/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { mapFilter } from './arrays.js';
export class ValidatorBase {
    validateOrThrow(content) {
        const result = this.validate(content);
        if (result.error) {
            throw new Error(result.error.message);
        }
        return result.content;
    }
}
class TypeofValidator extends ValidatorBase {
    constructor(type) {
        super();
        this.type = type;
    }
    validate(content) {
        if (typeof content !== this.type) {
            return { content: undefined, error: { message: `Expected ${this.type}, but got ${typeof content}` } };
        }
        return { content: content, error: undefined };
    }
    getJSONSchema() {
        return { type: this.type };
    }
}
const vStringValidator = new TypeofValidator('string');
export function vString() { return vStringValidator; }
const vNumberValidator = new TypeofValidator('number');
export function vNumber() { return vNumberValidator; }
const vBooleanValidator = new TypeofValidator('boolean');
export function vBoolean() { return vBooleanValidator; }
const vObjAnyValidator = new TypeofValidator('object');
export function vObjAny() { return vObjAnyValidator; }
class UncheckedValidator extends ValidatorBase {
    validate(content) {
        return { content: content, error: undefined };
    }
    getJSONSchema() {
        return {};
    }
}
export function vUnchecked() {
    return new UncheckedValidator();
}
class UndefinedValidator extends ValidatorBase {
    validate(content) {
        if (content !== undefined) {
            return { content: undefined, error: { message: `Expected undefined, but got ${typeof content}` } };
        }
        return { content: undefined, error: undefined };
    }
    getJSONSchema() {
        return {};
    }
}
export function vUndefined() {
    return new UndefinedValidator();
}
export function vUnknown() {
    return vUnchecked();
}
export class Optional {
    constructor(validator) {
        this.validator = validator;
    }
}
export function vOptionalProp(validator) {
    return new Optional(validator);
}
class ObjValidator extends ValidatorBase {
    constructor(properties) {
        super();
        this.properties = properties;
    }
    validate(content) {
        if (typeof content !== 'object' || content === null) {
            return { content: undefined, error: { message: 'Expected object' } };
        }
        // eslint-disable-next-line local/code-no-dangerous-type-assertions
        const result = {};
        for (const key in this.properties) {
            const prop = this.properties[key];
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            const fieldValue = content[key];
            const isOptional = prop instanceof Optional;
            const validator = isOptional ? prop.validator : prop;
            if (isOptional && fieldValue === undefined) {
                // Optional field not provided, skip validation
                continue;
            }
            const { content: value, error } = validator.validate(fieldValue);
            if (error) {
                return { content: undefined, error: { message: `Error in property '${key}': ${error.message}` } };
            }
            // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
            result[key] = value;
        }
        return { content: result, error: undefined };
    }
    getJSONSchema() {
        const requiredFields = [];
        const schemaProperties = {};
        for (const [key, prop] of Object.entries(this.properties)) {
            const isOptional = prop instanceof Optional;
            const validator = isOptional ? prop.validator : prop;
            schemaProperties[key] = validator.getJSONSchema();
            if (!isOptional) {
                requiredFields.push(key);
            }
        }
        const schema = {
            type: 'object',
            properties: schemaProperties,
            ...(requiredFields.length > 0 ? { required: requiredFields } : {})
        };
        return schema;
    }
}
export function vObj(properties) {
    return new ObjValidator(properties);
}
class ArrayValidator extends ValidatorBase {
    constructor(validator) {
        super();
        this.validator = validator;
    }
    validate(content) {
        if (!Array.isArray(content)) {
            return { content: undefined, error: { message: 'Expected array' } };
        }
        const result = [];
        for (let i = 0; i < content.length; i++) {
            const { content: value, error } = this.validator.validate(content[i]);
            if (error) {
                return { content: undefined, error: { message: `Error in element ${i}: ${error.message}` } };
            }
            result.push(value);
        }
        return { content: result, error: undefined };
    }
    getJSONSchema() {
        return {
            type: 'array',
            items: this.validator.getJSONSchema(),
        };
    }
}
export function vArray(validator) {
    return new ArrayValidator(validator);
}
class TupleValidator extends ValidatorBase {
    constructor(validators) {
        super();
        this.validators = validators;
    }
    validate(content) {
        if (!Array.isArray(content)) {
            return { content: undefined, error: { message: 'Expected array' } };
        }
        if (content.length !== this.validators.length) {
            return { content: undefined, error: { message: `Expected tuple of length ${this.validators.length}, but got ${content.length}` } };
        }
        const result = [];
        for (let i = 0; i < this.validators.length; i++) {
            const validator = this.validators[i];
            const { content: value, error } = validator.validate(content[i]);
            if (error) {
                return { content: undefined, error: { message: `Error in element ${i}: ${error.message}` } };
            }
            result.push(value);
        }
        return { content: result, error: undefined };
    }
    getJSONSchema() {
        return {
            type: 'array',
            items: this.validators.map(validator => validator.getJSONSchema()),
        };
    }
}
export function vTuple(...validators) {
    return new TupleValidator(validators);
}
class UnionValidator extends ValidatorBase {
    constructor(validators) {
        super();
        this.validators = validators;
    }
    validate(content) {
        let lastError;
        for (const validator of this.validators) {
            const { content: value, error } = validator.validate(content);
            if (!error) {
                // eslint-disable-next-line local/code-no-any-casts, @typescript-eslint/no-explicit-any
                return { content: value, error: undefined };
            }
            lastError = error;
        }
        return { content: undefined, error: lastError };
    }
    getJSONSchema() {
        return {
            oneOf: mapFilter(this.validators, validator => {
                if (validator instanceof UndefinedValidator) {
                    return undefined;
                }
                return validator.getJSONSchema();
            }),
        };
    }
}
export function vUnion(...validators) {
    return new UnionValidator(validators);
}
class EnumValidator extends ValidatorBase {
    constructor(values) {
        super();
        this.values = values;
    }
    validate(content) {
        if (this.values.indexOf(content) === -1) {
            return { content: undefined, error: { message: `Expected one of: ${this.values.join(', ')}` } };
        }
        return { content: content, error: undefined };
    }
    getJSONSchema() {
        return {
            enum: this.values,
        };
    }
}
export function vEnum(...values) {
    return new EnumValidator(values);
}
class LiteralValidator extends ValidatorBase {
    constructor(value) {
        super();
        this.value = value;
    }
    validate(content) {
        if (content !== this.value) {
            return { content: undefined, error: { message: `Expected: ${this.value}` } };
        }
        return { content: content, error: undefined };
    }
    getJSONSchema() {
        return {
            const: this.value,
        };
    }
}
export function vLiteral(value) {
    return new LiteralValidator(value);
}
class LazyValidator extends ValidatorBase {
    constructor(fn) {
        super();
        this.fn = fn;
    }
    validate(content) {
        return this.fn().validate(content);
    }
    getJSONSchema() {
        return this.fn().getJSONSchema();
    }
}
export function vLazy(fn) {
    return new LazyValidator(fn);
}
class UseRefSchemaValidator extends ValidatorBase {
    constructor(_ref, _validator) {
        super();
        this._ref = _ref;
        this._validator = _validator;
    }
    validate(content) {
        return this._validator.validate(content);
    }
    getJSONSchema() {
        return { $ref: this._ref };
    }
}
export function vWithJsonSchemaRef(ref, validator) {
    return new UseRefSchemaValidator(ref, validator);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiJmaWxlOi8vL2hvbWUvZnJvc3R5L3ZzY29kZS9zcmMvIiwic291cmNlcyI6WyJ2cy9iYXNlL2NvbW1vbi92YWxpZGF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFTeEMsTUFBTSxPQUFnQixhQUFhO0lBS2xDLGVBQWUsQ0FBQyxPQUFnQjtRQUMvQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3RDLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2xCLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQ3ZCLENBQUM7Q0FDRDtBQWdCRCxNQUFNLGVBQThDLFNBQVEsYUFBOEI7SUFDekYsWUFBNkIsSUFBVTtRQUN0QyxLQUFLLEVBQUUsQ0FBQztRQURvQixTQUFJLEdBQUosSUFBSSxDQUFNO0lBRXZDLENBQUM7SUFFRCxRQUFRLENBQUMsT0FBZ0I7UUFDeEIsSUFBSSxPQUFPLE9BQU8sS0FBSyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbEMsT0FBTyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEVBQUUsT0FBTyxFQUFFLFlBQVksSUFBSSxDQUFDLElBQUksYUFBYSxPQUFPLE9BQU8sRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUN2RyxDQUFDO1FBRUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUEwQixFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsQ0FBQztJQUNsRSxDQUFDO0lBRUQsYUFBYTtRQUNaLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzVCLENB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