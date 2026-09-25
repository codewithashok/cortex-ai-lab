import io
import logging

from docx import Document
from fastapi import APIRouter, File, HTTPException, UploadFile
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from app.schemas.documents import DocumentChunk, ProcessDocumentResponse

router = APIRouter(tags=["documents"])
logger = logging.getLogger("cortex")

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150


def extract_pdf_pages(file_bytes: bytes) -> list[tuple[int | None, str]]:
    reader = PdfReader(io.BytesIO(file_bytes))
    return [(index + 1, page.extract_text() or "") for index, page in enumerate(reader.pages)]


def extract_docx_text(file_bytes: bytes) -> list[tuple[int | None, str]]:
    document = Document(io.BytesIO(file_bytes))
    text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    return [(None, text)]


def extract_plain_text(file_bytes: bytes) -> list[tuple[int | None, str]]:
    return [(None, file_bytes.decode("utf-8", errors="replace"))]


def extract_pages(filename: str, file_bytes: bytes) -> list[tuple[int | None, str]]:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "pdf":
        return extract_pdf_pages(file_bytes)
    if suffix == "docx":
        return extract_docx_text(file_bytes)
    if suffix in ("txt", "md"):
        return extract_plain_text(file_bytes)
    raise ValueError(f"Unsupported file type: .{suffix or 'unknown'}")


def build_chunks(filename: str, pages: list[tuple[int | None, str]]) -> list[DocumentChunk]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    chunks: list[DocumentChunk] = []
    for page_number, text in pages:
        for piece in splitter.split_text(text):
            chunks.append(
                DocumentChunk(
                    chunk_index=len(chunks),
                    content=piece,
                    source_filename=filename,
                    page_number=page_number,
                )
            )
    return chunks


@router.post("/documents/process", response_model=ProcessDocumentResponse)
async def process_document(file: UploadFile = File(...)) -> ProcessDocumentResponse:
    filename = file.filename or "unknown"
    file_bytes = await file.read()

    try:
        pages = extract_pages(filename, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to extract text from %s", filename)
        raise HTTPException(status_code=422, detail="Could not read this file. Is it corrupted?") from exc

    full_text = "\n".join(text for _, text in pages)
    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No extractable text found in the file.")

    chunks = build_chunks(filename, pages)
    return ProcessDocumentResponse(filename=filename, chunk_count=len(chunks), chunks=chunks)
