import type { Config } from "../../config.js";
interface LogFilters {
    sessionId?: string;
    searchText?: string;
    date?: string;
    since?: string;
    until?: string;
    agent?: string;
    field?: "input" | "output" | "thinking" | "all";
    tail?: number;
    error?: boolean;
}
export declare function runSessionLogCLI(action: string, filters: LogFilters, basePath?: string, config?: Config): string;
export {};
//# sourceMappingURL=session-log.d.ts.map