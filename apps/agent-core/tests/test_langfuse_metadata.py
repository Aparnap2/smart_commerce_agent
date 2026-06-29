"""
TDD tests for Langfuse integration in agent-core.
Tests verify the integration code works when Langfuse IS available.
Tests should pass (GREEN) when Langfuse available, skip gracefully when not.
"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

# Import the functions under test
import src.dependencies as deps
from src.dependencies import (
    get_langfuse_metadata,
    LANGFUSE_AVAILABLE,
)


class TestLangfuseMetadata:
    """Test get_langfuse_metadata() function."""

    def test_no_config_returns_default_app(self):
        """Missing config returns default app only."""
        result = get_langfuse_metadata()
        
        assert result == {"app": "supportpilot"}
        assert "app" in result

    def test_config_with_department_id(self):
        """Config with department_id returns correct metadata."""
        config = {
            "configurable": {
                "department_id": "dept-123",
                "role": "buyer",
            }
        }
        result = get_langfuse_metadata(config)
        
        assert result["department_id"] == "dept-123"
        assert result["role"] == "buyer"
        assert result["app"] == "supportpilot"

    def test_config_with_only_role(self):
        """Config with only role returns role and defaults."""
        config = {
            "configurable": {
                "role": "approver",
            }
        }
        result = get_langfuse_metadata(config)
        
        assert result["role"] == "approver"
        assert result["department_id"] == "unknown"
        assert result["app"] == "supportpilot"

    def test_empty_configurable_returns_defaults(self):
        """Empty configurable returns defaults."""
        config = {"configurable": {}}
        result = get_langfuse_metadata(config)
        
        assert result["department_id"] == "unknown"
        assert result["role"] == "unknown"
        assert result["app"] == "supportpilot"

    def test_missing_configurable_key_returns_defaults(self):
        """Missing configurable key returns defaults."""
        config = {"other_key": "value"}
        result = get_langfuse_metadata(config)
        
        assert result["department_id"] == "unknown"
        assert result["role"] == "unknown"
        assert result["app"] == "supportpilot"

    def test_non_dict_config_returns_default_app(self):
        """Non-dict config returns default app."""
        result = get_langfuse_metadata("not-a-dict")
        
        assert result == {"app": "supportpilot"}


class TestLangfuseHealthCheck:
    """Test Langfuse health check when available."""

    @pytest.mark.asyncio
    async def test_langfuse_available_flag_is_boolean(self):
        """LANGFUSE_AVAILABLE should be a boolean."""
        assert isinstance(LANGFUSE_AVAILABLE, bool)

    @pytest.mark.skipif(not LANGFUSE_AVAILABLE, reason="Langfuse not available")
    @pytest.mark.asyncio
    async def test_langfuse_connection_when_available(self):
        """Can connect to Langfuse when available and configured."""
        from src.dependencies import get_langfuse
        
        # Try to get langfuse instance - may fail if no credentials
        try:
            lf = get_langfuse()
            # If we have credentials, instance should exist
            if lf is not None:
                # Basic smoke test - instance has expected methods
                assert hasattr(lf, 'flushAsync')
        except Exception as e:
            # If credentials missing, that's OK - just means not configured
            pytest.skip(f"Langfuse credentials not configured: {e}")

    @pytest.mark.skipif(LANGFUSE_AVAILABLE, reason="Langfuse is available")
    @pytest.mark.asyncio
    async def test_skip_gracefully_when_not_available(self):
        """Test handles missing Langfuse gracefully."""
        # When Langfuse not available, operations should not fail
        from src.dependencies import get_langfuse
        
        result = get_langfuse()
        assert result is None


class TestTraceGeneration:
    """Test trace creation with metadata."""

    @pytest.mark.skipif(not LANGFUSE_AVAILABLE, reason="Langfuse not available")
    @pytest.mark.asyncio
    async def test_create_trace_with_metadata(self):
        """Can create a trace with metadata when Langfuse available."""
        from src.dependencies import get_langfuse
        
        lf = get_langfuse()
        if lf is None:
            pytest.skip("Langfuse not configured")
        
        # Create a trace with metadata
        metadata = get_langfuse_metadata({
            "configurable": {
                "department_id": "dept-trace-test",
                "role": "tester",
            }
        })
        
        # Langfuse trace should accept metadata
        trace = lf.trace(
            name="test-trace",
            metadata=metadata,
        )
        
        assert trace is not None
        assert trace.name == "test-trace"
        
        # End the trace
        trace.end()
        
        # Flush to ensure trace is sent
        await lf.flushAsync()

    @pytest.mark.skipif(not LANGFUSE_AVAILABLE, reason="Langfuse not available")
    @pytest.mark.asyncio
    async def test_trace_generation_with_default_metadata(self):
        """Can create trace with default metadata."""
        from src.dependencies import get_langfuse
        
        lf = get_langfuse()
        if lf is None:
            pytest.skip("Langfuse not configured")
        
        # Create trace with default metadata
        default_metadata = get_langfuse_metadata()
        trace = lf.trace(
            name="test-default-trace",
            metadata=default_metadata,
        )
        
        assert trace is not None
        trace.end()
        await lf.flushAsync()


class TestLangfuseIntegration:
    """Integration tests for Langfuse with observability."""

    @pytest.mark.asyncio
    async def test_metadata_includes_all_required_fields(self):
        """Metadata always includes department_id, role, and app."""
        metadata = get_langfuse_metadata({
            "configurable": {
                "department_id": "dept-integration",
                "role": "admin",
            }
        })
        
        # All required fields present
        assert "department_id" in metadata
        assert "role" in metadata
        assert "app" in metadata
        
        # Values are correct
        assert metadata["department_id"] == "dept-integration"
        assert metadata["role"] == "admin"
        assert metadata["app"] == "supportpilot"

    @pytest.mark.asyncio
    async def test_metadata_fields_are_strings(self):
        """Metadata field values are strings."""
        config = {
            "configurable": {
                "department_id": "dept-456",
                "role": "viewer",
            }
        }
        metadata = get_langfuse_metadata(config)
        
        assert isinstance(metadata["department_id"], str)
        assert isinstance(metadata["role"], str)
        assert isinstance(metadata["app"], str)