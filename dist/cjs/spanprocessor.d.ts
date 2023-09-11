import { Context, Span } from '@opentelemetry/api';
import { ReadableSpan, SpanExporter, SpanProcessor } from '@opentelemetry/sdk-trace-base';
export declare class BatchTraceSpanProcessor implements SpanProcessor {
    private exporter;
    private traces;
    private inprogressExports;
    constructor(exporter: SpanExporter);
    private action;
    private export;
    onStart(span: Span, _parentContext: Context): void;
    onEnd(span: ReadableSpan): void;
    forceFlush(): Promise<void>;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=spanprocessor.d.ts.map