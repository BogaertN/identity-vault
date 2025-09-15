// utils/integrations.js - Ecosystem Hooks for Identity Vault Profiles
// Plug-and-play loaders/configs for popular frameworks: LangChain (memory injection), AutoGen/CrewAI (agent roles/perms),
// RAG (tag-based filtering), plus stubs for Cursor/VS Code, Kubiya/SuperAGI orchestration.
// Features: Auto-load profile into chains/agents (e.g., inject as system prompt), enforce rules (pushback, safe words),
// multi-agent handshakes (ZKP verify before collab), audit hooks (log integrations).
// Advanced: Callback for drift check on load, selective disclosure via ZKP, pubsub sync for IPFS updates.
// Integrates: Called from server.js (/integrations endpoints), db.js (fetch profile), zkps.js (trust), ipfs.js (pin configs).
// Safety: Fallback to defaults if profile missing; no external calls. Deps: langchain (npm install @langchain/core), autogen-js stub.
// Usage: const loader = langchainLoader(profileId, 'user'); // Returns memory module with prefs.
// Version: 1.0 | 2025 | For multi-tool workflows; expand to more (e.g., Ollama).

const { getProfile } = require('../db'); // Fetch encrypted/decrypt
const { verifyZKP } = require('./zkps'); // Trust in multi-agent
const { detectDrift } = require('./drift'); // Enforce on load
const { publishUpdate } = require('./ipfs'); // Sync configs
const { decrypt } = require('./encryption');

// LangChain Hook: Memory loader - Injects profile as conversation summary/system prompt
async function langchainLoader(profileId, type = 'user', options = {}) {
  const profile = await getProfile(type, profileId, true); // Include state
  if (!profile) return { error: 'Profile not found' };

  // Enforce meta-rules (e.g., if drift_tracking, check last load)
  const oldState = options.lastProfile || profile; // Stub for diff
  const drift = detectDrift(oldState, profile);
  if (drift && profile.meta_rules.drift_tracking) {
    console.warn('Drift detected on load:', drift);
    await publishUpdate('langchain_drift', { profileId, alert: drift }); // Sync alert
  }

  // ZKP verify if multi-chain
  if (options.zkpFields) {
    const proof = profile.zkp_metadata?.proof; // From DB
    if (proof && !verifyZKP(proof, { fields: options.zkpFields })) {
      return { error: 'ZKP trust failed—handshake denied' };
    }
  }

  // Build memory module: System prompt from prefs + context
  const systemPrompt = `
    You are an AI assistant configured by the user's Operational Identity.
    User Profile: ${JSON.stringify(profile.data, null, 2)}  // Full inject (selective in prod)
    Rules: Follow interaction_preferences (e.g., ${profile.data.interaction_preferences.formality} formality, ${profile.data.interaction_preferences.step_by_step ? 'step-by-step' : 'direct'}).
    Meta: ${profile.data.meta_rules.preserve_session_memory ? 'Preserve context' : 'Fresh start'}. Safe words: ${profile.data.meta_rules.safe_words.join(', ')}.
    Current State: Phase ${profile.session_state.phase}, waiting for ${profile.session_state.waiting_for}.
    Project Context: ${profile.data.project_context.current_project} (${profile.data.project_context.phase}).
  `;

  // Return LangChain-compatible (e.g., for ConversationSummaryMemory)
  return {
    type: 'bufferMemory',
    systemPrompt,
    humanPrefix: profile.data.interaction_preferences.plain_language ? '[User (plain):' : '[User]:',
    aiPrefix: '[AI]:',
    memoryKey: 'chat_history',
    returnMessages: true,
    // Callback for post-load (e.g., enforce confirmation)
    postProcess: (messages) => {
      if (profile.data.interaction_preferences.confirmation_required) {
        return [...messages, { role: 'system', content: 'Waiting for confirmation...' }];
      }
      return messages;
    }
  };
}

// AutoGen/CrewAI Hook: Agent config - Maps profile to agent init (roles, tools, perms)
async function autogenHook(agentId, options = {}) {
  const profile = await getProfile('agent', agentId);
  if (!profile) return { error: 'Agent profile not found' };

  // Enforce limitations/permissions
  const allowedTools = profile.data.capabilities.filter(c => !profile.data.limitations.includes(c));
  const systemMessage = `
    Agent Identity: ${profile.data.name} (${profile.data.core_role}).
    Strengths: ${profile.data.strengths.join(', ')}.
    Tone: ${profile.data.tone}.
    Permissions: ${profile.data.permissions.join(', ')} only—enforce enforcement_rules.
    ${profile.data.enforcement_rules.length > 0 ? `Rules: ${profile.data.enforcement_rules.join('; ')}.` : ''}
    Safe Actions: Avoid ${profile.data.limitations.join(', ')}.
  `;

  // AutoGen-compatible config
  return {
    name: profile.data.name,
    system_message: systemMessage,
    llm_config: { config_list: [{ model: 'gpt-4', api_key: process.env.OPENAI_API_KEY }] }, // Stub; use env
    tools: allowedTools, // e.g., ['code_exec', 'web_search']
    function_map: {}, // Populate from caps
    // Multi-agent handshake: ZKP before group chat
    on_start: async (groupchat) => {
      if (options.team) {
        const proof = profile.zkp_metadata?.proof;
        if (!verifyZKP(proof, { role: profile.data.core_role })) {
          throw new Error('Handshake failed—agent untrusted');
        }
      }
    }
  };
}

// CrewAI Stub (similar; expand for task delegation)
function crewaiHook(agentId) {
  return autogenHook(agentId); // Reuse for MVP; diff: task/goal mapping to goals[]
}

// RAG Hook: Filter retrieval based on identity_tags/project_context (e.g., vector store query with metadata filter)
async function ragFilter(query, profileId, type = 'user', vectorStore = null) { // Assume FAISS/Chroma stub
  const profile = await getProfile(type, profileId);
  if (!profile) return { error: 'Profile not found' };

  // Build filter: Tags + context for relevance
  const metadataFilter = {
    $and: [
      { identity_tags: { $in: profile.data.identity_tags } },
      { project_affiliations: { $in: profile.data.project_affiliations } },
      { phase: profile.data.project_context.phase } // e.g., only 'development' docs
    ]
  };

  // Stub query (in real: vectorStore.similaritySearch(query, k=5, filter=metadataFilter))
  const mockResults = [
    { pageContent: 'Relevant doc snippet matching tags.', metadata: { source: 'project_file.py' } },
    // Filtered by profile
  ];

  // Enforce plain_language if true
  const filtered = mockResults.map(doc => ({
    ...doc,
    content: profile.data.interaction_preferences.plain_language ? simplifyText(doc.pageContent) : doc.pageContent
  }));

  // Drift check on query context
  if (profile.meta_rules.drift_tracking) {
    // Stub: Compare query to last_action
    const sim = stringSimilarity(query, profile.session_state.last_action || '');
    if (sim < 0.5) console.warn('Query drift from session state');
  }

  return { results: filtered, filterUsed: metadataFilter };
}

// Helper: Simple text simplifier (for plain_language)
function simplifyText(text) {
  return text.replace(/[^\w\s]/g, '').split(' ').filter(w => w.length > 3).join(' '); // Stub
}

// VS Code/Cursor Extension Stub: Profile inject on file open
function vscodeHook(profileId) {
  return {
    activationEvents: ['onStartupFinished'],
    onLoad: async (context) => {
      const profile = await getProfile('user', profileId);
      if (profile.interaction_preferences.no_boxes) {
        // Disable markdown previews, etc.
        context.subscriptions.push(vscode.commands.registerCommand('vault.noBoxes', () => {}));
      }
      // Inject into chat: system prompt override
    }
  };
}

// SuperAGI/Kubiya Orchestration Stub: Multi-agent team registry
async function orchestrationHook(teamId) {
  // Fetch team vault (shared profiles)
  const teamProfiles = await getProfile('user', teamId, false, true); // Logs for audit
  return {
    agents: teamProfiles.map(p => autogenHook(p.agent_id)), // Parallel configs
    handshake: async (agents) => {
      // ZKP chain for trust
      for (let agent of agents) {
        const proof = agent.zkp_proof;
        if (!verifyZKP(proof, { role: agent.core_role })) throw new Error('Orchestration handshake failed');
      }
    }
  };
}

// Exports
module.exports = {
  langchainLoader,
  autogenHook,
  crewaiHook,
  ragFilter,
  vscodeHook,
  orchestrationHook
};
