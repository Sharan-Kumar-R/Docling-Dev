from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from converter import process_document
import uvicorn
import os
import database as db
from rag import RAGEngine
from pydantic import BaseModel
import logging
import sys

# Robust Logging Configuration
# Create handlers
file_handler = logging.FileHandler("app.log", mode='a')
console_handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# Configure Root Logger
root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.handlers = [file_handler, console_handler]

# Configure Uvicorn Loggers to use our handlers
logging.getLogger("uvicorn").handlers = [file_handler, console_handler]
logging.getLogger("uvicorn.access").handlers = [file_handler, console_handler]

# Configure Docling Logger
# Explicitly set handlers in case it doesn't propagate
docling_logger = logging.getLogger("docling")
docling_logger.setLevel(logging.INFO) 
docling_logger.handlers = [file_handler, console_handler]
docling_logger.propagate = False

app = FastAPI(title="DocGenie")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize DB
db.init_db()

# Initialize RAG Engine
try:
    rag_engine = RAGEngine()
except Exception as e:
    print(f"Warning: RAG Engine could not be initialized: {e}")
    rag_engine = None

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

@app.post("/convert")
async def convert_file(
    file: UploadFile = File(...),
    ocr_enabled: bool = Form(False),
    table_extraction: bool = Form(True)
):
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    try:
        content = await file.read()
        options = {
            "ocr": ocr_enabled,
            "table_extraction": table_extraction
        }
        # Save file to static/uploads
        upload_dir = "static/uploads"
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(content)
            
        result = process_document(content, file.filename, options)
        result["file_url"] = f"/static/uploads/{file.filename}"
        
        if result["status"] == "error":
            raise HTTPException(status_code=500, detail=result["error"])
        
        # Save to DB
        session_id = db.create_session(file.filename, file_path, result["markdown"])
        result["session_id"] = session_id
        
        # Index in ChromaDB
        if rag_engine:
            rag_engine.index_document(session_id, result["markdown"])
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/convert/batch")
async def convert_batch(
    files: list[UploadFile] = File(...),
    ocr_enabled: bool = Form(False),
    table_extraction: bool = Form(True)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    results = []
    upload_dir = "static/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    options = {
        "ocr": ocr_enabled,
        "table_extraction": table_extraction
    }

    for file in files:
        try:
            content = await file.read()
            file_path = os.path.join(upload_dir, file.filename)
            with open(file_path, "wb") as f:
                f.write(content)
                
            result = process_document(content, file.filename, options)
            result["file_url"] = f"/static/uploads/{file.filename}"
            if result["status"] == "success":
                # Save to DB
                session_id = db.create_session(file.filename, file_path, result["markdown"])
                result["session_id"] = session_id
                
                # Index in ChromaDB
                if rag_engine:
                    rag_engine.index_document(session_id, result["markdown"])
                results.append(result)
            else:
                results.append({"filename": file.filename, "status": "error", "error": result.get("error", "Unknown error")})
                
        except Exception as e:
             results.append({"filename": file.filename, "status": "error", "error": str(e)})

    return {"results": results}

class ChatRequest(BaseModel):
    query: str
    context: str

# Legacy chat endpoint (optional, but keeping for compatibility if needed, or redirecting to use generic one)
@app.post("/chat")
async def chat_with_document(request: ChatRequest):
    if not rag_engine:
        raise HTTPException(status_code=500, detail="RAG Engine not initialized (check API Key)")
    
    response = rag_engine.chat(request.query, request.context)
    return {"response": response}

# --- History Endpoints ---

@app.get("/sessions")
async def get_sessions():
    return {"sessions": db.get_all_sessions()}

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

class SessionChatRequest(BaseModel):
    query: str

@app.post("/sessions/{session_id}/chat")
async def session_chat(session_id: str, request: SessionChatRequest):
    session_data = db.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if not rag_engine:
        raise HTTPException(status_code=500, detail="RAG Engine not initialized")

    # Add user message to DB
    db.add_message(session_id, "user", request.query)

    # Generate response (Using ChromaDB)
    # context = session_data["session"]["markdown_content"] # No longer needed, RAG retrieves from DB
    response = rag_engine.chat(request.query, session_id)
    
    # Add AI message to DB
    db.add_message(session_id, "ai", response)
    
    return {"response": response}

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    db.delete_session(session_id)
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
