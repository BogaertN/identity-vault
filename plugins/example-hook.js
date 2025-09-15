// plugins/example-hook.js - Sample Plugin for Custom Webhooks/Events in Identity Vault
// Demonstrates modular extensions: e.g., webhook on profile update (notify Slack/Email),
// event listener for drift alerts (trigger recursive), or milestone automation (update state).
// Features: Register hooks in server.js (app.use('/hooks', hooksRouter)), async handlers,
// integration with db/utils (logFeedback, publishUpdate), env-configurable (e.g., SLACK_WEBHOOK_URL).
// Advanced: Chainable (multiple plugins), error-resilient (try/catch + log), ZKP verify for events,
// IPFS publish for distributed triggers.
// Usage: Load in server.js: const exampleHook = require('./plugins/example-hook'); exampleHook.init(app);
// Expand: Add to /plugins dir, auto-load via glob.
// Version: 1.0 | 2025 | Deps: axios (for webhooks; npm install axios).

const axios = require('axios'); // For HTTP notifies
const { logFeedback, updateState } = require('../db');
const { detectDrift } = require('../utils/drift');
const { publishUpdate } = require('../utils/ipfs');
const crypto = require('crypto');

// Sample Hook: On profile update, notify if drift > threshold
async function onProfileUpdate(oldProfile, newProfile, profileId) {
  const drift = detectDrift(oldProfile, newProfile);
  if (drift && parseFloat(process.env.DRIFT_THRESHOLD || '0.3') < drift.severity) {
    // Log
    await logFeedback(profileId, { type: 'hook_drift', details: drift });

    // Notify (e.g., Slack webhook)
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await axios.post(webhookUrl, {
        text: `🚨 Drift Alert: Profile ${profileId} shifted (${drift.count} changes). Review: ${drift.recommendation}`
      }).catch(err => console.error('Slack notify failed:', err));
    }

    // Trigger recursive
    await require('../utils/drift').recursiveFeedback(newProfile, drift);

    // IPFS publish for team sync
    await publishUpdate(`hook_drift_${profileId}`, { alert: drift });

    console.log(`[HOOK] Processed drift for ${profileId}`);
  }
}

// Sample Event: Milestone update (e.g., POST /hooks/milestone with {profileId, milestone: 'MVP done'})
async function onMilestone(eventData) {
  const { profileId, milestone } = eventData;
  try {
    // Verify ZKP if from external
    if (eventData.zkp_proof) {
      const { verifyZKP } = require('../utils/zkps');
      if (!verifyZKP(eventData.zkp_proof, { milestone })) {
        throw new Error('ZKP event verify failed');
      }
    }

    // Update state
    await updateState(profileId, {
      phase: 'milestone_achieved',
      last_action: milestone,
      waiting_for: 'next phase planning'
    });

    // Log
    await logFeedback(profileId, { type: 'milestone', data: { milestone } });

    // Chain: Check for drift post-update
    const profile = await require('../db').getProfile('user', profileId);
    const selfDrift = detectDrift(profile.data, profile.data); // Stub; compare to baseline
    if (selfDrift) await onProfileUpdate(profile.data, profile.data, profileId);

    console.log(`[HOOK] Milestone ${milestone} for ${profileId}`);
    return { success: true, event: 'milestone_processed' };
  } catch (err) {
    await logFeedback(profileId, { type: 'hook_error', error: err.message });
    throw err;
  }
}

// Webhook Router: /hooks/webhook/:type (e.g., POST /hooks/webhook/slack with body)
function webhookRouter() {
  const router = require('express').Router();

  router.post('/webhook/:type', async (req, res) => {
    const { type } = req.params;
    const data = req.body;

    try {
      let result;
      switch (type) {
        case 'milestone':
          result = await onMilestone(data);
          break;
        case 'external_update':
          // Verify signature
          const sig = req.headers['x-signature'];
          const expected = 'sha256=' + crypto.createHmac('sha256', process.env.HOOK_SECRET).update(JSON.stringify(data)).digest('hex');
          if (sig !== expected) return res.status(401).json({ error: 'Invalid signature' });
          result = { processed: true }; // Stub
          break;
        default:
          return res.status(400).json({ error: 'Unknown webhook type' });
      }

      // Publish to IPFS for audit
      await publishUpdate(`webhook_${type}`, { data, result });

      res.json(result || { success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// Init: Register hooks (e.g., in server.js: app.use('/hooks', webhookRouter()); app.on('profileUpdate', onProfileUpdate))
function init(app) {
  if (app) {
    app.use('/hooks', webhookRouter());
    // Event emitter stub: app.on('profileUpdate', (old, new, id) => onProfileUpdate(old, new, id));
  }
  log.info('Example hook initialized');
}

// Exports
module.exports = {
  init,
  onProfileUpdate,
  onMilestone,
  webhookRouter
};
