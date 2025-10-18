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
- `node dist/cli.js release` - Run the release workflow
- `node dist/cli.js status` - Show workflow status
- `node dist/cli.js feature` - Create feature branch (coming soon)

### Testing Single Components
- `bun test src/core/task-engine.test.ts` - Test the task engine
- `bun test src/workflows/release.test.ts` - Test release workflow
- `bunx vitest run --reporter=verbose` - Detailed test output

## Architecture Overview

### Core System Design
This is an enterprise-grade TypeScript workflow automation tool with a modular architecture:

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

**Enterprise Features**
- Quality gates enforced before any release (lint, typecheck, tests)
- Multi-platform deployment (npm, Cloudflare, GitHub releases)
- Fallback strategy: bun → npm → direct tools (bunx/npx)

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
The automated release workflow (`go-workflow release`) includes:
1. Quality gates (auto-fix lint, typecheck, tests)
2. Git analysis and semantic version calculation
3. Package.json update, changelog generation, git tag creation
4. Build step for deployment
5. Multi-platform publishing (Cloudflare, npm, GitHub releases)

### Error Handling Strategy
- Custom error types: WorkflowError, GitError, ConfigError, DeploymentError
- Graceful degradation (e.g., GitHub release failure doesn't fail entire workflow)
- Comprehensive error context preservation

### Future Extensions
- Configuration system (`.go-workflow.config.js`)
- Feature branch workflow with PR automation
- AI-powered commit and branch suggestions
- Custom deployment targets via plugin system
