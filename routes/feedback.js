// routes/feedback.js - Feedback and State API Routes for Identity Vault
// Handles POST /feedback (log user/AI exchanges, drifts, contradictions), GET /state/:id (retrieve session state/logs),
// with recursive loops trigger, audit exports, meta-rules enforcement (e.g., log_all_exchanges auto-logs).
// Features: Type-specific logs (feedback/drift/contradiction/export), query filters (by type/date), bulk log.
// Advanced: Recursive feedback endpoint (POST /feedback/recursive), contradiction auto-resolve stub,
// regulatory export (redacted logs), ties to drift_tracking (alert on high severity).
// Mounts on /feedback in server.js; uses express.Router.
// Integrates: db.js (logFeedback/getState/getAuditTrail), utils/drift (alerts/recursive), utils/encryption (log encrypt if sensitive).
// Safety: Auth assumed; validate inputs, rate limit on logs. Errors JSON.
// Usage: app.use('/feedback', feedbackRoutes);
// Version: 1.0 | 2025 | Deps: None.

const express = require('express');
const router = express.Router();
const { logFeedback, getState, updateState, getAuditTrail } = require('../db');
const { alertContradictions, recursiveFeedback, detectDrift } = require('../utils/drift');
const { encrypt } = require('../utils/encryption');
const { publishUpdate } = require('./../utils/ipfs'); // Sync logs to P2P if enabled

// POST /feedback - Log feedback/drift/contradiction (auto-type if meta_rules.log_all_exchanges)
router.post('/', async (req, res) => {
  try {
    const { profile_id, type = 'feedback', data } = req.body;
    if (!profile_id || !data) return res.status(400).json({ error: 'profile_id and data required' });

    // Encrypt sensitive data (e.g., exchanges)
    const encryptedData = data.sensitive ? encrypt(JSON.stringify(data)) : JSON.stringify(data);

    // Auto-detect type if not specified (e.g., if data has 'alert')
    let finalType = type;
    if (!type && data.alert) finalType = 'drift';
    if (!type && data.conflict) finalType = 'contradiction';

    const logId = await logFeedback(profile_id, { type: finalType, data: encryptedData });

    // Enforce meta_rules: If log_all_exchanges, auto-publish to IPFS for team sync
    const profile = await require('../db').getProfile('user', profile_id, false, false); // Quick fetch
    if (profile?.meta_rules?.log_all_exchanges) {
      await publishUpdate(`feedback_${profile_id}`, { logId, type: finalType });
    }

    // Trigger recursive if contradiction
    if (finalType === 'contradiction') {
      const contradiction = alertContradictions(profile.data);
      if (contradiction) await recursiveFeedback(profile.data, contradiction);
    }

    res.status(201).json({ logId, message: `Logged ${finalType}: ${logId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /state/:id - Retrieve session state (phase, waiting, last action/feedback, with logs filter)
router.get('/state/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, type = null, since = null } = req.query; // Filters: type='drift', since='2025-09-01'

    const state = await getState(id);

    // Augment with filtered logs
    let logs = await getAuditTrail(id, limit);
    if (type) logs = logs.filter(log => log.type === type);
    if (since) logs = logs.filter(log => new Date(log.timestamp) >= new Date(since));

    // Decrypt log data if encrypted
    logs.forEach(log => {
      try {
        log.data = typeof log.data === 'string' && log.data.includes(':') ? JSON.parse(require('./encryption').decrypt(log.data)) : JSON.parse(log.data);
      } catch (e) {
        log.data = '[Decryption failed - check key]';
      }
    });

    // Drift/contradiction summary if recent logs
    const recentLogs = logs.slice(0, 10);
    const drifts = recentLogs.filter(l => l.type === 'drift');
    const contradictions = recentLogs.filter(l => l.type === 'contradiction');
    const summary = {
      total_logs: logs.length,
      recent_drifts: drifts.length,
      recent_contradictions: contradictions.length,
      last_update: state.timestamp
    };

    res.json({ state, logs, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /feedback/recursive - Trigger recursive feedback loop (with issue from body)
router.post('/recursive/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { issue } = req.body; // e.g., {type: 'drift', details: [...]}

    const profile = await require('../db').getProfile('user', id, true, false);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    await recursiveFeedback(profile.data, issue || alertContradictions(profile.data) || detectDrift(profile.data, profile.data));

    // Update state to reflect loop
    await updateState(id, { last_action: 'recursive_feedback', phase: 'reviewing_changes' });

    res.json({ message: 'Recursive feedback triggered and logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /feedback/export/:id - Regulatory export (redacted logs for GDPR/AI Act)
router.get('/export/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { redact = 'pii' } = req.query; // e.g., redact=pii for names/emails

    const logs = await getAuditTrail(id, 0); // All
    const state = await getState(id);

    // Redact
    const exportData = {
      profile_id: id,
      state,
      logs: logs.map(log => {
        let data = log.data;
        try {
          data = JSON.parse(typeof data === 'string' ? require('./encryption').decrypt(data) : data);
        } catch (e) {}
        if (redact === 'pii') {
          data = redactLogData(data); // Stub: Remove names, etc.
        }
        return { ...log, data };
      })
    };

    // Timestamp and hash for tamper-proof
    exportData.export_hash = require('crypto').createHash('sha256').update(JSON.stringify(exportData)).digest('hex');
    exportData.exported_at = new Date().toISOString();

    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename=feedback-export-${id}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Redact log data (e.g., anonymize PII)
function redactLogData(data) {
  const redacted = { ...data };
  // Stub rules: Remove personal fields
  if (redacted.user_name) redacted.user_name = '[REDACTED]';
  if (redacted.email) redacted.email = '[REDACTED]';
  if (redacted.content && redacted.content.includes('@')) redacted.content = redacted.content.replace(/[\w\.-]+@[\w\.-]+/g, '[EMAIL]');
  return redacted;
}

// Bulk log stub: POST /feedback/bulk
router.post('/bulk', async (req, res) => {
  const { logs } = req.body; // Array of {profile_id, type, data}
  if (!Array.isArray(logs)) return res.status(400).json({ error: 'logs must be array' });

  const results = [];
  for (let log of logs) {
    try {
      const id = await logFeedback(log.profile_id, { type: log.type, data: JSON.stringify(log.data) });
      results.push({ success: true, logId: id });
    } catch (err) {
      results.push({ success: false, error: err.message });
    }
  }
  res.json({ results, total: results.length });
});

// Exports
module.exports = router;
