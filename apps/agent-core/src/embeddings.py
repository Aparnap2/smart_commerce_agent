import os
from langchain_openai import AzureOpenAIEmbeddings

_embeddings: AzureOpenAIEmbeddings | None = None


def get_embeddings() -> AzureOpenAIEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = AzureOpenAIEmbeddings(
            azure_deployment=os.environ["AZURE_OPENAI_EMBEDDING_DEPLOYMENT"],
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            api_version=os.environ["AZURE_OPENAI_API_VERSION"],
        )
    return _embeddings


async def embed_query(text: str) -> list[float]:
    return await get_embeddings().aembed_query(text)
