import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Plotly from 'plotly.js-dist-min';
import { BarChart3, FileText, Download, Sparkles, CheckCircle } from 'lucide-react';
import { AnalysisReport } from '../types';

interface ReportViewProps {
  report: AnalysisReport | null;
  plotSpec: Record<string, any> | null;
  executiveSummary: string;
}

export const ReportView: React.FC<ReportViewProps> = ({
  report,
  plotSpec,
  executiveSummary
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'both' | 'chart' | 'summary'>('both');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Render or update Plotly chart when plotSpec changes
  useEffect(() => {
    if (chartContainerRef.current && plotSpec) {
      try {
        const figure = typeof plotSpec === 'string' ? JSON.parse(plotSpec) : plotSpec;
        const data = figure.data || [];
        const layout = {
          ...figure.layout,
          autosize: true,
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(15,23,42,0.6)',
          font: {
            family: 'Inter, sans-serif',
            color: '#cbd5e1',
            size: 12
          },
          margin: { t: 50, r: 30, l: 50, b: 50 },
          grid: { color: 'rgba(255,255,255,0.06)' },
        };

        const config: any = {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d']
        };

        Plotly.newPlot(chartContainerRef.current, data, layout, config);

        const handleResize = () => {
          if (chartContainerRef.current) {
            Plotly.Plots.resize(chartContainerRef.current);
          }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
      } catch (err) {
        console.error('Failed to render Plotly chart:', err);
      }
    }
  }, [plotSpec, activeTab]);

  const downloadMarkdownReport = () => {
    if (!executiveSummary) return;
    const blob = new Blob([executiveSummary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autonomous_analysis_report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  if (!plotSpec && !executiveSummary) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-200 mb-1">
          Awaiting Analysis Execution
        </h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Interactive Plotly charts and AI synthesized executive insights will automatically render here once the agent completes execution.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 flex flex-col">
      {/* Header bar */}
      <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Analysis Results & Synthesis
            </h3>
            {report?.query && (
              <p className="text-xs text-slate-400 italic truncate max-w-md">
                "{report.query}"
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('both')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'both' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Split View
            </button>
            {plotSpec && (
              <button
                onClick={() => setActiveTab('chart')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'chart' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chart Only
              </button>
            )}
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === 'summary' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Executive Summary
            </button>
          </div>

          <button
            onClick={downloadMarkdownReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
          >
            {downloadSuccess ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        <div className={`grid gap-6 ${activeTab === 'both' && plotSpec ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Plotly Chart Card */}
          {(activeTab === 'both' || activeTab === 'chart') && plotSpec && (
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                  Interactive Plotly Specification
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Zoom • Pan • Hover</span>
              </div>
              <div
                ref={chartContainerRef}
                className="w-full h-[400px] rounded-lg overflow-hidden"
              />
            </div>
          )}

          {/* Executive Summary Markdown Card */}
          {(activeTab === 'both' || activeTab === 'summary') && (
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5 overflow-y-auto max-h-[460px]">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Executive Intelligence Report
                </h4>
              </div>

              <div className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed space-y-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {executiveSummary || 'No summary generated.'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
