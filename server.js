// server.js - Main Entry Point for Self-Hosted Identity Vault
// Sovereign, Portable, Privacy-First Operational Identity Server
// Version: 1.0 | Compiled: Nic Bogaert & AI.Web Systems Group, 2025
// Features: Full API for user/agent profiles, versioning, encryption, drift tracking,
// multi-agent orchestration, IPFS/ZKP integration, recursive feedback, audit logs,
// regulatory exports, LangChain/AutoGen hooks, safe word enforcement, session memory.
// Run: npm start (listens on port from .env or 3000)

require('dotenv').config(); // Load env vars (e.g., PORT=3000, ENCRYPTION_KEY=..., IPFS_NODE=...)
const express = require('express');
const cors = require('cors'); // For cross-origin (e.g., LLM apps)
const bodyParser = require('body-parser'); // Parse JSON bodies
const sqlite3 = require('sqlite3').verbose(); // DB driver
const path = require('path');
const { encrypt, decrypt } = require('./utils/encryption'); // Privacy: Encrypt profiles
const { initDB, getProfile, saveProfile, updateProfile, logFeedback, getState } = require('./db'); // DB ops
const userSchema = require('./schemas').user; // Templates/validators
const agentSchema = require('./schemas').agent;
const { createProfilePrompts } = require('./utils/prompts'); // CLI-like prompts (used in API too)
const { pinToIPFS, fetchFromIPFS } = require('./utils/ipfs'); // Decentralized sharing
const { proveZKP, verifyZKP } = require('./utils/zkps'); // Advanced: Trust handshakes
const { detectDrift, alertContradictions, recursiveFeedback } = require('./utils/drift'); // Meta-rules enforcement
const { langchainLoader, autogenHook, ragFilter } = require('./utils/integrations'); // Ecosystem hooks
const profileRoutes = require('./routes/profiles'); // User/Agent CRUD
const feedbackRoutes = require('./routes/feedback'); // Logs/state
const agentRoutes = require('./routes/agents'); // Orchestration/audit

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'vault.db');

// Global middleware
app.use(cors({ origin: '*' })); // Allow LLM/localhost access; tighten for prod
app.use(bodyParser.json({ limit: '10mb' })); // Handle large JSON profiles
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve UI
app.get('/ui', (req, res) => res.sendFile(path.join(__dirname, 'public/ui.html')));

// Auth stub: Basic token check (expand to JWT/OAuth for teams)
app.use((req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token !== process.env.API_TOKEN) { // Env var for simple auth
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
  next();
});

// Error handling middleware (logs drifts/contradictions)
app.use((err, req, res, next) => {
  console.error('Server Error:', err); // Audit trail
  if (err.drift) detectDrift(req.body, res); // Enforce meta-rules
  res.status(500).json({ error: 'Internal error; check logs' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', version: '1.0', timestamp: new Date().toISOString() });
});

// Profile creation endpoint (uses prompts for guided setup)
app.post('/profiles/create/:type', async (req, res) => { // type: 'user' or 'agent'
  try {
    const { type } = req.params;
    const schema = type === 'user' ? userSchema : agentSchema;
    const answers = await createProfilePrompts(schema, req.body.initialAnswers || {}); // Interactive if CLI, else batch
    const profile = { ...schema.template, ...answers, version: '1.0.0', last_updated: new Date().toISOString() };
    const encrypted = encrypt(JSON.stringify(profile), process.env.ENCRYPTION_KEY);
    const id = await saveProfile(type, encrypted, profile.user_id || profile.agent_id);
    // Optional IPFS pin for portability
    if (req.body.pinToIPFS) {
      const hash = await pinToIPFS(encrypted);
      profile.ipfs_hash = hash;
    }
    res.json({ id, profile: decrypt(encrypted, process.env.ENCRYPTION_KEY), message: 'Profile created' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Load profile (with ZKP verification for trust)
app.get('/profiles/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    let encrypted = await getProfile(type, id);
    if (!encrypted) return res.status(404).json({ error: 'Profile not found' });
    const profile = JSON.parse(decrypt(encrypted, process.env.ENCRYPTION_KEY));
    // ZKP for selective disclosure (advanced: prove fields without revealing all)
    if (req.query.zkpProof) {
      const proof = await proveZKP(profile, req.query.fields.split(','));
      if (!verifyZKP(proof)) return res.status(403).json({ error: 'ZKP verification failed' });
      profile.selective = proof; // Return proof only
    }
    // IPFS fallback if local missing
    if (!encrypted && profile.ipfs_hash) encrypted = await fetchFromIPFS(profile.ipfs_hash);
    // Enforce meta-rules (e.g., safe words, context carryover)
    if (profile.meta_rules.safe_words && req.query.safe_word) {
      return res.json({ action: 'halted', reason: 'Safe word triggered' });
    }
    res.json({ profile, session_state: await getState(id) }); // Preserve memory
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile (partial PATCH, versioning)
app.patch('/profiles/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const updates = req.body;
    let encrypted = await getProfile(type, id);
    const profile = JSON.parse(decrypt(encrypted, process.env.ENCRYPTION_KEY));
    const newVersion = `${parseFloat(profile.version) + 0.1}`.substring(0, 5); // Semantic versioning stub
    const updated = { ...profile, ...updates, version: newVersion, last_updated: new Date().toISOString() };
    // Drift check before save
    const driftAlert = detectDrift(profile, updated);
    if (driftAlert) {
      await logFeedback(id, { type: 'drift', alert: driftAlert });
      if (updated.meta_rules.drift_tracking) res.json({ warning: driftAlert, profile: updated });
    }
    // Contradiction alert
    const contradiction = alertContradictions(updated);
    if (contradiction) await recursiveFeedback(updated, contradiction);
    const newEncrypted = encrypt(JSON.stringify(updated), process.env.ENCRYPTION_KEY);
    await updateProfile(type, id, newEncrypted);
    res.json({ id, version: newVersion, changes: Object.keys(updates) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mount sub-routes
app.use('/profiles', profileRoutes); // Extends CRUD
app.use('/feedback', feedbackRoutes); // Logs, state
app.use('/agents', agentRoutes); // Orchestration, audits

// Advanced: Integration hooks (e.g., LangChain loader)
app.post('/integrations/langchain', (req, res) => {
  const { profileId, type } = req.body;
  res.json({ loader: langchainLoader(profileId, type) }); // Returns memory module
});

// AutoGen/CrewAI hook
app.post('/integrations/autogen', (req, res) => {
  const { agentId } = req.body;
  res.json({ config: autogenHook(agentId) }); // Agent role/perms
});

// RAG filter
app.post('/integrations/rag', (req, res) => {
  const { query, profileId } = req.body;
  res.json({ filtered: ragFilter(query, profileId) }); // Tags-based
});

// Regulatory export (GDPR/AI Act compliant)
app.get('/export/regulatory/:id', async (req, res) => {
  const { id } = req.params;
  const profile = await getProfile('user', id); // Or agent
  const logs = await getState(id); // Full audit trail
  res.set('Content-Type', 'application/json');
  res.download(path.join(__dirname, `export-${id}.json`)); // Tamper-proof with timestamps
  // Auto-log export
  await logFeedback(id, { type: 'export', fields: ['all'] });
});

// Webhook for events (e.g., milestone updates)
app.post('/hooks/event', async (req, res) => {
  const { event, profileId } = req.body; // e.g., {event: 'milestone', profileId: 'nic'}
  // Trigger update reminder or automation
  console.log(`Event: ${event} for ${profileId}`);
  res.json({ acknowledged: true });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Vault...');
  db.close((err) => {
    if (err) console.error(err.message);
    console.log('DB closed.');
  });
  process.exit(0);
});

// Init DB on start
initDB(dbPath);

// Start server
app.listen(PORT, () => {
  console.log(`Identity Vault running at http://localhost:${PORT}`);
  console.log('Endpoints: /health, /profiles/create/:type, /profiles/:type/:id, etc.');
  console.log('Advanced: ZKP for trust, IPFS for P2P, drift tracking enabled.');
});

module.exports = app; // For testing
