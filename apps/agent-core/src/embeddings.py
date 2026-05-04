import os
import aiohttp
from langchain_openai import AzureOpenAIEmbeddings

_azure_embeddings: AzureOpenAIEmbeddings | None = None


def get_azure_embeddings() -> AzureOpenAIEmbeddings:
    global _azure_embeddings
    if _azure_embeddings is None:
        _azure_embeddings = AzureOpenAIEmbeddings(
            azure_deployment=os.environ["AZURE_OPENAI_EMBEDDING_DEPLOYMENT"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        )
    return _azure_embeddings


async def embed_query(text: str) -> list[float]:
    return await get_azure_embeddings().aembed_query(text)