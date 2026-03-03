from langchain_openai import ChatOpenAI
from openai import AsyncOpenAI
import os


def get_llm(temperature: float = 0.2) -> ChatOpenAI:
    base_url = os.environ.get("OPENAI_BASE_URL")
    if not base_url:
        raise ValueError("OPENAI_BASE_URL is required")
    return ChatOpenAI(
        model=os.environ.get("OPENAI_MODEL", "gpt-oss-120b"),
        temperature=temperature,
        max_retries=2,
        openai_api_key=os.environ.get("OPENAI_API_KEY", "placeholder"),
        openai_api_base=base_url,
        default_query=(
            {"api-version": os.environ["OPENAI_API_VERSION"]}
            if os.environ.get("OPENAI_API_VERSION")
            else {}
        ),
    )


def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.environ.get("OPENAI_API_KEY", "placeholder"),
        base_url=os.environ.get("OPENAI_BASE_URL"),
        default_query=(
            {"api-version": os.environ["OPENAI_API_VERSION"]}
            if os.environ.get("OPENAI_API_VERSION")
            else {}
        ),
    )
