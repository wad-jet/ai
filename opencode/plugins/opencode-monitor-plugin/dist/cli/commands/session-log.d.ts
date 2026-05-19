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
type SessionLogAction = "list" | "view" | "search" | "help";
export declare function runSessionLogCLI(action: SessionLogAction, filters: LogFilters, basePath?: string, config?: Config): string;
export {};
//# sourceMappingURL=session-log.d.ts.map