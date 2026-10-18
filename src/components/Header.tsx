'use client';

import React from 'react';
import { Database, Shield, GitBranch, Cpu } from 'lucide-react';

interface HeaderProps {
  systemStatus: {
    connected: boolean;
    engineType: string;
    details: string;
    totalRepositories: number;
    activePortfolio: string;
  } | null;
}

export function Header({ systemStatus }: HeaderProps) {
  const isLiveFalkor = systemStatus?.engineType === 'FALKORDB_LIVE';

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Track */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold text-lg shadow-sm shadow-emerald-500/10">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100 tracking-tight text-base">PATCH</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 text-zinc-400">
                Graph Hacks · Track 1
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-sans">
              Dependency Graph Security & Blast-Radius Engine
            </p>
          </div>
        </div>

        {/* System & Portfolio State */}
        <div className="flex items-center gap-3">
          {/* Portfolio pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-500">Portfolio:</span>
            <span className="font-medium text-zinc-200">Default</span>
            {systemStatus && (
              <span className="ml-1 text-[10px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">
                {systemStatus.totalRepositories} {systemStatus.totalRepositories === 1 ? 'repo' : 'repos'}
              </span>
            )}
          </div>

          {/* FalkorDB Connection pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono border transition-all ${
              isLiveFalkor
                ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                : 'bg-indigo-950/40 border-indigo-800/50 text-indigo-300'
            }`}
            title={systemStatus?.details || 'Connecting to FalkorDB...'}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLiveFalkor ? 'bg-emerald-400' : 'bg-indigo-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveFalkor ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
              />
            </span>
            <div className="flex items-center gap-1.5">
              {isLiveFalkor ? (
                <Database className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span className="font-medium">
                {isLiveFalkor ? 'FalkorDB Live' : 'FalkorDB Graph Engine'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
