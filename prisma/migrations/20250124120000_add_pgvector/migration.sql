-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create Product Embeddings table
CREATE TABLE IF NOT EXISTS "product_embeddings" (
    "id" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,
    "embedding_model" TEXT NOT NULL DEFAULT 'nomic-embed-text',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_embeddings_pkey" PRIMARY KEY ("id")
);

-- Create Documents table
CREATE TABLE IF NOT EXISTS "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL,
    "category" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Create Document Chunks table
CREATE TABLE IF NOT EXISTS "document_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,
    "token_count" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "product_embeddings_product_id_idx" ON "product_embeddings"("product_id");
CREATE INDEX IF NOT EXISTS "documents_doc_type_idx" ON "documents"("doc_type");
CREATE INDEX IF NOT EXISTS "documents_category_idx" ON "documents"("category");
CREATE INDEX IF NOT EXISTS "document_chunks_document_id_idx" ON "document_chunks"("document_id");

-- Add foreign key constraint
ALTER TABLE "product_embeddings" ADD CONSTRAINT "product_embeddings_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
