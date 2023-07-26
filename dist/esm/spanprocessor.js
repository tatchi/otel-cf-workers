import { ExportResultCode } from '@opentelemetry/core';
import { stateMachine } from 'ts-checked-fsm';
import { getActiveConfig } from './config.js';
function newTrace(currentState, { span }) {
    const spanId = span.spanContext().spanId;
    return {
        ...currentState,
        stateName: 'in_progress',
        traceId: span.spanContext().traceId,
        localRootSpan: span,
        completedSpans: [],
        inProgressSpanIds: new Set([spanId]),
    };
}
function newSpan(currentState, { span }) {
    const spanId = span.spanContext().spanId;
    currentState.inProgressSpanIds.add(spanId);
    return { ...currentState };
}
function endSpan(currentState, { span }) {
    currentState.completedSpans.push(span);
    currentState.inProgressSpanIds.delete(span.spanContext().spanId);
    if (currentState.inProgressSpanIds.size === 0) {
        return {
            stateName: 'trace_complete',
            traceId: currentState.traceId,
            localRootSpan: currentState.localRootSpan,
            completedSpans: currentState.completedSpans,
        };
    }
    else {
        return { ...currentState };
    }
}
function startExport(currentState, { args }) {
    const { exporter, tailSampler, postProcessor } = args;
    const { traceId, localRootSpan, completedSpans: spans } = currentState;
    const shouldExport = tailSampler({ traceId, localRootSpan, spans });
    if (shouldExport) {
        const exportSpans = postProcessor(spans);
        const promise = new Promise((resolve) => {
            exporter.export(exportSpans, resolve);
        });
        return { stateName: 'exporting', promise };
    }
    else {
        return { stateName: 'done' };
    }
}
const { nextState } = stateMachine()
    .state('not_started')
    .state('in_progress')
    .state('trace_complete')
    .state('exporting')
    .state('done')
    .transition('not_started', 'in_progress')
    .transition('in_progress', 'in_progress')
    .transition('in_progress', 'trace_complete')
    .transition('trace_complete', 'exporting')
    .transition('trace_complete', 'done')
    .transition('exporting', 'done')
    .action('startSpan')
    .action('endSpan')
    .action('startExport')
    .action('exportDone')
    .actionHandler('not_started', 'startSpan', newTrace)
    .actionHandler('in_progress', 'startSpan', newSpan)
    .actionHandler('in_progress', 'endSpan', endSpan)
    .actionHandler('trace_complete', 'startExport', startExport)
    .actionHandler('exporting', 'exportDone', (_c, _a) => {
    return { stateName: 'done' };
})
    .done();
export class BatchTraceSpanProcessor {
    exporter;
    traces = new Map();
    inprogressExports = new Map();
    constructor(exporter) {
        this.exporter = exporter;
    }
    action(traceId, action) {
        const state = this.traces.get(traceId) || { stateName: 'not_started' };
        const newState = nextState(state, action);
        if (newState.stateName === 'done') {
            this.traces.delete(traceId);
        }
        else {
            this.traces.set(traceId, newState);
        }
        return newState;
    }
    export(traceId) {
        const { sampling, postProcessor } = getActiveConfig();
        const exportArgs = { exporter: this.exporter, tailSampler: sampling.tailSampler, postProcessor };
        const newState = this.action(traceId, { actionName: 'startExport', args: exportArgs });
        if (newState.stateName === 'exporting') {
            const promise = newState.promise;
            this.inprogressExports.set(traceId, promise);
            promise.then((result) => {
                if (result.code === ExportResultCode.FAILED) {
                    console.log('Error sending spans to exporter:', result.error);
                }
                this.action(traceId, { actionName: 'exportDone' });
                this.inprogressExports.delete(traceId);
            });
        }
    }
    onStart(span, _parentContext) {
        const traceId = span.spanContext().traceId;
        this.action(traceId, { actionName: 'startSpan', span });
    }
    onEnd(span) {
        const traceId = span.spanContext().traceId;
        const state = this.action(traceId, { actionName: 'endSpan', span });
        if (state.stateName === 'trace_complete') {
            this.export(traceId);
        }
    }
    async forceFlush() {
        await Promise.allSettled(this.inprogressExports.values());
    }
    async shutdown() { }
}
//# sourceMappingURL=spanprocessor.js.map