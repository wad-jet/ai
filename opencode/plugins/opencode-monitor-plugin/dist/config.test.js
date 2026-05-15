import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { ConfigSchema, createConfig } from "./config.js";
describe("config", () => {
    it("should validate config with includeThinking true", () => {
        const config = ConfigSchema.parse({ includeThinking: true });
        assert.equal(config.includeThinking, true);
    });
    it("should validate config with includeThinking false", () => {
        const config = ConfigSchema.parse({ includeThinking: false });
        assert.equal(config.includeThinking, false);
    });
    it("should default includeThinking to false when not provided", () => {
        const config = ConfigSchema.parse({});
        assert.equal(config.includeThinking, false);
    });
    it("should create config with custom values", () => {
        const config = createConfig({ includeThinking: true });
        assert.equal(config.includeThinking, true);
    });
    it("should create config with defaults", () => {
        const config = createConfig({});
        assert.equal(config.includeThinking, false);
    });
    it("should reject invalid includeThinking value", () => {
        assert.throws(() => ConfigSchema.parse({ includeThinking: "yes" }), Error);
    });
});
