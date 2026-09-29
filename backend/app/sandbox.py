import asyncio
import os
import sys
import json
import time
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, Optional

from app.schemas import ExecutionResult
from app.config import settings

# Code wrapper template ensuring headless execution and automatic Plotly figure serialization
SANDBOX_WRAPPER_TEMPLATE = """
import sys
import os
import json

# Ensure headless execution for plotting libraries
os.environ["MPLBACKEND"] = "Agg"

import pandas as pd
import numpy as np

# Intercept and auto-export plotly charts
try:
    import plotly
    import plotly.express as px
    import plotly.graph_objects as go
    import plotly.io as pio

    # Patch pio.show to save JSON instead of opening browser
    def custom_show(fig, *args, **kwargs):
        with open("output_plot.json", "w", encoding="utf-8") as f:
            f.write(fig.to_json())
    pio.show = custom_show
except ImportError:
    pass

# User dataset path
DATASET_PATH = r"{dataset_path}"

# --- USER GENERATED CODE BEGINS ---
{user_code}
# --- USER GENERATED CODE ENDS ---

# Check if a plotly figure 'fig' exists in global scope and wasn't explicitly saved
try:
    if 'fig' in locals() and hasattr(locals()['fig'], 'to_json'):
        if not os.path.exists("output_plot.json"):
            with open("output_plot.json", "w", encoding="utf-8") as f:
                f.write(locals()['fig'].to_json())
except Exception as e:
    sys.stderr.write(f"Warning saving figure: {{e}}\\n")
"""

class CodeSandbox:
    def __init__(self, timeout_seconds: int = 15):
        self.timeout_seconds = timeout_seconds

    async def run_code(self, code: str, dataset_path: str) -> ExecutionResult:
        """
        Executes Python code in an isolated subprocess with timeout guardrails,
        capturing stdout, stderr, exit code, and extracted Plotly charts.
        """
        start_time = time.time()
        dataset_abs_path = os.path.abspath(dataset_path)

        # Create isolated temporary directory
        temp_dir = tempfile.mkdtemp(prefix="agent_sandbox_")

        try:
            # Prepare wrapped code
            wrapped_code = SANDBOX_WRAPPER_TEMPLATE.format(
                dataset_path=dataset_abs_path,
                user_code=code
            )

            script_file = Path(temp_dir) / "run_analysis.py"
            with open(script_file, "w", encoding="utf-8") as f:
                f.write(wrapped_code)

            # Python executable (same venv as backend)
            python_executable = sys.executable

            # Launch subprocess
            proc = await asyncio.create_subprocess_exec(
                python_executable,
                str(script_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir,
                env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"}
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=self.timeout_seconds
                )
                exit_code = proc.returncode if proc.returncode is not None else 0
                stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
                stderr = stderr_bytes.decode("utf-8", errors="replace").strip()
            except asyncio.TimeoutError:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass
                exit_code = -1
                stdout = ""
                stderr = f"Execution timed out after {self.timeout_seconds} seconds. Optimization or row sampling recommended."

            elapsed_time = round(time.time() - start_time, 3)

            # Check for exported plotly figure
            plot_file = Path(temp_dir) / "output_plot.json"
            plot_spec: Optional[Dict[str, Any]] = None
            has_plot = False

            if plot_file.exists():
                try:
                    with open(plot_file, "r", encoding="utf-8") as f:
                        plot_spec = json.load(f)
                        has_plot = True
                except Exception as e:
                    stderr += f"\nFailed to parse generated plot JSON: {str(e)}"

            error_message = stderr if exit_code != 0 else None

            return ExecutionResult(
                exit_code=exit_code,
                stdout=stdout,
                stderr=stderr,
                duration_seconds=elapsed_time,
                has_plot=has_plot,
                plot_spec=plot_spec,
                error_message=error_message
            )

        finally:
            # Clean up sandbox temp dir
            try:
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass

sandbox_runner = CodeSandbox(timeout_seconds=settings.MAX_EXECUTION_TIME)
