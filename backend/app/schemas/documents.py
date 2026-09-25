from pydantic import BaseModel


class DocumentChunk(BaseModel):
    chunk_index: int
    content: str
    source_filename: str
    page_number: int | None = None


class ProcessDocumentResponse(BaseModel):
    filename: str
    chunk_count: int
    chunks: list[DocumentChunk]
