# ACP adapter for Kode

Use [Kode](https://github.com/shareAI-lab/kode) from [ACP-compatible](https://agentclientprotocol.com) clients such as [Zed](https://zed.dev)!

**Repository**: https://github.com/soddygo/kode-acp

This tool implements an ACP agent by using Kode's tool system, supporting:

- Context @-mentions
- Images
- Tool calls (with permission requests)
- Following
- Edit review
- TODO lists
- Interactive (and background) terminals
- Multi-model collaboration
- Custom slash commands
- Client MCP servers

Learn more about the [Agent Client Protocol](https://agentclientprotocol.com/).

## How to use

### Installation

#### npm (Node.js)

Install the adapter from npm:

```bash
npm install -g kode-acp
```

#### Deno

Install the adapter using Deno:

```bash
deno install --allow-read --allow-write --allow-net --allow-env --allow-run --allow-sys -n kode-acp https://deno.land/x/kode-acp/mod.ts
```

#### JSR (JavaScript Registry)

Install the adapter using JSR (recommended for TypeScript projects):

```bash
# npm
npm install @kode/acp

# yarn
yarn add @kode/acp

# pnpm
pnpm add @kode/acp

# Deno
deno add jsr:@kode/acp
```

#### GitHub Releases

Download pre-built binaries from the [GitHub Releases](https://github.com/soddygo/kode-acp/releases) page.

#### Build from source

```bash
git clone https://github.com/soddygo/kode-acp.git
cd kode-acp
npm install
npm run build
npm install -g .  # or use npm link for development
```

You can then use `kode-acp` as a regular ACP agent:

```bash
kode-acp
```

### Zed

The latest version of Zed can use this adapter out of the box.

To use Kode, open the Agent Panel and click "New Kode Thread" from the `+` button menu in the top-right.

### Other clients

- Emacs via [agent-shell.el](https://github.com/xenodium/agent-shell)
- [marimo notebook](https://github.com/marimo-team/marimo)
- Neovim
  - via [CodeCompanion.nvim](https://codecompanion.olimorris.dev/configuration/adapters#setup-claude-code-via-acp)
  - via [yetone/avante.nvim](https://github.com/yetone/avante.nvim)

## Features

### Multi-Model Support

Unlike other ACP adapters, Kode-ACP supports:
- **Multi-model collaboration**: Use different AI models for different tasks
- **Expert consultation**: Consult specialized models for specific problems
- **Parallel processing**: Run multiple models simultaneously
- **Model switching**: Switch models on the fly without losing context

### Tool Support

- **File operations**: Read, write, edit files with intelligent diff handling
- **Search capabilities**: Glob patterns, grep searches across codebase
- **Command execution**: Run shell commands with real-time output
- **Web tools**: Fetch URLs, search the web
- **Notebook support**: Read and edit Jupyter notebooks
- **Task management**: Create and track TODO lists
- **Memory system**: Store and retrieve context across sessions

## Configuration

Kode-ACP uses Kode's configuration system. You can configure:

- **Model profiles**: Set up multiple AI models with their API keys
- **Default models**: Configure which model to use for different tasks
- **Permission settings**: Control tool access and safety settings
- **Working directory**: Set the project root

## Publishing

### npm Publishing

To publish to npm:

```bash
# Build and check
npm run build
npm run check

# Dry run to test
npm run publish:dry-run

# Publish to npm (requires npm login)
npm publish

# Publish with tags
npm run publish:beta   # for beta releases
npm run publish:next   # for next releases
```

### JSR Publishing

To publish to JSR (JavaScript Registry):

```bash
# Install JSR CLI
npm install -g jsr

# Login to JSR
jsr login

# Dry run to test
npm run publish:jsr:dry-run

# Publish to JSR
npm run publish:jsr
```

### Deno Publishing

To publish to Deno:

```bash
# Build with Deno
deno task build

# Publish to Deno Land
deno publish --allow-scratch
```

### Manual Publishing Steps

1. **Update version in package.json and jsr.json**
2. **Build the project**: `npm run build`
3. **Run tests and checks**: `npm run check`
4. **Commit changes**: `git commit -m "Release v0.1.0"`
5. **Create tag**: `git tag v0.1.0`
6. **Push to GitHub**: `git push && git push --tags`
7. **Publish to npm**: `npm publish`
8. **Publish to JSR**: `npm run publish:jsr`
9. **Publish to Deno**: `deno publish --allow-scratch`

## License

Apache-2.0