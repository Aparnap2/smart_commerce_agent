"""
Notifications module for publishing approval events.

This module provides functions to publish PR approval events to Redis pubsub,
Slack, and optionally via QStash for durable fallback.
"""
import json
import uuid
import os
import httpx
from datetime import datetime, timezone

from .dependencies import get_redis

# Slack API URL - use mock in dev (localhost:3002), real API in production
SLACK_API_URL = os.environ.get("SLACK_API_URL", "http://localhost:3002")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "xoxb-mock-token")


async def publish_approval_event(
    employee_id: str,
    pr_id: str,
    pr_number: str,
    decision: str,  # "APPROVED" or "REJECTED"
    total_amount: int = 0,
) -> dict:
    """Publish PR approval event to Redis pubsub.

    Args:
        employee_id: The employee ID to notify
        pr_id: The PR UUID
        pr_number: The PR number (e.g., "PR-101")
        decision: "APPROVED" or "REJECTED"
        total_amount: Total amount in cents

    Returns:
        dict with success status, channel, and message_id
    """
    channel = f"pr-approval-{employee_id}"
    message_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    message = {
        "pr_id": pr_id,
        "pr_number": pr_number,
        "decision": decision,
        "total_amount": total_amount,
        "timestamp": timestamp,
        "message_id": message_id,
    }

    try:
        redis = get_redis()
        await redis.publish(channel, json.dumps(message))
        return {
            "success": True,
            "channel": channel,
            "message_id": message_id,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


async def publish_with_qstash(
    employee_id: str,
    event_type: str,
    payload: dict,
    delay_seconds: int = 5,
) -> dict:
    """Fallback: publish via QStash for durability.

    This is a placeholder since QStash requires external setup (Upstash account).
    Returns a not configured response until QStash credentials are provided.

    Args:
        employee_id: The employee ID
        event_type: Type of event (e.g., "approval")
        payload: Event payload data
        delay_seconds: Delay in seconds before delivery

    Returns:
        dict with success status and reason
    """
    # TODO: Implement QStash publishing when QSTASH_URL and QSTASH_TOKEN are configured
    return {"success": False, "reason": "qstash_not_configured"}


async def send_slack_notification(
    channel: str,
    pr_number: str,
    decision: str,
    requestor: str,
    total_amount: int,
    approver: str = "",
) -> dict:
    """Send Slack notification for PR approval/rejection.
    
    Uses mock Slack API in dev (localhost:3002), real API in production.
    
    Args:
        channel: Slack channel to post to
        pr_number: PR number (e.g., "PR-101")
        decision: "APPROVED" or "REJECTED"
        requestor: Who requested the PR
        total_amount: Amount in cents
        approver: Who approved/rejected
    
    Returns:
        dict with success status and Slack response
    """
    emoji = "✅" if decision == "APPROVED" else "❌"
    color = "#36a64f" if decision == "APPROVED" else "#ff0000"
    
    text = f"{emoji} *Purchase Request {pr_number} {decision}*"
    
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": text
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Requestor:*\n{requestor}"},
                {"type": "mrkdwn", "text": f"*Amount:*\n₹{total_amount / 100:,}"},
                {"type": "mrkdwn", "text": f"*Decision:*\n{decision}"},
                {"type": "mrkdwn", "text": f"*Approver:*\n{approver}"}
            ]
        }
    ]
    
    payload = {
        "channel": channel,
        "text": text,
        "blocks": blocks,
        "attachments": [{"color": color}]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{SLACK_API_URL}/api/chat.postMessage",
                json=payload,
                headers={
                    "Authorization": f"Bearer {SLACK_BOT_TOKEN}",
                    "Content-Type": "application/json"
                }
            )
            result = resp.json()
            return {"success": True, "slack_response": result}
    except Exception as e:
        return {"success": False, "error": str(e)}
