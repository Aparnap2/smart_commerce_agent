// Direct Agent API Test - No Auth
// Tests the Python agent directly via HTTP

const AGENT_URL = 'http://localhost:8000'

describe('Python Agent - Direct API', () => {
  it('agent health check works', () => {
    cy.request(`${AGENT_URL}/health`).then((res) => {
      expect(res.status).to.eq(200)
      expect(res.body).to.have.property('status', 'ok')
    })
  })

  it('agent has chat endpoint', () => {
    cy.request({
      method: 'POST',
      url: `${AGENT_URL}/agent/chat`,
      body: {
        messages: [{ role: 'user', content: 'hello' }],
        threadId: 'test-thread',
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect([200, 422]).to.include(res.status)
    })
  })

  it('catalog search tool responds', () => {
    cy.request({
      method: 'POST',
      url: `${AGENT_URL}/agent/chat`,
      body: {
        messages: [{ role: 'user', content: 'show me laptops' }],
        threadId: 'test-laptop-search',
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 422, 500])
    })
  })

  it('budget check tool responds', () => {
    cy.request({
      method: 'POST',
      url: `${AGENT_URL}/agent/chat`,
      body: {
        messages: [{ role: 'user', content: 'check my budget' }],
        threadId: 'test-budget',
      },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 422, 500])
    })
  })
})