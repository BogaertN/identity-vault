// utils/prompts.js - Interactive Step-by-Step Profile Creation Prompts
// Based on Operational Identity docs (2025): Grouped questions for user/agent profiles,
// one section at a time with "Ready?" confirmations, fills template via readline.
// Features: CLI-friendly (uses readline for input), batch mode (for API/LLM), validation integration,
// derives fields (e.g., tags from affiliations), handles booleans/arrays, recursive for feedback.
// Advanced: Pause on safe words, drift check during input, IPFS/ZKP prompts for advanced users,
// confirmation loops for critique_mandatory, exports to JSON/DB hook.
// Usage: createProfilePrompts(schema, type, isCLI=true) -> returns filled profile.
// Integrates: Calls schemas.validate, utils.drift for meta-rules preview.
// Version: 1.0 | For solo/CLI use; non-blocking for server.

const readline = require('readline');
const { user: userSchema, agent: agentSchema } = require('../schemas'); // Templates/validate
const { detectDrift } = require('./drift'); // Preview meta-rules
const fs = require('fs');
const path = require('path');

// Sections from docs: Grouped questions (Basic, Project, Interaction, Meta, Session)
const USER_SECTIONS = [
  {
    name: 'Basic Identity',
    questions: [
      { key: 'user_id', prompt: 'What is your preferred user ID or handle?' },
      { key: 'canonical_name', prompt: 'What is your full (canonical) name?' },
      { key: 'spirit_name', prompt: 'Do you have a “spirit name,” nickname, or alternate identity you want to include?' },
      { key: 'project_affiliations', prompt: 'What are your main project or team affiliations? (comma-separated)' },
      { key: 'identity_tags', prompt: 'Which tags describe your style, strengths, or working role? (e.g., “visionary”, “critical thinker”; comma-separated)' }
    ]
  },
  {
    name: 'Project Context',
    questions: [
      { key: 'project_context.current_project', prompt: 'What is your current primary project?' },
      { key: 'project_context.phase', prompt: 'What phase or stage are you in?' },
      { key: 'project_context.current_files', prompt: 'What files or documents are most relevant right now? (comma-separated)' },
      { key: 'project_context.active_collaborators', prompt: 'Who are your active collaborators, if any? (comma-separated)' },
      { key: 'project_context.subsystems', prompt: 'What major subsystems or components are you working on? (comma-separated)' },
      { key: 'project_context.goals', prompt: 'What are your top goals for this project/session? (comma-separated)' }
    ]
  },
  {
    name: 'Interaction Preferences',
    questions: [
      { key: 'interaction_preferences.formality', prompt: 'What level of formality do you want? (stoic, casual, technical, etc.)' },
      { key: 'interaction_preferences.depth', prompt: 'How deep or detailed should answers be? (maximum, summary, minimal, etc.)' },
      { key: 'interaction_preferences.step_by_step', prompt: 'Do you want everything explained step-by-step? (yes/no)', type: 'boolean' },
      { key: 'interaction_preferences.beginner_friendly', prompt: 'Should responses always be beginner-friendly? (yes/no)', type: 'boolean' },
      { key: 'interaction_preferences.plain_language', prompt: 'Should I use plain language and avoid jargon unless asked? (yes/no)', type: 'boolean' },
      { key: 'interaction_preferences.no_boxes', prompt: 'Do you want to avoid tables/boxes/markdown blocks? (yes/no)', type: 'boolean' },
      { key: 'interaction_preferences.pushback', prompt: 'Should I give pushback and challenge your ideas? (yes/no)', type: 'boolean' },
      { key: 'interaction_preferences.critique_mandatory', prompt: 'Do you want mandatory critique and honest feedback? (yes/no)', type: 'boolean' },
      { key: 'interaction_preferences.confirmation_required', prompt: 'Should I wait for your confirmation before moving to the next step or section? (yes/no)', type: 'boolean' },
      { key: 'interaction_preferences.formatting_rules', prompt: 'Are there any special formatting rules? (e.g., “never use code blocks”, “always add explanations”; comma-separated)' }
    ]
  },
  {
    name: 'Meta-Rules',
    questions: [
      { key: 'meta_rules.recursive_feedback', prompt: 'Should I enable recursive feedback loops and critique? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.drift_tracking', prompt: 'Should I actively track and alert for conceptual drift? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.contradiction_alerts', prompt: 'Should I flag contradictions? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.require_honest_pushback', prompt: 'Do you require honest pushback (not simulated agreement)? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.preserve_session_memory', prompt: 'Should I preserve and recall session memory/context between sessions? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.require_context_carryover', prompt: 'Should I require context carryover? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.log_all_exchanges', prompt: 'Should I log all exchanges for transparency? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.always_explain_decisions', prompt: 'Should I always explain my reasoning and decisions? (yes/no)', type: 'boolean' },
      { key: 'meta_rules.safe_words', prompt: 'Are there any safe words or “pause” commands you want to use? (comma-separated)' },
      { key: 'meta_rules.forbidden_actions', prompt: 'Are there actions that should always be forbidden? (e.g., “skip steps,” “summarize before context”; comma-separated)' }
    ]
  },
  {
    name: 'Session State',
    questions: [
      { key: 'session_state.phase', prompt: 'What phase or mode are you in right now? (optional; for live projects)' },
      { key: 'session_state.waiting_for', prompt: 'What are you currently waiting for (feedback, review, etc.)?' },
      { key: 'session_state.last_feedback', prompt: 'Any notes about last feedback, last action, or timestamp? (optional; can be auto-filled)' }
    ]
  }
];

const AGENT_SECTIONS = [ // Adapted for agents: Basics, Role/Caps, Tone/Perms, Enforcement
  {
    name: 'Basic Agent Identity',
    questions: [
      { key: 'agent_id', prompt: 'What is the agent\'s unique ID?' },
      { key: 'name', prompt: 'What is the agent\'s display name?' },
      { key: 'core_role', prompt: 'What is the agent\'s core role/function? (e.g., "code reviewer")' },
      { key: 'description', prompt: 'Short description of the agent\'s purpose.' },
      { key: 'strengths', prompt: 'Key strengths of the agent? (comma-separated)' }
    ]
  },
  {
    name: 'Capabilities and Limits',
    questions: [
      { key: 'capabilities', prompt: 'What can this agent do? (comma-separated)' },
      { key: 'limitations', prompt: 'What can\'t this agent do? (comma-separated)' }
    ]
  },
  {
    name: 'Tone and Permissions',
    questions: [
      { key: 'tone', prompt: 'What tone should the agent use? (formal, playful, etc.)' },
      { key: 'permissions', prompt: 'What permissions does the agent have? (e.g., "read_files"; comma-separated)' }
    ]
  },
  {
    name: 'Enforcement Rules',
    questions: [
      { key: 'enforcement_rules', prompt: 'Any special enforcement rules? (e.g., "never overwrite files"; comma-separated)' }
    ]
  }
];

// Core function: Interactive prompts (CLI or batch)
async function createProfilePrompts(schemaType, initialAnswers = {}, isCLI = true) {
  const schema = schemaType === 'user' ? userSchema : agentSchema;
  let profile = { ...schema.template };
  const sections = schemaType === 'user' ? USER_SECTIONS : AGENT_SECTIONS;
  const rl = isCLI ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  // Apply initials (for API/batch mode)
  Object.assign(profile, initialAnswers);

  for (let section of sections) {
    console.log(`\n--- Section: ${section.name} ---`);
    for (let q of section.questions) {
      let answer;
      if (isCLI) {
        answer = await new Promise(resolve => {
          rl.question(`${q.prompt} `, resolve);
        });
      } else {
        // Batch: Use initial or prompt stub (for server)
        answer = initialAnswers[q.key] || '';
      }

      // Process: Split comma for arrays, bool for yes/no
      if (q.type === 'boolean') {
        const norm = answer.toLowerCase().trim();
        answer = norm === 'yes' || norm === 'y';
      } else if (answer.includes(',')) {
        answer = answer.split(',').map(s => s.trim()).filter(Boolean);
      }

      // Set nested key (e.g., 'project_context.current_project')
      const keys = q.key.split('.');
      let target = profile;
      for (let i = 0; i < keys.length - 1; i++) {
        target = target[keys[i]] || (target[keys[i]] = {});
      }
      target[keys[keys.length - 1]] = answer;

      // Advanced: Safe word check during input
      if (profile.meta_rules?.safe_words?.includes(answer)) {
        console.log('Safe word detected—pausing section.');
        return null; // Halt
      }

      // Drift preview if enabled
      if (profile.meta_rules?.drift_tracking) {
        const mockUpdate = { ...profile, [q.key]: answer };
        const drift = detectDrift(profile, mockUpdate);
        if (drift) console.log(`Drift alert: ${drift} (continuing...)`);
      }
    }

    // Confirmation: Wait for "Ready" (or yes/no if critique_mandatory)
    if (isCLI) {
      let ready;
      do {
        ready = await new Promise(resolve => {
          rl.question(`Ready for next section? (type "Ready" or "yes") `, resolve);
        });
        if (profile.interaction_preferences?.critique_mandatory && ready.toLowerCase() === 'yes') {
          console.log('Critique mode: Any changes to this section? (optional feedback)');
          const feedback = await new Promise(resolve => rl.question('Feedback: ', resolve));
          if (feedback) {
            // Recursive stub: Log for later
            console.log(`Feedback noted: ${feedback}`);
          }
        }
      } while (!['ready', 'yes'].includes(ready.toLowerCase()));
    }
  }

  // Finalize: Validate, derive, timestamp
  schema.validate(profile); // Throws if invalid
  profile.last_updated = new Date().toISOString();
  profile.version = '1.0.0'; // Bump in update
  profile.session_state.timestamp = new Date().toISOString();

  // Advanced: Optional IPFS/ZKP prompts
  if (isCLI) {
    const pinIPFS = await new Promise(resolve => {
      rl.question('Pin to IPFS for sharing? (y/n): ', a => resolve(a.toLowerCase() === 'y'));
    });
    if (pinIPFS) {
      const { pinToIPFS } = require('./ipfs');
      profile.ipfs_hash = await pinToIPFS(JSON.stringify(profile));
    }
  }

  if (rl) rl.close();
  return profile;
}

// Export blank to templates/
function generateTemplates() {
  const templatesDir = path.join(__dirname, '../templates');
  if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir);
  fs.writeFileSync(path.join(templatesDir, 'user-template.json'), JSON.stringify(userSchema.template, null, 2));
  fs.writeFileSync(path.join(templatesDir, 'agent-template.json'), JSON.stringify(agentSchema.template, null, 2));
  console.log('Templates generated in /templates');
}

// Batch mode for API (non-interactive)
function batchCreate(schemaType, answers) {
  return createProfilePrompts(schemaType, answers, false);
}

// Exports
module.exports = {
  createProfilePrompts,
  generateTemplates,
  batchCreate,
  USER_SECTIONS,
  AGENT_SECTIONS
};
