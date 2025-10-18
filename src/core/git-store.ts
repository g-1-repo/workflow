/**
 * Git Store - Complete Git operations with AI-powered suggestions
 */

import type { SimpleGit } from 'simple-git'
import type {
  BranchOptions,
  CommitInfo,
  GitError,
  PullRequestOptions,
} from '../types/index.js'
import process from 'node:process'
import { execa } from 'execa'
import { simpleGit } from 'simple-git'

export class GitStore {
  private git: SimpleGit

  constructor(private workingDir: string = process.cwd()) {
    this.git = simpleGit(workingDir)
  }

  // =============================================================================
  // Repository Info
  // =============================================================================

  async isGitRepository(): Promise<boolean> {
    try {
      await this.git.status()
      return true
    }
    catch {
      return false
    }
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.git.status()
      return status.current || 'main'
    }
    catch (error) {
      throw this.createGitError('Failed to get current branch', error)
    }
  }

  async getRemoteUrl(): Promise<string> {
    try {
      const remotes = await this.git.getRemotes(true)
      const origin = remotes.find(remote => remote.name === 'origin')
      return origin?.refs?.push || ''
    }
    catch (error) {
      throw this.createGitError('Failed to get remote URL', error)
    }
  }

  async getRepositoryName(): Promise<string> {
    const remoteUrl = await this.getRemoteUrl()
    const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/)
    return match?.[1] || ''
  }

  // =============================================================================
  // Status & Changes
  // =============================================================================

  async hasUncommittedChanges(): Promise<boolean> {
    try {
      const status = await this.git.status()
      return status.files.length > 0
    }
    catch (error) {
      throw this.createGitError('Failed to check uncommitted changes', error)
    }
  }

  async getChangedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status()
      return status.files.map(file => file.path)
    }
    catch (error) {
      throw this.createGitError('Failed to get changed files', error)
    }
  }

  async getStagedFiles(): Promise<string[]> {
    try {
      const status = await this.git.status()
      return status.staged
    }
    catch (error) {
      throw this.createGitError('Failed to get staged files', error)
    }
  }

  // =============================================================================
  // Commits & History
  // =============================================================================

  async getCommits(since?: string, limit = 50): Promise<CommitInfo[]> {
    try {
      const options = {
        from: since,
        to: 'HEAD',
        maxCount: limit,
      }

      const log = await this.git.log(options)
      return log.all.map(commit => this.parseCommit(commit))
    }
    catch (error) {
      throw this.createGitError('Failed to get commits', error)
    }
  }

  async getCommitsSinceTag(tagPattern = 'v*'): Promise<CommitInfo[]> {
    try {
      // Get latest tag
      const tags = await this.git.tags(['--sort=-version:refname', '--merged'])
      const latestTag = tags.all.find(tag => tag.match(new RegExp(tagPattern.replace('*', '.*'))))

      if (!latestTag) {
        // No tags, get all commits
        return this.getCommits()
      }

      return this.getCommits(latestTag)
    }
    catch (error) {
      throw this.createGitError('Failed to get commits since tag', error)
    }
  }

  private parseCommit(commit: any): CommitInfo {
    const message = commit.message
    const conventionalMatch = message.match(/^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/)

    return {
      hash: commit.hash,
      message: commit.message,
      author: commit.author_name,
      date: new Date(commit.date),
      type: conventionalMatch?.[1] as any,
      scope: conventionalMatch?.[2],
      breaking: !!conventionalMatch?.[3],
    }
  }

  // =============================================================================
  // Branch Management
  // =============================================================================

  async createBranch(options: BranchOptions): Promise<string> {
    try {
      let branchName = options.name

      if (!branchName && options.autoSuggest) {
        branchName = await this.suggestBranchName(options.type)
      }

      if (!branchName) {
        throw new Error('Branch name is required')
      }

      // Format branch name according to convention
      const formattedName = this.formatBranchName(options.type, branchName)

      // Create and checkout branch
      await this.git.checkoutBranch(formattedName, options.baseBranch || 'main')

      return formattedName
    }
    catch (error) {
      throw this.createGitError(`Failed to create ${options.type} branch`, error)
    }
  }

  async switchBranch(branchName: string): Promise<void> {
    try {
      await this.git.checkout(branchName)
    }
    catch (error) {
      throw this.createGitError(`Failed to switch to branch: ${branchName}`, error)
    }
  }

  async deleteBranch(branchName: string, force = false): Promise<void> {
    try {
      const flag = force ? '-D' : '-d'
      await this.git.branch([flag, branchName])
    }
    catch (error) {
      throw this.createGitError(`Failed to delete branch: ${branchName}`, error)
    }
  }

  async getBranches(): Promise<string[]> {
    try {
      const branches = await this.git.branchLocal()
      return branches.all
    }
    catch (error) {
      throw this.createGitError('Failed to get branches', error)
    }
  }

  private formatBranchName(type: string, name: string): string {
    // Remove special characters and spaces
    const cleanName = name.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    return `${type}/${cleanName}`
  }

  // =============================================================================
  // AI-Powered Suggestions
  // =============================================================================

  async suggestBranchName(type: string): Promise<string> {
    try {
      // Get recent commits to understand current work
      const recentCommits = await this.getCommits(undefined, 5)
      const changedFiles = await this.getChangedFiles()

      // For now, create a simple suggestion based on changed files
      // In a real implementation, you'd call your AI service here
      const suggestion = this.generateBranchSuggestion(type, changedFiles, recentCommits)

      return suggestion
    }
    catch {
      // Fallback to timestamp-based name
      return `${type}-${Date.now()}`
    }
  }

  async suggestCommitMessage(): Promise<string> {
    try {
      const changedFiles = await this.getChangedFiles()
      const status = await this.git.status()

      // Simple heuristic-based suggestion
      // In production, integrate with your AI service
      return this.generateCommitSuggestion(changedFiles, status)
    }
    catch {
      return 'chore: update files'
    }
  }

  private generateBranchSuggestion(type: string, files: string[], _commits: CommitInfo[]): string {
    // Simple heuristics - replace with AI call
    if (files.some(f => f.includes('test'))) {
      return 'improve-testing'
    }
    if (files.some(f => f.includes('config'))) {
      return 'update-configuration'
    }
    if (files.some(f => f.includes('README'))) {
      return 'update-documentation'
    }
    return 'feature-enhancement'
  }

  private generateCommitSuggestion(files: string[], _status: any): string {
    // Simple heuristics - replace with AI call
    if (files.some(f => f.includes('test'))) {
      return 'test: improve test coverage'
    }
    if (files.some(f => f.includes('.md'))) {
      return 'docs: update documentation'
    }
    if (files.length === 1) {
      return `feat: update ${files[0]}`
    }
    return `feat: update ${files.length} files`
  }

  // =============================================================================
  // Git Operations
  // =============================================================================

  async stageFiles(files?: string[]): Promise<void> {
    try {
      if (files) {
        await this.git.add(files)
      }
      else {
        await this.git.add('.')
      }
    }
    catch (error) {
      throw this.createGitError('Failed to stage files', error)
    }
  }

  async commit(message: string): Promise<string> {
    try {
      const result = await this.git.commit(message)
      return result.commit
    }
    catch (error) {
      throw this.createGitError('Failed to commit changes', error)
    }
  }

  async push(branch?: string, remote = 'origin'): Promise<void> {
    try {
      const currentBranch = branch || await this.getCurrentBranch()
      await this.git.push(remote, currentBranch)
    }
    catch (error) {
      throw this.createGitError('Failed to push changes', error)
    }
  }

  async createTag(tagName: string, message?: string): Promise<void> {
    try {
      // Check if tag already exists
      const tags = await this.git.tags()
      if (tags.all.includes(tagName)) {
        throw new Error(`Tag ${tagName} already exists. Please use a different version or delete the existing tag.`)
      }

      if (message) {
        await this.git.addAnnotatedTag(tagName, message)
      }
      else {
        await this.git.addTag(tagName)
      }
    }
    catch (error) {
      // If it's our custom error about existing tag, throw it as-is
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error
      }
      throw this.createGitError(`Failed to create tag: ${tagName}`, error)
    }
  }

  async pushTags(remote = 'origin'): Promise<void> {
    try {
      await this.git.pushTags(remote)
    }
    catch (error) {
      throw this.createGitError('Failed to push tags', error)
    }
  }

  // =============================================================================
  // GitHub Integration (via CLI)
  // =============================================================================

  async createPullRequest(options: PullRequestOptions): Promise<string> {
    try {
      const currentBranch = await this.getCurrentBranch()
      const title = options.title || `${currentBranch}: Ready for review`

      const args = [
        'pr',
        'create',
        '--title',
        title,
        '--body',
        options.body || '',
      ]

      if (options.labels?.length) {
        args.push('--label', options.labels.join(','))
      }

      if (options.assignees?.length) {
        args.push('--assignee', options.assignees.join(','))
      }

      if (options.reviewers?.length) {
        args.push('--reviewer', options.reviewers.join(','))
      }

      const result = await execa('gh', args)
      const prUrl = result.stdout.trim()

      // Enable auto-merge if requested
      if (options.autoMerge) {
        await execa('gh', ['pr', 'merge', '--auto', '--squash'])
      }

      return prUrl
    }
    catch (error) {
      throw this.createGitError('Failed to create pull request', error)
    }
  }

  async mergePullRequest(prNumber: string, method = 'squash'): Promise<void> {
    try {
      await execa('gh', ['pr', 'merge', prNumber, `--${method}`])
    }
    catch (error) {
      throw this.createGitError(`Failed to merge PR #${prNumber}`, error)
    }
  }

  async closePullRequest(prNumber: string): Promise<void> {
    try {
      await execa('gh', ['pr', 'close', prNumber])
    }
    catch (error) {
      throw this.createGitError(`Failed to close PR #${prNumber}`, error)
    }
  }

  // =============================================================================
  // Version Management
  // =============================================================================

  async getCurrentVersion(): Promise<string> {
    try {
      // First try to get version from latest git tag
      const tags = await this.git.tags(['--sort=-version:refname', '--merged'])
      const latestTag = tags.all.find(tag => tag.match(/^v?\d+\.\d+\.\d+/))

      if (latestTag) {
        // Remove 'v' prefix if present
        return latestTag.replace(/^v/, '')
      }

      // Fallback to package.json
      const packageJson = await import(`${this.workingDir}/package.json`, {
        assert: { type: 'json' },
      })
      return packageJson.default.version || '0.0.0'
    }
    catch {
      return '0.0.0'
    }
  }

  async updatePackageVersion(newVersion: string): Promise<void> {
    try {
      const fs = await import('node:fs/promises')
      const packagePath = `${this.workingDir}/package.json`
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'))

      packageJson.version = newVersion
      await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
    }
    catch (error) {
      throw this.createGitError('Failed to update package version', error)
    }
  }

  // =============================================================================
  // Cleanup Operations
  // =============================================================================

  async cleanupFeatureBranch(branchName: string, deleteBranch = true): Promise<void> {
    try {
      // Switch to main branch
      await this.switchBranch('main')

      // Pull latest changes
      await this.git.pull('origin', 'main')

      // Delete feature branch if requested
      if (deleteBranch) {
        await this.deleteBranch(branchName)

        // Delete remote branch
        try {
          await this.git.push('origin', branchName, ['--delete'])
        }
        catch {
          // Ignore if remote branch doesn't exist
        }
      }
    }
    catch (error) {
      throw this.createGitError(`Failed to cleanup branch: ${branchName}`, error)
    }
  }

  // =============================================================================
  // Utilities
  // =============================================================================

  private createGitError(message: string, error: unknown): GitError {
    const gitError: GitError = {
      name: 'GitError',
      message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
      code: 'GIT_ERROR',
    }
    return gitError
  }
}

/**
 * Factory function
 */
export function createGitStore(workingDir?: string): GitStore {
  return new GitStore(workingDir)
}
