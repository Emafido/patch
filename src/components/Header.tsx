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
    <header className="border-b border-zinc-800/90 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Track */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-lg shadow-sm shadow-emerald-500/10 shrink-0">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100 tracking-tight text-base font-mono">PATCH</span>
              <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-zinc-800/90 border border-zinc-700/80 text-zinc-300 font-medium">
                Graph Hacks · Track 1
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-sans hidden sm:block">
              Dependency Graph Security & Blast-Radius Engine
            </p>
          </div>
        </div>

        {/* System & Portfolio State */}
        <div className="flex items-center gap-2.5">
          {/* Portfolio pill */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
            <GitBranch className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-500">Portfolio:</span>
            <span className="font-medium text-zinc-200">Default</span>
            {systemStatus && (
              <span className="ml-1 text-xs font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {systemStatus.totalRepositories} {systemStatus.totalRepositories === 1 ? 'repo' : 'repos'}
              </span>
            )}
          </div>

          {/* FalkorDB Connection pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              isLiveFalkor
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300 shadow-sm shadow-emerald-950/50'
                : 'bg-rose-950/60 border-rose-800/80 text-rose-300'
            }`}
            title={systemStatus?.details || 'FalkorDB status'}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLiveFalkor ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLiveFalkor ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </span>
            <div className="flex items-center gap-1.5">
              <Database className={`w-3.5 h-3.5 ${isLiveFalkor ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className="font-semibold">
                {isLiveFalkor ? 'FalkorDB Live' : 'FalkorDB Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
