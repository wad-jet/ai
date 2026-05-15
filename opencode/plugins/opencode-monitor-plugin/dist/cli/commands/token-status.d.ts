import { TokenSummary, AgentRow, DailyRow } from "../../queries/token-query.js";
export declare function runTokenStatusCLI(args: Record<string, string | boolean | number | undefined>): string;
export declare function formatCLITokenTable(summary: TokenSummary): string;
export declare function formatDailyTable(rows: DailyRow[]): string;
export declare function formatAgentTable(agents: AgentRow[], noData: boolean): string;
//# sourceMappingURL=token-status.d.ts.map