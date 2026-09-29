import React, { useState } from 'react';
import { Table, BarChart2, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { DatasetProfile } from '../types';

interface DatasetPreviewProps {
  profile: DatasetProfile;
}

export const DatasetPreview: React.FC<DatasetPreviewProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'schema' | 'sample'>('schema');
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 transition-all duration-300">
      {/* Header bar */}
      <div className="p-4 bg-slate-900/60 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-200">{profile.filename}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded uppercase font-mono bg-slate-800 text-slate-400">
                {profile.file_type}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {profile.row_count.toLocaleString()} rows • {profile.column_count} columns • {profile.memory_usage_kb} KB
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('schema')}
              className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                activeTab === 'schema'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Schema & Profiling
            </button>
            <button
              onClick={() => setActiveTab('sample')}
              className={`px-3 py-1 rounded-md transition-all font-medium flex items-center gap-1.5 ${
                activeTab === 'sample'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              Preview Rows
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          {activeTab === 'schema' ? (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                    <th className="py-2.5 px-3">Column</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Missing</th>
                    <th className="py-2.5 px-3">Uniques</th>
                    <th className="py-2.5 px-3">Distribution / Stats</th>
                    <th className="py-2.5 px-3">Samples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {profile.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 font-semibold text-slate-200">{col.name}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-800 text-purple-300">
                          {col.dtype}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full ${col.null_percentage > 10 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${Math.min(col.null_percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-slate-400 text-[11px]">{col.null_percentage}%</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{col.unique_count}</td>
                      <td className="py-2 px-3 text-slate-400 text-[11px] font-sans">
                        {col.summary_stats?.mean !== undefined && col.summary_stats?.mean !== null ? (
                          <div className="flex gap-2">
                            <span>Mean: <b className="text-slate-200">{col.summary_stats.mean}</b></span>
                            <span>Range: [{col.summary_stats.min} → {col.summary_stats.max}]</span>
                          </div>
                        ) : col.summary_stats?.top_values ? (
                          <div className="truncate max-w-xs text-slate-300">
                            {Object.entries(col.summary_stats.top_values).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ')}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[11px]">
                        <span className="truncate max-w-[150px] inline-block">
                          {col.sample_values.slice(0, 3).join(', ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                    <th className="py-2.5 px-3">#</th>
                    {profile.columns.map((c) => (
                      <th key={c.name} className="py-2.5 px-3 whitespace-nowrap">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {profile.preview_rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                      {profile.columns.map((col) => (
                        <td key={col.name} className="py-2 px-3 text-slate-300 whitespace-nowrap">
                          {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : (
                            <span className="text-slate-600 italic">null</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
