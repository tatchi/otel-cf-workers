"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OTLPExporter = exports.waitUntilTrace = exports.instrumentDO = exports.instrument = exports.isAlarm = exports.isMessageBatch = exports.isRequest = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const exporter_js_1 = require("./exporter.js");
Object.defineProperty(exports, "OTLPExporter", { enumerable: true, get: function () { return exporter_js_1.OTLPExporter; } });
const provider_js_1 = require("./provider.js");
const sampling_js_1 = require("./sampling.js");
const spanprocessor_js_1 = require("./spanprocessor.js");
const types_js_1 = require("./types.js");
const wrap_js_1 = require("./wrap.js");
const fetch_js_1 = require("./instrumentation/fetch.js");
const cache_js_1 = require("./instrumentation/cache.js");
const queue_js_1 = require("./instrumentation/queue.js");
const do_js_1 = require("./instrumentation/do.js");
function isRequest(trigger) {
    return trigger instanceof Request;
}
exports.isRequest = isRequest;
function isMessageBatch(trigger) {
    return !!trigger.ackAll;
}
exports.isMessageBatch = isMessageBatch;
function isAlarm(trigger) {
    return trigger === 'do-alarm';
}
exports.isAlarm = isAlarm;
const createResource = (config) => {
    const workerResourceAttrs = {
        [semantic_conventions_1.SemanticResourceAttributes.CLOUD_PROVIDER]: 'cloudflare',
        [semantic_conventions_1.SemanticResourceAttributes.CLOUD_PLATFORM]: 'cloudflare.workers',
        [semantic_conventions_1.SemanticResourceAttributes.CLOUD_REGION]: 'earth',
        // [SemanticResourceAttributes.FAAS_NAME]: '//TODO',
        // [SemanticResourceAttributes.FAAS_VERSION]: '//TODO',
        [semantic_conventions_1.SemanticResourceAttributes.FAAS_MAX_MEMORY]: 128,
        [semantic_conventions_1.SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: 'JavaScript',
        [semantic_conventions_1.SemanticResourceAttributes.TELEMETRY_SDK_NAME]: '@microlabs/otel-workers-sdk',
    };
    const serviceResource = new resources_1.Resource({
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: config.service.name,
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAMESPACE]: config.service.namespace,
        [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: config.service.version,
    });
    const resource = new resources_1.Resource(workerResourceAttrs);
    return resource.merge(serviceResource);
};
function isSpanExporter(exporterConfig) {
    return !!exporterConfig.export;
}
let initialised = false;
function init(config) {
    if (!initialised) {
        (0, cache_js_1.instrumentGlobalCache)();
        (0, fetch_js_1.instrumentGlobalFetch)();
        api_1.propagation.setGlobalPropagator(config.propagator);
        const resource = createResource(config);
        const provider = new provider_js_1.WorkerTracerProvider(config.spanProcessors, resource);
        provider.register();
        initialised = true;
    }
}
function isSampler(sampler) {
    return !!sampler.shouldSample;
}
function createSampler(conf) {
    const ratioSampler = new sdk_trace_base_1.TraceIdRatioBasedSampler(conf.ratio);
    if (typeof conf.acceptRemote === 'boolean' && !conf.acceptRemote) {
        return new sdk_trace_base_1.ParentBasedSampler({
            root: ratioSampler,
            remoteParentSampled: ratioSampler,
            remoteParentNotSampled: ratioSampler,
        });
    }
    else {
        return new sdk_trace_base_1.ParentBasedSampler({ root: ratioSampler });
    }
}
function parseConfig(supplied) {
    var _a, _b, _c, _d, _e, _f, _g;
    if ((0, types_js_1.isSpanProcessorConfig)(supplied)) {
        const headSampleConf = (_a = supplied.sampling) === null || _a === void 0 ? void 0 : _a.headSampler;
        const headSampler = headSampleConf
            ? isSampler(headSampleConf)
                ? headSampleConf
                : createSampler(headSampleConf)
            : new sdk_trace_base_1.AlwaysOnSampler();
        const spanProcessors = Array.isArray(supplied.spanProcessors) ? supplied.spanProcessors : [supplied.spanProcessors];
        if (spanProcessors.length === 0) {
            console.log('Warning! You must either specify an exporter or your own SpanProcessor(s)/Exporter combination in the open-telemetry configuration.');
        }
        return {
            fetch: {
                includeTraceContext: (_c = (_b = supplied.fetch) === null || _b === void 0 ? void 0 : _b.includeTraceContext) !== null && _c !== void 0 ? _c : true,
            },
            handlers: {
                fetch: {
                    acceptTraceContext: (_f = (_e = (_d = supplied.handlers) === null || _d === void 0 ? void 0 : _d.fetch) === null || _e === void 0 ? void 0 : _e.acceptTraceContext) !== null && _f !== void 0 ? _f : true,
                },
            },
            postProcessor: supplied.postProcessor || ((spans) => spans),
            sampling: {
                headSampler,
                tailSampler: ((_g = supplied.sampling) === null || _g === void 0 ? void 0 : _g.tailSampler) || (0, sampling_js_1.multiTailSampler)([sampling_js_1.isHeadSampled, sampling_js_1.isRootErrorSpan]),
            },
            service: supplied.service,
            spanProcessors,
            propagator: supplied.propagator || new core_1.W3CTraceContextPropagator(),
        };
    }
    else {
        const exporter = isSpanExporter(supplied.exporter) ? supplied.exporter : new exporter_js_1.OTLPExporter(supplied.exporter);
        const spanProcessors = [new spanprocessor_js_1.BatchTraceSpanProcessor(exporter)];
        const newConfig = Object.assign(supplied, { exporter: undefined, spanProcessors });
        return parseConfig(newConfig);
    }
}
function createInitialiser(config) {
    if (typeof config === 'function') {
        return (env, trigger) => {
            const conf = parseConfig(config(env, trigger));
            init(conf);
            return conf;
        };
    }
    else {
        return () => {
            const conf = parseConfig(config);
            init(conf);
            return conf;
        };
    }
}
function instrument(handler, config) {
    const initialiser = createInitialiser(config);
    if (handler.fetch) {
        const fetcher = (0, wrap_js_1.unwrap)(handler.fetch);
        handler.fetch = (0, fetch_js_1.createFetchHandler)(fetcher, initialiser);
    }
    if (handler.queue) {
        const queuer = (0, wrap_js_1.unwrap)(handler.queue);
        handler.queue = (0, queue_js_1.createQueueHandler)(queuer, initialiser);
    }
    return handler;
}
exports.instrument = instrument;
function instrumentDO(doClass, config) {
    const initialiser = createInitialiser(config);
    return (0, do_js_1.instrumentDOClass)(doClass, initialiser);
}
exports.instrumentDO = instrumentDO;
var fetch_js_2 = require("./instrumentation/fetch.js");
Object.defineProperty(exports, "waitUntilTrace", { enumerable: true, get: function () { return fetch_js_2.waitUntilTrace; } });
//# sourceMappingURL=sdk.js.map