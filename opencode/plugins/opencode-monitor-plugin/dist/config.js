import { z } from "zod";
export const ConfigSchema = z.object({
    includeThinking: z.boolean().default(false),
});
export function createConfig(input) {
    return ConfigSchema.parse(input);
}
