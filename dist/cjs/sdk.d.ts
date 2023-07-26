/// <reference types="@cloudflare/workers-types/experimental" />
import { OTLPExporter } from './exporter.js';
import { Trigger, TraceConfig } from './types.js';
import { DOClass } from './instrumentation/do.js';
export type ResolveConfigFn = (env: any, trigger: Trigger) => TraceConfig;
export type ConfigurationOption = TraceConfig | ResolveConfigFn;
export declare function isRequest(trigger: Trigger): trigger is Request;
export declare function isMessageBatch(trigger: Trigger): trigger is MessageBatch;
export declare function isAlarm(trigger: Trigger): trigger is 'do-alarm';
export declare function instrument<E, Q, C>(handler: ExportedHandler<E, Q, C>, config: ConfigurationOption): ExportedHandler<E, Q, C>;
export declare function instrumentDO(doClass: DOClass, config: ConfigurationOption): DOClass;
export { waitUntilTrace } from './instrumentation/fetch.js';
export { OTLPExporter };
//# sourceMappingURL=sdk.d.ts.map