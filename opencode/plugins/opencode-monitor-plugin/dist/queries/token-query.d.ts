export interface TokenSummary {
    totalInput: number;
    totalOutput: number;
    totalReasoning: number;
    totalCacheRead: number;
    totalCacheWrite: number;
    totalCost: number;
    totalRows: number;
}
export declare function queryTokenSummary(base: string, days: number): TokenSummary;
export interface AgentRow {
    agent: string;
    input: number;
    output: number;
    cost: number;
    hits: number;
}
export interface DailyRow {
    date: string;
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
    hits: number;
}
export declare function queryDailyBreakdown(base: string, days: number): DailyRow[];
export declare function queryAgentBreakdown(base: string, days: number, sortBy: "cost" | "tokens", topN: number): AgentRow[];
//# sourceMappingURL=token-query.d.ts.map