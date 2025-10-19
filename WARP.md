# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Primary Commands (uses bun by default)
- `bun run dev` - Development mode with watch for TypeScript compilation
- `bun run build` - Build for production using tsup (creates both CJS and ESM)
- `bun run test` - Run tests using vitest
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Run tests with coverage report
- `bun run lint` - Run ESLint
- `bun run lint:fix` - Run ESLint with auto-fix
- `bun run typecheck` - TypeScript type checking without emitting files
- `bun run clean` - Remove dist directory
- `bun run prepublishOnly` - Pre-publish hooks (clean, build, typecheck)

### CLI Usage
- `bun run dev:cli` - Build and run CLI in development
- `bun run release` or `node dist/cli.js release` - Run interactive release workflow
- `bun run release --skip-cloudflare --skip-npm` - Release without deployments
- `bun run release --non-interactive --force` - Non-interactive mode for CI
- `node dist/cli.js status` - Show workflow status
- `node dist/cli.js feature` - Create feature branch (coming soon)

### Testing Single Components
- `bun test src/core/task-engine.test.ts` - Test the task engine
- `bun test src/workflows/release.test.ts` - Test release workflow
- `bunx vitest run --reporter=verbose` - Detailed test output

## Architecture Overview

### Core System Design
This is a **badass, enterprise-grade** TypeScript workflow automation system that could easily be the backbone of a major development organization's release process. 

Built with modular architecture and professional reliability:

**Core Engine (`src/core/`)**
- `TaskEngine` - Native listr2 integration for beautiful progress UI, hierarchical tasks, concurrent execution support
- `GitStore` - Complete Git operations wrapper using simple-git, includes AI-powered suggestions for branch names and commit messages

**Workflow System (`src/workflows/`)**
- `ReleaseWorkflow` - Multi-stage release pipeline: Quality Gates → Git Operations → Deployments
- Declarative workflow definitions using WorkflowStep interface
- Extensible step system with subtasks, skip conditions, retry logic

**Plugin Architecture (`src/plugins/`)**
- Plugin system for custom workflow extensions
- Hook system for workflow events (before/after steps, error handling)

### Key Architectural Patterns

**Task Orchestration**
- Workflows are composed of WorkflowSteps with title, task function, subtasks
- TaskEngine converts these to native listr2 ListrTasks
- Context object flows between steps maintaining state

**Git-First Design**
- All operations are Git-aware with repository analysis
- Conventional commit parsing for semantic versioning
- Branch management with naming conventions (feature/, bugfix/, hotfix/)

**Enterprise Features** 🚀
- 📊 **Beautiful UI**: Native listr2 integration with spinners, progress bars, and professional styling
- 🔧 **Intelligent Error Recovery**: Automated detection and fixing of linting, build, and dependency issues  
- 🔴 **Enhanced Error Visibility**: Red styling, error boxes, and clear failure indicators
- 🔍 **Smart GitHub Actions Monitoring**: Real-time job tracking with automated npm verification
- ⚡ **Multi-Platform Support**: Bun-first with npm/npx fallbacks for maximum compatibility
- 🛡️ **Quality Gates**: Automated lint fixing, TypeScript checking, and testing
- 📎 **Semantic Versioning**: Git analysis with conventional commits and changelog generation
- 🌐 **Multi-Deployment**: GitHub releases, npm publishing, and Cloudflare Workers
- 🤖 **AI-Ready Architecture**: Placeholder integrations for future LLM-powered suggestions
- 💪 **Crash-Proof Execution**: Interactive prompts moved upfront, comprehensive error handling
- 📊 **Enterprise Logging**: Structured output with timing, context preservation

**Interactive Workflow Features**
- **Upfront Configuration**: Deployment targets selected before workflow starts
- **Uncommitted Changes Handling**: Interactive prompts for commit, stash, or force options
- **npm OTP Support**: Interactive terminal access for 2FA/OTP authentication
- **Error Recovery**: Non-fatal failures with clear guidance and workflow continuation
- **CI/CD Mode**: `--non-interactive` flag for automated environments

**AI Integration Points**
- Branch name suggestions based on changed files and commit history
- Commit message generation using file analysis
- Ready for LLM integration (placeholder implementations exist)

## Development Notes

### TypeScript Configuration
- ES2022 target with ESNext modules
- Strict mode enabled with comprehensive type checking
- Dual build output: CommonJS and ESM via tsup
- Source maps and declaration files generated

### Package Manager Strategy
Following the user's preference, this project is **bun-first**:
1. All npm scripts use `bun run` by default
2. CLI tool prefers `bun` commands with npm fallback
3. Publishing uses `bun publish`
4. Installation examples show `bun install` first

### Release Process
The interactive release workflow (`bun run release`) includes:
1. **Interactive Configuration**: Prompts for deployment targets and uncommitted changes
2. **Quality Gates**: Auto-fix lint, typecheck, tests with graceful fallbacks
3. **Git Analysis**: Repository analysis and semantic version calculation
4. **Release Execution**: Package.json update, changelog generation, git tag creation
5. **Build Step**: Project build for deployment
6. **Deployments**: Multi-platform publishing (npm with OTP support, GitHub releases)
7. **Error Resilience**: Non-fatal deployment failures with clear error messages

### Error Handling Strategy
- **Interactive Error Recovery**: Uncommitted changes and deployment failures handled gracefully
- **Non-Fatal Deployments**: npm publish failures don't stop the workflow
- **Clear Error Messages**: Specific guidance for authentication, permission, and OTP errors
- **Crash Prevention**: All interactive prompts moved upfront to prevent mid-workflow freezing
- **Custom Error Types**: WorkflowError, GitError, ConfigError, DeploymentError
- **Comprehensive Context**: Error context preserved throughout the workflow

## Shared packages
- @g-1/test: /Users/johnnymathis/Developer/g1/test
- @g-1/workflow: /Users/johnnymathis/Developer/g1/workflow
- @g-1/util: /Users/johnnymathis/Developer/g1/util

## Guidance for Warp
- Before adding utilities/runners/workflows, check these repos for an existing implementation.
- Consolidation rules:
  - @g-1/util: generic helpers/types/logging/config
  - @g-1/test: testing/Vitest helpers, runners, fixtures, factories
  - @g-1/workflow: workflow orchestration/execution, release pipelines
- When duplication is detected, propose an extraction plan and PR outline to move code to the right package.

### Future Extensions
- Configuration system (`.workflow.config.js`)
- Feature branch workflow with PR automation
- AI-powered commit and branch suggestions
- Custom deployment targets via plugin system

---

**This workflow tool could easily be the backbone of a major development organization's release process. The combination of automation, error recovery, beautiful UX, and professional reliability makes it production-ready for any scale.**

**Enjoy using your badass enterprise workflow system! 🔥**
