'use client';

import React from 'react';
import { InvestigationResult } from '@/types';
import { 
  GitCommit, 
  CornerDownRight, 
  ExternalLink, 
  Share2, 
  CheckCircle2, 
  Package,
  Layers
} from 'lucide-react';

interface DependencyInvestigatorProps {
  investigation: InvestigationResult | null;
  loading: boolean;
}

export function DependencyInvestigator({
  investigation,
  loading
}: DependencyInvestigatorProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-6 h-[650px] flex flex-col justify-center items-center text-center">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono text-zinc-400">Executing FalkorDB Cypher traversal...</p>
        <p className="text-[11px] text-zinc-600 mt-1 font-mono">MATCH shortestPath((root)-[:DEPENDS_ON*]-&gt;(target))</p>
      </div>
    );
  }

  if (!investigation) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-8 h-[650px] flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center mb-3 text-zinc-500">
          <Layers className="w-6 h-6 opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Select a Package to Investigate</h3>
        <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
          Click any installed package in the left panel to trace its exact dependency lineage from root and discover cross-repository sharing in FalkorDB.
        </p>
      </div>
    );
  }

  const { target, path, introducingDirectDep, sharedInRepositories } = investigation;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl flex flex-col h-[650px] overflow-hidden shadow-sm">
      {/* Target Package Header */}
      <div className="p-5 border-b border-zinc-800 bg-zinc-950/40">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-base font-bold text-zinc-100">{target.name}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                v{target.version}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                  target.isDirect
                    ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                    : 'bg-indigo-950/80 border border-indigo-800 text-indigo-300'
                }`}
              >
                {target.isDirect ? 'Direct Dependency' : 'Transitive Dependency'}
              </span>
            </div>
            <p className="font-mono text-[11px] text-zinc-500 truncate max-w-lg">
              Path: {target.packagePath}
            </p>
          </div>
        </div>

        {/* Root Attribution Callout */}
        <div className="mt-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="text-zinc-400">Why does this exist? </span>
              {target.isDirect ? (
                <span className="text-zinc-200 font-medium">Declared directly in root package.json</span>
              ) : introducingDirectDep ? (
                <span>
                  Introduced by direct dependency{' '}
                  <strong className="text-emerald-400 font-mono font-semibold">
                    {introducingDirectDep.name}
                  </strong>
                  <span className="text-zinc-500 font-mono">@{introducingDirectDep.version}</span>
                </span>
              ) : (
                <span className="text-zinc-300">Resolved via dependency chain</span>
              )}
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800/60">
            Depth: {path.length - 1} {path.length - 1 === 1 ? 'hop' : 'hops'}
          </span>
        </div>
      </div>

      {/* Investigation Details: Path & Cross-Repo Sharing */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Ordered Dependency Path */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
              Dependency Path Traversal (Root → Target)
            </h4>
            <span className="text-[11px] font-mono text-zinc-500">Shortest Directed Path</span>
          </div>

          <div className="space-y-1 relative pl-2">
            {/* Vertical connector line */}
            <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-zinc-800" />

            {path.map((node, index) => {
              const isRoot = index === 0;
              const isLeaf = index === path.length - 1;
              const isIntroducing = !isRoot && !isLeaf && node.isDirect;

              return (
                <div
                  key={`${node.id}-${index}`}
                  className={`relative flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    isLeaf
                      ? 'bg-emerald-950/20 border-emerald-500/50 shadow-sm'
                      : isIntroducing
                      ? 'bg-indigo-950/20 border-indigo-700/50'
                      : 'bg-zinc-950/70 border-zinc-800/80'
                  }`}
                >
                  {/* Step indicator */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-bold z-10 shrink-0 ${
                      isLeaf
                        ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/30'
                        : isRoot
                        ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        : isIntroducing
                        ? 'bg-indigo-500 text-white'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {index}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-200 truncate">
                        {node.name}
                      </span>
                      {!isRoot && (
                        <span className="font-mono text-[11px] text-zinc-500">
                          @{node.version}
                        </span>
                      )}
                      {isRoot && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 uppercase">
                          Root Project
                        </span>
                      )}
                      {isIntroducing && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 border border-indigo-700 text-indigo-300">
                          Introducing Direct Dep
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-zinc-600 truncate mt-0.5">
                      {node.packagePath}
                    </p>
                  </div>

                  {index < path.length - 1 && (
                    <CornerDownRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cross-Repository Visibility */}
        <div className="pt-2 border-t border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-indigo-400" />
              Cross-Repository Sharing
            </h4>
            <span className="text-[11px] font-mono text-zinc-500">
              {sharedInRepositories.length} {sharedInRepositories.length === 1 ? 'other repository' : 'other repositories'}
            </span>
          </div>

          {sharedInRepositories.length === 0 ? (
            <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-500 text-center font-mono">
              This package version is only installed in the current repository snapshot.
            </div>
          ) : (
            <div className="space-y-2">
              {sharedInRepositories.map((repo) => (
                <div
                  key={`${repo.repoId}-${repo.snapshotId}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <p className="font-mono text-xs font-semibold text-zinc-200">
                        {repo.repoName}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-500">
                        {repo.isDirect ? 'Direct dependency' : 'Transitive dependency'}
                      </p>
                    </div>
                  </div>

                  <a
                    href={repo.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
