from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime

class ColumnSummaryStats(BaseModel):
    mean: Optional[float] = None
    std: Optional[float] = None
    min: Optional[Union[float, str]] = None
    max: Optional[Union[float, str]] = None
    median: Optional[float] = None
    q25: Optional[float] = None
    q75: Optional[float] = None
    top_values: Optional[Dict[str, int]] = None

class ColumnProfile(BaseModel):
    name: str
    dtype: str
    non_null_count: int
    null_count: int
    null_percentage: float
    unique_count: int
    sample_values: List[Any] = Field(default_factory=list)
    summary_stats: Optional[ColumnSummaryStats] = None

class DatasetProfile(BaseModel):
    dataset_id: str
    filename: str
    file_type: str
    row_count: int
    column_count: int
    memory_usage_kb: float
    columns: List[ColumnProfile]
    preview_rows: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UploadResponse(BaseModel):
    success: bool
    message: str
    profile: DatasetProfile

class AnalysisRequest(BaseModel):
    dataset_id: str
    query: str
    provider: Optional[str] = None
    model: Optional[str] = None

class PlanStep(BaseModel):
    step_number: int
    title: str
    description: str
    status: str = "pending"  # pending, in_progress, completed, failed

class ExecutionResult(BaseModel):
    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float
    has_plot: bool = False
    plot_spec: Optional[Dict[str, Any]] = None
    generated_files: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None

class AnalysisReport(BaseModel):
    session_id: str
    dataset_id: str
    query: str
    plan: List[str]
    generated_code: str
    code_history: List[str] = Field(default_factory=list)
    execution_result: Optional[ExecutionResult] = None
    plot_spec: Optional[Dict[str, Any]] = None
    executive_summary: str
    key_insights: List[str] = Field(default_factory=list)
    retries_taken: int = 0
    total_time_seconds: float = 0.0

class WebSocketMessage(BaseModel):
    type: str  # "status" | "plan" | "code" | "log" | "retry" | "plot" | "report" | "error"
    step: str  # "planner" | "codegen" | "executor" | "self_correction" | "synthesizer" | "init" | "done"
    message: str
    payload: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
