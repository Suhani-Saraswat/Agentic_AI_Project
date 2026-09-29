import React from 'react';
import { Bot, ShieldCheck, Cpu } from 'lucide-react';

interface HeaderProps {
  isAnalyzing: boolean;
  activeProvider: string;
}

export const Header: React.FC<HeaderProps> = ({ isAnalyzing, activeProvider }) => {
  return (
    <header className="glass-panel sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
            <Bot className="w-5 h-5" />
            {isAnalyzing && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 via-purple-100 to-slate-300">
                Autonomous Data Analysis Agent
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                LangGraph v0.2
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Stateful Multi-Step Agentic Architecture with Isolated Code Sandbox & Self-Correction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Isolated Sandbox Runtime</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-mono text-purple-300">{activeProvider.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
