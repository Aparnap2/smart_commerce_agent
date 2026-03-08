import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'

const ROOT = join(__dirname, '../../../../')
const compose = parseYaml(
  readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8')
)
const services = compose.services as Record<string, Record<string, unknown>>

describe('docker-compose.yml structure', () => {

  it('defines postgres, redis, commerce-api, agent-core', () => {
    expect(Object.keys(services)).toContain('postgres')
    expect(Object.keys(services)).toContain('redis')
    expect(Object.keys(services)).toContain('commerce-api')
    expect(Object.keys(services)).toContain('agent-core')
  })

  it('postgres container_name is smart-commerce-postgres', () => {
    expect(services['postgres']['container_name'])
      .toBe('smart-commerce-postgres')
  })

  it('redis container_name is smart-commerce-redis', () => {
    expect(services['redis']['container_name'])
      .toBe('smart-commerce-redis')
  })

  it('commerce-api has no AZURE_* env vars', () => {
    const env = services['commerce-api']['environment'] as Record<string, string>
    const keys = Object.keys(env)
    expect(keys.some(k => k.startsWith('AZURE_'))).toBe(false)
  })

  it('agent-core has no AZURE_* env vars', () => {
    const env = services['agent-core']['environment'] as Record<string, string>
    const keys = Object.keys(env)
    expect(keys.some(k => k.startsWith('AZURE_'))).toBe(false)
  })

  it('agent-core depends on commerce-api', () => {
    const deps = services['agent-core']['depends_on'] as Record<string, unknown>
    expect(Object.keys(deps)).toContain('commerce-api')
  })

  it('commerce-api has memory limit', () => {
    const deploy = services['commerce-api']['deploy'] as Record<string, unknown>
    expect(deploy).toBeDefined()
    const limits = (deploy.resources as Record<string, unknown>)?.limits
    expect(limits).toBeDefined()
  })

  it('agent-core has memory limit', () => {
    const deploy = services['agent-core']['deploy'] as Record<string, unknown>
    expect(deploy).toBeDefined()
  })

  it('both services use OPENAI_* vars', () => {
    for (const svc of ['commerce-api', 'agent-core']) {
      const env = services[svc]['environment'] as Record<string, string>
      expect(Object.keys(env)).toContain('OPENAI_API_KEY')
      expect(Object.keys(env)).toContain('OPENAI_BASE_URL')
    }
  })

})
