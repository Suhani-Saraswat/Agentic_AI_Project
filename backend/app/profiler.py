import json
import sqlite3
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

from app.schemas import DatasetProfile, ColumnProfile, ColumnSummaryStats

def clean_value_for_json(val: Any) -> Any:
    """Convert numpy / pandas values into JSON-serializable Python native types."""
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        if np.isnan(val) or np.isinf(val):
            return None
        return round(float(val), 4)
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (pd.Timestamp, pd.Timedelta)):
        return str(val)
    return str(val)

def load_dataset_to_dataframe(file_path: str) -> pd.DataFrame:
    """Loads a structured file (CSV, XLSX, JSON, SQLite) into a pandas DataFrame."""
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".csv":
        return pd.read_csv(file_path, low_memory=False)
    elif ext in [".xlsx", ".xls"]:
        return pd.read_excel(file_path)
    elif ext == ".json":
        try:
            return pd.read_json(file_path)
        except ValueError:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return pd.json_normalize(data)
    elif ext in [".sqlite", ".db", ".sqlite3"]:
        conn = sqlite3.connect(file_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        if not tables:
            conn.close()
            raise ValueError("No tables found in SQLite database.")
        first_table = tables[0][0]
        df = pd.read_sql_query(f"SELECT * FROM {first_table}", conn)
        conn.close()
        return df
    elif ext == ".parquet":
        return pd.read_parquet(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

def profile_dataset(file_path: str, dataset_id: str) -> DatasetProfile:
    """Automated dataset profiler computing schemas, missing data, and statistical summaries."""
    path = Path(file_path)
    df = load_dataset_to_dataframe(file_path)

    total_rows = len(df)
    total_cols = len(df.columns)
    memory_kb = round(df.memory_usage(deep=True).sum() / 1024.0, 2)

    column_profiles: List[ColumnProfile] = []

    for col in df.columns:
        series = df[col]
        null_count = int(series.isna().sum())
        non_null_count = total_rows - null_count
        null_pct = round((null_count / total_rows * 100.0) if total_rows > 0 else 0.0, 2)
        unique_cnt = int(series.nunique(dropna=True))

        # Sample values (up to 5 non-null distinct items)
        samples = [clean_value_for_json(v) for v in series.dropna().unique()[:5]]

        # Compute summary stats
        summary = ColumnSummaryStats()
        if pd.api.types.is_numeric_dtype(series):
            valid_nums = series.dropna()
            if not valid_nums.empty:
                summary.mean = clean_value_for_json(valid_nums.mean())
                summary.std = clean_value_for_json(valid_nums.std())
                summary.min = clean_value_for_json(valid_nums.min())
                summary.max = clean_value_for_json(valid_nums.max())
                summary.median = clean_value_for_json(valid_nums.median())
                summary.q25 = clean_value_for_json(valid_nums.quantile(0.25))
                summary.q75 = clean_value_for_json(valid_nums.quantile(0.75))
        elif pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series) or isinstance(series.dtype, pd.CategoricalDtype):
            top_vals = series.value_counts().head(5).to_dict()
            summary.top_values = {str(k): int(v) for k, v in top_vals.items()}

        col_profile = ColumnProfile(
            name=str(col),
            dtype=str(series.dtype),
            non_null_count=non_null_count,
            null_count=null_count,
            null_percentage=null_pct,
            unique_count=unique_cnt,
            sample_values=samples,
            summary_stats=summary
        )
        column_profiles.append(col_profile)

    # Preview rows (first 10 rows)
    preview_df = df.head(10).copy()
    preview_rows: List[Dict[str, Any]] = []
    for _, row in preview_df.iterrows():
        clean_row = {str(k): clean_value_for_json(v) for k, v in row.items()}
        preview_rows.append(clean_row)

    return DatasetProfile(
        dataset_id=dataset_id,
        filename=path.name,
        file_type=path.suffix.lstrip(".").lower(),
        row_count=total_rows,
        column_count=total_cols,
        memory_usage_kb=memory_kb,
        columns=column_profiles,
        preview_rows=preview_rows
    )

def format_profile_for_llm(profile: DatasetProfile) -> str:
    """Formats the profile into a clean prompt context for LLM code generation & planning."""
    lines = [
        f"Dataset: {profile.filename} ({profile.file_type.upper()})",
        f"Dimensions: {profile.row_count} rows, {profile.column_count} columns",
        "Columns & Types:"
    ]
    for c in profile.columns:
        stats_str = ""
        if c.summary_stats:
            if c.summary_stats.min is not None and c.summary_stats.max is not None:
                stats_str = f" [Range: {c.summary_stats.min} to {c.summary_stats.max}, Mean: {c.summary_stats.mean}]"
            elif c.summary_stats.top_values:
                top_keys = list(c.summary_stats.top_values.keys())[:3]
                stats_str = f" [Top values: {', '.join(top_keys)}]"
        lines.append(f"  - '{c.name}' ({c.dtype}): {c.null_percentage}% missing, {c.unique_count} unique values{stats_str}")

    return "\n".join(lines)
