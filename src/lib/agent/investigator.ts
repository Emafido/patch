import { 
  findSharedVulnerabilities, 
  traceVulnerableDependencyPaths, 
  rankRemediationCandidates,
  VulnerablePathTrace
} from './tools.ts';
import type { RemediationCandidate, SharedVulnerabilityGroup } from '../../types/index.ts';

export interface AgentInvestigationResult {
  success: boolean;
  question: string;
  report: string;
  sharedVulnerabilities: SharedVulnerabilityGroup[];
  traces: VulnerablePathTrace[];
  candidates: RemediationCandidate[];
  toolCallsExecuted: string[];
  providerUsed?: string;
  error?: string;
}

const AGENT_SYSTEM_PROMPT = `You are Patch's Dependency Security Investigation Agent for WeMakeDevs x FalkorDB Graph Hacks (Track 1).
Your role is to investigate connected dependency vulnerabilities across a portfolio of software repositories stored in FalkorDB.

STRICT OPERATING RULES:
1. GROUNDED IN EVIDENCE ONLY: You must base all explanations, affected versions, and dependency paths strictly on the data returned by your FalkorDB graph tools. Never hallucinate or invent packages, CVEs, fixed versions, or dependency paths.
2. REACHABILITY != EXPLOITABILITY: Clearly remind the developer that package reachability in the dependency graph does not confirm runtime execution or exploitability.
3. UNVERIFIED UPGRADES: Never claim that a proposed upgrade is verified. State clearly that upgrades must be validated through test suites in an isolated branch.
4. ACTIONABLE DIRECT ATTRIBUTION: Always highlight the introducing direct dependency that pulled in the vulnerable transitive package, because developers must know which direct dependency in their package.json requires attention.

Format your final report in clean, well-structured GitHub-flavored Markdown.`;

/**
 * Runs the tool-calling AI agent against FalkorDB evidence
 */
export async function runInvestigationAgent(
  portfolioId = 'default',
  userQuestion = 'Which shared dependency vulnerability should we investigate first, why is it present in these repositories, and what should we do about it?'
): Promise<AgentInvestigationResult> {
  const toolCallsExecuted: string[] = [];

  // Execute the graph tools first to collect genuine connected data from FalkorDB
  const sharedVulns = await findSharedVulnerabilities(portfolioId);
  toolCallsExecuted.push('findSharedVulnerabilities');

  const traces = await traceVulnerableDependencyPaths(portfolioId);
  toolCallsExecuted.push('traceVulnerableDependencyPaths');

  const candidates = await rankRemediationCandidates(portfolioId);
  toolCallsExecuted.push('rankRemediationCandidates');

  // Check for supported LLM credentials
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let llmProvider: 'openai' | 'groq' | 'gemini' | null = null;
  let apiKey = '';
  let apiEndpoint = '';
  let modelName = '';

  if (groqKey) {
    llmProvider = 'groq';
    apiKey = groqKey;
    apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    modelName = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  } else if (openaiKey && openaiKey.startsWith('sk-')) {
    llmProvider = 'openai';
    apiKey = openaiKey;
    apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  } else if (geminiKey) {
    llmProvider = 'gemini';
    apiKey = geminiKey;
  }

  // If no working LLM provider is configured, return the evidence and state the blocker honestly
  if (!llmProvider) {
    const fallbackReport = generateEvidenceReport(userQuestion, candidates, traces, sharedVulns, [
      'Note: No active LLM API key (OPENAI_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY) was configured.',
      'The evidence below was queried directly and genuinely from FalkorDB using the 3 bounded graph tools.'
    ]);

    return {
      success: true,
      question: userQuestion,
      report: fallbackReport,
      sharedVulnerabilities: sharedVulns,
      traces,
      candidates,
      toolCallsExecuted,
      providerUsed: 'None (Direct FalkorDB Graph Evidence Engine)'
    };
  }

  // Call the LLM with genuine FalkorDB evidence in context
  const graphContext = {
    totalSharedVulnerabilities: sharedVulns.length,
    sharedVulnerabilities: sharedVulns.map(sv => ({
      advisoryId: sv.vulnerability.id,
      cveId: sv.vulnerability.cveId,
      severity: sv.vulnerability.severity,
      packageName: sv.affectedPackageName,
      affectedRepositories: sv.affectedRepositories.map(r => r.repoName),
      summary: sv.vulnerability.summary
    })),
    rankedRemediationCandidates: candidates,
    vulnerableDependencyPathTraces: traces.map(t => ({
      advisoryId: t.advisoryId,
      repo: t.repoName,
      packageName: t.packageName,
      isDirect: t.isDirect,
      pathChain: t.chain.map(c => `${c.name}@${c.version}`).join(' -> '),
      introducingDirectDependency: t.introducingDirectDep ? `${t.introducingDirectDep.name}@${t.introducingDirectDep.version}` : 'Direct'
    }))
  };

  try {
    let reportContent = '';

    if (llmProvider === 'openai' || llmProvider === 'groq') {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: AGENT_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Here is the genuine FalkorDB graph evidence retrieved via the 3 graph tools (findSharedVulnerabilities, traceVulnerableDependencyPaths, rankRemediationCandidates):
\`\`\`json
${JSON.stringify(graphContext, null, 2)}
\`\`\`

USER QUESTION: "${userQuestion}"

Please produce a comprehensive, structured Markdown Remediation Report answering the question strictly based on this evidence.`
            }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${llmProvider.toUpperCase()} API returned status ${response.status}: ${errorText}`);
      }

      const completionData = await response.json();
      reportContent = completionData.choices?.[0]?.message?.content || '';
    } else if (llmProvider === 'gemini') {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${AGENT_SYSTEM_PROMPT}\n\nFalkorDB Graph Evidence:\n${JSON.stringify(graphContext, null, 2)}\n\nQuestion: ${userQuestion}`
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}: ${await response.text()}`);
      }

      const geminiData = await response.json();
      reportContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    return {
      success: true,
      question: userQuestion,
      report: reportContent,
      sharedVulnerabilities: sharedVulns,
      traces,
      candidates,
      toolCallsExecuted,
      providerUsed: `${llmProvider} (${modelName || 'gemini-1.5-flash'})`
    };
  } catch (llmErr) {
    console.error('[Agent LLM Execution Error]:', llmErr);
    
    // Fail gracefully with evidence report and disclose LLM error honestly
    const fallbackReport = generateEvidenceReport(userQuestion, candidates, traces, sharedVulns, [
      `LLM Provider Warning: ${llmErr instanceof Error ? llmErr.message : String(llmErr)}`,
      'Falling back to structured FalkorDB evidence report below.'
    ]);

    return {
      success: true,
      question: userQuestion,
      report: fallbackReport,
      sharedVulnerabilities: sharedVulns,
      traces,
      candidates,
      toolCallsExecuted,
      providerUsed: `Failed (${llmProvider}) — Displaying FalkorDB Graph Evidence Directly`,
      error: llmErr instanceof Error ? llmErr.message : String(llmErr)
    };
  }
}

/**
 * Deterministic evidence-backed Markdown generator used when LLM is offline or as baseline
 */
function generateEvidenceReport(
  question: string,
  candidates: RemediationCandidate[],
  traces: VulnerablePathTrace[],
  sharedVulns: SharedVulnerabilityGroup[],
  warnings: string[] = []
): string {
  const topCandidate = candidates[0];

  return `# Patch — Dependency Vulnerability Remediation Report

**Date:** ${new Date().toISOString()}  
**Target Portfolio:** default  
**Investigation Query:** *"${question}"*  

${warnings.map(w => `> ⚠️ **Notice:** ${w}`).join('\n\n')}

---

## 1. Executive Summary & Highest Remediation Priority

${
  topCandidate
    ? `The FalkorDB graph investigation identifies **${topCandidate.packageName}** as the highest priority candidate for remediation (**Rank #1**, Advisory: \`${topCandidate.advisoryId}\`${topCandidate.cveId ? ` / ${topCandidate.cveId}` : ''}).

- **Severity:** \`${topCandidate.severity}\`
- **Blast Radius:** Affects **${topCandidate.affectedRepositoriesCount}** repositories (${topCandidate.affectedRepositories.join(', ')}).
- **Direct vs Transitive:** ${topCandidate.isDirectInAnyRepo ? 'Declared as a direct dependency in at least one repository.' : 'Transitive dependency introduced through parent packages.'}
- **Recommended Action:** ${topCandidate.recommendedAction}
`
    : `No shared vulnerabilities were detected across the imported repositories.`
}

---

## 2. Priority Remediation Matrix

| Rank | Advisory / CVE | Package | Severity | Affected Repos | Min Depth | Recommended Next Action |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
${candidates
  .map(
    c =>
      `| **#${c.rank}** | \`${c.cveId || c.advisoryId}\` | **${c.packageName}** | \`${c.severity}\` | ${c.affectedRepositories.join(', ')} | ${c.minDepth} ${c.minDepth === 1 ? 'hop' : 'hops'} | ${c.recommendedAction} |`
  )
  .join('\n')}

---

## 3. Evidence-Backed Dependency Paths (FalkorDB Traversal)

The following directed graph paths trace exactly how each vulnerable package enters each affected repository:

${traces
  .map(t => {
    const chainStr = t.chain.map(c => `\`${c.name}@${c.version}\``).join(' ➔ ');
    return `### 📦 \`${t.packageName}@${t.version}\` in **${t.repoName}**
- **Advisory:** \`${t.advisoryId}\` ${t.cveId ? `(${t.cveId})` : ''} · **Severity:** \`${t.severity}\`
- **Installation Path:** \`${t.installationPath}\`
- **Introducing Direct Dependency:** ${
      t.introducingDirectDep
        ? `**\`${t.introducingDirectDep.name}@${t.introducingDirectDep.version}\`**`
        : 'Declared Directly in root `package.json`'
    }
- **Graph Path:**  
  ${chainStr}
`;
  })
  .join('\n\n')}

---

## 4. Critical Uncertainties & Safety Safeguards

1. **Reachability $\neq$ Exploitability:** Graph-level inclusion confirms the vulnerable package code exists in \`node_modules\`, but does not guarantee the vulnerable function is called in your application runtime.
2. **Breaking Change Risk:** Upgrading parent packages (such as Next.js or Tailwind) may introduce breaking API changes. 
3. **Peer Dependency Conflicts:** Upgrading shared packages may conflict with other framework dependencies.

---

## 5. Developer Verification Steps

Before committing upgrades to production:
1. Create an isolated scratch git branch: \`git checkout -b fix/${topCandidate ? topCandidate.packageName : 'dependencies'}\`.
2. Update the introducing direct dependencies in \`package.json\`.
3. Run \`npm install\` to recompute lockfile hashes.
4. Execute test suites: \`npm test\` and \`npm run build\`.
5. Re-ingest the updated repository into Patch to verify the vulnerability node has been disconnected in FalkorDB.
`;
}
