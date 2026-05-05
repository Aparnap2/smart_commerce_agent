import { describe, it, expect } from 'vitest'
import { readdir, access, readFile } from 'fs/promises'
import { join } from 'path'

const ROOT = process.cwd()

describe('B2B Compliance Audit', () => {
  it('should NOT have B2C files in agent-core/agents', async () => {
    const agentsDir = join(ROOT, 'apps/agent-core/agents')
    const files = await readdir(agentsDir).catch(() => [])
    const b2cFiles = files.filter(f => 
      (f.includes('shopper') || f.includes('support') || f.includes('orchestrator')) &&
      !f.startsWith('.') && !f.startsWith('__')
    )
    expect(b2cFiles).toHaveLength(0)
  })

  it('should NOT have B2C files in web/components/genui', async () => {
    const genuiDir = join(ROOT, 'apps/web/components/genui')
    const files = await readdir(genuiDir).catch(() => [])
    const b2cFiles = files.filter(f => 
      f.includes('Cart') || f.includes('Order') || f.includes('ProductGrid') || f.includes('Return')
    )
    expect(b2cFiles).toHaveLength(0)
  })

  it('should NOT have B2C mock files in agent-core', async () => {
    const b2cFiles = [
      'apps/agent-core/llm/mock_provider.py',
      'apps/agent-core/routers/chat.py',
      'apps/agent-core/mock_graphql_server.py',
    ]
    for (const file of b2cFiles) {
      let exists = false
      try {
        await access(join(ROOT, file))
        exists = true
      } catch {
        exists = false
      }
      expect(exists).toBe(false)
    }
  })

  it('should have B2B tools defined', async () => {
    const toolsFile = join(ROOT, 'apps/agent-core/src/tools.py')
    const content = await readFile(toolsFile, 'utf-8')
    const b2bTools = ['search_catalog', 'get_budget_status', 'manage_purchase_request']
    for (const tool of b2bTools) {
      expect(content).toContain(tool)
    }
  })

  it('should have B2B GenUI components', async () => {
    const genuiDir = join(ROOT, 'apps/web/components/genui')
    const files = await readdir(genuiDir).catch(() => [])
    const required = ['CatalogGrid', 'PurchaseRequestDraft', 'ApprovalCard', 'BudgetGauge']
    for (const component of required) {
      const exists = files.some(f => f.includes(component))
      expect(exists).toBe(true)
    }
  })
})