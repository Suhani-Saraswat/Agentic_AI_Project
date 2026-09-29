import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon,
  RotateCcw,
  Code2,
  Copy,
  Check,
  Cpu,
  ChevronRight
} from 'lucide-react';
import { TerminalLog } from '../types';

interface AgentTerminalProps {
  logs: TerminalLog[];
  currentStep: string;
  isAnalyzing: boolean;
  generatedCode: string;
  codeHistory: string[];
  retryCount: number;
  plan: string[];
}

export const AgentTerminal: React.FC<AgentTerminalProps> = ({
  logs,
  currentStep,
  isAnalyzing,
  generatedCode,
  codeHistory,
  retryCount,
  plan
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'code' | 'plan'>('terminal');
  const [selectedAttempt, setSelectedAttempt] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  // Keep selectedAttempt up to date with newest code attempt
  useEffect(() => {
    if (codeHistory.length > 0) {
      setSelectedAttempt(codeHistory.length - 1);
    }
  }, [codeHistory.length]);

  const copyCode = () => {
    const codeToCopy = codeHistory[selectedAttempt] || generatedCode;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stepsList = [
    { key: 'planner', label: '1. Planner' },
    { key: 'codegen', label: '2. Code Gen' },
    { key: 'executor', label: '3. Execution' },
    { key: 'self_correction', label: '4. Self-Correct' },
    { key: 'synthesizer', label: '5. Synthesis' }
  ];

  const getStepStatus = (stepKey: string) => {
    const order = ['planner', 'codegen', 'executor', 'self_correction', 'synthesizer'];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepKey);

    if (stepKey === 'self_correction' && retryCount > 0) {
      return 'active-correction';
    }
    if (currentStep === 'done') return 'completed';
    if (currentIndex === stepIndex) return 'current';
    if (currentIndex > stepIndex) return 'completed';
    return 'pending';
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col h-[520px]">
      {/* Top Bar with LangGraph Pipeline Steps */}
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="text-xs font-mono text-slate-400 ml-2 flex items-center gap-1.5">
            <TerminalIcon className="w-3.5 h-3.5 text-purple-400" />
            LangGraph Execution Runtime
          </span>
        </div>

        {/* Multi-step pipeline tracker */}
        <div className="flex items-center gap-1 sm:gap-2">
          {stepsList.map((st, i) => {
            const status = getStepStatus(st.key);
            return (
              <div key={st.key} className="flex items-center">
                <div
                  className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition-all ${
                    status === 'current'
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 animate-pulse'
                      : status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : status === 'active-correction'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  {st.label}
                  {st.key === 'self_correction' && retryCount > 0 && (
                    <span className="ml-1 px-1 rounded bg-amber-500/30 text-amber-200 text-[10px]">
                      x{retryCount}
                    </span>
                  )}
                </div>
                {i < stepsList.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-slate-700 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'terminal'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TerminalIcon className="w-3 h-3" />
            Stream
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
              activeTab === 'code'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3 h-3" />
            Code {codeHistory.length > 0 && `(${codeHistory.length})`}
          </button>
          {plan.length > 0 && (
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === 'plan'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3 h-3" />
              Plan ({plan.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Terminal Content */}
      <div className="flex-1 bg-slate-950 p-4 font-mono text-xs overflow-y-auto relative">
        {activeTab === 'terminal' && (
          <div className="space-y-2">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-24 space-y-2">
                <TerminalIcon className="w-8 h-8 opacity-40 text-purple-400" />
                <p>Execution stream idle. Upload a dataset and enter a query to initiate analysis.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 leading-relaxed group">
                  <span className="text-slate-600 select-none text-[10px] pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      log.type === 'error'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : log.type === 'retry'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : log.type === 'code'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : log.type === 'plot'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {log.step}
                  </span>

                  <div className="flex-1 text-slate-200">
                    <p className={log.type === 'error' ? 'text-rose-400' : log.type === 'retry' ? 'text-amber-300' : ''}>
                      {log.message}
                    </p>

                    {/* Display execution stdout or stderr in formatted block if available */}
                    {log.details?.stdout && (
                      <pre className="mt-1 p-2 rounded bg-slate-900 border border-slate-800 text-emerald-400/90 overflow-x-auto whitespace-pre-wrap max-h-36">
                        {log.details.stdout}
                      </pre>
                    )}

                    {log.details?.stderr && (
                      <pre className="mt-1 p-2 rounded bg-rose-950/40 border border-rose-800/50 text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-36">
                        {log.details.stderr}
                      </pre>
                    )}
                  </div>
                </div>
              ))
            )}

            {isAnalyzing && (
              <div className="flex items-center gap-2 text-purple-400 animate-pulse pt-2">
                <span className="inline-block w-2 h-4 bg-purple-400" />
                <span className="text-[11px]">Executing agent node...</span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        )}

        {activeTab === 'code' && (
          <div className="relative h-full flex flex-col">
            {codeHistory.length > 1 && (
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                <span className="text-slate-400 text-xs font-sans">Execution Revisions:</span>
                {codeHistory.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedAttempt(idx)}
                    className={`px-2.5 py-1 rounded text-xs transition-all ${
                      selectedAttempt === idx
                        ? 'bg-purple-600 text-white font-semibold'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Attempt {idx + 1} {idx === codeHistory.length - 1 ? '(Latest)' : '(Error)'}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={copyCode}
              className="absolute top-0 right-0 z-10 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <pre className="flex-1 overflow-auto p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-purple-200 font-mono text-xs leading-relaxed whitespace-pre">
              {codeHistory[selectedAttempt] || generatedCode || '# No code generated yet'}
            </pre>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="h-full p-2 space-y-3 font-sans">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
              Autonomous Analytical Plan
            </h4>
            <div className="space-y-2">
              {plan.map((stepStr, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {idx + 1}
                  </div>
                  <p className="text-xs text-slate-200 pt-0.5 leading-relaxed">
                    {stepStr.replace(/^\d+\.\s*/, '')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="bg-slate-950 px-4 py-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isAnalyzing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
          <span>Status: {currentStep.toUpperCase()}</span>
        </div>
        {retryCount > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <RotateCcw className="w-3 h-3" />
            <span>Self-Correction Retries: {retryCount} / 3</span>
          </div>
        )}
      </div>
    </div>
  );
};
