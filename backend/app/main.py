import uuid
import os
import shutil
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.schemas import (
    UploadResponse,
    DatasetProfile,
    AnalysisRequest,
    AnalysisReport,
    WebSocketMessage,
    ExecutionResult
)
from app.profiler import profile_dataset, format_profile_for_llm
from app.agent import create_analysis_graph, AgentState

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentic_data_analysis")

app = FastAPI(
    title="Autonomous Data Analysis Agent API",
    description="Backend API with LangGraph, isolated code sandbox, and WebSocket streaming.",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory registry of datasets (persisted metadata can also be stored in SQLite/Redis)
DATASET_REGISTRY: Dict[str, Dict[str, Any]] = {}

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "llm_provider": settings.DEFAULT_LLM_PROVIDER,
        "model": settings.DEFAULT_MODEL_NAME,
        "max_timeout_seconds": settings.MAX_EXECUTION_TIME,
        "max_retries": settings.MAX_RETRIES,
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "anthropic_configured": bool(settings.ANTHROPIC_API_KEY)
    }

@app.post("/api/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """Uploads a CSV, XLSX, JSON, or SQLite dataset and returns an automated profile."""
    filename = file.filename or "uploaded_dataset"
    ext = Path(filename).suffix.lower()

    allowed_extensions = {".csv", ".xlsx", ".xls", ".json", ".sqlite", ".db", ".parquet"}
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed types: {', '.join(allowed_extensions)}"
        )

    dataset_id = str(uuid.uuid4())[:8]
    saved_filename = f"{dataset_id}_{filename}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)

    try:
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Profile the dataset
        profile = profile_dataset(saved_path, dataset_id=dataset_id)

        # Store in registry
        DATASET_REGISTRY[dataset_id] = {
            "file_path": saved_path,
            "profile": profile
        }

        return UploadResponse(
            success=True,
            message="Dataset uploaded and profiled successfully.",
            profile=profile
        )

    except Exception as e:
        logger.error(f"Error processing dataset upload: {str(e)}", exc_info=True)
        if os.path.exists(saved_path):
            os.remove(saved_path)
        raise HTTPException(status_code=500, detail=f"Failed to profile dataset: {str(e)}")

@app.get("/api/datasets/{dataset_id}", response_model=DatasetProfile)
async def get_dataset(dataset_id: str):
    """Retrieves profile and schema metadata for a previously uploaded dataset."""
    if dataset_id not in DATASET_REGISTRY:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return DATASET_REGISTRY[dataset_id]["profile"]

@app.websocket("/ws/analyze/{session_id}")
async def websocket_analyze_endpoint(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint handling real-time agent execution streaming.
    Streams planner stages, code generation, execution output, self-corrections, and final report.
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected: session_id={session_id}")

    async def send_ws_message(msg_type: str, step: str, message: str, payload: Optional[Dict[str, Any]] = None):
        msg = WebSocketMessage(
            type=msg_type,
            step=step,
            message=message,
            payload=payload
        )
        try:
            await websocket.send_text(msg.model_dump_json())
        except Exception as e:
            logger.warning(f"Error sending message to client {session_id}: {e}")

    try:
        # Wait for analysis request from client
        raw_data = await websocket.receive_text()
        req_data = json.loads(raw_data)
        dataset_id = req_data.get("dataset_id")
        user_query = req_data.get("query", "").strip()
        provider = req_data.get("provider") or settings.DEFAULT_LLM_PROVIDER
        model = req_data.get("model") or settings.DEFAULT_MODEL_NAME

        if not dataset_id or dataset_id not in DATASET_REGISTRY:
            await send_ws_message("error", "init", f"Dataset '{dataset_id}' not found. Please upload first.", None)
            await websocket.close()
            return

        if not user_query:
            await send_ws_message("error", "init", "Analysis query cannot be empty.", None)
            await websocket.close()
            return

        dataset_entry = DATASET_REGISTRY[dataset_id]
        dataset_path = dataset_entry["file_path"]
        profile: DatasetProfile = dataset_entry["profile"]
        profile_str = format_profile_for_llm(profile)

        await send_ws_message("status", "init", f"Starting analysis for query: '{user_query}'", {
            "dataset_name": profile.filename,
            "rows": profile.row_count,
            "columns": profile.column_count
        })

        # Compile LangGraph with streaming callback
        graph = create_analysis_graph(stream_cb=send_ws_message)

        initial_state: AgentState = {
            "dataset_path": dataset_path,
            "dataset_profile_str": profile_str,
            "user_query": user_query,
            "provider": provider,
            "model": model,
            "plan": [],
            "generated_code": "",
            "code_history": [],
            "execution_result": None,
            "error_message": None,
            "retry_count": 0,
            "max_retries": settings.MAX_RETRIES,
            "plot_spec": None,
            "markdown_report": "",
            "status": "initialized",
            "logs": []
        }

        # Run the LangGraph state machine
        final_state = await graph.ainvoke(initial_state)

        # Assemble final structured report
        exec_dict = final_state.get("execution_result") or {}
        exec_res = ExecutionResult(**exec_dict) if exec_dict else None

        final_report = AnalysisReport(
            session_id=session_id,
            dataset_id=dataset_id,
            query=user_query,
            plan=final_state.get("plan", []),
            generated_code=final_state.get("generated_code", ""),
            code_history=final_state.get("code_history", []),
            execution_result=exec_res,
            plot_spec=final_state.get("plot_spec"),
            executive_summary=final_state.get("markdown_report", ""),
            key_insights=[],
            retries_taken=final_state.get("retry_count", 0),
            total_time_seconds=sum(l.get("duration", 0) for l in final_state.get("logs", []))
        )

        await send_ws_message("report", "done", "Workflow complete", final_report.model_dump())

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: session_id={session_id}")
    except Exception as e:
        logger.error(f"Error during agent execution: {str(e)}", exc_info=True)
        await send_ws_message("error", "executor", f"Analysis error: {str(e)}", {"error": str(e)})
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
