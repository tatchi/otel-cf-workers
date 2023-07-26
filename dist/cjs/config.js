"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveConfig = exports.setConfig = void 0;
const api_1 = require("@opentelemetry/api");
const configSymbol = Symbol('Otel Workers Tracing Configuration');
function setConfig(config, ctx = api_1.context.active()) {
    return ctx.setValue(configSymbol, config);
}
exports.setConfig = setConfig;
function getActiveConfig() {
    const config = api_1.context.active().getValue(configSymbol);
    return config;
}
exports.getActiveConfig = getActiveConfig;
//# sourceMappingURL=config.js.map