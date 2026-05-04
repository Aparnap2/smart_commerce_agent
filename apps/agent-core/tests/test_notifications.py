"""
TDD tests for notifications.py
Tests publish_approval_event and publish_with_qstash functions.
"""
import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock


@pytest.mark.asyncio
async def test_publish_approval_event_approved():
    """Test publishing an APPROVED PR approval event to Redis pubsub."""
    from src.notifications import publish_approval_event
    from src import dependencies

    # Mock Redis to capture the publish call
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(return_value=1)  # 1 subscriber received
    mock_redis.get = AsyncMock(return_value=None)

    with patch.object(dependencies, 'get_redis', return_value=mock_redis):
        result = await publish_approval_event(
            employee_id="emp-123",
            pr_id="pr-uuid-456",
            pr_number="PR-101",
            decision="APPROVED",
            total_amount=50000,
        )

    # Verify result structure
    assert result["success"] is True
    assert "channel" in result
    assert result["channel"] == "pr-approval-emp-123"
    assert "message_id" in result

    # Verify Redis publish was called with correct channel
    mock_redis.publish.assert_called_once()
    call_args = mock_redis.publish.call_args
    assert call_args[0][0] == "pr-approval-emp-123"

    # Verify message content
    message = json.loads(call_args[0][1])
    assert message["pr_id"] == "pr-uuid-456"
    assert message["pr_number"] == "PR-101"
    assert message["decision"] == "APPROVED"
    assert message["total_amount"] == 50000
    assert "timestamp" in message


@pytest.mark.asyncio
async def test_publish_approval_event_rejected():
    """Test publishing a REJECTED PR approval event to Redis pubsub."""
    from src.notifications import publish_approval_event
    from src import dependencies

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(return_value=1)

    with patch.object(dependencies, 'get_redis', return_value=mock_redis):
        result = await publish_approval_event(
            employee_id="emp-456",
            pr_id="pr-uuid-789",
            pr_number="PR-102",
            decision="REJECTED",
            total_amount=0,
        )

    assert result["success"] is True
    assert result["channel"] == "pr-approval-emp-456"

    # Verify message content for rejected
    call_args = mock_redis.publish.call_args
    message = json.loads(call_args[0][1])
    assert message["decision"] == "REJECTED"
    assert message["total_amount"] == 0


@pytest.mark.asyncio
async def test_publish_approval_event_redis_error():
    """Test handling Redis connection errors gracefully."""
    from src.notifications import publish_approval_event
    from src import dependencies

    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(side_effect=Exception("Redis connection failed"))

    with patch.object(dependencies, 'get_redis', return_value=mock_redis):
        result = await publish_approval_event(
            employee_id="emp-123",
            pr_id="pr-uuid-456",
            pr_number="PR-101",
            decision="APPROVED",
        )

    assert result["success"] is False
    assert "error" in result


@pytest.mark.asyncio
async def test_publish_with_qstash_not_configured():
    """Test that QStash returns not configured when no credentials."""
    from src.notifications import publish_with_qstash

    result = await publish_with_qstash(
        employee_id="emp-123",
        event_type="approval",
        payload={"test": "data"},
    )

    assert result["success"] is False
    assert result["reason"] == "qstash_not_configured"


@pytest.mark.asyncio
async def test_publish_with_qstash_with_delay():
    """Test QStash publish accepts delay parameter."""
    from src.notifications import publish_with_qstash

    # Even without config, verify delay parameter is accepted
    result = await publish_with_qstash(
        employee_id="emp-123",
        event_type="approval",
        payload={"test": "data"},
        delay_seconds=10,
    )

    assert result["success"] is False
    assert result["reason"] == "qstash_not_configured"
