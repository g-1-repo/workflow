# Changelog

## [2.19.6] - 2025-10-19

### Other Changes

- chore: commit changes before release


## [2.19.5] - 2025-10-19

### Bug Fixes

- automated lint error fixes
- automated lint error fixes

### Other Changes

- chore: commit changes before release


## [2.19.4] - 2025-10-19

### Other Changes

- chore: commit changes before release


## [2.19.3] - 2025-10-19

### Bug Fixes

- automated lint error fixes


## [2.19.2] - 2025-10-19

### Bug Fixes

- automated lint error fixes
- automated lint error fixes
- resolve linting errors causing GitHub Actions publishing failures


## [2.19.1] - 2025-10-19

### Other Changes

- style: clean up GitHub Actions monitor with minimal styling


## [2.19.0] - 2025-10-19

### Features

- move Cloudflare deployment to post-release prompt

### Bug Fixes

- load CLI version dynamically from package.json

### Other Changes

- chore: commit changes before release


## [2.18.0] - 2025-10-19

### Features

- smart detection of npm publishing workflows

### Bug Fixes

- improve npm workflow detection specificity


## [2.17.4] - 2025-10-19


## [2.17.3] - 2025-10-19

### Other Changes

- chore: commit changes before release


## [2.17.2] - 2025-10-19

### Other Changes

- chore: commit changes before release


## [2.17.1] - 2025-10-19

### Other Changes

- chore: commit changes before release


## [2.17.0] - 2025-10-19

### Features

- improve GitHub Actions monitoring for completed workflows

### Bug Fixes

- use lint:fix in GitHub Actions publish workflow


## [2.16.0] - 2025-10-19

### Features

- add GitHub Actions monitoring prompt after release

### Bug Fixes

- correct GitHub Actions API field usage


## [2.15.1] - 2025-10-19

### Other Changes

- chore: commit changes before release


## [2.15.0] - 2025-10-19

### Features

- remove npm publishing from workflow - handled by GitHub Actions


## [2.13.1] - 2025-10-19

### Bug Fixes

- update import statements from @go-corp/utils to @g-1/util

### Other Changes

- chore: commit changes before release


## [2.13.0] - 2025-10-19

### Features

- add NPM publish workflow and update G1 package config (#16)

### Other Changes

- docs: update branding to G1 and npm scope to @g-1/workflow (#14)
- chore(ci): add GitHub Actions (CI + Release), Dependabot; update repo URLs (#1)


## [2.12.14] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.13] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.12] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.11] - 2025-10-18


## [2.12.10] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.9] - 2025-10-18


## [2.12.8] - 2025-10-18


## [2.12.7] - 2025-10-18


## [2.12.6] - 2025-10-18


## [2.12.5] - 2025-10-18


## [2.12.4] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.3] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.2] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.1] - 2025-10-18

### Other Changes

- chore: commit changes before release


## [2.12.0] - 2025-10-18

### Features

- integrate with consolidated go-utils package

### Other Changes

- chore: commit changes before release


## [2.11.2] - 2025-10-18

### Other Changes

- chore: prepare for v2.11.4 stable release
- final: prepare stable build for GitHub publish


## [2.11.1] - 2025-10-18

### Other Changes

- docs: comprehensive update for v2.11.0 stable release


## [2.11.0] - 2025-10-18

### Bug Fixes

- resolve linting issue with unused variable for stable release
- clean up final syntax issues for stable release


## [2.10.1] - 2025-10-18

### Bug Fixes

- revert to fully interactive npm publish (stdio inherit)


## [2.10.0] - 2025-10-18

### Features

- add automatic Enter key press for npm publish OTP prompts


## [2.9.0] - 2025-10-18

### Features

- enable interactive terminal access for npm publish


## [2.8.2] - 2025-10-18

### Bug Fixes

- improve npm publish to prevent interactive prompts and handle auth failures

### Other Changes

- chore: commit changes before release


## [2.8.1] - 2025-10-18

### Other Changes

- simplify: remove authentication checks and OTP handling from upfront configuration


## [2.8.0] - 2025-10-18

### Features

- add upfront uncommitted changes handling to prevent crashes
- comprehensive OTP handling for npm publish to prevent freezing

### Other Changes

- chore: commit changes before release


## [2.7.0] - 2025-10-18

### Features

- add immediate authentication verification after deployment selection


## [2.6.1] - 2025-10-18


## [2.6.0] - 2025-10-18

### Features

- add authentication verification and improve npm publish to prevent freezing

### Bug Fixes

- clean up TypeScript errors in authentication verification


## [2.5.2] - 2025-10-18


## [2.5.1] - 2025-10-18

### Other Changes

- cleanup: fix linting issues and code quality for stable release


## [2.5.0] - 2025-10-18

### Features

- move interactive deployment prompts to beginning of workflow - ask questions before quality gates

### Bug Fixes

- clean up duplicate deployment configuration code
- correct enquirer import syntax for interactive prompts


## [2.4.3] - 2025-10-18

### Bug Fixes

- clean up syntax errors in deployment configuration
- add interactive deployment prompts using enquirer


## [2.4.2] - 2025-10-18

### Bug Fixes

- make deployments safe by default - skip all unless explicitly enabled via CLI flags


## [2.4.1] - 2025-10-18


## [2.4.0] - 2025-10-18

### Features

- intelligent deployment configuration - auto-detect and configure based on available options


## [2.3.8] - 2025-10-18


## [2.3.7] - 2025-10-18


## [2.3.6] - 2025-10-18


## [2.3.5] - 2025-10-18

### Bug Fixes

- make deployment failures non-fatal

### Other Changes

- test: add change to test graceful npm failure


## [2.3.4] - 2025-10-18

### Other Changes

- test: add change to test successful release


## [2.3.3] - 2025-10-18

### Bug Fixes

- replace interactive deployment prompt with clear CLI-based options

### Other Changes

- test: add change to test deployment prompt fix


## [2.3.2] - 2025-10-18

### Bug Fixes

- correct non-interactive deployment configuration logic

### Other Changes

- test: add change to test non-interactive deployment fix


## [2.3.1] - 2025-10-18

### Bug Fixes

- replace problematic interactive prompts with clear error messages
- improve non-interactive mode deployment behavior


## [2.3.0] - 2025-10-18

### Features

- add interactive deployment configuration

### Other Changes

- test: add test change for interactive workflow demo


## [2.2.1] - 2025-10-18


## [2.2.0] - 2025-10-18

### Features

- add interactive prompt for uncommitted changes


## [2.1.1] - 2025-10-18


## [2.1.0] - 2025-10-18

### Features

- improve test handling and error reporting in release workflow

### Bug Fixes

- improve version detection to use latest git tag
- improve error propagation and test failure handling

### Other Changes

- chore: release v0.1.0
- chore: release v0.1.0


## [0.1.0] - 2025-10-18

### Features

- improve test handling and error reporting in release workflow

### Bug Fixes

- improve error propagation and test failure handling

### Other Changes

- chore: release v0.1.0


## [0.1.0] - 2025-10-18

### Features

- improve test handling and error reporting in release workflow


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.1] - 2024-10-18

### 🚀 Bun-First Updates

- **Prefer bun**: All commands now try bun first, then fallback to npm
- **Package Manager**: Updated default package manager preference to bun
- **Installation**: README now shows bun as the recommended installation method
- **Workflow**: Release workflow uses `bun run`, `bun test`, `bun publish` by default
- **Documentation**: Updated all examples to show bun-first approach

## [2.0.0] - 2024-10-18

### ✨ Major Release - Complete Rewrite

**@go-corp/workflow V2** is a ground-up rewrite focused on enterprise needs, performance, and developer experience.

### Features

- **🎯 Native listr2 Integration**: Beautiful, hierarchical progress indicators
- **🏢 Enterprise Task Engine**: Type-safe, extensible workflow orchestration  
- **📋 Complete Release Pipeline**: Quality gates → Git → Cloudflare → npm
- **🔧 Smart Git Operations**: Branch management, PR automation, cleanup
- **⚡ Performance Optimized**: Lazy loading, minimal startup time
- **🧠 AI-Ready Architecture**: Hooks for intelligent suggestions
- **📦 Zero Configuration**: Works out of the box with sensible defaults

### Architecture

- **Core**: Clean separation between task engine, workflows, and integrations
- **Workflows**: Declarative workflow definitions with full type safety
- **Git Store**: Comprehensive Git operations with AI suggestion hooks
- **Error Handling**: Robust error recovery and user-friendly messages
- **Extensibility**: Plugin system ready for custom integrations

### Commands

- `workflow release` - Complete release automation
- `workflow status` - Project and workflow status
- `workflow feature` - Branch management (coming soon)

### Breaking Changes

- **Package Name**: Changed from `@golive_me/go-workflow` to `@go-corp/workflow`
- **Architecture**: Complete API rewrite - not backward compatible with V1
- **Node.js**: Requires Node.js >= 18.0.0
- **TypeScript**: Full TypeScript rewrite with strict typing

### Migration from V1

V2 is a complete rewrite and is not backward compatible. See the [Migration Guide](docs/MIGRATION.md) for assistance upgrading from V1.

### Performance

- 🚀 **50% faster startup** compared to V1
- 🧠 **Lazy loading** of heavy dependencies  
- ⚡ **Optimized execution** with parallel processing where safe
- 📦 **Smaller bundle size** with better tree-shaking

---

**V2 represents our commitment to providing enterprise-grade release automation for modern development teams.**