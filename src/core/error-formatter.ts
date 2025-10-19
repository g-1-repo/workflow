/**
 * Error Formatting Utility - Enhanced error styling for workflow failures
 */

import chalk from 'chalk'

export interface FormattedError {
  message: string
  type: 'critical' | 'warning' | 'info'
  context?: string
}

export class ErrorFormatter {
  /**
   * Format error messages with red styling and red X
   */
  static formatError(error: Error | string, type: 'critical' | 'warning' | 'info' = 'critical'): FormattedError {
    const message = error instanceof Error ? error.message : error

    let formattedMessage: string
    let icon: string

    switch (type) {
      case 'critical':
        icon = chalk.red('✗')
        formattedMessage = chalk.red.bold(message)
        break
      case 'warning':
        icon = chalk.yellow('⚠️')
        formattedMessage = chalk.yellow(message)
        break
      case 'info':
        icon = chalk.blue('ℹ')
        formattedMessage = chalk.blue(message)
        break
    }

    return {
      message: `${icon} ${formattedMessage}`,
      type,
      context: error instanceof Error ? error.stack : undefined,
    }
  }

  /**
   * Format workflow step failures with enhanced visibility
   */
  static formatWorkflowFailure(stepTitle: string, error: Error | string): string {
    const formattedError = this.formatError(error, 'critical')
    return `${chalk.red('✗')} ${chalk.red.bold(stepTitle)} - ${formattedError.message.replace(/^✗\s/, '')}`
  }

  /**
   * Format publishing workflow failures specifically
   */
  static formatPublishingFailure(error: Error | string): string {
    const formattedError = this.formatError(error, 'critical')
    return `${chalk.red('✗')} ${chalk.red.bold('Publishing workflow failed')} - ${formattedError.message.replace(/^✗\s/, '')}`
  }

  /**
   * Create a red error box for critical failures
   */
  static createErrorBox(title: string, message: string, suggestions?: string[]): string {
    const width = 68
    const border = '═'.repeat(width - 2)

    let output = '\n'
    output += chalk.red(`╔${border}╗\n`)
    output += chalk.red(`║${title.padStart((width + title.length) / 2).padEnd(width - 2)}║\n`)
    output += chalk.red(`╚${border}╝\n`)
    output += '\n'
    output += `${chalk.red.bold(message)}\n`

    if (suggestions && suggestions.length > 0) {
      output += `\n${chalk.yellow.bold('Suggestions:\n')}`
      suggestions.forEach((suggestion) => {
        output += chalk.yellow(`  • ${suggestion}\n`)
      })
    }

    output += '\n'
    return output
  }

  /**
   * Format error logs for display
   */
  static formatErrorLogs(logs: string): string {
    return logs
      .split('\n')
      .map((line) => {
        if (line.includes('error') || line.includes('Error') || line.includes('ERROR')) {
          return chalk.red(line)
        }
        if (line.includes('warn') || line.includes('Warning') || line.includes('WARN')) {
          return chalk.yellow(line)
        }
        return chalk.gray(line)
      })
      .join('\n')
  }
}
