import { propagation } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { AlwaysOnSampler, ParentBasedSampler, TraceIdRatioBasedSampler, } from '@opentelemetry/sdk-trace-base';
import { OTLPExporter } from './exporter.js';
import { WorkerTracerProvider } from './provider.js';
import { isHeadSampled, isRootErrorSpan, multiTailSampler } from './sampling.js';
import { BatchTraceSpanProcessor } from './spanprocessor.js';
import { isSpanProcessorConfig, } from './types.js';
import { unwrap } from './wrap.js';
import { createFetchHandler, instrumentGlobalFetch } from './instrumentation/fetch.js';
import { instrumentGlobalCache } from './instrumentation/cache.js';
import { createQueueHandler } from './instrumentation/queue.js';
import { instrumentDOClass } from './instrumentation/do.js';
export function isRequest(trigger) {
    return trigger instanceof Request;
}
export function isMessageBatch(trigger) {
    return !!trigger.ackAll;
}
export function isAlarm(trigger) {
    return trigger === 'do-alarm';
}
const createResource = (config) => {
    const workerResourceAttrs = {
        [SemanticResourceAttributes.CLOUD_PROVIDER]: 'cloudflare',
        [SemanticResourceAttributes.CLOUD_PLATFORM]: 'cloudflare.workers',
        [SemanticResourceAttributes.CLOUD_REGION]: 'earth',
        // [SemanticResourceAttributes.FAAS_NAME]: '//TODO',
        // [SemanticResourceAttributes.FAAS_VERSION]: '//TODO',
        [SemanticResourceAttributes.FAAS_MAX_MEMORY]: 128,
        [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: 'JavaScript',
        [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: '@microlabs/otel-workers-sdk',
    };
    const serviceResource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.service.name,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: config.service.namespace,
        [SemanticResourceAttributes.SERVICE_VERSION]: config.service.version,
    });
    const resource = new Resource(workerResourceAttrs);
    return resource.merge(serviceResource);
};
function isSpanExporter(exporterConfig) {
    return !!exporterConfig.export;
}
let initialised = false;
function init(config) {
    if (!initialised) {
        instrumentGlobalCache();
        instrumentGlobalFetch();
        propagation.setGlobalPropagator(config.propagator);
        const resource = createResource(config);
        const provider = new WorkerTracerProvider(config.spanProcessors, resource);
        provider.register();
        initialised = true;
    }
}
function isSampler(sampler) {
    return !!sampler.shouldSample;
}
function createSampler(conf) {
    const ratioSampler = new TraceIdRatioBasedSampler(conf.ratio);
    if (typeof conf.acceptRemote === 'boolean' && !conf.acceptRemote) {
        return new ParentBasedSampler({
            root: ratioSampler,
            remoteParentSampled: ratioSampler,
            remoteParentNotSampled: ratioSampler,
        });
    }
    else {
        return new ParentBasedSampler({ root: ratioSampler });
    }
}
function parseConfig(supplied) {
    if (isSpanProcessorConfig(supplied)) {
        const headSampleConf = supplied.sampling?.headSampler;
        const headSampler = headSampleConf
            ? isSampler(headSampleConf)
                ? headSampleConf
                : createSampler(headSampleConf)
            : new AlwaysOnSampler();
        const spanProcessors = Array.isArray(supplied.spanProcessors) ? supplied.spanProcessors : [supplied.spanProcessors];
        if (spanProcessors.length === 0) {
            console.log('Warning! You must either specify an exporter or your own SpanProcessor(s)/Exporter combination in the open-telemetry configuration.');
        }
        return {
            fetch: {
                includeTraceContext: supplied.fetch?.includeTraceContext ?? true,
            },
            handlers: {
                fetch: {
                    acceptTraceContext: supplied.handlers?.fetch?.acceptTraceContext ?? true,
                },
            },
            postProcessor: supplied.postProcessor || ((spans) => spans),
            sampling: {
                headSampler,
                tailSampler: supplied.sampling?.tailSampler || multiTailSampler([isHeadSampled, isRootErrorSpan]),
            },
            service: supplied.service,
            spanProcessors,
            propagator: supplied.propagator || new W3CTraceContextPropagator(),
        };
    }
    else {
        const exporter = isSpanExporter(supplied.exporter) ? supplied.exporter : new OTLPExporter(supplied.exporter);
        const spanProcessors = [new BatchTraceSpanProcessor(exporter)];
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
export function instrument(handler, config) {
    const initialiser = createInitialiser(config);
    if (handler.fetch) {
        const fetcher = unwrap(handler.fetch);
        handler.fetch = createFetchHandler(fetcher, initialiser);
    }
    if (handler.queue) {
        const queuer = unwrap(handler.queue);
        handler.queue = createQueueHandler(queuer, initialiser);
    }
    return handler;
}
export function instrumentDO(doClass, config) {
    const initialiser = createInitialiser(config);
    return instrumentDOClass(doClass, initialiser);
}
export { waitUntilTrace } from './instrumentation/fetch.js';
export { OTLPExporter };
//# sourceMappingURL=sdk.js.map