import type { Config } from "../config.js";
interface ChatInput {
    sessionID?: string;
    agent?: string;
}
interface ChatOutput {
    message?: {
        role?: string;
    };
    parts?: {
        type?: string;
        text?: string;
    }[];
}
export declare function handleChatMessage(base: string, input: ChatInput, output: ChatOutput, timestamp?: string, rootDir?: string, username?: string, providerId?: string, modelId?: string, opencodeVersion?: string, projectId?: string, gitBranch?: string, skills?: string[], config?: Config): void;
export declare function handlePartUpdate(base: string, event: {
    properties?: {
        part?: {
            id?: string;
            type?: string;
            text?: string;
            messageID?: string;
            time?: {
                end?: number;
            };
        };
    };
}): void;
export declare function flushAssistantOutput(base: string, msgId: string, sessionId: string, agent: string, timestamp?: string, rootDir?: string, username?: string, providerId?: string, modelId?: string, opencodeVersion?: string, finishReason?: string, mode?: string, durationMs?: number, error?: Record<string, unknown>, cwd?: string, projectId?: string, gitBranch?: string, skills?: string[], config?: Config): void;
export {};
//# sourceMappingURL=session-collector.d.ts.map