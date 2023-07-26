import { SpanKind, trace } from '@opentelemetry/api';
import { wrap } from '../wrap.js';
const KVAttributes = {
    delete(argArray) {
        return {
            'kv.key': argArray[0],
        };
    },
    get(argArray) {
        const attrs = {
            'kv.key': argArray[0],
        };
        const opts = argArray[1];
        if (typeof opts === 'string') {
            attrs['kv.type'] = opts;
        }
        else if (typeof opts === 'object') {
            attrs['kv.type'] = opts.type;
            attrs['kv.cacheTtl'] = opts.cacheTtl;
        }
        return attrs;
    },
    getWithMetadata(argArray, result) {
        const attrs = this.get(argArray, result);
        attrs['kv.withMetadata'] = true;
        const { cacheStatus } = result;
        if (typeof cacheStatus === 'string') {
            attrs['kv.cacheStatus'] = cacheStatus;
        }
        return attrs;
    },
    list(argArray, result) {
        const attrs = {};
        const opts = argArray[0] || {};
        const { cursor, limit, prefix } = opts;
        attrs['kv.list_prefix'] = prefix || undefined;
        attrs['kv.list_request_cursor'] = cursor || undefined;
        attrs['kv.list_limit'] = limit || undefined;
        const { list_complete, cacheStatus } = result;
        attrs['kv.list_complete'] = list_complete || undefined;
        if (!list_complete) {
            attrs['kv.list_response_cursor'] = cursor || undefined;
        }
        if (typeof cacheStatus === 'string') {
            attrs['kv.cacheStatus'] = cacheStatus;
        }
        return attrs;
    },
    put(argArray) {
        const attrs = {
            'kv.key': argArray[0],
        };
        if (argArray.length > 2 && argArray[2]) {
            const { expiration, expirationTtl, metadata } = argArray[2];
            attrs['kv.expiration'] = expiration;
            attrs['kv.expirationTtl'] = expirationTtl;
            attrs['kv.withMetadata'] = !!metadata;
        }
        return attrs;
    },
};
function instrumentKVFn(fn, name, operation) {
    const tracer = trace.getTracer('KV');
    const fnHandler = {
        apply: (target, thisArg, argArray) => {
            const options = {
                kind: SpanKind.CLIENT,
                attributes: {
                    binding_type: 'KV',
                    kv_namespace: name,
                    operation,
                },
            };
            return tracer.startActiveSpan(`kv:${name}:${operation}`, options, async (span) => {
                const result = await Reflect.apply(target, thisArg, argArray);
                const extraAttrs = KVAttributes[operation] ? KVAttributes[operation](argArray, result) : {};
                span.setAttributes(extraAttrs);
                span.setAttribute('hasResult', !!result);
                span.end();
                return result;
            });
        },
    };
    return wrap(fn, fnHandler);
}
export function instrumentKV(kv, name) {
    const kvHandler = {
        get: (target, prop, receiver) => {
            const operation = String(prop);
            const fn = Reflect.get(target, prop, receiver);
            return instrumentKVFn(fn, name, operation);
        },
    };
    return wrap(kv, kvHandler);
}
//# sourceMappingURL=kv.js.map