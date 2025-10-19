/**
 * Complete Workflow System Types
 */

import type { ListrRenderer } from 'listr2'

// =============================================================================
// Core Workflow Types
// =============================================================================

export interface WorkflowContext {
  // Project info
  project?: {
    name: string
    version: string
    type: 'library' | 'cli' | 'web-app' | 'api'
  }

  // Git state
  git?: {
    branch: string
    hasChanges: boolean
    commits: CommitInfo[]
    remote: string
    repository: string
  }

  // Version management
  version?: {
    current: string
    next: string
    type: 'patch' | 'minor' | 'major'
    strategy: 'semantic' | 'manual'
  }

  // Deployment targets
  deployments?: {
    cloudflare?: CloudflareDeployment
    npm?: NpmDeployment
    custom?: CustomDeployment[]
  }

  // Quality gates
  quality?: {
    lintPassed: boolean
    testsPassed: boolean
    coverageThreshold?: number
  }

  // AI suggestions
  ai?: {
    suggestedBranchName?: string
    suggestedCommitMessage?: string
    suggestedReleaseNotes?: string
  }

  // User data (extensible)
  [key: string]: unknown
}

export interface WorkflowStep {
  title: string
  task?: (ctx: WorkflowContext, helpers: TaskHelpers) => Promise<void> | void
  subtasks?: WorkflowStep[]
  enabled?: boolean | ((ctx: WorkflowContext) => boolean)
  skip?: boolean | string | ((ctx: WorkflowContext) => boolean | string | Promise<boolean | string>)
  retry?: number
  concurrent?: boolean
}

export interface TaskHelpers {
  setOutput: (output: string) => void
  setTitle: (title: string) => void
  setProgress: (current: number, total?: number) => void
}

// =============================================================================
// Git Workflow Types
// =============================================================================

export interface CommitInfo {
  hash: string
  message: string
  author: string
  date: Date
  type?: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore'
  scope?: string
  breaking?: boolean
}

export interface BranchOptions {
  type: 'feature' | 'bugfix' | 'hotfix' | 'release'
  name?: string
  baseBranch?: string
  autoSuggest?: boolean
}

export interface PullRequestOptions {
  title?: string
  body?: string
  labels?: string[]
  assignees?: string[]
  reviewers?: string[]
  autoMerge?: boolean
  deleteBranch?: boolean
}

// =============================================================================
// Deployment Types
// =============================================================================

export interface CloudflareDeployment {
  accountId?: string
  projectName?: string
  environment?: 'production' | 'preview'
  buildCommand?: string
  outputDir?: string
  environmentVars?: Record<string, string>
}

export interface NpmDeployment {
  registry?: string
  tag?: string
  access?: 'public' | 'restricted'
  otp?: string
  provenance?: boolean
}

export interface CustomDeployment {
  name: string
  command: string
  env?: Record<string, string>
  cwd?: string
  timeout?: number
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface WorkflowConfig {
  // Project settings
  project: {
    name: string
    type: 'library' | 'cli' | 'web-app' | 'api'
    packageManager: 'bun' | 'npm' | 'yarn' | 'pnpm'
  }

  // Git settings
  git: {
    defaultBranch: string
    remote: string
    branchNaming: {
      feature: string // e.g., "feature/{name}"
      bugfix: string // e.g., "bugfix/{name}"
      hotfix: string // e.g., "hotfix/{name}"
    }
    autoCleanup: boolean
  }

  // Quality gates
  quality: {
    lint: {
      enabled: boolean
      autoFix: boolean
      command?: string
    }
    test: {
      enabled: boolean
      command?: string
      coverage?: {
        enabled: boolean
        threshold: number
      }
    }
    typecheck: {
      enabled: boolean
      command?: string
    }
  }

  // Deployment targets
  deployments: {
    npm?: {
      enabled: boolean
      registry?: string
      tag?: string
      access?: 'public' | 'restricted'
      skipTests?: boolean
    }
    cloudflare?: {
      enabled: boolean
      accountId?: string
      projectName?: string
      buildCommand?: string
      outputDir?: string
    }
    custom?: CustomDeployment[]
  }

  // GitHub integration
  github?: {
    enabled: boolean
    autoRelease: boolean
    pullRequests: {
      autoMerge: boolean
      deleteBranch: boolean
      defaultLabels: string[]
    }
  }

  // AI features
  ai?: {
    enabled: boolean
    provider?: 'openai' | 'anthropic' | 'local'
    suggestBranchNames: boolean
    suggestCommitMessages: boolean
    generateReleaseNotes: boolean
  }

  // Workflow customization
  workflows?: {
    release?: string[] // Custom workflow steps
    feature?: string[] // Feature branch workflow
    hotfix?: string[] // Hotfix workflow
  }
}

// =============================================================================
// Task Engine Types
// =============================================================================

export interface TaskEngineOptions {
  renderer?: ListrRenderer
  concurrent?: boolean
  exitOnError?: boolean
  showTimer?: boolean
  clearOutput?: boolean
  autoRecovery?: boolean
}

// =============================================================================
// Plugin System Types
// =============================================================================

export interface Plugin {
  name: string
  version: string
  description?: string
  install: (context: PluginContext) => void | Promise<void>
  uninstall?: () => void | Promise<void>
}

export interface PluginContext {
  registerWorkflow: (name: string, steps: WorkflowStep[]) => void
  registerCommand: (name: string, handler: CommandHandler) => void
  registerHook: (event: WorkflowEvent, handler: HookHandler) => void
  getConfig: () => WorkflowConfig
  getContext: () => WorkflowContext
}

export type CommandHandler = (args: string[], context: WorkflowContext) => Promise<void>
export type HookHandler = (context: WorkflowContext) => Promise<void> | void

export type WorkflowEvent
  = | 'before:workflow'
    | 'after:workflow'
    | 'before:step'
    | 'after:step'
    | 'on:error'

// =============================================================================
// CLI Types
// =============================================================================

export interface CliOptions {
  verbose?: boolean
  debug?: boolean
  dryRun?: boolean
  interactive?: boolean
  config?: string
}

export interface ReleaseOptions extends CliOptions {
  type?: 'patch' | 'minor' | 'major'
  tag?: string
  skipTests?: boolean
  skipLint?: boolean
  skipCloudflare?: boolean
  force?: boolean
  nonInteractive?: boolean
}

export interface FeatureOptions extends CliOptions {
  name?: string
  type?: 'feature' | 'bugfix' | 'hotfix'
  baseBranch?: string
  autoMerge?: boolean
}

// =============================================================================
// Error Types
// =============================================================================

export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: WorkflowContext,
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export class ConfigError extends WorkflowError {
  constructor(message: string, context?: WorkflowContext) {
    super(message, 'CONFIG_ERROR', context)
    this.name = 'ConfigError'
  }
}

export class GitError extends WorkflowError {
  constructor(message: string, context?: WorkflowContext) {
    super(message, 'GIT_ERROR', context)
    this.name = 'GitError'
  }
}

export class DeploymentError extends WorkflowError {
  constructor(message: string, public readonly target: string, context?: WorkflowContext) {
    super(message, 'DEPLOYMENT_ERROR', context)
    this.name = 'DeploymentError'
  }
}
