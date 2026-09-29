import os
import json
import re
from typing import List, Dict, Any, Optional, Callable, Awaitable
from typing_extensions import TypedDict
from datetime import datetime

from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, SystemMessage

from app.schemas import DatasetProfile, ExecutionResult
from app.sandbox import sandbox_runner
from app.config import settings

# ---------------------------------------------------------
# State Definition for LangGraph State Machine
# ---------------------------------------------------------
class AgentState(TypedDict):
    dataset_path: str
    dataset_profile_str: str
    user_query: str
    provider: str
    model: str
    plan: List[str]
    generated_code: str
    code_history: List[str]
    execution_result: Optional[Dict[str, Any]]
    error_message: Optional[str]
    retry_count: int
    max_retries: int
    plot_spec: Optional[Dict[str, Any]]
    markdown_report: str
    status: str
    logs: List[Dict[str, Any]]

# Type for WebSocket progress streaming callback
StreamCallback = Callable[[str, str, str, Optional[Dict[str, Any]]], Awaitable[None]]

# ---------------------------------------------------------
# LLM Factory supporting OpenAI, Anthropic, Ollama, & Mock
# ---------------------------------------------------------
def get_llm(provider: str, model: str):
    provider = provider.lower() if provider else settings.DEFAULT_LLM_PROVIDER.lower()
    model = model or settings.DEFAULT_MODEL_NAME

    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            return MockLLM()
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.1
        )
    elif provider == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            return MockLLM()
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model,
            api_key=settings.ANTHROPIC_API_KEY,
            temperature=0.1
        )
    elif provider == "ollama":
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=model,
            temperature=0.1
        )
    else:
        return MockLLM()

class MockLLMResponse:
    def __init__(self, content: str):
        self.content = content

class MockLLM:
    """Intelligent fallback generator when no live API key is configured."""
    def invoke(self, messages: List[Any]) -> MockLLMResponse:
        full_prompt = " ".join([m.content for m in messages if hasattr(m, 'content')]).lower()

        if "planner" in full_prompt or "step-by-step plan" in full_prompt:
            return MockLLMResponse(
                "1. Load and inspect the dataset schema and data distributions.\n"
                "2. Perform data cleaning, handling null values, and parsing date/numeric columns.\n"
                "3. Calculate aggregated descriptive metrics and grouping relevant to the user query.\n"
                "4. Construct an interactive Plotly visualization to highlight key trends and outliers.\n"
                "5. Print key findings to stdout for synthesis."
            )
        elif "self-correction" in full_prompt or "stack trace" in full_prompt:
            return MockLLMResponse(
                "```python\n"
                "# Corrected script resolving missing columns and dtype mismatches\n"
                "import pandas as pd\n"
                "import plotly.express as px\n"
                "\n"
                "df = pd.read_csv(DATASET_PATH)\n"
                "# Fallback safe aggregation\n"
                "numeric_cols = df.select_dtypes(include=['number']).columns.tolist()\n"
                "if len(numeric_cols) > 0:\n"
                "    summary = df.describe().T\n"
                "    print('Summary Statistics:\\n', summary[['mean', 'std', 'min', 'max']])\n"
                "    fig = px.histogram(df, x=numeric_cols[0], title=f'Distribution of {numeric_cols[0]}', template='plotly_dark')\n"
                "    fig.show()\n"
                "else:\n"
                "    print('No numeric columns detected.')\n"
                "```"
            )
        elif "code generator" in full_prompt or "python" in full_prompt:
            return MockLLMResponse(
                "```python\n"
                "# Autonomous Data Analysis Script\n"
                "import pandas as pd\n"
                "import plotly.express as px\n"
                "\n"
                "# Load the dataset using injected path\n"
                "df = pd.read_csv(DATASET_PATH)\n"
                "print(f'Total records analyzed: {len(df)}')\n"
                "\n"
                "# Identify column types\n"
                "num_cols = df.select_dtypes(include=['number']).columns.tolist()\n"
                "cat_cols = df.select_dtypes(include=['object', 'category', 'string']).columns.tolist()\n"
                "\n"
                "if len(cat_cols) > 0 and len(num_cols) > 0:\n"
                "    group_col = cat_cols[0]\n"
                "    metric_col = num_cols[0]\n"
                "    agg_df = df.groupby(group_col)[metric_col].agg(['mean', 'sum', 'count']).reset_index()\n"
                "    agg_df = agg_df.sort_values(by='sum', ascending=False).head(10)\n"
                "    print('Top Aggregations:\\n', agg_df)\n"
                "    fig = px.bar(agg_df, x=group_col, y='sum', color='mean', title=f'Aggregated {metric_col} by {group_col}', template='plotly_dark')\n"
                "    fig.show()\n"
                "elif len(num_cols) >= 2:\n"
                "    print('Correlation matrix:\\n', df[num_cols].corr())\n"
                "    fig = px.scatter(df, x=num_cols[0], y=num_cols[1], title=f'{num_cols[0]} vs {num_cols[1]}', template='plotly_dark')\n"
                "    fig.show()\n"
                "elif len(num_cols) == 1:\n"
                "    print('Descriptive stats:\\n', df[num_cols[0]].describe())\n"
                "    fig = px.histogram(df, x=num_cols[0], title=f'Distribution of {num_cols[0]}', template='plotly_dark')\n"
                "    fig.show()\n"
                "else:\n"
                "    print('Non-numeric summary:\\n', df.describe())\n"
                "```"
            )
        else:
            return MockLLMResponse(
                "### Executive Summary\n\n"
                "The automated exploratory analysis has completed successfully across the dataset.\n\n"
                "#### Key Findings\n"
                "- **Data Integrity:** Dataset schema was validated with complete record traversal.\n"
                "- **Primary Distributions:** Significant variance observed across leading numerical and categorical indicators.\n"
                "- **Visual Insights:** The interactive chart reveals segment-level concentration and high-value performance clusters.\n\n"
                "#### Recommended Actions\n"
                "- Drill down into top quartile performers for granular cohort retention.\n"
                "- Investigate anomalies flagged in the upper percentile thresholds."
            )

# ---------------------------------------------------------
# Helper to extract Python code from markdown blocks
# ---------------------------------------------------------
def clean_code_block(text: str) -> str:
    pattern = r"```(?:python)?\s*(.*?)\s*```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()

# ---------------------------------------------------------
# LangGraph Nodes
# ---------------------------------------------------------

async def planner_node(state: AgentState, stream_cb: Optional[StreamCallback] = None) -> Dict[str, Any]:
    """Node 1: Parses user intent and creates step-by-step plan."""
    if stream_cb:
        await stream_cb("status", "planner", "Analyzing schema and planning execution strategy...", None)

    llm = get_llm(state["provider"], state["model"])
    prompt = [
        SystemMessage(content=(
            "You are a Principal Data Scientist and Analytics Architect. "
            "Given a dataset schema and user query, create a concise 3 to 5 step analytical plan. "
            "Return numbered steps only."
        )),
        HumanMessage(content=(
            f"Dataset Profile:\n{state['dataset_profile_str']}\n\n"
            f"User Query: {state['user_query']}\n\n"
            "Provide the step-by-step analytical plan:"
        ))
    ]

    response = llm.invoke(prompt)
    plan_lines = [line.strip() for line in response.content.split("\n") if line.strip() and line[0].isdigit()]
    if not plan_lines:
        plan_lines = [line.strip() for line in response.content.split("\n") if line.strip()][:5]

    if stream_cb:
        await stream_cb("plan", "planner", "Analytical plan generated", {"plan": plan_lines})

    return {
        "plan": plan_lines,
        "status": "planned"
    }

async def code_generator_node(state: AgentState, stream_cb: Optional[StreamCallback] = None) -> Dict[str, Any]:
    """Node 2: Generates executable Python code using Pandas, Plotly, etc."""
    if stream_cb:
        await stream_cb("status", "codegen", "Generating Python Pandas & Plotly code...", None)

    llm = get_llm(state["provider"], state["model"])
    prompt = [
        SystemMessage(content=(
            "You are an expert Python Data Engineer. Write clean, robust, executable Python code "
            "to answer the analytical plan and query using Pandas, NumPy, and Plotly (px or go).\n"
            "IMPORTANT RULES:\n"
            "1. The variable `DATASET_PATH` is already pre-defined. Load it with `pd.read_csv(DATASET_PATH)` or appropriate pd loader.\n"
            "2. Always print key analytical summaries and numerical findings using `print(...)` so stdout captures metrics.\n"
            "3. Create an interactive Plotly figure assigned to variable `fig` and call `fig.show()`.\n"
            "4. Do NOT use markdown outside ```python code blocks. Do not ask for user input. Do not import unsupported packages."
        )),
        HumanMessage(content=(
            f"Dataset Profile:\n{state['dataset_profile_str']}\n\n"
            f"Plan:\n" + "\n".join(state["plan"]) + f"\n\n"
            f"User Query: {state['user_query']}\n\n"
            "Output Python code in a ```python block:"
        ))
    ]

    response = llm.invoke(prompt)
    clean_code = clean_code_block(response.content)

    if stream_cb:
        await stream_cb("code", "codegen", "Python code generated", {"code": clean_code})

    return {
        "generated_code": clean_code,
        "code_history": state["code_history"] + [clean_code],
        "status": "code_generated"
    }

async def executor_node(state: AgentState, stream_cb: Optional[StreamCallback] = None) -> Dict[str, Any]:
    """Node 3: Executes code in isolated sandbox and captures stdout/stderr/Plotly."""
    if stream_cb:
        await stream_cb("status", "executor", f"Executing code in sandbox (Attempt {state['retry_count'] + 1})...", None)

    result: ExecutionResult = await sandbox_runner.run_code(
        code=state["generated_code"],
        dataset_path=state["dataset_path"]
    )

    log_entry = {
        "attempt": state["retry_count"] + 1,
        "exit_code": result.exit_code,
        "duration": result.duration_seconds,
        "stdout": result.stdout,
        "stderr": result.stderr
    }

    if stream_cb:
        await stream_cb(
            "log",
            "executor",
            f"Execution finished with exit code {result.exit_code} in {result.duration_seconds}s",
            log_entry
        )
        if result.has_plot and result.plot_spec:
            await stream_cb("plot", "executor", "Generated interactive Plotly visualization", {"plot_spec": result.plot_spec})

    return {
        "execution_result": result.model_dump(),
        "error_message": result.error_message,
        "plot_spec": result.plot_spec,
        "logs": state["logs"] + [log_entry],
        "status": "executed"
    }

async def self_correction_node(state: AgentState, stream_cb: Optional[StreamCallback] = None) -> Dict[str, Any]:
    """Node 4: Evaluates runtime errors, explains root cause, and generates fixed code."""
    new_retry_count = state["retry_count"] + 1
    err = state["error_message"] or "Unknown runtime error"

    if stream_cb:
        await stream_cb(
            "retry",
            "self_correction",
            f"Self-correcting runtime error (Retry {new_retry_count} of {state['max_retries']})...",
            {"error": err}
        )

    llm = get_llm(state["provider"], state["model"])
    prompt = [
        SystemMessage(content=(
            "You are a Senior Python Debugging Specialist. The previous Python code executed in a sandbox "
            "and threw an error or timed out.\n"
            "Analyze the stack trace, diagnose the root cause, and provide a corrected, robust script.\n"
            "Follow the exact same rules: use `DATASET_PATH`, print key metrics, create `fig`, call `fig.show()`.\n"
            "Return ONLY the fixed code within a ```python block."
        )),
        HumanMessage(content=(
            f"Dataset Profile:\n{state['dataset_profile_str']}\n\n"
            f"Failed Code:\n```python\n{state['generated_code']}\n```\n\n"
            f"Runtime Error / Stderr:\n{err}\n\n"
            "Provide the revised, fixed Python script:"
        ))
    ]

    response = llm.invoke(prompt)
    fixed_code = clean_code_block(response.content)

    if stream_cb:
        await stream_cb("code", "self_correction", "Self-corrected code generated", {"code": fixed_code})

    return {
        "generated_code": fixed_code,
        "code_history": state["code_history"] + [fixed_code],
        "retry_count": new_retry_count,
        "status": "self_corrected"
    }

async def synthesizer_node(state: AgentState, stream_cb: Optional[StreamCallback] = None) -> Dict[str, Any]:
    """Node 5: Synthesizes stdout numbers, findings, and charts into executive Markdown."""
    if stream_cb:
        await stream_cb("status", "synthesizer", "Synthesizing executive summary and final report...", None)

    exec_result = state.get("execution_result") or {}
    stdout = exec_result.get("stdout", "")
    stderr = exec_result.get("stderr", "")
    exit_code = exec_result.get("exit_code", 0)

    llm = get_llm(state["provider"], state["model"])
    prompt = [
        SystemMessage(content=(
            "You are a Principal Business Intelligence & Data Science Lead. "
            "Write an executive-ready Markdown report summarizing the analytical findings.\n"
            "Structure:\n"
            "- ### Executive Summary\n"
            "- #### Key Numerical Insights (cite exact numbers from stdout)\n"
            "- #### Visualization Interpretation\n"
            "- #### Strategic Recommendations\n"
            "Be precise, clear, and professional."
        )),
        HumanMessage(content=(
            f"User Query: {state['user_query']}\n"
            f"Code Executed:\n```python\n{state['generated_code']}\n```\n\n"
            f"Execution Stdout:\n{stdout}\n\n"
            f"Execution Stderr / Errors:\n{stderr}\n\n"
            f"Exit Code: {exit_code}\n\n"
            "Generate the final Markdown report:"
        ))
    ]

    response = llm.invoke(prompt)
    report = response.content

    if stream_cb:
        await stream_cb("report", "synthesizer", "Analysis complete", {"report": report})

    return {
        "markdown_report": report,
        "status": "completed"
    }

# ---------------------------------------------------------
# Conditional Router Function
# ---------------------------------------------------------
def routing_after_execution(state: AgentState) -> str:
    exec_result = state.get("execution_result") or {}
    exit_code = exec_result.get("exit_code", 0)
    has_error = exit_code != 0 or bool(state.get("error_message"))

    if not has_error:
        return "synthesizer"

    if state["retry_count"] < state["max_retries"]:
        return "self_correction"

    return "synthesizer"

# ---------------------------------------------------------
# Build LangGraph Workflow
# ---------------------------------------------------------
def create_analysis_graph(stream_cb: Optional[StreamCallback] = None):
    workflow = StateGraph(AgentState)

    # Wrap nodes with optional streaming callback
    async def _planner(state: AgentState):
        return await planner_node(state, stream_cb)

    async def _codegen(state: AgentState):
        return await code_generator_node(state, stream_cb)

    async def _executor(state: AgentState):
        return await executor_node(state, stream_cb)

    async def _self_correction(state: AgentState):
        return await self_correction_node(state, stream_cb)

    async def _synthesizer(state: AgentState):
        return await synthesizer_node(state, stream_cb)

    workflow.add_node("planner", _planner)
    workflow.add_node("code_generator", _codegen)
    workflow.add_node("executor", _executor)
    workflow.add_node("self_correction", _self_correction)
    workflow.add_node("synthesizer", _synthesizer)

    workflow.set_entry_point("planner")
    workflow.add_edge("planner", "code_generator")
    workflow.add_edge("code_generator", "executor")

    workflow.add_conditional_edges(
        "executor",
        routing_after_execution,
        {
            "synthesizer": "synthesizer",
            "self_correction": "self_correction"
        }
    )

    workflow.add_edge("self_correction", "executor")
    workflow.add_edge("synthesizer", END)

    return workflow.compile()
