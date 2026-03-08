from jose import jwt
import json

payload = {
    "userId": "test-user-123",
    "email": "test@example.com",
    "role": "SHOPPER"
}

token = jwt.encode(payload, "test-secret-change-in-prod-min-32-chars-long", algorithm="HS256")
print(f"Bearer {token}")
