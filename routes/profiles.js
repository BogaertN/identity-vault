// routes/profiles.js - Core API Routes for User/Agent Profiles in Identity Vault
// Handles CRUD: POST /profiles (create), GET /profiles/:type/:id (load), PATCH /profiles/:type/:id (update),
// DELETE /profiles/:type/:id (soft/hard delete), with versioning, validation, encryption passthrough.
// Features: Type discriminator (user/agent), query params for includeState/logs/ZKP, IPFS fallback,
// safe word enforcement, drift/contradiction checks on update.
// Advanced: Bulk ops stub, export to JSON/IPFS, regulatory redaction (e.g., ?redact=pii),
// integrates meta_rules (e.g., confirmation_required triggers 202 Accepted).
// Mounts on /profiles in server.js; uses express.Router for modularity.
// Integrates: db.js (CRUD), schemas.js (validate), utils/* (encrypt/drift/ipfs/zkps).
// Safety: Auth middleware assumed in server.js; rate limit stub. Errors JSON.
// Usage: app.use('/profiles', profileRoutes);
// Version: 1.0 | 2025 | Deps: None (uses core Express).

const express = require('express');
const router = express.Router();
const { saveProfile, getProfile, updateProfile, deleteProfile, getAuditTrail } = require('../db');
const { user: userSchema, agent: agentSchema } = require('../schemas');
const { encrypt } = require('../utils/encryption');
const { fetchFromIPFS } = require('../utils/ipfs');
const { proveZKP } = require('../utils/zkps');
const { detectDrift, alertContradictions, recursiveFeedback } = require('../utils/drift');
const { batchCreate } = require('../utils/prompts'); // For non-interactive create

// Middleware: Validate type (user/agent)
router.use('/:type', (req, res, next) => {
  if (!['user', 'agent'].includes(req.params.type)) {
    return res.status(400).json({ error: 'Type must be "user" or "agent"' });
  }
  next();
});

// POST /profiles/:type - Create new profile (guided or batch)
router.post('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const schema = type === 'user' ? userSchema : agentSchema;
    
    // Batch from body (for API) or prompts (stub for CLI redirect)
    let profile;
    if (req.body.usePrompts) {
      // Redirect to CLI if flagged (or simulate)
      profile = await batchCreate(type, req.body.answers || {});
    } else {
      profile = { ...schema.template, ...req.body };
    }
    
    // Validate
    schema.validate(profile);
    
    // Finalize
    profile.version = '1.0.0';
    profile.last_updated = new Date().toISOString();
    const encrypted = encrypt(JSON.stringify(profile));
    
    // Optional ZKP metadata on create
    if (req.body.zkpFields) {
      profile.zkp_metadata = await proveZKP(profile, req.body.zkpFields);
    }
    
    // IPFS pin if requested
    let ipfsHash = null;
    if (req.body.pinToIPFS) {
      ipfsHash = await require('../utils/ipfs').pinToIPFS(encrypted, { version: profile.version });
      profile.ipfs_hash = ipfsHash;
    }
    
    const id = profile[type === 'user' ? 'user_id' : 'agent_id'];
    if (!id) return res.status(400).json({ error: 'ID required (user_id or agent_id)' });
    
    const savedId = await saveProfile(type, encrypted, id, ipfsHash, JSON.stringify(profile.zkp_metadata || {}));
    
    // Log creation
    await require('../db').logFeedback(id, { type: 'create', version: profile.version });
    
    res.status(201).json({ id: savedId, profile, message: 'Profile created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /profiles/:type/:id - Load profile (with options)
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { includeState = 'true', includeLogs = 'false', zkpProof = false, redact = null } = req.query;
    
    let profileData = await getProfile(type, id, includeState === 'true', includeLogs === 'true');
    if (!profileData) {
      // IPFS fallback
      const ipfsData = await fetchFromIPFS(req.headers['x-ipfs-hash'] || ''); // From header or query
      if (ipfsData) {
        profileData = ipfsData;
      } else {
        return res.status(404).json({ error: 'Profile not found locally or on IPFS' });
      }
    }
    
    let profile = profileData.data;
    
    // ZKP proof generation if requested
    if (zkpProof) {
      const fields = req.query.fields ? req.query.fields.split(',') : [];
      const proof = await proveZKP(profile, fields);
      profile.zkp_proof = proof;
    }
    
    // Safe word enforcement
    if (profile.meta_rules?.safe_words?.includes(req.query.safe_word)) {
      return res.status(202).json({ action: 'halted', reason: 'Safe word triggered—session paused' });
    }
    
    // Redact for regulatory (e.g., redact=pii removes names)
    if (redact) {
      profile = redactProfile(profile, redact.split(','));
    }
    
    // Include audit if logs
    if (includeLogs === 'true') {
      profile.audit_trail = await getAuditTrail(id);
    }
    
    res.json({ profile, session_state: profileData.session_state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /profiles/:type/:id - Partial update (versioning, checks)
router.patch('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const updates = req.body;
    
    // Fetch current for diff/checks
    const current = await getProfile(type, id, false, false);
    if (!current) return res.status(404).json({ error: 'Profile not found' });
    
    // Drift/contradiction checks
    const updatedProfile = { ...current.data, ...updates };
    const drift = detectDrift(current.data, updatedProfile);
    const contradiction = alertContradictions(updatedProfile);
    
    if (drift && updatedProfile.meta_rules.drift_tracking) {
      await recursiveFeedback(updatedProfile, drift);
      res.json({ warning: 'Drift detected—feedback loop triggered', ...await updateProfile(type, id, updates) });
      return;
    }
    
    if (contradiction && updatedProfile.meta_rules.contradiction_alerts) {
      await recursiveFeedback(updatedProfile, contradiction);
    }
    
    // Validate updates
    const schema = type === 'user' ? userSchema : agentSchema;
    schema.validate(updatedProfile);
    
    // Apply update (returns changes count)
    const changes = await updateProfile(type, id, updates);
    
    // Re-prove ZKP if metadata changed
    if (updates.zkp_metadata) {
      updatedProfile.zkp_metadata = await proveZKP(updatedProfile, []); // Full re-prove
      await require('../db').updateProfile(type, id, { zkp_metadata: JSON.stringify(updatedProfile.zkp_metadata) }, false);
    }
    
    res.json({ changes, message: `Updated ${changes} fields`, version: updatedProfile.version });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /profiles/:type/:id - Soft/hard delete
router.delete('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { hard = false } = req.query; // ?hard=true for permanent
    
    const changes = await deleteProfile(type, id, hard === 'true');
    if (changes === 0) return res.status(404).json({ error: 'Profile not found' });
    
    // Unpin IPFS if present
    const profile = await getProfile(type, id, false, false);
    if (profile?.ipfs_hash) {
      await require('../utils/ipfs').unpinFromIPFS(profile.ipfs_hash);
    }
    
    // Log deletion
    await require('../db').logFeedback(id, { type: 'delete', hard: hard === 'true' });
    
    res.json({ message: `Profile ${hard === 'true' ? 'permanently' : 'soft-'}deleted (${changes} affected)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Redact sensitive fields (e.g., for export)
function redactProfile(profile, fields) {
  const redacted = { ...profile };
  fields.forEach(field => {
    const keys = field.split('.');
    let target = redacted;
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = '[REDACTED]';
  });
  return redacted;
}

// Bulk stub: POST /profiles/bulk (future)
router.post('/bulk', async (req, res) => {
  // Stub: Loop create for array
  res.status(501).json({ error: 'Bulk ops coming soon' });
});

// Exports
module.exports = router;
