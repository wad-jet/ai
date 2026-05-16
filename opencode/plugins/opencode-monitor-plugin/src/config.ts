import { z } from "zod";

export const ConfigSchema = z.object({
  includeThinking: z.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

export function createConfig(input: Partial<Config> | undefined): Config {
  return ConfigSchema.parse(input ?? {});
}
