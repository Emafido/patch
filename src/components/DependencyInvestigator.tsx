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
  Layers,
  ShieldAlert,
  Shield
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
      <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl p-8 min-h-[500px] lg:h-[calc(100vh-210px)] lg:max-h-[820px] flex flex-col justify-center items-center text-center">
        <div className="w-9 h-9 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4" />
        <p className="text-sm font-mono text-zinc-200 font-medium">Executing FalkorDB Cypher traversal...</p>
        <p className="text-xs text-zinc-500 mt-1 font-mono">MATCH shortestPath((root)-[:DEPENDS_ON*]-&gt;(target))</p>
      </div>
    );
  }

  if (!investigation) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl p-8 min-h-[500px] lg:h-[calc(100vh-210px)] lg:max-h-[820px] flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center mb-3.5 text-zinc-500">
          <Layers className="w-6 h-6 opacity-60" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Select a Package to Investigate</h3>
        <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
          Select any installed package from the list to trace its dependency lineage from root and discover cross-repository sharing in FalkorDB.
        </p>
      </div>
    );
  }

  const { target, path, introducingDirectDep, sharedInRepositories, vulnerabilities } = investigation;
  const hasVulnerabilities = vulnerabilities && vulnerabilities.length > 0;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl flex flex-col min-h-[500px] lg:h-[calc(100vh-210px)] lg:max-h-[820px] overflow-hidden shadow-sm">
      {/* Target Package Header */}
      <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/50 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="font-mono text-base font-bold text-zinc-100 truncate" title={target.name}>
                {target.name}
              </span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700 font-semibold">
                v{target.version}
              </span>
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                  target.isDirect
                    ? 'bg-emerald-950/90 border border-emerald-700 text-emerald-300'
                    : 'bg-indigo-950/90 border border-indigo-700 text-indigo-300'
                }`}
              >
                {target.isDirect ? 'Direct Dependency' : 'Transitive Dependency'}
              </span>
            </div>
            <p className="font-mono text-xs text-zinc-400 truncate max-w-xl" title={target.packagePath}>
              Path: {target.packagePath}
            </p>
          </div>
        </div>

        {/* Root Attribution Callout */}
        <div className="mt-3.5 p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-xs text-zinc-300">
              <span className="text-zinc-400">Attribution: </span>
              {target.isDirect ? (
                <span className="text-zinc-200 font-medium">Declared directly in root package.json</span>
              ) : introducingDirectDep ? (
                <span>
                  Introduced by direct dependency{' '}
                  <strong className="text-emerald-400 font-mono font-semibold" title={introducingDirectDep.name}>
                    {introducingDirectDep.name}
                  </strong>
                  <span className="text-zinc-400 font-mono">@{introducingDirectDep.version}</span>
                </span>
              ) : (
                <span className="text-zinc-300">Resolved via lockfile dependency graph</span>
              )}
            </div>
          </div>
          <span className="text-xs font-mono text-zinc-300 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 font-medium shrink-0">
            Depth: {path.length - 1} {path.length - 1 === 1 ? 'hop' : 'hops'}
          </span>
        </div>
      </div>

      {/* Investigation Details: Path & Cross-Repo Sharing */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
        {/* Security Findings & Advisories */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              {hasVulnerabilities ? (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Security Intel ({hasVulnerabilities ? `${vulnerabilities.length} Confirmed Advisories` : '0 Confirmed Findings'})
            </h4>
            <span className="text-xs font-mono text-zinc-400">OSV.dev Advisory Intel</span>
          </div>

          {hasVulnerabilities ? (
            <div className="space-y-2.5">
              {vulnerabilities.map((v) => (
                <div key={v.id} className="p-3.5 rounded-lg border border-rose-800/70 bg-rose-950/20 text-xs space-y-1.5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-rose-300">{v.cveId || v.id}</span>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        v.severity === 'CRITICAL' ? 'bg-rose-900 text-rose-100 border border-rose-700' :
                        v.severity === 'HIGH' ? 'bg-orange-900 text-orange-200 border border-orange-700' :
                        'bg-amber-900 text-amber-200 border border-amber-700'
                      }`}>
                        {v.severity}
                      </span>
                      {v.fixedVersion && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-semibold">
                          Fix: &gt;={v.fixedVersion}
                        </span>
                      )}
                    </div>
                    {v.url && (
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-200 text-xs flex items-center gap-1 font-mono transition-colors">
                        Advisory <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-zinc-300 text-xs leading-relaxed">{v.summary}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>No known advisories published in OSV for {target.name}@{target.version}.</span>
            </div>
          )}
        </div>

        {/* Ordered Dependency Path */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
              Dependency Path Traversal (Root → Target)
            </h4>
            <span className="text-xs font-mono text-zinc-400">Shortest Directed Path</span>
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
                      : 'bg-zinc-950/80 border-zinc-800'
                  }`}
                >
                  {/* Step indicator */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold z-10 shrink-0 ${
                      isLeaf
                        ? 'bg-emerald-500 text-zinc-950 shadow-sm shadow-emerald-500/30'
                        : isRoot
                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                        : isIntroducing
                        ? 'bg-indigo-500 text-white'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {index}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-zinc-200 truncate" title={node.name}>
                        {node.name}
                      </span>
                      {!isRoot && (
                        <span className="font-mono text-xs text-zinc-400">
                          @{node.version}
                        </span>
                      )}
                      {isRoot && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase font-medium">
                          Root Project
                        </span>
                      )}
                      {isIntroducing && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 font-medium">
                          Introducing Direct Dep
                        </span>
                      )}
                      {isLeaf && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-medium">
                          Target
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-zinc-500 truncate mt-0.5" title={node.packagePath}>
                      {node.packagePath}
                    </p>
                  </div>

                  {index < path.length - 1 && (
                    <CornerDownRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Cross-Repository Visibility */}
        <div className="pt-3 border-t border-zinc-800/80">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-indigo-400" />
              Cross-Repository Sharing
            </h4>
            <span className="text-xs font-mono text-zinc-400 font-medium px-2 py-0.5 rounded bg-zinc-850 border border-zinc-800">
              {sharedInRepositories.length} other {sharedInRepositories.length === 1 ? 'repository' : 'repositories'}
            </span>
          </div>

          {sharedInRepositories.length === 0 ? (
            <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-400 text-center font-mono">
              This package version is only installed in the current repository snapshot.
            </div>
          ) : (
            <div className="space-y-2">
              {sharedInRepositories.map((repo) => (
                <div
                  key={`${repo.repoId}-${repo.snapshotId}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-all gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Package className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-zinc-200 truncate" title={repo.repoName}>
                        {repo.repoName}
                      </p>
                      <p className="text-xs font-mono text-zinc-400">
                        {repo.isDirect ? 'Direct dependency' : 'Transitive dependency'}
                      </p>
                    </div>
                  </div>

                  <a
                    href={repo.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors shrink-0 font-medium px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
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
