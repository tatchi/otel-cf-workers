"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instrumentEnv = void 0;
const wrap_js_1 = require("../wrap.js");
const do_js_1 = require("./do.js");
const kv_js_1 = require("./kv.js");
const queue_js_1 = require("./queue.js");
const isKVNamespace = (item) => {
    return !!(item === null || item === void 0 ? void 0 : item.getWithMetadata);
};
const isQueue = (item) => {
    return !!(item === null || item === void 0 ? void 0 : item.sendBatch);
};
const isDurableObject = (item) => {
    return !!(item === null || item === void 0 ? void 0 : item.idFromName);
};
const instrumentEnv = (env) => {
    const envHandler = {
        get: (target, prop, receiver) => {
            const item = Reflect.get(target, prop, receiver);
            if (isKVNamespace(item)) {
                return (0, kv_js_1.instrumentKV)(item, String(prop));
            }
            else if (isQueue(item)) {
                return (0, queue_js_1.instrumentQueueSender)(item, String(prop));
            }
            else if (isDurableObject(item)) {
                return (0, do_js_1.instrumentDOBinding)(item, String(prop));
            }
            else {
                return item;
            }
        },
    };
    return (0, wrap_js_1.wrap)(env, envHandler);
};
exports.instrumentEnv = instrumentEnv;
//# sourceMappingURL=env.js.map