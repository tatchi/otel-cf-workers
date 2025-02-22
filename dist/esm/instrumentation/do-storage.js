import { SpanKind, trace } from '@opentelemetry/api';
import { wrap } from '../wrap.js';
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
    const tracer = trace.getTracer('do_storage');
    const fnHandler = {
        apply: (target, thisArg, argArray) => {
            const options = {
                kind: SpanKind.CLIENT,
                attributes: {
                    operation,
                },
            };
            return tracer.startActiveSpan(`do:storage:${operation}`, options, async (span) => {
                const result = await Reflect.apply(target, thisArg, argArray);
                const extraAttrs = StorageAttributes[operation] ? StorageAttributes[operation](argArray, result) : {};
                span.setAttributes(extraAttrs);
                span.setAttribute('hasResult', !!result);
                span.end();
                return result;
            });
        },
    };
    return wrap(fn, fnHandler);
}
export function instrumentStorage(storage) {
    const storageHandler = {
        get: (target, prop, receiver) => {
            const operation = String(prop);
            const fn = Reflect.get(target, prop, receiver);
            return instrumentStorageFn(fn, operation);
        },
    };
    return wrap(storage, storageHandler);
}
//# sourceMappingURL=do-storage.js.map