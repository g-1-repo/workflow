/**
 * Complete Release Workflow - Git → Cloudflare → npm
 */

import type { ReleaseOptions, WorkflowStep } from '../types/index.js'
import process from 'node:process'
import { createGitOperations } from '@go-corp/utils/node'
import { execa } from 'execa'
import * as semver from 'semver'

// Detection functions
async function detectCloudflareSetup(): Promise<boolean> {
  try {
    const fs = await import('node:fs/promises')
    // Check for wrangler.toml or wrangler.json
    try {
      await fs.access('wrangler.toml')
      return true
    }
    catch {
      try {
        await fs.access('wrangler.json')
        return true
      }
      catch {
        return false
      }
    }
  }
  catch {
    return false
  }
}

async function detectNpmSetup(): Promise<boolean> {
  try {
    const fs = await import('node:fs/promises')
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
    // Check if it's a publishable package (has name and not private)
    return !!(packageJson.name && !packageJson.private)
  }
  catch {
    return false
  }
}

export async function createReleaseWorkflow(options: ReleaseOptions = {}): Promise<WorkflowStep[]> {
  // Interactive deployment configuration - ask questions upfront
  if (!options.nonInteractive && (options.skipCloudflare === undefined || options.skipNpm === undefined)) {
    process.stdout.write('\n')
    process.stdout.write('╔══════════════════════════════════════════════════════════════╗\n')
    process.stdout.write('║                 DEPLOYMENT CONFIGURATION                 ║\n')
    process.stdout.write('╚══════════════════════════════════════════════════════════════╝\n')
    process.stdout.write('\n')

    const hasCloudflare = await detectCloudflareSetup()
    const hasNpmSetup = await detectNpmSetup()

    if (hasNpmSetup && options.skipNpm === undefined) {
      process.stdout.write('\x1B[1m\x1B[36m→ npm Publishing Configuration\x1B[0m\n')
      process.stdout.write('  Configure npm registry publishing for this release\n')
      process.stdout.write('\n')

      const enquirer = await import('enquirer')
      const response = await enquirer.default.prompt({
        type: 'confirm',
        name: 'publishToNpm',
        message: '  Publish to npm registry?',
        initial: false,
        prefix: '  ',
      }) as { publishToNpm: boolean }

      options.skipNpm = !response.publishToNpm
      process.stdout.write('\n')
    }

    if (hasCloudflare && options.skipCloudflare === undefined) {
      process.stdout.write('\x1B[1m\x1B[36m→ Cloudflare Deployment Configuration\x1B[0m\n')
      process.stdout.write('  Configure Cloudflare Workers deployment for this release\n')
      process.stdout.write('\n')

      const enquirer = await import('enquirer')
      const response = await enquirer.default.prompt({
        type: 'confirm',
        name: 'deployToCloudflare',
        message: '  Deploy to Cloudflare?',
        initial: false,
        prefix: '  ',
      }) as { deployToCloudflare: boolean }

      options.skipCloudflare = !response.deployToCloudflare
      process.stdout.write('\n')
    }

    // Set defaults for anything not detected
    if (options.skipCloudflare === undefined)
      options.skipCloudflare = true
    if (options.skipNpm === undefined)
      options.skipNpm = true

    // Show configuration summary
    process.stdout.write('\x1B[2m────────────────────────────────────────────────────────────────\x1B[0m\n')
    process.stdout.write('\x1B[1mConfiguration Summary:\x1B[0m\n')
    process.stdout.write(`  npm Publishing: ${options.skipNpm ? '\x1B[31mSkipped\x1B[0m' : '\x1B[32mEnabled\x1B[0m'}\n`)
    process.stdout.write(`  Cloudflare Deploy: ${options.skipCloudflare ? '\x1B[31mSkipped\x1B[0m' : '\x1B[32mEnabled\x1B[0m'}\n`)
    process.stdout.write('\n')
  }

  // Handle uncommitted changes upfront (before workflow starts)
  if (!options.force) {
    const git = createGitOperations()
    const hasChanges = await git.hasUncommittedChanges()

    if (hasChanges) {
      const changedFiles = await git.getChangedFiles()
      const changesList = changedFiles.map(file => `    ${file}`).join('\n')

      process.stdout.write('\n')
      process.stdout.write('╔══════════════════════════════════════════════════════════════╗\n')
      process.stdout.write('║                  UNCOMMITTED CHANGES                  ║\n')
      process.stdout.write('╚══════════════════════════════════════════════════════════════╝\n')
      process.stdout.write('\n')
      process.stdout.write('\x1B[1m\x1B[33mThe following files have uncommitted changes:\x1B[0m\n')
      process.stdout.write(`\n${changesList}\n\n`)
      process.stdout.write('\x1B[2m────────────────────────────────────────────────────────────────\x1B[0m\n')
      process.stdout.write('\x1B[1mHow would you like to proceed?\x1B[0m\n')
      process.stdout.write('\n')

      if (!options.nonInteractive) {
        const enquirer = await import('enquirer')
        const response = await enquirer.default.prompt({
          type: 'select',
          name: 'action',
          message: '  Choose an action:',
          choices: [
            { name: 'commit', message: 'Commit all changes now', value: 'commit' },
            { name: 'stash', message: 'Stash changes for later', value: 'stash' },
            { name: 'force', message: 'Continue anyway (--force)', value: 'force' },
          ],
          prefix: '  ',
        }) as { action: 'commit' | 'stash' | 'force' }

        process.stdout.write('\n')

        if (response.action === 'commit') {
          process.stdout.write('\x1B[1m\x1B[36m→ Commit Configuration\x1B[0m\n')
          process.stdout.write('  Enter a commit message for these changes\n')
          process.stdout.write('\n')

          // Get commit message
          const commitResponse = await enquirer.default.prompt({
            type: 'input',
            name: 'message',
            message: '  Commit message:',
            initial: 'chore: commit changes before release',
            prefix: '  ',
          }) as { message: string }

          // Commit changes
          process.stdout.write('\n\x1B[2mCommitting changes...\x1B[0m\n')
          await git.stageFiles(changedFiles)
          await git.commit(commitResponse.message)
          process.stdout.write('\x1B[32m✅ Changes committed successfully\x1B[0m\n')
        }
        else if (response.action === 'stash') {
          process.stdout.write('\x1B[2mStashing changes...\x1B[0m\n')
          await execa('git', ['stash', 'push', '-m', 'Pre-release stash'], { stdio: 'pipe' })
          process.stdout.write('\x1B[32m✅ Changes stashed successfully\x1B[0m\n')
        }
        else if (response.action === 'force') {
          options.force = true
          process.stdout.write('\x1B[33m⚠️  Continuing with uncommitted changes\x1B[0m\n')
        }

        process.stdout.write('\n')
      }
      else {
        // Non-interactive mode - just show error and exit
        process.stdout.write('❌ Cannot proceed with uncommitted changes in non-interactive mode\n')
        process.stdout.write('Use --force flag to override or commit/stash changes first\n')
        process.exit(1)
      }
    }
  }

  // Set defaults for non-interactive mode
  if (options.nonInteractive && options.skipCloudflare === undefined && options.skipNpm === undefined) {
    options.skipCloudflare = true
    options.skipNpm = true
  }

  return [
    // Quality Gates
    {
      title: 'Quality Gates',
      subtasks: [
        {
          title: 'Auto-fix linting issues',
          skip: () => options.skipLint || false,
          task: async (ctx, helpers) => {
            helpers.setOutput('Running lint with auto-fix...')

            try {
              await execa('bun', ['run', 'lint:fix'], { stdio: 'pipe' })
              helpers.setTitle('Auto-fix linting issues - ✅ Fixed')
            }
            catch {
              // Try npm fallback
              try {
                await execa('npm', ['run', 'lint:fix'], { stdio: 'pipe' })
                helpers.setTitle('Auto-fix linting issues - ✅ Fixed with npm')
              }
              catch {
                // Try direct eslint
                try {
                  await execa('bunx', ['eslint', '.', '--fix'], { stdio: 'pipe' })
                  helpers.setTitle('Auto-fix linting issues - ✅ Fixed with bunx')
                }
                catch {
                  helpers.setTitle('Auto-fix linting issues - ⚠️ No lint command found')
                }
              }
            }
          },
        },
        {
          title: 'Type checking',
          task: async (ctx, helpers) => {
            helpers.setOutput('Running TypeScript type checking...')

            try {
              await execa('bun', ['run', 'typecheck'], { stdio: 'pipe' })
              helpers.setTitle('Type checking - ✅ Passed')
            }
            catch {
              try {
                await execa('npm', ['run', 'typecheck'], { stdio: 'pipe' })
                helpers.setTitle('Type checking - ✅ Passed with npm')
              }
              catch {
                try {
                  await execa('bunx', ['tsc', '--noEmit'], { stdio: 'pipe' })
                  helpers.setTitle('Type checking - ✅ Passed with bunx')
                }
                catch {
                  throw new Error('TypeScript errors found. Please fix before releasing.')
                }
              }
            }
          },
        },
        {
          title: 'Running tests',
          skip: () => options.skipTests || false,
          task: async (ctx, helpers) => {
            helpers.setOutput('Executing test suite...')

            // Define test command priority order
            const testCommands: Array<[string, string[]]> = [
              ['bun', ['run', 'test:ci']], // CI test command (preferred)
              ['bun', ['run', 'test']], // Standard test command
              ['bun', ['test']], // Direct bun test
              ['npm', ['run', 'test:ci']], // npm CI fallback
              ['npm', ['run', 'test']], // npm standard fallback
              ['npm', ['test']], // npm direct fallback
            ]

            let lastError: any = null

            for (const [command, args] of testCommands) {
              try {
                helpers.setOutput(`Trying ${command} ${args.join(' ')}...`)
                const _result = await execa(command, args, { stdio: 'pipe' })
                ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
                helpers.setTitle(`Running tests - ✅ All tests passed (${command})`)
                return // Success! Exit early
              }
              catch (error) {
                const errorOutput = error instanceof Error ? error.message : String(error)

                // Check if it's a "no tests found" or "script not found" error
                if (errorOutput.includes('No tests found')
                  || errorOutput.includes('no test files')
                  || errorOutput.includes('script not found')
                  || errorOutput.includes('Missing script')) {
                  // Try next command
                  lastError = error
                  continue
                }

                // If it's a real test failure (not a missing script), stop trying
                if (errorOutput.includes('fail') || errorOutput.includes('Test')) {
                  const lines = errorOutput.split('\n')
                  const summary = lines.find(line => line.includes('fail')) || 'Tests failed'
                  ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: false }
                  throw new Error(`Test failures detected: ${summary}`)
                }

                // Store error and try next command
                lastError = error
              }
            }

            // If we get here, all commands failed - check if it's because no tests exist
            const lastErrorOutput = lastError instanceof Error ? lastError.message : String(lastError)
            if (lastErrorOutput.includes('No tests found')
              || lastErrorOutput.includes('no test files')
              || lastErrorOutput.includes('script not found')
              || lastErrorOutput.includes('Missing script')) {
              ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: true }
              helpers.setTitle('Running tests - ✅ No tests found (skipping)')
              return
            }

            // Real test failure
            ctx.quality = { lintPassed: ctx.quality?.lintPassed ?? true, testsPassed: false }
            throw new Error(`Tests failed: ${lastErrorOutput}`)
          },
        },
      ],
    },

    // Git Operations
    {
      title: 'Git repository analysis',
      task: async (ctx, helpers) => {
        helpers.setOutput('Initializing Git operations...')
        const git = createGitOperations()

        helpers.setOutput('Checking repository status...')
        const isRepo = await git.isGitRepository()
        if (!isRepo) {
          throw new Error('Not a Git repository')
        }

        helpers.setOutput('Getting current branch and version...')
        const currentBranch = await git.getCurrentBranch()
        const currentVersion = await git.getCurrentVersion()
        const repository = await git.getRepositoryName()

        // Uncommitted changes are now handled upfront before workflow starts
        const hasChanges = await git.hasUncommittedChanges()
        if (hasChanges && options.force) {
          helpers.setOutput('⚠️  Uncommitted changes detected but continuing due to --force flag')
        }

        // Store git info in context
        ctx.git = {
          branch: currentBranch,
          hasChanges,
          commits: [],
          remote: 'origin',
          repository,
        }

        ctx.version = {
          current: currentVersion,
          next: '', // Will be calculated next
          type: options.type || 'patch',
          strategy: 'semantic',
        }

        helpers.setTitle(`Git repository analysis - ✅ ${repository} on ${currentBranch}`)
      },
    },

    // Version Analysis
    {
      title: 'Version calculation',
      task: async (ctx, helpers) => {
        const git = createGitOperations()

        helpers.setOutput('Analyzing commits since last release...')
        const commits = await git.getCommitsSinceTag()
        ctx.git!.commits = commits

        let versionBump = options.type || 'patch'

        if (!options.type) {
          helpers.setOutput('Determining semantic version bump...')

          // Analyze commits for version bump
          const hasBreaking = commits.some(c => c.breaking)
          const hasFeatures = commits.some(c => c.type === 'feat')

          if (hasBreaking) {
            versionBump = 'major'
          }
          else if (hasFeatures) {
            versionBump = 'minor'
          }
          else {
            versionBump = 'patch'
          }
        }

        const nextVersion = semver.inc(ctx.version!.current, versionBump)
        if (!nextVersion) {
          throw new Error(`Failed to calculate next version from ${ctx.version!.current}`)
        }

        ctx.version!.next = nextVersion
        ctx.version!.type = versionBump

        helpers.setTitle(`Version calculation - ✅ ${ctx.version!.current} → ${nextVersion} (${versionBump})`)
      },
    },

    // Deployment Summary (options were configured at the beginning)
    {
      title: 'Deployment configuration',
      task: async (ctx, helpers) => {
        const enabledTargets = []

        if (!options.skipCloudflare)
          enabledTargets.push('Cloudflare')
        if (!options.skipNpm)
          enabledTargets.push('npm')

        const summary = enabledTargets.length > 0
          ? `Will deploy to: ${enabledTargets.join(', ')}`
          : 'All deployments skipped'

        helpers.setTitle(`Deployment configuration - ✅ ${summary}`)
      },
    },

    // Release Execution
    {
      title: 'Release execution',
      subtasks: [
        {
          title: 'Update package.json version',
          task: async (ctx, helpers) => {
            const git = createGitOperations()
            helpers.setOutput(`Setting version to ${ctx.version!.next}...`)

            await git.updatePackageVersion(ctx.version!.next)
            helpers.setTitle(`Update package.json version - ✅ ${ctx.version!.next}`)
          },
        },
        {
          title: 'Generate changelog',
          task: async (ctx, helpers) => {
            helpers.setOutput('Generating changelog entry...')

            // Simple changelog generation - can be enhanced
            const fs = await import('node:fs/promises')
            const changelogPath = 'CHANGELOG.md'

            const changelogEntry = generateChangelogEntry(
              ctx.version!.next,
              ctx.git!.commits,
            )

            try {
              const existingChangelog = await fs.readFile(changelogPath, 'utf-8')
              const updatedChangelog = insertChangelogEntry(existingChangelog, changelogEntry)
              await fs.writeFile(changelogPath, updatedChangelog)
            }
            catch {
              // Create new changelog
              const newChangelog = `# Changelog\n\n${changelogEntry}`
              await fs.writeFile(changelogPath, newChangelog)
            }

            helpers.setTitle('Generate changelog - ✅ CHANGELOG.md updated')
          },
        },
        {
          title: 'Commit release changes',
          task: async (ctx, helpers) => {
            const git = createGitOperations()

            helpers.setOutput('Staging files...')
            await git.stageFiles(['package.json', 'CHANGELOG.md'])

            helpers.setOutput('Creating release commit...')
            const commitMessage = `chore: release v${ctx.version!.next}`
            await git.commit(commitMessage)

            helpers.setTitle(`Commit release changes - ✅ ${commitMessage}`)
          },
        },
        {
          title: 'Create git tag',
          task: async (ctx, helpers) => {
            const git = createGitOperations()
            const tagName = `v${ctx.version!.next}`

            helpers.setOutput(`Creating tag ${tagName}...`)
            await git.createTag(tagName, `Release ${ctx.version!.next}`)

            helpers.setTitle(`Create git tag - ✅ ${tagName}`)
          },
        },
        {
          title: 'Push to remote',
          task: async (ctx, helpers) => {
            const git = createGitOperations()

            helpers.setOutput('Pushing commits...')
            await git.push()

            helpers.setOutput('Pushing tags...')
            await git.pushTags()

            helpers.setTitle('Push to remote - ✅ Complete')
          },
        },
      ],
    },

    // Build for deployment
    {
      title: 'Build project',
      task: async (ctx, helpers) => {
        helpers.setOutput('Building project for deployment...')

        const buildCommands: Array<[string, string[]]> = [
          ['bun', ['run', 'build']],
          ['npm', ['run', 'build']],
        ]

        let lastError: any = null

        for (const [command, args] of buildCommands) {
          try {
            helpers.setOutput(`Trying ${command} ${args.join(' ')}...`)
            await execa(command, args, { stdio: 'pipe' })
            helpers.setTitle(`Build project - ✅ Build complete (${command})`)
            return // Success! Exit early
          }
          catch (error) {
            const errorOutput = error instanceof Error ? error.message : String(error)

            // Check if it's a missing script error
            if (errorOutput.includes('script not found')
              || errorOutput.includes('Missing script')
              || errorOutput.includes('npm ERR! missing script')
              || errorOutput.includes('Script not found')) {
              lastError = error
              continue
            }

            // Real build error - don't continue
            throw new Error(`Build failed: ${errorOutput}`)
          }
        }

        // If we get here, build script wasn't found - that's okay for some projects
        if (lastError) {
          const lastErrorOutput = lastError instanceof Error ? lastError.message : String(lastError)
          if (lastErrorOutput.includes('script not found')
            || lastErrorOutput.includes('Missing script')
            || lastErrorOutput.includes('npm ERR! missing script')
            || lastErrorOutput.includes('Script not found')) {
            helpers.setTitle('Build project - ✅ No build script found (skipping)')
            return
          }
        }

        throw new Error('Build failed. Cannot proceed with deployment.')
      },
    },

    // Cloudflare Deployment
    {
      title: 'Deploy to Cloudflare',
      skip: () => options.skipCloudflare || false,
      task: async (ctx, helpers) => {
        helpers.setOutput('Deploying to Cloudflare...')

        try {
          const result = await execa('npx', ['wrangler', 'deploy'], { stdio: 'pipe' })

          // Extract deployment URL from output
          const output = result.stdout
          const urlMatch = output.match(/https?:\/\/\S+/)
          const deploymentUrl = urlMatch?.[0] || 'Deployed successfully'

          ctx.deployments = {
            ...ctx.deployments,
            cloudflare: {
              environment: 'production',
            },
          }

          helpers.setTitle(`Deploy to Cloudflare - ✅ ${deploymentUrl}`)
        }
        catch (error) {
          // Don't fail the entire workflow if Cloudflare deployment fails
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (errorMessage.includes('Missing entry-point')) {
            helpers.setTitle('Deploy to Cloudflare - ⚠️ Failed: No wrangler config (continuing)')
          }
          else if (errorMessage.includes('not authenticated')) {
            helpers.setTitle('Deploy to Cloudflare - ⚠️ Failed: Not authenticated (continuing)')
          }
          else {
            helpers.setTitle('Deploy to Cloudflare - ⚠️ Failed (continuing)')
          }
        }
      },
    },

    // npm Publishing
    {
      title: 'Publish to npm',
      skip: () => options.skipNpm || false,
      task: async (ctx, helpers) => {
        helpers.setOutput('Publishing to npm registry...')

        try {
          // Use npm publish with terminal access for interactive prompts (OTP, etc.)
          helpers.setOutput('Publishing to npm... (you may need to interact with prompts)')

          const _publishResult = await execa('npm', [
            'publish',
            '--access',
            'public',
            '--registry',
            'https://registry.npmjs.org/',
            '--no-git-checks',
          ], {
            stdio: 'inherit', // Allow full terminal interaction
            timeout: 120000, // 2 minute timeout for interactive prompts
            env: {
              ...process.env,
              NPM_CONFIG_AUDIT: 'false',
              NPM_CONFIG_FUND: 'false',
              NPM_CONFIG_UPDATE_NOTIFIER: 'false',
              // Removed CI=true to allow interactive prompts
            },
          })

          ctx.deployments = {
            ...ctx.deployments,
            npm: {
              registry: 'https://registry.npmjs.org',
              tag: 'latest',
              access: 'public',
            },
          }

          helpers.setTitle(`Publish to npm - ✅ v${ctx.version!.next} published`)
        }
        catch (error) {
          // Don't fail the entire workflow if npm publishing fails
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorOutput = error instanceof Error && 'stderr' in error ? error.stderr : ''
          const fullError = `${errorMessage} ${errorOutput}`.toLowerCase()

          if (fullError.includes('401') || fullError.includes('not authenticated') || fullError.includes('login')) {
            helpers.setTitle('Publish to npm - ⚠️ Failed: Authentication required')
            helpers.setOutput('❌ Please run: npm login')
          }
          else if (fullError.includes('403') || fullError.includes('forbidden') || fullError.includes('permission')) {
            helpers.setTitle('Publish to npm - ⚠️ Failed: No permission to publish')
            helpers.setOutput('❌ Check package name and access rights')
          }
          else if (fullError.includes('otp') || fullError.includes('one-time') || fullError.includes('two-factor')) {
            helpers.setTitle('Publish to npm - ⚠️ Failed: 2FA/OTP required')
            helpers.setOutput('❌ OTP required but cannot be provided in automated workflow')
          }
          else if (fullError.includes('package already exists') || fullError.includes('version already published')) {
            helpers.setTitle('Publish to npm - ⚠️ Failed: Version already published')
            helpers.setOutput('❌ This version already exists on npm')
          }
          else {
            helpers.setTitle('Publish to npm - ⚠️ Failed: Unknown error')
            helpers.setOutput(`❌ Error: ${errorMessage.slice(0, 100)}...`)
          }
        }
      },
    },

    // GitHub Release
    {
      title: 'Create GitHub release',
      task: async (ctx, helpers) => {
        helpers.setOutput('Creating GitHub release...')

        try {
          const releaseNotes = generateReleaseNotes(ctx.git!.commits, ctx.version!.next)

          await execa('gh', [
            'release',
            'create',
            `v${ctx.version!.next}`,
            '--title',
            `Release v${ctx.version!.next}`,
            '--notes',
            releaseNotes,
          ], { stdio: 'pipe' })

          helpers.setTitle(`Create GitHub release - ✅ v${ctx.version!.next} released`)
        }
        catch {
          // Don't fail the entire workflow if GitHub release fails
          helpers.setTitle('Create GitHub release - ⚠️ Failed (continuing)')
        }
      },
    },
  ]
}

// =============================================================================
// Helper Functions
// =============================================================================

function generateChangelogEntry(version: string, commits: any[]): string {
  const date = new Date().toISOString().split('T')[0]
  let entry = `## [${version}] - ${date}\n\n`

  const features = commits.filter(c => c.type === 'feat')
  const fixes = commits.filter(c => c.type === 'fix')
  const others = commits.filter(c => !['feat', 'fix'].includes(c.type))

  if (features.length > 0) {
    entry += '### Features\n\n'
    features.forEach((commit) => {
      entry += `- ${commit.message.replace(/^feat(\([^)]+\))?: /, '')}\n`
    })
    entry += '\n'
  }

  if (fixes.length > 0) {
    entry += '### Bug Fixes\n\n'
    fixes.forEach((commit) => {
      entry += `- ${commit.message.replace(/^fix(\([^)]+\))?: /, '')}\n`
    })
    entry += '\n'
  }

  if (others.length > 0) {
    entry += '### Other Changes\n\n'
    others.forEach((commit) => {
      entry += `- ${commit.message}\n`
    })
    entry += '\n'
  }

  return entry
}

function insertChangelogEntry(existingChangelog: string, newEntry: string): string {
  const lines = existingChangelog.split('\n')
  const headerIndex = lines.findIndex(line => line.startsWith('# '))

  if (headerIndex === -1) {
    return `# Changelog\n\n${newEntry}\n${existingChangelog}`
  }

  // Insert after header
  lines.splice(headerIndex + 2, 0, newEntry)
  return lines.join('\n')
}

function generateReleaseNotes(commits: any[], version: string): string {
  const features = commits.filter(c => c.type === 'feat')
  const fixes = commits.filter(c => c.type === 'fix')

  let notes = `Release v${version}\n\n`

  if (features.length > 0) {
    notes += '## ✨ New Features\n'
    features.forEach((commit) => {
      notes += `- ${commit.message.replace(/^feat(\([^)]+\))?: /, '')}\n`
    })
    notes += '\n'
  }

  if (fixes.length > 0) {
    notes += '## 🐛 Bug Fixes\n'
    fixes.forEach((commit) => {
      notes += `- ${commit.message.replace(/^fix(\([^)]+\))?: /, '')}\n`
    })
    notes += '\n'
  }

  if (commits.length > features.length + fixes.length) {
    const others = commits.length - features.length - fixes.length
    notes += `## 📦 Other Changes\n${others} other commits included in this release.\n\n`
  }

  return notes
}
