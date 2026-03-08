import httpx, os
from typing import Any

COMMERCE_API_URL = os.getenv("COMMERCE_API_URL", "http://localhost:3001")


async def graphql_query(
    query: str, variables: dict | None = None, token: str = ""
) -> Any:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{COMMERCE_API_URL}/graphql",
            json={"query": query, "variables": variables or {}},
            headers=headers,
        )
        r.raise_for_status()
        return r.json()


async def graphql_mutate(
    mutation: str, variables: dict | None = None, token: str = ""
) -> Any:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{COMMERCE_API_URL}/graphql",
            json={"query": mutation, "variables": variables or {}},
            headers=headers,
        )
        r.raise_for_status()
        return r.json()
