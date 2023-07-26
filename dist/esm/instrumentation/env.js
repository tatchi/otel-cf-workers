import { wrap } from '../wrap.js';
import { instrumentDOBinding } from './do.js';
import { instrumentKV } from './kv.js';
import { instrumentQueueSender } from './queue.js';
const isKVNamespace = (item) => {
    return !!item?.getWithMetadata;
};
const isQueue = (item) => {
    return !!item?.sendBatch;
};
const isDurableObject = (item) => {
    return !!item?.idFromName;
};
const instrumentEnv = (env) => {
    const envHandler = {
        get: (target, prop, receiver) => {
            const item = Reflect.get(target, prop, receiver);
            if (isKVNamespace(item)) {
                return instrumentKV(item, String(prop));
            }
            else if (isQueue(item)) {
                return instrumentQueueSender(item, String(prop));
            }
            else if (isDurableObject(item)) {
                return instrumentDOBinding(item, String(prop));
            }
            else {
                return item;
            }
        },
    };
    return wrap(env, envHandler);
};
export { instrumentEnv };
//# sourceMappingURL=env.js.map