import { describe, expect, it } from 'vitest'
import {
  buildAutonomousCoordinatorLaunchPrompt,
  decodeAutonomousGoalObjective,
  encodeAutonomousGoalObjective
} from './autonomous-coordinator-prompt'

describe('autonomous goal objective encoding', () => {
  it('round-trips multi-line UTF-8 text through shell-safe base64', () => {
    const objective = 'Analisar a documentação "docs/" e seguir com o desenvolvimento\n- passo 2 ✓'
    const encoded = encodeAutonomousGoalObjective(objective)
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(decodeAutonomousGoalObjective(encoded)).toBe(objective)
  })

  it('rejects bytes that are not UTF-8', () => {
    expect(() => decodeAutonomousGoalObjective(btoa('\xff\xfe'))).toThrow()
  })
})

describe('buildAutonomousCoordinatorLaunchPrompt', () => {
  it('binds the goal first and carries the worker policy', () => {
    const prompt = buildAutonomousCoordinatorLaunchPrompt({
      objective: '  Build the app  ',
      agent: 'claude',
      workerAgent: 'codex',
      maxConcurrent: 3
    })
    const encoded = encodeAutonomousGoalObjective('Build the app')
    expect(prompt).toContain(
      `dolphin goal start --agent claude --worker-agent codex --max-concurrent 3 --objective-b64 ${encoded} --json`
    )
    expect(prompt).toContain('--agent codex --json`. Keep at most 3 workers running.')
    expect(prompt).toContain('enable auto-merge')
    expect(prompt).toContain('dolphin goal complete')
    expect(prompt.indexOf('dolphin goal start')).toBeLessThan(prompt.indexOf('Rules:'))
  })
})
