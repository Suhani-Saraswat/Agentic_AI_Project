import React, { useState } from 'react';
import { Send, Sparkles, StopCircle, Settings2 } from 'lucide-react';

interface QueryInputProps {
  onExecute: (query: string, provider: string, model: string) => void;
  isAnalyzing: boolean;
  onStop: () => void;
  hasDataset: boolean;
  activeProvider: string;
  setActiveProvider: (provider: string) => void;
}

export const QueryInput: React.FC<QueryInputProps> = ({
  onExecute,
  isAnalyzing,
  onStop,
  hasDataset,
  activeProvider,
  setActiveProvider
}) => {
  const [query, setQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');

  const suggestions = [
    "Break down total sales and profit margins across regions",
    "Identify correlation between discount rates and sales volume",
    "Find top 5 customer segments generating highest profit",
    "Analyze distribution of customer satisfaction ratings"
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isAnalyzing || !hasDataset) return;
    onExecute(query, activeProvider, selectedModel);
  };

  const handleSuggestionClick = (suggested: string) => {
    setQuery(suggested);
    if (!isAnalyzing && hasDataset) {
      onExecute(suggested, activeProvider, selectedModel);
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Autonomous Analytical Query
        </label>

        {/* Provider and Model Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <Settings2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={activeProvider}
              onChange={(e) => setActiveProvider(e.target.value)}
              className="bg-transparent text-slate-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="openai" className="bg-slate-900">OpenAI</option>
              <option value="anthropic" className="bg-slate-900">Anthropic</option>
              <option value="ollama" className="bg-slate-900">Ollama</option>
              <option value="mock" className="bg-slate-900">Mock / Demo</option>
            </select>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-slate-300 font-mono text-[11px] focus:outline-none cursor-pointer"
            >
              {activeProvider === 'openai' && (
                <>
                  <option value="gpt-4o" className="bg-slate-900">gpt-4o</option>
                  <option value="gpt-4o-mini" className="bg-slate-900">gpt-4o-mini</option>
                </>
              )}
              {activeProvider === 'anthropic' && (
                <>
                  <option value="claude-3-5-sonnet-20240620" className="bg-slate-900">claude-3-5-sonnet</option>
                  <option value="claude-3-haiku-20240307" className="bg-slate-900">claude-3-haiku</option>
                </>
              )}
              {activeProvider === 'ollama' && (
                <>
                  <option value="deepseek-coder:6.7b" className="bg-slate-900">deepseek-coder</option>
                  <option value="llama3:latest" className="bg-slate-900">llama3</option>
                </>
              )}
              {activeProvider === 'mock' && (
                <option value="heuristic-generator" className="bg-slate-900">heuristic-engine</option>
              )}
            </select>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            hasDataset
              ? "Ask any question in natural language (e.g. 'Plot regional profit distributions and find anomalies')..."
              : "Upload a dataset first to enable autonomous querying..."
          }
          disabled={!hasDataset || isAnalyzing}
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3.5 pr-28 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <div className="absolute right-2 top-2">
          {isAnalyzing ? (
            <button
              type="button"
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
            >
              <StopCircle className="w-4 h-4 text-rose-400" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!query.trim() || !hasDataset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Analyze</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>

      {/* Suggested Queries */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="text-[11px] text-slate-500 mr-1">Suggestions:</span>
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            disabled={!hasDataset || isAnalyzing}
            onClick={() => handleSuggestionClick(item)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-purple-300 border border-slate-800 hover:border-purple-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};
