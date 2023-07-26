/// <reference types="@cloudflare/workers-types/experimental" />
type ContextAndTracker = {
    ctx: ExecutionContext;
    tracker: PromiseTracker;
};
export declare class PromiseTracker {
    _outstandingPromises: Promise<unknown>[];
    get outstandingPromiseCount(): number;
    track(promise: Promise<unknown>): void;
    wait(): Promise<void>;
}
export declare function proxyExecutionContext(context: ExecutionContext): ContextAndTracker;
export declare function exportSpans(tracker?: PromiseTracker): Promise<void>;
/** Like `Promise.allSettled`, but handles modifications to the promises array */
export declare function allSettledMutable(promises: Promise<unknown>[]): Promise<PromiseSettledResult<unknown>[]>;
export {};
//# sourceMappingURL=common.d.ts.map