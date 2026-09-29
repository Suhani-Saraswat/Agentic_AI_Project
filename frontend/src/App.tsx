import React, { useState, useRef } from 'react';
import { Header } from './components/Header';
import { DatasetUpload } from './components/DatasetUpload';
import { DatasetPreview } from './components/DatasetPreview';
import { QueryInput } from './components/QueryInput';
import { AgentTerminal } from './components/AgentTerminal';
import { ReportView } from './components/ReportView';
import {
  DatasetProfile,
  AnalysisReport,
  TerminalLog,
  WebSocketMessage
} from './types';

export const App: React.FC = () => {
  const [dataset, setDataset] = useState<DatasetProfile | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeProvider, setActiveProvider] = useState<string>('openai');
  const [currentStep, setCurrentStep] = useState<string>('idle');
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [codeHistory, setCodeHistory] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [plan, setPlan] = useState<string[]>([]);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [plotSpec, setPlotSpec] = useState<Record<string, any> | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);

  const appendLog = (type: string, step: string, message: string, details?: any) => {
    const newLog: TerminalLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      step,
      message,
      details
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const handleExecuteAnalysis = (query: string, provider: string, model: string) => {
    if (!dataset) return;

    // Reset previous run states
    setIsAnalyzing(true);
    setCurrentStep('planner');
    setLogs([]);
    setGeneratedCode('');
    setCodeHistory([]);
    setRetryCount(0);
    setPlan([]);
    setReport(null);
    setPlotSpec(null);
    setExecutiveSummary('');

    const sessionId = Math.random().toString(36).substring(2, 10);
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect through proxy or direct host
    const wsUrl = `${protocol}//${window.location.host}/ws/analyze/${sessionId}`;

    appendLog('status', 'init', `Connecting to LangGraph agent runner (Session: ${sessionId})...`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      appendLog('status', 'init', 'WebSocket channel established. Submitting analysis request.');
      ws.send(JSON.stringify({
        dataset_id: dataset.dataset_id,
        query,
        provider,
        model
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);
        setCurrentStep(msg.step);

        if (msg.type === 'plan' && msg.payload?.plan) {
          setPlan(msg.payload.plan);
          appendLog('plan', msg.step, msg.message, msg.payload);
        } else if (msg.type === 'code' && msg.payload?.code) {
          setGeneratedCode(msg.payload.code);
          setCodeHistory((prev) => [...prev, msg.payload.code]);
          appendLog('code', msg.step, msg.message, msg.payload);
        } else if (msg.type === 'retry') {
          setRetryCount((prev) => prev + 1);
          appendLog('retry', msg.step, msg.message, msg.payload);
        } else if (msg.type === 'plot' && msg.payload?.plot_spec) {
          setPlotSpec(msg.payload.plot_spec);
          appendLog('plot', msg.step, msg.message);
        } else if (msg.type === 'report') {
          if (msg.payload?.report) {
            setExecutiveSummary(msg.payload.report);
          } else if (msg.payload?.executive_summary) {
            setExecutiveSummary(msg.payload.executive_summary);
            setReport(msg.payload);
            if (msg.payload.plot_spec) {
              setPlotSpec(msg.payload.plot_spec);
            }
          }
          appendLog('report', msg.step, msg.message);
          setIsAnalyzing(false);
          setCurrentStep('done');
        } else if (msg.type === 'error') {
          appendLog('error', msg.step, msg.message, msg.payload);
          setIsAnalyzing(false);
          setCurrentStep('error');
        } else {
          appendLog(msg.type, msg.step, msg.message, msg.payload);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = () => {
      appendLog('error', 'network', 'WebSocket error encountered.');
      setIsAnalyzing(false);
      setCurrentStep('error');
    };

    ws.onclose = () => {
      setIsAnalyzing(false);
    };
  };

  const handleStopAnalysis = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsAnalyzing(false);
    setCurrentStep('stopped');
    appendLog('status', 'user', 'Execution cancelled by user.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-purple-500 selection:text-white">
      <Header isAnalyzing={isAnalyzing} activeProvider={activeProvider} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Top Section: Dataset Upload & Schema Profiler */}
        <div className="grid grid-cols-1 gap-6">
          <DatasetUpload
            onDatasetUploaded={(profile) => setDataset(profile)}
            currentDataset={dataset}
          />

          {dataset && <DatasetPreview profile={dataset} />}
        </div>

        {/* Middle Section: Query Input */}
        <QueryInput
          onExecute={handleExecuteAnalysis}
          isAnalyzing={isAnalyzing}
          onStop={handleStopAnalysis}
          hasDataset={!!dataset}
          activeProvider={activeProvider}
          setActiveProvider={setActiveProvider}
        />

        {/* Bottom Section: Side-by-Side Agent Terminal & Visualization Dashboard */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <AgentTerminal
            logs={logs}
            currentStep={currentStep}
            isAnalyzing={isAnalyzing}
            generatedCode={generatedCode}
            codeHistory={codeHistory}
            retryCount={retryCount}
            plan={plan}
          />

          <ReportView
            report={report}
            plotSpec={plotSpec}
            executiveSummary={executiveSummary}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        Autonomous Data Analysis Agent Architecture • LangGraph Multi-Agent Loops • Isolated Python Subprocess Runner
      </footer>
    </div>
  );
};

export default App;
