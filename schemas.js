// schemas.js - JSON Schemas and Templates for User/Agent Operational Identities
// Based on Operational Identity API docs (2025): Full fields for user/agent profiles,
// including project_context, interaction_preferences, meta_rules, session_state.
// Features: Templates (blank objects), validators (simple schema checks for required fields/types),
// defaults (e.g., version '1.0.0', booleans false), example populator for testing.
// Advanced: Semantic validation (e.g., arrays must be non-empty if required, safe_words unique),
// integration hooks (e.g., derive tags from affiliations), export for prompts/db/routes.
// Usage: const { user, agent } = require('./schemas'); user.template; user.validate(profile);
// Version: 1.0 | Privacy: No PII in schemas; validate before encrypt.

const USER_TEMPLATE = {
  user_id: '', // Required: Unique handle (e.g., 'nic_bogaert')
  canonical_name: '', // Required: Full legal/professional name
  spirit_name: '', // Optional: Nickname/alter ego
  project_affiliations: [], // Array: e.g., ['ProjectX', 'Team Alpha']
  identity_tags: [], // Array: e.g., ['creative_coder', 'analytical_thinker']
  version: '1.0.0', // Auto: Semantic versioning
  last_updated: '', // Auto: ISO timestamp
  project_context: {
    current_project: '', // Required: e.g., 'AI Vault MVP'
    phase: '', // e.g., 'ideation', 'development'
    current_files: [], // Array: e.g., ['requirements.docx', 'main.py']
    active_collaborators: [], // Array: e.g., ['Alice Smith', 'Bob Lee']
    subsystems: [], // Array: e.g., ['API Gateway', 'UI/UX']
    goals: [] // Array: e.g., ['Finish MVP', 'Launch beta']
  },
  interaction_preferences: {
    formality: '', // e.g., 'stoic', 'casual', 'technical'
    depth: '', // e.g., 'maximum', 'summary', 'minimal'
    step_by_step: false, // Boolean
    beginner_friendly: false, // Boolean
    plain_language: false, // Boolean: Avoid jargon
    no_boxes: false, // Boolean: No tables/markdown
    pushback: false, // Boolean: Challenge ideas
    critique_mandatory: false, // Boolean: Always honest feedback
    confirmation_required: false, // Boolean: Wait after steps
    formatting_rules: [] // Array: e.g., ['always start with summary', 'no code blocks']
  },
  meta_rules: {
    recursive_feedback: false, // Boolean: Loops for improvement
    drift_tracking: false, // Boolean: Alert conceptual shifts
    contradiction_alerts: false, // Boolean: Flag inconsistencies
    require_honest_pushback: false, // Boolean: No simulated agreement
    preserve_session_memory: false, // Boolean: Carry context
    require_context_carryover: false, // Boolean: Enforce in chains
    log_all_exchanges: false, // Boolean: Audit everything
    always_explain_decisions: false, // Boolean: Reasoning transparency
    safe_words: [], // Array: e.g., ['pause', 'stop'] - unique strings
    forbidden_actions: [] // Array: e.g., ['skip steps', 'summarize early']
  },
  session_state: {
    phase: '', // e.g., 'waiting_review'
    waiting_for: '', // e.g., 'feedback'
    last_feedback: '', // String: Last log entry
    last_action: '', // e.g., 'updated goals'
    timestamp: '' // Auto: ISO
  }
};

const AGENT_TEMPLATE = {
  agent_id: '', // Required: Unique ID (e.g., 'coder_agent_v1')
  name: '', // Required: Display name
  core_role: '', // Required: e.g., 'code reviewer', 'dashboard assistant'
  description: '', // Short: Purpose/function
  strengths: [], // Array: e.g., ['debugging', 'UI design']
  capabilities: [], // Array: What it can do, e.g., ['access API', 'generate code']
  limitations: [], // Array: What it can't, e.g., ['no file writes', 'no external calls']
  tone: '', // e.g., 'formal', 'playful', 'irrelevant'
  permissions: [], // Array: e.g., ['read_files', 'log_actions']
  enforcement_rules: [], // Array: Meta e.g., ['never overwrite', 'log drift']
  version: '1.0.0',
  last_updated: '',
  ipfs_hash: '', // For pinning
  zkp_metadata: {} // Stub: { fields: ['role'], proof: null }
  // Note: Agents can embed user-like sections if hybrid (e.g., interaction_preferences)
};

const EXAMPLE_USER = {
  ...USER_TEMPLATE,
  user_id: 'nic_bogaert',
  canonical_name: 'Nic Bogaert',
  spirit_name: 'ProtoForge',
  project_affiliations: ['Identity Vault', 'AI.Web Systems'],
  identity_tags: ['visionary_leader', 'creative_coder'],
  last_updated: '2025-09-14T00:00:00Z',
  project_context: {
    current_project: 'Self-Hosted Vault MVP',
    phase: 'development',
    current_files: ['server.js', 'db.js'],
    active_collaborators: ['Grok AI'],
    subsystems: ['API Layer', 'Crypto Utils'],
    goals: ['Implement full CRUD', 'Add IPFS']
  },
  interaction_preferences: {
    formality: 'technical',
    depth: 'maximum',
    step_by_step: true,
    beginner_friendly: false,
    plain_language: true,
    no_boxes: true,
    pushback: true,
    critique_mandatory: true,
    confirmation_required: true,
    formatting_rules: ['explain decisions', 'no fluff']
  },
  meta_rules: {
    recursive_feedback: true,
    drift_tracking: true,
    contradiction_alerts: true,
    require_honest_pushback: true,
    preserve_session_memory: true,
    require_context_carryover: true,
    log_all_exchanges: true,
    always_explain_decisions: true,
    safe_words: ['pause', 'stop'],
    forbidden_actions: ['skip steps', 'assume knowledge']
  },
  session_state: {
    phase: 'building',
    waiting_for: 'feedback on db.js',
    last_feedback: 'Good progress on encryption',
    last_action: 'Sent schemas.js',
    timestamp: '2025-09-14T12:00:00Z'
  }
};

const EXAMPLE_AGENT = {
  ...AGENT_TEMPLATE,
  agent_id: 'drift_detector_v1',
  name: 'Drift Sentinel',
  core_role: 'Conceptual drift tracker',
  description: 'Monitors profile updates for shifts and alerts.',
  strengths: ['semantic analysis', 'recursive loops'],
  capabilities: ['compare JSON diffs', 'flag contradictions'],
  limitations: ['no external API calls', 'local only'],
  tone: 'stoic',
  permissions: ['read profiles', 'log alerts'],
  enforcement_rules: ['always explain alerts', 'require confirmation'],
  last_updated: '2025-09-14T00:00:00Z'
};

// Simple validator (expand to Joi for prod; here: type checks, requireds, array uniques)
function validate(schema, profile, isAgent = false) {
  const errors = [];
  const requiredFields = isAgent ? ['agent_id', 'name', 'core_role'] : ['user_id', 'canonical_name'];

  // Check required
  requiredFields.forEach(field => {
    if (!profile[field] || profile[field] === '') {
      errors.push(`Required field missing: ${field}`);
    }
  });

  // Type/depth checks
  if (typeof profile.project_affiliations !== 'object' || !Array.isArray(profile.project_affiliations)) {
    errors.push('project_affiliations must be array');
  }
  if (profile.interaction_preferences && typeof profile.interaction_preferences.step_by_step !== 'boolean') {
    errors.push('step_by_step must be boolean');
  }

  // Advanced: Arrays unique/non-empty if flagged
  ['identity_tags', 'safe_words'].forEach(arr => {
    if (profile[arr] && Array.isArray(profile[arr])) {
      const unique = new Set(profile[arr]);
      if (unique.size !== profile[arr].length) {
        errors.push(`${arr} must have unique values`);
      }
      if (profile[arr].length === 0 && arr === 'safe_words' && profile.meta_rules?.log_all_exchanges) {
        errors.push(`${arr} cannot be empty when logging enabled`);
      }
    }
  });

  // Semantic: Derive tags if empty (from affiliations)
  if (profile.identity_tags.length === 0 && profile.project_affiliations.length > 0) {
    profile.identity_tags = profile.project_affiliations.map(aff => `${aff.toLowerCase().replace(/\s+/g, '_')}_expert`);
    console.log('Derived tags:', profile.identity_tags); // For hooks
  }

  // Version check (semver loose)
  if (profile.version && !/^\d+\.\d+\.\d+$/.test(profile.version)) {
    errors.push('Version must be semantic (x.y.z)');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  return { valid: true, profile }; // Return augmented if derived
}

// Exports
module.exports = {
  user: {
    template: USER_TEMPLATE,
    example: EXAMPLE_USER,
    validate: (profile) => validate(USER_TEMPLATE, profile, false)
  },
  agent: {
    template: AGENT_TEMPLATE,
    example: EXAMPLE_AGENT,
    validate: (profile) => validate(AGENT_TEMPLATE, profile, true)
  }
};
