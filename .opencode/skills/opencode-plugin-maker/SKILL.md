---
name: opencode-plugin-maker
description: Use when creating opencode plugins, custom tools, or workspace adapters; when you need to hook into opencode events (tool execution, chat, shell, permissions, session lifecycle, auth, providers, or compaction)
---

# opencode-plugin-maker

## Overview

A plugin is a JavaScript/TypeScript module that exports a function receiving a context object and returning hooks. Plugins extend opencode by hooking into events across the entire lifecycle — tool execution, chat messages, shell commands, permissions, sessions, auth, providers, and compaction.

## Architecture

### Load Order

1. Global config (`~/.config/opencode/opencode.json`)
2. Project config (`opencode.json`)
3. Global plugin directory (`~/.config/opencode/plugins/`)
4. Project plugin directory (`.opencode/plugins/`)

Duplicate npm packages (same name + version) load once. A local and npm plugin with similar names both load separately.

### Plugin Function Signature

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  // Plugin initialization
  return {
    // Hook implementations
  }
}
```

The function receives:
- `project` — current project info
- `client` — opencode SDK client for server API
- `$` — Bun's shell API for executing commands
- `directory` — current working directory
- `worktree` — git worktree path
- `experimental_workspace` — workspace adapter registration
- `serverUrl` — opencode server URL

All hooks run in sequence.

---

## Quick Reference

### Available Hooks

| Hook | Trigger | Use Case |
|------|---------|----------|
| `tool.execute.before` | Before any tool call | Validate/modify arguments, block dangerous operations |
| `tool.execute.after` | After tool execution | Enhance output, add metadata, log results |
| `tool.definition` | Tool definitions sent to LLM | Modify tool descriptions/parameters |
| `shell.env` | Shell command execution | Inject environment variables |
| `chat.message` | New message received | Inject context, log conversations |
| `chat.params` | LLM parameters being sent | Modify temperature, topP, max tokens |
| `chat.headers` | LLM API request headers | Add auth headers, tracing |
| `permission.ask` | Permission prompt | Auto-allow/deny based on rules |
| `command.execute.before` | Slash command execution | Intercept/modify commands |
| `event` | Any server event | General-purpose monitoring |
| `config` | Config loaded | Modify configuration |
| `auth` | Provider auth setup | Custom auth flows (OAuth, API keys) |
| `provider` | Model provider setup | Custom model providers |
| `experimental.session.compacting` | Before compaction | Inject context into compaction prompt |
| `experimental.compaction.autocontinue` | After compaction | Control auto-continue behavior |
| `experimental.chat.messages.transform` | Messages to LLM | Transform conversation history |
| `experimental.chat.system.transform` | System prompt | Modify system prompt |
| `experimental.text.complete` | Text completion | Intercept text output |
| `tool` (property) | Custom tool registration | Define custom tools |

### Session Events (via `event` hook)

| Event | Trigger |
|-------|---------|
| `session.created` | Session created |
| `session.updated` | Session updated |
| `session.deleted` | Session deleted |
| `session.compacted` | Session compacted |
| `session.idle` | Session idle |
| `session.error` | Session error |
| `session.diff` | Session diff |
| `session.status` | Session status change |

### Other Server Events

| Event | Trigger |
|-------|---------|
| `message.part.updated` | Message part updated |
| `message.part.removed` | Message part removed |
| `message.updated` | Message updated |
| `message.removed` | Message removed |
| `file.edited` | File edited |
| `file.watcher.updated` | File watcher change |
| `installation.updated` | Installation updated |
| `lsp.client.diagnostics` | LSP diagnostics |
| `lsp.updated` | LSP status change |
| `server.connected` | Server connected |
| `todo.updated` | Todo updated |
| `tui.prompt.append` | TUI prompt append |
| `tui.command.execute` | TUI command |
| `tui.toast.show` | TUI toast |
| `command.executed` | Command executed |

---

## Plugin API Reference

### Core Types

#### Plugin

```typescript
import type { Plugin, PluginOptions, Hooks, PluginInput } from "@opencode-ai/plugin"

type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>
```

#### PluginInput

```typescript
type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>
  project: Project
  directory: string
  worktree: string
  experimental_workspace: {
    register(type: string, adapter: WorkspaceAdapter): void
  }
  serverUrl: URL
  $: BunShell
}
```

#### Hooks Interface

```typescript
interface Hooks {
  // General event handler — receives ALL server events
  event?: (input: { event: Event }) => Promise<void>

  // Config modification
  config?: (input: Config) => Promise<void>

  // Custom tools
  tool?: {
    [key: string]: ToolDefinition
  }

  // Auth provider
  auth?: AuthHook

  // Model provider
  provider?: ProviderHook

  // Chat hooks
  "chat.message"?: (
    input: { sessionID: string; agent?: string; model?: { providerID: string; modelID: string }; messageID?: string; variant?: string },
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>

  "chat.params"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: { temperature: number; topP: number; topK: number; maxOutputTokens: number | undefined; options: Record<string, any> },
  ) => Promise<void>

  "chat.headers"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: { headers: Record<string, string> },
  ) => Promise<void>

  // Permission hook
  "permission.ask"?: (
    input: Permission,
    output: { status: "ask" | "deny" | "allow" },
  ) => Promise<void>

  // Command hook
  "command.execute.before"?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Part[] },
  ) => Promise<void>

  // Tool hooks
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>

  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>

  "tool.definition"?: (
    input: { toolID: string },
    output: { description: string; parameters: any },
  ) => Promise<void>

  // Shell hook
  "shell.env"?: (
    input: { cwd: string; sessionID?: string; callID?: string },
    output: { env: Record<string, string> },
  ) => Promise<void>

  // Experimental hooks
  "experimental.chat.messages.transform"?: (
    input: {},
    output: { messages: { info: Message; parts: Part[] }[] },
  ) => Promise<void>

  "experimental.chat.system.transform"?: (
    input: { sessionID?: string; model: Model },
    output: { system: string[] },
  ) => Promise<void>

  "experimental.session.compacting"?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>

  "experimental.compaction.autocontinue"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage; overflow: boolean },
    output: { enabled: boolean },
  ) => Promise<void>

  "experimental.text.complete"?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string },
  ) => Promise<void>
}
```

---

### Custom Tools

Create custom tools that opencode can call alongside built-in tools:

#### Using `tool()` Helper

```typescript
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Query the project database",
  args: {
    query: tool.schema.string().describe("SQL query to execute"),
  },
  async execute(args) {
    // Your database logic here
    return `Executed query: ${args.query}`
  },
})
```

**Naming:**
- Single export: filename becomes tool name (e.g., `database.ts` → `database` tool)
- Multiple exports: `filename_exportname` (e.g., `math.ts` with `add` → `math_add` tool)
- Name collision with built-in: custom tool takes precedence

#### Tool Schema (Zod)

The `tool.schema` is just Zod. Supports all Zod types:

```typescript
args: {
  name: tool.schema.string().describe("Name"),
  age: tool.schema.number().min(0).describe("Age"),
  tags: tool.schema.array(tool.schema.string()).describe("Tags"),
  options: tool.schema.object({
    verbose: tool.schema.boolean().default(false),
  }).describe("Options"),
}
```

#### ToolContext

Tools receive context about the current session:

```typescript
type ToolContext = {
  sessionID: string
  messageID: string
  agent: string
  directory: string     // Current project directory
  worktree: string      // Git worktree root
  abort: AbortSignal    // AbortSignal for cancellation
  metadata(input: { title?: string; metadata?: { [key: string]: any } }): void
  ask(input: AskInput): Effect.Effect<void>
}
```

#### ToolResult

Return a string or structured result:

```typescript
type ToolResult = string | {
  title?: string
  output: string
  metadata?: { [key: string]: any }
  attachments?: Array<{
    type: "file"
    mime: string
    url: string
    filename?: string
  }>
}
```

#### Tools in Separate Files

Tools can also be defined in `.opencode/tools/`:

```typescript
// .opencode/tools/math.ts
import { tool } from "@opencode-ai/plugin"

export const add = tool({
  description: "Add two numbers",
  args: {
    a: tool.schema.number().describe("First number"),
    b: tool.schema.number().describe("Second number"),
  },
  async execute(args) {
    return args.a + args.b
  },
})
```

---

### Auth Hooks

For creating custom auth flows (API keys, OAuth):

```typescript
type AuthHook = {
  provider: string
  loader?: (auth: () => Promise<Auth>, provider: Provider) => Promise<Record<string, any>>
  methods: Array<
    | {
        type: "oauth"
        label: string
        prompts?: Array<{ type: "text" | "select"; key: string; message: string; placeholder?: string; validate?: Function; when?: Rule }>
        authorize(inputs?: Record<string, string>): Promise<AuthOAuthResult>
      }
    | {
        type: "api"
        label: string
        prompts?: Array<{ type: "text" | "select"; key: string; message: string; placeholder?: string; validate?: Function; when?: Rule }>
        authorize?(inputs?: Record<string, string>): Promise<{ type: "success"; key: string; provider?: string; metadata?: Record<string, string> } | { type: "failed" }>
      }
  >
}
```

### Provider Hooks

For adding custom model providers:

```typescript
type ProviderHook = {
  id: string
  models?: (provider: ProviderV2, ctx: ProviderHookContext) => Promise<Record<string, ModelV2>>
}

type ProviderHookContext = {
  auth?: Auth
}
```

### Workspace Adapters

For creating custom workspace management:

```typescript
type WorkspaceAdapter = {
  name: string
  description: string
  configure(config: WorkspaceInfo): WorkspaceInfo | Promise<WorkspaceInfo>
  create(config: WorkspaceInfo, env: Record<string, string | undefined>, from?: WorkspaceInfo): Promise<void>
  remove(config: WorkspaceInfo): Promise<void>
  target(config: WorkspaceInfo): WorkspaceTarget | Promise<WorkspaceTarget>
}
```

---

## Setup & Installation

### Local Plugins

Place JS/TS files in:
- `.opencode/plugins/` — project-level plugins
- `~/.config/opencode/plugins/` — global plugins

Files are auto-loaded at startup.

### npm Plugins

Add to `opencode.json`:

```json
{
  "plugin": [
    "opencode-helicone-session",
    "opencode-wakatime",
    "@my-org/custom-plugin"
  ]
}
```

Both regular and scoped npm packages supported.

### Dependencies

Local plugins can use external packages. Add a `package.json` to your config directory:

```json
// .opencode/package.json
{
  "dependencies": {
    "shescape": "^2.1.0"
  }
}
```

OpenCode runs `bun install` at startup. Your plugins can then import them:

```typescript
// .opencode/plugins/my-plugin.ts
import { escape } from "shescape"
```

### TypeScript Support

For TypeScript plugins, import types from the plugin package:

```typescript
import type { Plugin, Hooks, PluginInput } from "@opencode-ai/plugin"
import type { ToolContext, ToolResult } from "@opencode-ai/plugin"
```

### How Plugins Are Installed

- **npm plugins:** Installed automatically via Bun at startup. Cached in `~/.cache/opencode/node_modules/`.
- **Local plugins:** Loaded directly from plugin directory. External packages need `package.json` in config directory.

---

## Development Workflow

### 1. Scaffold

```bash
# Create plugin directory
mkdir -p .opencode/plugins

# Add package.json if you need external deps
cat > .opencode/package.json << 'EOF'
{
  "dependencies": {
    "@opencode-ai/plugin": "latest"
  }
}
EOF
```

### 2. Implement Plugin

Create your plugin file:

```typescript
// .opencode/plugins/my-plugin.ts
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ client, $ }) => {
  console.log("Plugin initialized!")

  return {
    "tool.execute.before": async (input, output) => {
      // Intercept tool calls
    },
  }
}
```

### 3. Test Locally

```bash
# Restart opencode — plugins auto-load
# Watch for initialization log
# Test with relevant commands
```

### 4. Debug with Logging

```typescript
// Use structured logging instead of console.log
await client.app.log({
  body: {
    service: "my-plugin",
    level: "info",     // debug | info | warn | error
    message: "Tool intercepted",
    extra: { tool: input.tool },
  },
})
```

### 5. Publish to npm

```bash
# Create package
npm init
npm run build
npm publish

# Or use bun
bun publish
```

### 6. Add to Ecosystem

Submit a PR to [opencode docs ecosystem page](https://github.com/anomalyco/opencode/tree/dev/packages/web/src/content/docs/ecosystem.mdx).

---

## Examples

### Notification Plugin

Send macOS notifications on session events:

```typescript
// .opencode/plugins/notification.js
export const NotificationPlugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $`osascript -e 'display notification "Session completed!" with title "opencode"'`
      }
    },
  }
}
```

### .env Protection

Prevent opencode from reading `.env` files:

```typescript
// .opencode/plugins/env-protection.js
export const EnvProtection = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read" && output.args.filePath?.includes(".env")) {
        throw new Error("Do not read .env files")
      }
    },
  }
}
```

### Inject Environment Variables

```typescript
// .opencode/plugins/inject-env.js
export const InjectEnvPlugin = async () => {
  return {
    "shell.env": async (input, output) => {
      output.env.MY_API_KEY = "secret"
      output.env.PROJECT_ROOT = input.cwd
    },
  }
}
```

### Custom Tools in Plugin

```typescript
// .opencode/plugins/custom-tools.ts
import { type Plugin, tool } from "@opencode-ai/plugin"

export const CustomToolsPlugin: Plugin = async () => {
  return {
    tool: {
      mytool: tool({
        description: "This is a custom tool",
        args: {
          foo: tool.schema.string().describe("Input value"),
        },
        async execute(args, context) {
          const { directory, worktree } = context
          return `Hello ${args.foo} from ${directory} (worktree: ${worktree})`
        },
      }),
    },
  }
}
```

### Structured Logging

```typescript
// .opencode/plugins/my-plugin.ts
export const MyPlugin = async ({ client }) => {
  await client.app.log({
    body: {
      service: "my-plugin",
      level: "info",
      message: "Plugin initialized",
      extra: { foo: "bar" },
    },
  })
}
```

### Compaction Hooks

Customize what context persists when a session is compacted:

```typescript
// .opencode/plugins/compaction.ts
import type { Plugin } from "@opencode-ai/plugin"

export const CompactionPlugin: Plugin = async () => {
  return {
    "experimental.session.compacting": async (input, output) => {
      // Append additional context
      output.context.push(`## Custom Context
Include any state that should persist across compaction:
- Current task status
- Important decisions made
- Files being actively worked on`)
    },
  }
}
```

Replace the entire compaction prompt:

```typescript
export const CustomCompactionPlugin: Plugin = async () => {
  return {
    "experimental.session.compacting": async (input, output) => {
      output.prompt = `You are generating a continuation prompt...
Summarize: 1. Current task status 2. Files modified 3. Blockers 4. Next steps`
    },
  }
}
```

When `output.prompt` is set, it replaces the default prompt completely and `output.context` is ignored.

### Auth Plugin (API Key)

```typescript
// .opencode/plugins/my-auth.ts
import type { Plugin } from "@opencode-ai/plugin"

export const MyAuthPlugin: Plugin = async () => {
  return {
    auth: {
      provider: "my-provider",
      methods: [
        {
          type: "api",
          label: "My Provider API Key",
          prompts: [
            {
              type: "text",
              key: "apiKey",
              message: "Enter your API key",
              placeholder: "sk-...",
            },
          ],
          async authorize(inputs) {
            if (inputs?.apiKey) {
              return {
                type: "success",
                key: inputs.apiKey,
                provider: "my-provider",
              }
            }
            return { type: "failed" }
          },
        },
      ],
    },
  }
}
```

### Custom Tool in Separate File (Python)

```typescript
// .opencode/tools/add.py
import sys
a = int(sys.argv[1])
b = int(sys.argv[2])
print(a + b)
```

```typescript
// .opencode/tools/python-add.ts
import { tool } from "@opencode-ai/plugin"
import path from "path"

export default tool({
  description: "Add two numbers using Python",
  args: {
    a: tool.schema.number().describe("First number"),
    b: tool.schema.number().describe("Second number"),
  },
  async execute(args, context) {
    const script = path.join(context.worktree, ".opencode/tools/add.py")
    const result = await Bun.$`python3 ${script} ${args.a} ${args.b}`.text()
    return result.trim()
  },
})
```

### Session Context Injection

Inject context without triggering AI response:

```typescript
export const ContextPlugin: Plugin = async ({ client }) => {
  return {
    "chat.message": async (input, output) => {
      // Inject system context before user message is processed
      await client.session.prompt({
        path: { id: input.sessionID },
        body: {
          noReply: true,  // Don't trigger AI response
          parts: [{ type: "text", text: "Remember: use TypeScript" }],
        },
      })
    },
  }
}
```

---

## Common Patterns

### Intercept + Modify

The most common pattern — intercept a hook, modify arguments, pass through:

```typescript
"tool.execute.before": async (input, output) => {
  if (input.tool === "bash") {
    // Modify the command before execution
    output.args.command = `cd /safe/directory && ${output.args.command}`
  }
}
```

### Context Injection

Add context to AI without triggering a response:

```typescript
await client.session.prompt({
  path: { id: sessionID },
  body: {
    noReply: true,
    parts: [{ type: "text", text: "Additional context for the AI" }],
  },
})
```

### Environment Injection

Make variables available in ALL shell commands:

```typescript
"shell.env": async (input, output) => {
  output.env.DATABASE_URL = process.env.DATABASE_URL
  output.env.NODE_ENV = "development"
}
```

### Monitoring & Logging

Track every tool execution:

```typescript
"tool.execute.after": async (input, output) => {
  await client.app.log({
    body: {
      service: "monitor",
      level: "info",
      message: `Tool ${input.tool} executed`,
      extra: { args: input.args, result: output.output },
    },
  })
}
```

## Common Pitfalls

| Pitfall | Description | Fix |
|---------|-------------|-----|
| **Name Collisions** | Local plugin + npm plugin with similar names both load; custom tool with same name as built-in overrides it | Use unique, descriptive names |
| **Async Error Handling** | Unhandled promise rejections crash the plugin | Always wrap in try/catch or use `.catch()` |
| **Forgetting `noReply`** | `session.prompt()` without `noReply: true` triggers AI response | Always set `noReply: true` when injecting context |
| **Load Order Assumptions** | Plugin load order across different sources is not guaranteed | Make plugins idempotent and independent |
| **Blocking Event Loop** | Heavy sync operations in hooks block opencode | Use async/await, offload heavy work |
| **Blanket Tool Definition Changes** | `tool.definition` modifies what LLM sees about a tool globally | Only modify specific `toolID`, avoid blanket changes |

---

## SDK Integration Reference

The `client` object provides full access to opencode server API:

### App API

```typescript
// Structured logging
await client.app.log({
  body: { service: "plugin", level: "info", message: "Hello" }
})

// List available agents
const agents = await client.app.agents()
```

### Session API

```typescript
// Create session
const session = await client.session.create({
  body: { title: "My Session" }
})

// Send prompt (with or without reply)
await client.session.prompt({
  path: { id: session.id },
  body: {
    noReply: true,  // Don't trigger AI
    parts: [{ type: "text", text: "Context" }],
  },
})

// List sessions
const sessions = await client.session.list()
```

### File API

```typescript
// Search files
const files = await client.find.files({
  query: { query: "*.ts", type: "file" }
})

// Read file
const content = await client.file.read({
  query: { path: "src/index.ts" }
})
```

### TUI API

```typescript
// Show toast notification
await client.tui.showToast({
  body: { message: "Plugin loaded", variant: "success" }
})

// Append to prompt
await client.tui.appendPrompt({
  body: { text: "Add this to the prompt" }
})
```

### Event Subscription

```typescript
// Real-time event stream
const events = await client.event.subscribe()
for await (const event of events.stream) {
  console.log("Event:", event.type)
}
```

### Config API

```typescript
// Get config
const config = await client.config.get()

// List providers and default models
const { providers, default: defaults } = await client.config.providers()
```

### Auth API

```typescript
// Set auth credentials
await client.auth.set({
  path: { id: "anthropic" },
  body: { type: "api", key: "your-api-key" },
})
```

### Health Check

```typescript
const health = await client.global.health()
console.log(`Server version: ${health.data.version}`)
```
