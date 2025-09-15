// routes/agents.js - Multi-Agent Orchestration and Audit API Routes for Identity Vault
// Handles POST /agents/orchestrate (team setup: assign roles, init handshakes via ZKP), GET /agents/audit/:teamId (trails for multi-agent sessions),
// with enforcement (perms/limits), coordination (e.g., pubsub sync), trust verification.
// Features: Team vault creation (shared profiles), role assignment from agent templates, handshake logs,
// audit exports (cross-agent actions, drifts in swarms).
// Advanced: Recursive orchestration stub (e.g., delegate tasks via CrewAI hook), contradiction alerts across agents,
// IPFS for shared configs, regulatory compliance for agent teams (e.g., permission traces).
// Mounts on /agents in server.js; uses express.Router.
// Integrates: db.js (profiles/state), utils/integrations (autogenHook/orchestrationHook), utils/zkps (handshakes),
// utils/ipfs (sync), utils/drift (cross-agent alerts).
// Safety: Verify all agents before orchestrate; soft-fail on handshake errors. Errors JSON.
// Usage: app.use('/agents', agentRoutes);
// Version: 1.0 | 2025 | Deps: None.

const express = require('express');
const router = express.Router();
const { getProfile, saveProfile, updateProfile, logFeedback, getAuditTrail, updateState } = require('../db');
const { agent: agentSchema } = require('../schemas');
const { autogenHook, orchestrationHook } = require('../utils/integrations');
const { verifyZKP } = require('../utils/zkps');
const { detectDrift, alertContradictions } = require('../utils/drift');
const { publishUpdate } = require('../utils/ipfs');
const { encrypt } = require('../utils/encryption');

// POST /agents/orchestrate - Setup multi-agent team (roles, handshakes, config gen)
router.post('/orchestrate', async (req, res) => {
  try {
    const { teamId, agents = [], tasks = [] } = req.body; // e.g., {teamId: 'project_alpha', agents: [{agent_id: 'coder_v1', role: 'developer'}], tasks: ['code review']}
    if (!teamId || !Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ error: 'teamId and non-empty agents array required' });
    }

    // Fetch/validate agents
    const teamAgents = [];
    for (let agentConfig of agents) {
      const profile = await getProfile('agent', agentConfig.agent_id);
      if (!profile) return res.status(404).json({ error: `Agent ${agentConfig.agent_id} not found` });

      // Validate schema
      agentSchema.validate(profile.data);

      // ZKP handshake for trust (prove role)
      const proof = profile.data.zkp_metadata?.proof;
      if (!verifyZKP(proof, { role: agentConfig.role || profile.data.core_role })) {
        return res.status(403).json({ error: `Handshake failed for ${agentConfig.agent_id}` });
      }

      // Assign role/enforce perms
      const updated = { ...profile.data, assigned_role: agentConfig.role };
      await updateProfile('agent', agentConfig.agent_id, updated);

      // Gen config via hook
      const config = await autogenHook(agentConfig.agent_id, { team: teamId });
      teamAgents.push({ id: agentConfig.agent_id, config, role: agentConfig.role });

      // Log handshake
      await logFeedback(agentConfig.agent_id, { type: 'handshake', teamId, verified: true });
    }

    // Orchestration hook for team (e.g., CrewAI delegation)
    const orchConfig = await orchestrationHook(teamId);
    orchConfig.team_agents = teamAgents;
    orchConfig.tasks = tasks; // Delegate via roles

    // Cross-agent drift/contradiction check (stub: pairwise)
    for (let i = 0; i < teamAgents.length; i++) {
      for (let j = i + 1; j < teamAgents.length; j++) {
        const agent1 = await getProfile('agent', teamAgents[i].id);
        const agent2 = await getProfile('agent', teamAgents[j].id);
        const drift = detectDrift(agent1.data, agent2.data); // Compare rules/perms
        if (drift) {
          await logFeedback(teamId, { type: 'team_drift', agents: [teamAgents[i].id, teamAgents[j].id], details: drift });
        }
        const contra = alertContradictions({ ...agent1.data, ...agent2.data }); // Merged rules
        if (contra) await logFeedback(teamId, { type: 'team_contradiction', details: contra });
      }
    }

    // Sync team config to IPFS for portability
    const teamConfigEncrypted = encrypt(JSON.stringify(orchConfig));
    const ipfsHash = await require('../utils/ipfs').pinToIPFS(teamConfigEncrypted, { teamId });
    await saveProfile('agent', teamConfigEncrypted, teamId, ipfsHash, '{}'); // Store as 'team' agent

    // Update team state
    await updateState(teamId, { phase: 'orchestrating', waiting_for: 'task execution', last_action: `Orchestrated ${teamAgents.length} agents` });

    // Pubsub notify
    await publishUpdate(`team_${teamId}`, { event: 'orchestrated', agents: teamAgents.map(a => a.id) });

    res.json({ teamId, config: orchConfig, ipfs_hash: ipfsHash, message: `Team orchestrated with ${teamAgents.length} agents` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /agents/audit/:teamId - Audit trails for multi-agent sessions (cross-logs, actions)
router.get('/audit/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { limit = 100, type = null, since = null } = req.query;

    // Get team state
    const state = await getState(teamId);

    // Aggregate logs from team agents + team
    const teamLogs = await getAuditTrail(teamId, limit);
    const agentIds = req.query.agents ? req.query.agents.split(',') : []; // Optional filter
    let allLogs = [...teamLogs];

    if (agentIds.length > 0) {
      for (let agentId of agentIds) {
        const agentLogs = await getAuditTrail(agentId, limit);
        allLogs = allLogs.concat(agentLogs);
      }
    } else {
      // All team agents (fetch from team profile or stub)
      const teamProfile = await getProfile('agent', teamId);
      if (teamProfile && teamProfile.data.team_agents) {
        for (let agent of teamProfile.data.team_agents) {
          const agentLogs = await getAuditTrail(agent.id, limit);
          allLogs = allLogs.concat(agentLogs);
        }
      }
    }

    // Filter
    if (type) allLogs = allLogs.filter(log => log.type === type);
    if (since) allLogs = allLogs.filter(log => new Date(log.timestamp) >= new Date(since));

    // Decrypt and sort by timestamp DESC
    allLogs.forEach(log => {
      try {
        log.data = JSON.parse(typeof log.data === 'string' ? require('../utils/encryption').decrypt(log.data) : log.data);
      } catch (e) {
        log.data = '[Decrypted failed]';
      }
    });
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Summary: Actions, drifts, handshakes
    const summary = {
      total_logs: allLogs.length,
      unique_agents: new Set(allLogs.map(l => l.profile_id)).size,
      drifts: allLogs.filter(l => l.type === 'drift').length,
      handshakes: allLogs.filter(l => l.type === 'handshake').length,
      last_action: state.last_action
    };

    // Regulatory: Add hash for tamper-proof
    const auditHash = require('crypto').createHash('sha256').update(JSON.stringify(allLogs)).digest('hex');
    res.set('X-Audit-Hash', auditHash);

    res.json({ teamId, state, audit_trail: allLogs, summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /agents/handshake/:agentId - Manual ZKP handshake for agent collab (stub for P2P)
router.post('/handshake/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { peerId, fields } = req.body; // e.g., {peerId: 'agent2', fields: ['role', 'permissions']}

    const profile = await getProfile('agent', agentId);
    if (!profile) return res.status(404).json({ error: 'Agent not found' });

    const proof = await require('../utils/zkps').proveZKP(profile.data, fields);
    const verified = await require('../utils/zkps').verifyZKP(proof, { peerId });

    // Log
    await logFeedback(agentId, { type: 'handshake', peerId, fields, verified });

    if (verified) {
      await publishUpdate(`handshake_${agentId}`, { peerId, success: true }); // Sync
    }

    res.json({ agentId, proof, verified, message: verified ? 'Handshake successful' : 'Verification failed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exports
module.exports = router;
