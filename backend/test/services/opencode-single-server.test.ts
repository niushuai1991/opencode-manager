import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { execSync } from 'child_process'
import type { Database } from 'bun:sqlite'

vi.mock('bun:sqlite', () => ({
  Database: vi.fn(),
}))

vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    access: vi.fn(),
  },
}))

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

const mkdirMock = fs.mkdir as any
const accessMock = fs.access as any
const execSyncMock = execSync as any

describe('OpenCodeServerManager - reinitializeBinDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('WORKSPACE_PATH', '/test/workspace')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  describe('Success Cases', () => {
    it('should create directory and initialize when package.json does not exist', async () => {
      const { opencodeServerManager } = await import('../../src/services/opencode-single-server')
      const { logger } = await import('../../src/utils/logger')
      
      accessMock.mockRejectedValue(new Error('File not found'))
      execSyncMock.mockReturnValue(Buffer.from('Success'))

      await opencodeServerManager.reinitializeBinDirectory()

      expect(mkdirMock).toHaveBeenCalledWith(
        '/test/workspace/.opencode/state/opencode/bin',
        { recursive: true }
      )
      expect(execSyncMock).toHaveBeenCalledWith(
        'bun init -y',
        expect.objectContaining({
          cwd: '/test/workspace/.opencode/state/opencode/bin',
          stdio: 'inherit',
          timeout: 30000
        })
      )
      expect(logger.info).toHaveBeenCalledWith('Reinitializing OpenCode bin directory')
      expect(logger.info).toHaveBeenCalledWith('OpenCode bin directory initialized successfully')
    })

    it('should skip initialization when package.json already exists', async () => {
      const { opencodeServerManager } = await import('../../src/services/opencode-single-server')
      const { logger } = await import('../../src/utils/logger')
      
      accessMock.mockResolvedValue(undefined)

      await opencodeServerManager.reinitializeBinDirectory()

      expect(mkdirMock).toHaveBeenCalledWith(
        '/test/workspace/.opencode/state/opencode/bin',
        { recursive: true }
      )
      expect(execSyncMock).not.toHaveBeenCalled()
      expect(logger.info).toHaveBeenCalledWith('Reinitializing OpenCode bin directory')
    })

    it('should log reinitialization message', async () => {
      const { opencodeServerManager } = await import('../../src/services/opencode-single-server')
      const { logger } = await import('../../src/utils/logger')
      
      accessMock.mockResolvedValue(undefined)

      await opencodeServerManager.reinitializeBinDirectory()

      expect(logger.info).toHaveBeenCalledWith('Reinitializing OpenCode bin directory')
    })
  })

  describe('Error Handling', () => {
    it('should handle bun init failure gracefully', async () => {
      const { opencodeServerManager } = await import('../../src/services/opencode-single-server')
      const { logger } = await import('../../src/utils/logger')
      
      accessMock.mockRejectedValue(new Error('Not found'))
      execSyncMock.mockImplementation(() => {
        throw new Error('bun init failed')
      })

      await expect(opencodeServerManager.reinitializeBinDirectory()).resolves.not.toThrow()

      expect(logger.error).toHaveBeenCalledWith('bun init failed:', expect.any(Error))
    })

    it('should handle directory creation failure gracefully', async () => {
      const { opencodeServerManager } = await import('../../src/services/opencode-single-server')
      const { logger } = await import('../../src/utils/logger')
      
      mkdirMock.mockRejectedValue(new Error('Permission denied'))

      await expect(opencodeServerManager.reinitializeBinDirectory()).resolves.not.toThrow()

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize OpenCode bin directory:',
        expect.any(Error)
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle fs.access throwing non-existence error', async () => {
      const { opencodeServerManager } = await import('../../src/services/opencode-single-server')
      
      mkdirMock.mockResolvedValue(undefined)
      accessMock.mockRejectedValue(new Error('Permission denied'))

      await expect(opencodeServerManager.reinitializeBinDirectory()).resolves.not.toThrow()

      expect(execSyncMock).toHaveBeenCalledWith(
        'bun init -y',
        expect.objectContaining({
          cwd: '/test/workspace/.opencode/state/opencode/bin',
          stdio: 'inherit',
          timeout: 30000
        })
      )
    })

    it('should handle timeout during bun init', async () => {
      const { opencodeServerManager } = await import('../../src/services/opencode-single-server')
      const { logger } = await import('../../src/utils/logger')
      
      mkdirMock.mockResolvedValue(undefined)
      accessMock.mockRejectedValue(new Error('Not found'))
      execSyncMock.mockImplementation(() => {
        const error = new Error('Command timed out')
        error.name = 'ETIMEDOUT'
        throw error
      })

      await expect(opencodeServerManager.reinitializeBinDirectory()).resolves.not.toThrow()

      expect(logger.error).toHaveBeenCalledWith('bun init failed:', expect.any(Error))
    })
  })
})
