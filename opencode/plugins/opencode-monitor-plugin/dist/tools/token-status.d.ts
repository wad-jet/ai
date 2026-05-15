import { TokenSummary, AgentRow } from "../queries/token-query.js";
interface FormatOptions {
    sessionId?: string;
    debug?: boolean;
    compact?: boolean;
}
export declare function formatTokenTable(summary: TokenSummary, agents: AgentRow[], opts?: FormatOptions): string;
export declare function buildTokenStatusOutput(args: {
    session_id?: string;
    include_children?: boolean;
    agent_view?: string;
    agent_sort?: string;
    agent_top_n?: number;
    trend_days?: number;
    scope?: string;
    compact?: boolean;
    debug?: boolean;
}): string;
export {};
//# sourceMappingURL=token-status.d.ts.map