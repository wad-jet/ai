interface TokenEvent {
    type: string;
    properties?: {
        info?: {
            role?: string;
            sessionID?: string;
            agent?: string;
            providerID?: string;
            modelID?: string;
            cost?: number;
            tokens?: {
                input: number;
                output: number;
                reasoning: number;
                cache: {
                    read: number;
                    write: number;
                };
            };
        };
    };
}
export declare function handleTokenEvent(base: string, event: TokenEvent, timestamp?: string): void;
export {};
//# sourceMappingURL=token-collector.d.ts.map