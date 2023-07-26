const unwrapSymbol = Symbol('unwrap');
export function isWrapped(item) {
    return item && !!item[unwrapSymbol];
}
function isProxyable(item) {
    return typeof item === 'object' || typeof item === 'function';
}
export function wrap(item, handler, autoPassthrough = true) {
    if (isWrapped(item) || !isProxyable(item)) {
        return item;
    }
    const proxyHandler = Object.assign({}, handler);
    proxyHandler.get = (target, prop, receiver) => {
        if (prop === unwrapSymbol) {
            return item;
        }
        else {
            if (handler.get) {
                return handler.get(target, prop, receiver);
            }
            else if (prop === 'bind') {
                return () => receiver;
            }
            else if (autoPassthrough) {
                return passthroughGet(target, prop);
            }
        }
    };
    proxyHandler.apply = (target, thisArg, argArray) => {
        if (handler.apply) {
            return handler.apply(unwrap(target), unwrap(thisArg), argArray);
        }
    };
    return new Proxy(item, proxyHandler);
}
export function unwrap(item) {
    if (item && isWrapped(item)) {
        return item[unwrapSymbol];
    }
    else {
        return item;
    }
}
export function passthroughGet(target, prop, thisArg) {
    const value = Reflect.get(unwrap(target), prop);
    if (typeof value === 'function') {
        thisArg = thisArg || unwrap(target);
        const bound = value.bind(thisArg);
        return bound;
    }
    else {
        return value;
    }
}
//# sourceMappingURL=wrap.js.map