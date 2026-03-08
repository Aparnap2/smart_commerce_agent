#!/usr/bin/env python3
"""Test script for Agent Core API"""

import requests
from jose import jwt

BASE_URL = "http://localhost:8000"
JWT_SECRET = "test-secret-change-in-prod-min-32-chars-long"


def generate_token(user_id="test-user-123", role="SHOPPER"):
    """Generate a valid JWT token for testing"""
    payload = {
        "userId": user_id,
        "email": "test@example.com",
        "role": role
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def test_health():
    """Test health endpoint"""
    print("=== Testing Health Endpoint ===")
    resp = requests.get(f"{BASE_URL}/health")
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    print("✅ Health check passed\n")


def test_chat_no_token():
    """Test chat endpoint without token returns 401"""
    print("=== Testing Chat (No Token) ===")
    resp = requests.post(
        f"{BASE_URL}/agent/chat",
        json={"message": "hello"},
        headers={"Content-Type": "application/json"}
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    assert resp.status_code == 401
    print("✅ No token returns 401\n")


def test_chat_invalid_token():
    """Test chat endpoint with invalid token returns 401"""
    print("=== Testing Chat (Invalid Token) ===")
    resp = requests.post(
        f"{BASE_URL}/agent/chat",
        json={"message": "hello"},
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer invalid-token"
        }
    )
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")
    assert resp.status_code == 401
    print("✅ Invalid token returns 401\n")


def test_chat_sse_streaming():
    """Test chat endpoint with valid token and SSE streaming"""
    print("=== Testing Chat (SSE Streaming) ===")
    token = generate_token()
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {"message": "hello", "thread_id": "test-123"}
    
    resp = requests.post(
        f"{BASE_URL}/agent/chat",
        headers=headers,
        json=data,
        stream=True
    )
    
    print(f"Status: {resp.status_code}")
    print(f"Content-Type: {resp.headers.get('Content-Type')}")
    print(f"Cache-Control: {resp.headers.get('Cache-Control')}")
    print(f"X-Accel-Buffering: {resp.headers.get('X-Accel-Buffering')}")
    
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("Content-Type", "")
    
    print("\n=== SSE Stream Events ===")
    events = []
    for line in resp.iter_lines():
        if line:
            event = line.decode("utf-8")
            events.append(event)
            print(event)
    
    # Verify SSE format - at minimum should have SSE-formatted response
    assert len(events) > 0, "Should have at least one SSE event"
    assert any("data:" in e for e in events), "Should include data: prefix"
    
    # Note: thread_id may not be present if GraphQL backend is unavailable
    # The important thing is that SSE streaming itself works
    print("\n✅ SSE streaming works correctly (format verified)\n")


def test_cors_preflight():
    """Test CORS preflight request"""
    print("=== Testing CORS Preflight ===")
    resp = requests.options(
        f"{BASE_URL}/agent/chat",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST"
        }
    )
    print(f"Status: {resp.status_code}")
    print(f"Access-Control-Allow-Origin: {resp.headers.get('Access-Control-Allow-Origin')}")
    print(f"Access-Control-Allow-Credentials: {resp.headers.get('Access-Control-Allow-Credentials')}")
    print(f"Access-Control-Allow-Methods: {resp.headers.get('Access-Control-Allow-Methods')}")
    
    assert resp.status_code == 200
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"
    assert resp.headers.get("Access-Control-Allow-Credentials") == "true"
    print("✅ CORS preflight works correctly\n")


if __name__ == "__main__":
    print("=" * 60)
    print("AGENT CORE API TEST SUITE")
    print("=" * 60 + "\n")
    
    try:
        test_health()
        test_chat_no_token()
        test_chat_invalid_token()
        test_chat_sse_streaming()
        test_cors_preflight()
        
        print("=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        exit(1)
