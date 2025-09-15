# Self-Hosted Identity Vault

[![Version](https://img.shields.io/badge/version-1.0-blue.svg)](https://github.com/nicbogaert/identity-vault)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%5E18.0.0-green.svg)](https://nodejs.org)

A sovereign, portable, and privacy-first platform for managing user and agent operational identities in the AI era. Built on Node.js/Express/SQLite with IPFS/ZKP integrations for decentralized trust.

## Overview

The Identity Vault turns your operational self—working styles, rules, project context—into a persistent JSON profile, loadable across LLMs, agents, and apps. No more "Groundhog Day" onboarding. Key features:
- **User Profiles**: Capture preferences, meta-rules (e.g., safe words, drift tracking), session state.
- **Agent Profiles**: Define roles, capabilities, limits, enforcement for multi-agent teams.
- **Privacy-First**: Local SQLite DB, AES encryption, optional IPFS pinning, ZKP for selective disclosure.
- **Integrations**: LangChain memory, AutoGen/CrewAI hooks, RAG filters, ngrok tunneling.
- **Advanced**: Drift/contradiction detection, recursive feedback, audit trails, regulatory exports.

For AI/Web apps, multi-agent orchestration, teams, or solo devs seeking control over digital context.

## Quick Start

### Prerequisites
- Node.js >=18 (check: `node --version`)
- Git (for cloning)

### Installation
1. Clone the repo:
git clone https://github.com/nicbogaert/identity-vault.git
cd identity-vault
text2. Install dependencies:
npm install
text(Includes: express, sqlite3, ipfs-core, snarkjs, commander, ngrok, chalk, json-diff, @langchain/core, multiformats)

3. Copy and configure env:
cp .env.example .env
textEdit `.env`: Set `ENCRYPTION_KEY` (gen: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), `API_TOKEN`, etc.

4. Generate templates:
npm run cli generate-templates
text5. Run the server:
npm start
textVault runs at `http://localhost:3000`. Test: `curl http://localhost:3000/health`

### First Profile
- CLI: `npm run cli create-profile --type user` (interactive prompts)
- API: POST `/profiles/user` with JSON body (use Postman/curl)

## Usage

### CLI Commands
Run `npm run cli -- <command> [options]`

| Command | Description | Example |
|---------|-------------|---------|
| `create-profile` | Interactive profile creation | `npm run cli create-profile --type agent --pin-ipfs` |
| `import` | Import JSON to DB | `npm run cli import user-template.json --type user` |
| `export` | Export to JSON/IPFS | `npm run cli export nic_bogaert --to-ipfs --zkp` |
| `tunnel` | Ngrok public tunnel | `npm run cli tunnel --port 3000` |
| `list` | List profiles/state | `npm run cli list --type user --state` |
| `update` | Patch field | `npm run cli update nic_bogaert --type user --field "interaction_preferences.depth" --value "maximum"` |
| `feedback` | Log entry | `npm run cli feedback nic_bogaert --message "Good drift alert" --type drift` |
| `orchestrate` | Team setup (stub) | `npm run cli orchestrate project_alpha` |
| `generate-templates` | Blank JSONs | `npm run cli generate-templates` |

### API Documentation
Base URL: `http://localhost:3000`. Auth: `Authorization: Bearer ${API_TOKEN}`

#### Profiles (CRUD)
| Method | Endpoint | Description | Params/Body |
|--------|----------|-------------|-------------|
| POST | `/profiles/:type` | Create (user/agent) | Body: JSON profile; ?pinToIPFS=true, ?zkpFields=field1,field2 |
| GET | `/profiles/:type/:id` | Load w/ options | ?includeState=true&includeLogs=true&zkpProof=true&fields=field1&safe_word=pause&redact=pii |
| PATCH | `/profiles/:type/:id` | Update (versioned) | Body: partial updates |
| DELETE | `/profiles/:type/:id` | Soft/hard delete | ?hard=true |

#### Feedback/State
| Method | Endpoint | Description | Params/Body |
|--------|----------|-------------|-------------|
| POST | `/feedback` | Log (auto-type) | Body: {profile_id, type, data} |
| GET | `/state/:id` | Session state/logs | ?limit=50&type=drift&since=2025-09-01 |
| POST | `/feedback/recursive/:id` | Trigger loop | Body: {issue: {...}} |
| GET | `/feedback/export/:id` | Regulatory export | ?redact=pii |

#### Agents (Multi-Agent)
| Method | Endpoint | Description | Params/Body |
|--------|----------|-------------|-------------|
| POST | `/agents/orchestrate` | Team setup/handshakes | Body: {teamId, agents: [...], tasks: [...]} |
| GET | `/agents/audit/:teamId` | Cross-agent trails | ?limit=100&agents=id1,id2&since=2025-09-01 |
| POST | `/agents/handshake/:agentId` | ZKP handshake | Body: {peerId, fields: [...]} |

#### Integrations
| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/integrations/langchain` | Memory loader | {profileId, type} |
| POST | `/integrations/autogen` | Agent config | {agentId} |
| POST | `/integrations/rag` | Filtered query | {query, profileId} |

Health: GET `/health` (status/version).

### Examples
- Create & Load: See `/examples/quickstart.md` (add if needed).
- Multi-Agent: POST `/agents/orchestrate` with JSON team spec.

## Development

### Scripts
- `npm start`: Run server
- `npm run dev`: Nodemon watch (add nodemon dep)
- `npm run cli <cmd>`: CLI tools
- `npm test`: Run tests (add jest)

### Structure
- `server.js`: Express app
- `db.js`: SQLite ops
- `routes/`: API endpoints
- `utils/`: Crypto, IPFS, ZKP, drift, integrations
- `cli.js`: Command-line interface
- `templates/`: Blank JSONs

### Extending
- Add plugins: `/plugins/example-hook.js` (webhook stub)
- Custom fields: Extend schemas.js, validate in routes
- Tests: `/tests/server.test.js` (Jest stub)

### Contribution
1. Fork & clone.
2. Branch: `git checkout -b feature/drift-v2`.
3. Commit: Conventional (feat:, fix:, docs:).
4. PR: Describe changes, link issues.
5. Code style: ESLint (add if needed); semver tags.

Guidelines: Privacy-first (no telemetry), modular (hooks over monoliths), tested (80% coverage).

## License
ISC © 2025 Nic Bogaert & The AI.Web Systems Group. See [LICENSE](LICENSE).

## Roadmap
- v1.1: Full RAG integration, asymmetric crypto for teams.
- v2.0: Blockchain anchoring for audits, GUI dashboard.

Questions? Open an issue.
# identity-vault
