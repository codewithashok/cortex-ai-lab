# Feature 2: Document Processing

**What we're building:** upload a file (PDF, Word doc, or plain text), pull the raw text out of it, and split it into small "chunks" — the unglamorous prep work every RAG/search feature depends on later.

**Scope for this feature:** upload → extract text → chunk it → show the chunks with metadata. No permanent storage yet — that's Feature 3 (Knowledge Center)'s job on purpose, so we're not duplicating work.

---

## Step 1: Install the new libraries

```
pypdf==6.19.0                    # extract text from PDFs
python-docx==1.2.0               # extract text from Word docs
langchain-text-splitters==1.1.2  # split long text into chunks
python-multipart==0.0.32         # FastAPI needs this specifically to read file uploads
```

**Gotcha we hit:** the server crashed on startup the first time with `RuntimeError: Form data requires "python-multipart" to be installed`. FastAPI's JSON request handling and its file-upload handling are separate features — you only need `python-multipart` once you use `UploadFile`/`File(...)` in an endpoint.

---

## Step 2: Define the response shape

`backend/app/schemas/documents.py`:

```python
class DocumentChunk(BaseModel):
    chunk_index: int
    content: str
    source_filename: str
    page_number: int | None = None

class ProcessDocumentResponse(BaseModel):
    filename: str
    chunk_count: int
    chunks: list[DocumentChunk]
```

**Why `page_number` is optional:** PDFs have real page numbers, but Word docs and plain text files don't have a fixed pagination — so it's `None` for those.

---

## Step 3: Extract text per file type

`backend/app/api/routes/documents.py` — a different extraction function per file type, all returning the same shape: a list of `(page_number, text)` pairs.

```python
def extract_pdf_pages(file_bytes: bytes) -> list[tuple[int | None, str]]:
    reader = PdfReader(io.BytesIO(file_bytes))
    return [(index + 1, page.extract_text() or "") for index, page in enumerate(reader.pages)]

def extract_docx_text(file_bytes: bytes) -> list[tuple[int | None, str]]:
    document = Document(io.BytesIO(file_bytes))
    text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    return [(None, text)]

def extract_plain_text(file_bytes: bytes) -> list[tuple[int | None, str]]:
    return [(None, file_bytes.decode("utf-8", errors="replace"))]
```

**Why return a list of pages instead of one big string?** So we can tag each chunk with which page it came from later — losing that would mean losing the "page number" metadata your feature guide explicitly asks for.

**Picking the right function by file extension:**

```python
def extract_pages(filename: str, file_bytes: bytes) -> list[tuple[int | None, str]]:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "pdf":
        return extract_pdf_pages(file_bytes)
    if suffix == "docx":
        return extract_docx_text(file_bytes)
    if suffix in ("txt", "md"):
        return extract_plain_text(file_bytes)
    raise ValueError(f"Unsupported file type: .{suffix or 'unknown'}")
```

---

## Step 4: Split the text into chunks

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

def build_chunks(filename: str, pages: list[tuple[int | None, str]]) -> list[DocumentChunk]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks: list[DocumentChunk] = []
    for page_number, text in pages:
        for piece in splitter.split_text(text):
            chunks.append(DocumentChunk(
                chunk_index=len(chunks),
                content=piece,
                source_filename=filename,
                page_number=page_number,
            ))
    return chunks
```

**What "chunking" actually means:** an LLM can only read a limited amount of text at once, and smaller, focused pieces of text make search/retrieval more accurate later (Feature 4: RAG). `chunk_size=1000` means "aim for ~1000 characters per chunk." `chunk_overlap=150` means each chunk repeats the last 150 characters of the previous one, so a sentence that gets cut in half at a chunk boundary still has its context in at least one chunk.

**Why "recursive"?** `RecursiveCharacterTextSplitter` tries to split at natural boundaries first — paragraph breaks, then sentences, then words — only cutting mid-word as a last resort. We saw this directly in testing: a 2783-character test file with 5 clearly-separated sections came back as exactly 5 chunks, one per section, because each section was under 1000 characters and the splitter preferred to keep natural sections whole rather than cutting at a fixed character count.

---

## Step 5: The upload endpoint

```python
@router.post("/documents/process", response_model=ProcessDocumentResponse)
async def process_document(file: UploadFile = File(...)) -> ProcessDocumentResponse:
    filename = file.filename or "unknown"
    file_bytes = await file.read()

    try:
        pages = extract_pages(filename, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Could not read this file. Is it corrupted?") from exc

    full_text = "\n".join(text for _, text in pages)
    if not full_text.strip():
        raise HTTPException(status_code=400, detail="No extractable text found in the file.")

    chunks = build_chunks(filename, pages)
    return ProcessDocumentResponse(filename=filename, chunk_count=len(chunks), chunks=chunks)
```

**`UploadFile = File(...)`** is FastAPI's way of saying "expect a file in the request," not JSON. **`await file.read()`** reads the raw bytes — extraction functions all work on bytes, not on a JSON body like `chat.py`'s endpoints did.

**Two different error cases, two different status codes:** an unsupported file extension is `400` (the caller's mistake — wrong input), a file that fails to parse (corrupted) is `422` (looks like the right kind of file, but something's actually wrong with its content).

---

## Step 6: The frontend upload page

`frontend/src/lib/documents-client.ts`:

```ts
export async function processDocument(file: File): Promise<ProcessDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/documents/process`, {
    method: "POST",
    body: formData,
  });
  ...
}
```

**Important detail:** we do **not** set a `Content-Type` header manually here. When you pass a `FormData` object as `fetch`'s body, the browser sets `Content-Type: multipart/form-data; boundary=...` itself — that `boundary` value is randomly generated per-request and the server needs it to know where one field ends and the next begins. Setting the header yourself would break this.

`frontend/src/app/documents/page.tsx` — a hidden native `<input type="file">` triggered by a Material UI button (MUI doesn't have its own file-picker component, so this is the standard pattern), showing a loading spinner while processing, then rendering each returned chunk as a card with its index and page number (when there is one).

---

## Step 7: Test it for real

Tested every path with real generated files:

```bash
# .txt with 5 sections -> 5 chunks, page_number: null
curl -X POST http://localhost:8000/api/documents/process -F "file=@sample.txt"

# .docx with 2 paragraphs -> 1 chunk containing both, page_number: null
curl -X POST http://localhost:8000/api/documents/process -F "file=@sample.docx"

# Unsupported extension -> 400 "Unsupported file type: .xyz"
# Empty file -> 400 "No extractable text found in the file."
```

Also confirmed the exact request the browser will make works: a CORS preflight from `http://localhost:3000`, and a real file upload with that `Origin` header set, both succeeded.

**Known gap:** PDF extraction uses the same well-tested `pypdf` pattern as the other file types, but wasn't verified with a synthetic file (hard to generate a realistic PDF without pulling in an extra library just for testing). **Test this yourself with a real PDF** (your resume works great, per the feature guide's own suggested practice project) before considering this feature fully done.

---

## Feature status

- ✅ Backend: extraction (PDF/DOCX/TXT/MD) + chunking + endpoint
- ✅ Frontend: upload UI showing chunks with metadata
- ✅ Error handling (unsupported type, empty file, corrupted file)
- ✅ Tested end-to-end for .txt and .docx, including real CORS/browser-shaped requests
- ⬜ **You still need to verify a real PDF upload through the browser**
- ⬜ No database yet (by design — Knowledge Center owns storage)
