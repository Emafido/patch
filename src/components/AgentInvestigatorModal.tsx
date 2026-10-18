'use client';

import React from 'react';
import { 
  Bot, 
  X, 
  Download, 
  Sparkles, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Layers,
  ArrowRight
} from 'lucide-react';
import type { AgentInvestigationResult } from '@/lib/agent/investigator';

interface AgentInvestigatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AgentInvestigationResult | null;
  loading: boolean;
  onTriggerInvestigation: () => void;
}

export function AgentInvestigatorModal({
  isOpen,
  onClose,
  result,
  loading,
  onTriggerInvestigation
}: AgentInvestigatorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-zinc-100">Patch Remediation Agent</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                  Track 1 · FalkorDB Powered
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Investigates cross-repository vulnerabilities and generates evidence-backed upgrade priorities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {result?.report && (
              <a
                href="/api/agent/report"
                download="patch-remediation-report.md"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download Report (.md)
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-zinc-200">Agent Executing Graph Traversals...</h4>
                <p className="text-xs font-mono text-zinc-400 max-w-md">
                  Executing FalkorDB tools: <code className="text-emerald-400">findSharedVulnerabilities</code>, <code className="text-emerald-400">traceVulnerableDependencyPaths</code>, and <code className="text-emerald-400">rankRemediationCandidates</code>.
                </p>
              </div>
            </div>
          ) : result ? (
            <div className="space-y-6">
              {/* Tool Execution Evidence Strip */}
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-mono text-[11px]">Graph Tools Executed:</span>
                  {result.toolCallsExecuted.map((tool) => (
                    <span key={tool} className="px-2 py-0.5 rounded bg-zinc-800 text-emerald-300 font-mono text-[11px] border border-zinc-700">
                      {tool}()
                    </span>
                  ))}
                </div>
                {result.providerUsed && (
                  <span className="text-[11px] font-mono text-zinc-400">
                    Engine: <strong className="text-zinc-200">{result.providerUsed}</strong>
                  </span>
                )}
              </div>

              {/* Priority Remediation Candidates Strip */}
              {result.candidates.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-emerald-400" />
                    Top Ranked Remediation Priorities
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.candidates.slice(0, 4).map((c) => (
                      <div key={c.advisoryId} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-zinc-100">#{c.rank} {c.packageName}</span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold uppercase ${
                                c.severity === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                                c.severity === 'HIGH' ? 'bg-orange-950 text-orange-300 border border-orange-800' :
                                'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}>
                                {c.severity}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-zinc-500">{c.cveId || c.advisoryId}</span>
                          </div>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {c.affectedRepositoriesCount} {c.affectedRepositoriesCount === 1 ? 'repo' : 'repos'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">
                          {c.recommendedAction}
                        </p>
                        <div className="text-[11px] font-mono text-zinc-500 pt-1 border-t border-zinc-800/80 flex items-center justify-between">
                          <span>Affects: {c.affectedRepositories.join(', ')}</span>
                          <span>Min depth: {c.minDepth} {c.minDepth === 1 ? 'hop' : 'hops'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Markdown Report */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Agent Synthesized Remediation Plan
                </h4>
                <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 prose prose-invert max-w-none text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap font-sans">
                  {result.report}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center space-y-4">
              <Bot className="w-12 h-12 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-zinc-200">No Investigation Run Yet</h4>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Click the button below to prompt the AI agent to traverse the FalkorDB dependency graph, rank vulnerabilities across your portfolio, and generate a verified action plan.
                </p>
              </div>
              <button
                onClick={onTriggerInvestigation}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                Run Remediation Investigation Now
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Safeguard: Reachability does not guarantee exploitability. Verify upgrades in an isolated branch.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
