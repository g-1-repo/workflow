# @g-1/workflow

🚀 **Enterprise-ready release automation and workflow orchestration**

A powerful, type-safe CLI tool built for modern development teams that need consistent, reliable release processes across all their projects.

[![npm version](https://badge.fury.io/js/%40g-1%2Fworkflow.svg)](https://badge.fury.io/js/%40g-1%2Fworkflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

### 🎯 **Complete Release Pipeline**
- **Quality Gates**: Auto-fix linting, type checking, test execution
- **Git Operations**: Smart version bumping, changelog generation, tagging
- **Multi-Platform Publishing**: npm, Cloudflare, GitHub releases
- **Interactive UI**: Beautiful progress indicators with listr2

### 🏢 **Enterprise-Ready**
- **Type-Safe**: Full TypeScript with comprehensive error handling
- **Extensible**: Plugin system for custom workflows
- **Configurable**: Skip steps, customize behavior per project
- **AI-Powered**: Smart branch names, commit suggestions (coming soon)

### 🌟 **Developer Experience**
- **Zero Config**: Works out of the box with sensible defaults
- **Interactive**: Smart deployment configuration and uncommitted changes handling
- **Crash-Proof**: Robust error handling prevents workflow interruptions
- **Fast**: Optimized performance with concurrent operations

## 🚀 Quick Start

### Installation

```bash
# Install globally (recommended)
bun install -g @g-1/workflow

# Or use in project
bun add --dev @g-1/workflow

# Also available via npm/yarn/pnpm
npm install -g @g-1/workflow
```

### Basic Usage

```bash
# Interactive release workflow (recommended)
workflow release
# → Prompts for deployment targets (npm, Cloudflare)
# → Handles uncommitted changes interactively
# → Executes complete release pipeline

# Release with specific version bump
workflow release --type minor

# Skip specific deployments via CLI flags
workflow release --skip-cloudflare --skip-npm

# Force release with uncommitted changes
workflow release --force

# Non-interactive mode (for CI/CD)
workflow release --non-interactive --skip-cloudflare --skip-npm

# Show workflow status
workflow status
```

## 📋 Commands

### `workflow release`

Execute the complete release workflow with interactive configuration:

```bash
🔧 Deployment Configuration
----------------------------------------
✔ 📦 Publish to npm registry? (y/N) · true

⚠️  Uncommitted changes detected:
  - README.md

? How would you like to handle uncommitted changes? › 📝 Commit all changes now
✅ Changes committed

✔ Quality Gates
  ✔ Auto-fix linting issues - ✅ Fixed
  ✔ Type checking - ✅ Passed
  ✔ Running tests - ✅ No tests found (skipping)
✔ Git repository analysis - ✅ g-1-repo/workflow on main
✔ Version calculation - ✅ 2.10.1 → 2.11.0 (minor)
✔ Deployment configuration - ✅ Will deploy to: npm
✔ Release execution
  ✔ Update package.json version - ✅ 2.11.0
  ✔ Generate changelog - ✅ CHANGELOG.md updated
  ✔ Commit release changes - ✅ chore: release v2.11.0
  ✔ Create git tag - ✅ v2.11.0
  ✔ Push to remote - ✅ Complete
✔ Build project - ✅ Build complete
↓ Deploy to Cloudflare [SKIPPED]
✔ Publish to npm - ✅ v2.11.0 published (you may need to interact with prompts)
✔ Create GitHub release - ✅ v2.11.0 released

🎉 Release completed successfully!
📦 Version: 2.10.1 → 2.11.0
📂 Repository: g-1-repo/workflow
```

**Options:**
- `--type <patch|minor|major>` - Force specific version bump
- `--skip-tests` - Skip test execution
- `--skip-lint` - Skip linting step
- `--skip-cloudflare` - Skip Cloudflare deployment (or use interactive prompt)
- `--skip-npm` - Skip npm publishing (or use interactive prompt)
- `--non-interactive` - Run without prompts (for CI/CD environments)
- `--force` - Skip uncommitted changes check
- `--dry-run` - Show what would be done without executing *(coming soon)*
- `--verbose` - Show detailed output

### `workflow feature` *(Coming Soon)*

Create and manage feature branches with AI-powered suggestions:

```bash
workflow feature                    # AI suggests branch name
workflow feature "add-user-auth"    # Create specific feature
workflow feature --auto-merge       # Enable auto-merge on PR
```

### `workflow status`

Show project and workflow status.

## 🏗️ Programmatic Usage

Use as a library in your Node.js applications:

```typescript
import { createReleaseWorkflow, createTaskEngine, createWorkflow, quickRelease } from '@g-1/workflow'

// Quick release with interactive prompts
await quickRelease({ type: 'minor' })

// Custom workflow (note: createReleaseWorkflow is now async)
const steps = await createReleaseWorkflow({
  skipTests: true,
  nonInteractive: true, // Skip prompts for programmatic use
  skipCloudflare: true,
  skipNpm: true
})
const engine = createTaskEngine({ showTimer: true })
const result = await engine.execute(steps)

// Build custom workflows
const customWorkflow = createWorkflow('deploy')
  .step('Build', async (ctx, helpers) => {
    helpers.setOutput('Building application...')
    // Your build logic
  })
  .step('Deploy', async (ctx, helpers) => {
    helpers.setOutput('Deploying to production...')
    // Your deploy logic
  })
  .build()
```

## ⚙️ Configuration *(Coming Soon)*

Create `.go-workflow.config.js` in your project root:

```javascript
export default {
  project: {
    type: 'library', // 'library' | 'cli' | 'web-app' | 'api'
    packageManager: 'bun' // 'bun' | 'npm' | 'yarn' | 'pnpm'
  },

  git: {
    defaultBranch: 'main',
    branchNaming: {
      feature: 'feature/{name}',
      bugfix: 'bugfix/{name}',
      hotfix: 'hotfix/{name}'
    }
  },

  deployments: {
    npm: {
      enabled: true,
      access: 'public'
    },
    cloudflare: {
      enabled: true,
      buildCommand: 'npm run build'
    }
  },

  github: {
    autoRelease: true,
    pullRequests: {
      autoMerge: true,
      deleteBranch: true
    }
  }
}
```

## 🔧 Requirements

- **Node.js**: >= 18.0.0
- **Git**: For version control operations
- **GitHub CLI** *(optional)*: For GitHub integrations (`gh` command)
- **Wrangler** *(optional)*: For Cloudflare deployments

## 🏢 Enterprise Features

### **Multi-Project Consistency**
Install once, use everywhere. Same commands and behavior across all your projects.

### **Quality Gates**
Enforces code quality before any release:
- Automatic linting with auto-fix
- TypeScript type checking
- Test execution with coverage
- Build verification

### **Smart Version Management**
- Semantic versioning based on conventional commits
- Automatic changelog generation
- Git tagging with proper annotations
- Release notes generation

### **Flexible Deployment**
- npm registry publishing
- Cloudflare Workers/Pages deployment
- GitHub releases with assets
- Extensible for custom targets

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © [G1](https://github.com/g-1-repo)

## 🆘 Support

- 📖 [Documentation](https://github.com/g-1-repo/workflow/wiki)
- 🐛 [Issue Tracker](https://github.com/g-1-repo/workflow/issues)
- 💬 [Discussions](https://github.com/g-1-repo/workflow/discussions)

---

**Built with ❤️ for modern development teams**
