export interface CleanupFile {
    date: string;
    type: "session-logs" | "token_status";
    size: number;
    path: string;
}
export declare function collectCleanupFiles(dataDir: string, days: number, types: ("session-logs" | "token_status")[]): CleanupFile[];
export declare function formatCleanupPreview(files: CleanupFile[]): string;
export declare function runCleanupCLI(args: {
    days: number;
    sessionLogs: boolean;
    tokenStatus: boolean;
    dryRun: boolean;
}, base?: string): Promise<string>;
//# sourceMappingURL=cleanup.d.ts.map