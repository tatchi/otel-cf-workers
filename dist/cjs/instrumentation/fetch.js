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
exports.instrumentGlobalFetch = exports.instrumentFetcher = exports.createFetchHandler = exports.executeFetchHandler = exports.waitUntilTrace = exports.getParentContextFromHeaders = exports.gatherIncomingCfAttributes = exports.gatherResponseAttributes = exports.gatherRequestAttributes = exports.sanitiseURL = void 0;
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const config_js_1 = require("../config.js");
const wrap_js_1 = require("../wrap.js");
const env_js_1 = require("./env.js");
const common_js_1 = require("./common.js");
function sanitiseURL(url) {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}${u.search}`;
}
exports.sanitiseURL = sanitiseURL;
const gatherOutgoingCfAttributes = (cf) => {
    const attrs = {};
    Object.keys(cf).forEach((key) => {
        const value = cf[key];
        if (typeof value === 'string' || typeof value === 'number') {
            attrs[`cf.${key}`] = value;
        }
        else {
            attrs[`cf.${key}`] = JSON.stringify(value);
        }
    });
    return attrs;
};
function gatherRequestAttributes(request) {
    const attrs = {};
    const headers = request.headers;
    // attrs[SemanticAttributes.HTTP_CLIENT_IP] = '1.1.1.1'
    attrs[semantic_conventions_1.SemanticAttributes.HTTP_METHOD] = request.method;
    attrs[semantic_conventions_1.SemanticAttributes.HTTP_URL] = sanitiseURL(request.url);
    attrs[semantic_conventions_1.SemanticAttributes.HTTP_USER_AGENT] = headers.get('user-agent');
    attrs[semantic_conventions_1.SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH] = headers.get('content-length');
    attrs['http.request_content-type'] = headers.get('content-type');
    attrs['http.accepts'] = headers.get('accepts');
    return attrs;
}
exports.gatherRequestAttributes = gatherRequestAttributes;
function gatherResponseAttributes(response) {
    const attrs = {};
    attrs[semantic_conventions_1.SemanticAttributes.HTTP_STATUS_CODE] = response.status;
    attrs[semantic_conventions_1.SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH] = response.headers.get('content-length');
    attrs['http.response_content-type'] = response.headers.get('content-type');
    return attrs;
}
exports.gatherResponseAttributes = gatherResponseAttributes;
function gatherIncomingCfAttributes(request) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const attrs = {};
    attrs[semantic_conventions_1.SemanticAttributes.HTTP_SCHEME] = (_a = request.cf) === null || _a === void 0 ? void 0 : _a.httpProtocol;
    attrs['net.colo'] = (_b = request.cf) === null || _b === void 0 ? void 0 : _b.colo;
    attrs['net.country'] = (_c = request.cf) === null || _c === void 0 ? void 0 : _c.country;
    attrs['net.request_priority'] = (_d = request.cf) === null || _d === void 0 ? void 0 : _d.requestPriority;
    attrs['net.tls_cipher'] = (_e = request.cf) === null || _e === void 0 ? void 0 : _e.tlsCipher;
    attrs['net.tls_version'] = (_f = request.cf) === null || _f === void 0 ? void 0 : _f.tlsVersion;
    attrs['net.asn'] = (_g = request.cf) === null || _g === void 0 ? void 0 : _g.asn;
    attrs['net.tcp_rtt'] = (_h = request.cf) === null || _h === void 0 ? void 0 : _h.clientTcpRtt;
    return attrs;
}
exports.gatherIncomingCfAttributes = gatherIncomingCfAttributes;
function getParentContextFromHeaders(headers) {
    return api_1.propagation.extract(api_1.context.active(), headers, {
        get(headers, key) {
            return headers.get(key) || undefined;
        },
        keys(headers) {
            return [...headers.keys()];
        },
    });
}
exports.getParentContextFromHeaders = getParentContextFromHeaders;
function getParentContextFromRequest(request) {
    var _a;
    const workerConfig = (0, config_js_1.getActiveConfig)();
    const acceptTraceContext = typeof workerConfig.handlers.fetch.acceptTraceContext === 'function'
        ? workerConfig.handlers.fetch.acceptTraceContext(request)
        : (_a = workerConfig.handlers.fetch.acceptTraceContext) !== null && _a !== void 0 ? _a : true;
    return acceptTraceContext ? getParentContextFromHeaders(request.headers) : api_1.context.active();
}
function waitUntilTrace(fn) {
    const tracer = api_1.trace.getTracer('waitUntil');
    return tracer.startActiveSpan('waitUntil', (span) => __awaiter(this, void 0, void 0, function* () {
        yield fn();
        span.end();
    }));
}
exports.waitUntilTrace = waitUntilTrace;
let cold_start = true;
function executeFetchHandler(fetchFn, [request, env, ctx]) {
    var _a;
    const spanContext = getParentContextFromRequest(request);
    const tracer = api_1.trace.getTracer('fetchHandler');
    const attributes = {
        [semantic_conventions_1.SemanticAttributes.FAAS_TRIGGER]: 'http',
        [semantic_conventions_1.SemanticAttributes.FAAS_COLDSTART]: cold_start,
        [semantic_conventions_1.SemanticAttributes.FAAS_EXECUTION]: (_a = request.headers.get('cf-ray')) !== null && _a !== void 0 ? _a : undefined,
    };
    cold_start = false;
    Object.assign(attributes, gatherRequestAttributes(request));
    Object.assign(attributes, gatherIncomingCfAttributes(request));
    const options = {
        attributes,
        kind: api_1.SpanKind.SERVER,
    };
    const promise = tracer.startActiveSpan('fetchHandler', options, spanContext, (span) => __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetchFn(request, env, ctx);
            if (response.status < 500) {
                span.setStatus({ code: api_1.SpanStatusCode.OK });
            }
            span.setAttributes(gatherResponseAttributes(response));
            span.end();
            return response;
        }
        catch (error) {
            span.recordException(error);
            span.setStatus({ code: api_1.SpanStatusCode.ERROR });
            span.end();
            throw error;
        }
    }));
    return promise;
}
exports.executeFetchHandler = executeFetchHandler;
function createFetchHandler(fetchFn, initialiser) {
    const fetchHandler = {
        apply: (target, _thisArg, argArray) => __awaiter(this, void 0, void 0, function* () {
            const [request, orig_env, orig_ctx] = argArray;
            const config = initialiser(orig_env, request);
            const env = (0, env_js_1.instrumentEnv)(orig_env);
            const { ctx, tracker } = (0, common_js_1.proxyExecutionContext)(orig_ctx);
            const context = (0, config_js_1.setConfig)(config);
            try {
                const args = [request, env, ctx];
                return yield api_1.context.with(context, executeFetchHandler, undefined, target, args);
            }
            catch (error) {
                throw error;
            }
            finally {
                orig_ctx.waitUntil((0, common_js_1.exportSpans)(tracker));
            }
        }),
    };
    return (0, wrap_js_1.wrap)(fetchFn, fetchHandler);
}
exports.createFetchHandler = createFetchHandler;
function instrumentFetcher(fetchFn, configFn, attrs) {
    const handler = {
        apply: (target, thisArg, argArray) => {
            const workerConfig = (0, config_js_1.getActiveConfig)();
            const config = configFn(workerConfig);
            const request = new Request(argArray[0], argArray[1]);
            const tracer = api_1.trace.getTracer('fetcher');
            const options = { kind: api_1.SpanKind.CLIENT, attributes: attrs };
            const host = new URL(request.url).host;
            const spanName = typeof (attrs === null || attrs === void 0 ? void 0 : attrs['name']) === 'string' ? attrs === null || attrs === void 0 ? void 0 : attrs['name'] : `fetch: ${host}`;
            const promise = tracer.startActiveSpan(spanName, options, (span) => __awaiter(this, void 0, void 0, function* () {
                const includeTraceContext = typeof config.includeTraceContext === 'function'
                    ? config.includeTraceContext(request)
                    : config.includeTraceContext;
                if (includeTraceContext !== null && includeTraceContext !== void 0 ? includeTraceContext : true) {
                    api_1.propagation.inject(api_1.context.active(), request.headers, {
                        set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
                    });
                }
                span.setAttributes(gatherRequestAttributes(request));
                if (request.cf)
                    span.setAttributes(gatherOutgoingCfAttributes(request.cf));
                const response = yield Reflect.apply(target, thisArg, [request]);
                span.setAttributes(gatherResponseAttributes(response));
                span.end();
                return response;
            }));
            return promise;
        },
    };
    return (0, wrap_js_1.wrap)(fetchFn, handler, true);
}
exports.instrumentFetcher = instrumentFetcher;
function instrumentGlobalFetch() {
    globalThis.fetch = instrumentFetcher(globalThis.fetch, (config) => config.fetch);
}
exports.instrumentGlobalFetch = instrumentGlobalFetch;
//# sourceMappingURL=fetch.js.map