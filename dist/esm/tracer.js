import { TraceFlags, SpanKind, context as api_context, trace, } from '@opentelemetry/api';
import { sanitizeAttributes } from '@opentelemetry/core';
import { RandomIdGenerator, SamplingDecision } from '@opentelemetry/sdk-trace-base';
import { SpanImpl } from './span.js';
import { getActiveConfig } from './config.js';
export class WorkerTracer {
    _spanProcessors;
    resource;
    idGenerator = new RandomIdGenerator();
    constructor(spanProcessors, resource) {
        this._spanProcessors = spanProcessors;
        this.resource = resource;
    }
    get spanProcessors() {
        return this._spanProcessors;
    }
    addToResource(extra) {
        this.resource.merge(extra);
    }
    startSpan(name, options = {}, context = api_context.active()) {
        if (options.root) {
            context = trace.deleteSpan(context);
        }
        const parentSpan = trace.getSpan(context);
        const parentSpanContext = parentSpan?.spanContext();
        const hasParentContext = parentSpanContext && trace.isSpanContextValid(parentSpanContext);
        const traceId = hasParentContext ? parentSpanContext.traceId : this.idGenerator.generateTraceId();
        const spanKind = options.kind || SpanKind.INTERNAL;
        const sanitisedAttrs = sanitizeAttributes(options.attributes);
        const sampler = getActiveConfig().sampling.headSampler;
        const samplingDecision = sampler.shouldSample(context, traceId, name, spanKind, sanitisedAttrs, []);
        const { decision, traceState, attributes: attrs } = samplingDecision;
        const attributes = Object.assign({}, sanitisedAttrs, attrs);
        const spanId = this.idGenerator.generateSpanId();
        const parentSpanId = hasParentContext ? parentSpanContext.spanId : undefined;
        const traceFlags = decision === SamplingDecision.RECORD_AND_SAMPLED ? TraceFlags.SAMPLED : TraceFlags.NONE;
        const spanContext = { traceId, spanId, traceFlags, traceState };
        const span = new SpanImpl({
            attributes,
            name,
            onEnd: (span) => {
                this.spanProcessors.forEach(sp => {
                    sp.onEnd(span);
                });
            },
            resource: this.resource,
            spanContext,
            parentSpanId,
            spanKind,
            startTime: options.startTime,
        });
        //Do not get me started on the idosyncracies of the Otel JS libraries.
        //@ts-ignore
        this.spanProcessors.forEach(sp => { sp.onStart(span, context); });
        return span;
    }
    startActiveSpan(name, ...args) {
        const options = args.length > 1 ? args[0] : undefined;
        const parentContext = args.length > 2 ? args[1] : api_context.active();
        const fn = args[args.length - 1];
        const span = this.startSpan(name, options, parentContext);
        const contextWithSpanSet = trace.setSpan(parentContext, span);
        return api_context.with(contextWithSpanSet, fn, undefined, span);
    }
}
//# sourceMappingURL=tracer.js.map