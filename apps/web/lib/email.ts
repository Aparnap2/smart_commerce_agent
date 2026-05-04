// Email service via Resend
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy')

export interface SendApprovalEmailProps {
  to: string
  name: string
  prNumber: string
  decision: 'APPROVED' | 'REJECTED'
  comments: string
  approverName: string
  totalAmount: number
}

export async function sendApprovalEmail(props: SendApprovalEmailProps) {
  const { to, name, prNumber, decision, comments, approverName, totalAmount } = props
  const approved = decision === 'APPROVED'
  
  const subject = approved
    ? `✅ ${prNumber} approved`
    : `❌ ${prNumber} rejected`

  const html = approved
    ? `<h2>Your purchase request ${prNumber} has been APPROVED!</h2>
       <p>Hi ${name},</p>
       <p>Your manager ${approverName} has approved your PR for ₹${totalAmount.toLocaleString('en-IN')}.</p>
       ${comments ? `<p>Comments: ${comments}</p>` : ''}
       <p>The procurement team will now process your order.</p>`
    : `<h2>Your purchase request ${prNumber} has been REJECTED</h2>
       <p>Hi ${name},</p>
       <p>Your manager ${approverName} has rejected your PR.</p>
       <p><strong>Reason:</strong> ${comments || 'No reason provided'}</p>`

  return resend.emails.send({
    from: 'ProcureAI <no-reply@procureai.com>',
    to,
    subject,
    html,
  })
}