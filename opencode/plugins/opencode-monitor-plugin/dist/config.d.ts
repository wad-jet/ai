import { z } from "zod";
export declare const ConfigSchema: z.ZodObject<{
    includeThinking: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type Config = z.infer<typeof ConfigSchema>;
export declare function createConfig(input: Partial<Config> | undefined): Config;
//# sourceMappingURL=config.d.ts.map