"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.instrumentStorage = void 0;
const api_1 = require("@opentelemetry/api");
const wrap_js_1 = require("../wrap.js");
const StorageAttributes = {
    delete(argArray, result) {
        let attrs = {};
        if (Array.isArray(argArray[0])) {
            const keys = argArray[0];
            attrs = {
                'do.storage.key': keys[0],
                'do.storage.number_of_keys': keys.length,
                'do.storage.keys_deleted': result,
            };
        }
        else {
            attrs = {
                'do.storage.key': argArray[0],
                'do.storage.success': result,
            };
        }
        if (argArray.length > 1) {
            Object.assign(attrs, argArray[1]);
        }
        return attrs;
    },
    get(argArray) {
        let attrs = {};
        if (Array.isArray(argArray[0])) {
            const keys = argArray[0];
            attrs = {
                'do.storage.key': keys[0],
                'do.storage.number_of_keys': keys.length,
            };
        }
        else {
            attrs = {
                'do.storage.key': argArray[0],
            };
        }
        if (argArray.length > 1) {
            Object.assign(attrs, argArray[1]);
        }
        return attrs;
    },
    list(argArray, result) {
        // list may be called with no arguments
        const attrs = {
            'do.storage.number_of_results': result.size,
        };
        Object.assign(attrs, argArray[0]);
        return attrs;
    },
    put(argArray) {
        const attrs = {
            'do.storage.key': argArray[0],
        };
        if (argArray.length > 2) {
            Object.assign(attrs, argArray[2]);
        }
        return attrs;
    },
};
function instrumentStorageFn(fn, operation) {
    const tracer = api_1.trace.getTracer('do_storage');
    const fnHandler = {
        apply: (target, thisArg, argArray) => {
            const options = {
                kind: api_1.SpanKind.CLIENT,
                attributes: {
                    operation,
                },
            };
            return tracer.startActiveSpan(`do:storage:${operation}`, options, (span) => __awaiter(this, void 0, void 0, function* () {
                const result = yield Reflect.apply(target, thisArg, argArray);
                const extraAttrs = StorageAttributes[operation] ? StorageAttributes[operation](argArray, result) : {};
                span.setAttributes(extraAttrs);
                span.setAttribute('hasResult', !!result);
                span.end();
                return result;
            }));
        },
    };
    return (0, wrap_js_1.wrap)(fn, fnHandler);
}
function instrumentStorage(storage) {
    const storageHandler = {
        get: (target, prop, receiver) => {
            const operation = String(prop);
            const fn = Reflect.get(target, prop, receiver);
            return instrumentStorageFn(fn, operation);
        },
    };
    return (0, wrap_js_1.wrap)(storage, storageHandler);
}
exports.instrumentStorage = instrumentStorage;
//# sourceMappingURL=do-storage.js.map