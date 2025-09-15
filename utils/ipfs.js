// utils/ipfs.js - IPFS Mock for Decentralized Profile Sharing (Stub for MVP; install Helia for real)
// Mocks pinning/fetch (returns CID stubs); expand to real via helia@latest later.
// Features: Stub CIDv1, encrypt passthrough, ZKP link, gateway fallback stub.
// Usage: Same as full; hash = 'QmMockHash' for tests.

const { encrypt } = require('./encryption'); // Passthrough
const { proveZKP } = require('./zkps'); // Proof on pin

// Mock CID (no real IPFS)
const mockCid = (data) => `Qm${Buffer.from(data).toString('base58btc').substring(0, 44)}`; // Stub v1 base32-like

// Pin profile: Mock add/pin, return CID
async function pinToIPFS(data, metadata = {}, encryptBefore = false) {
  let content = data;
  if (encryptBefore) content = encrypt(data);
  const wrapped = { data: content, metadata, timestamp: new Date().toISOString() };
  const proof = await proveZKP({ hash: 'mock', fields: ['version'] }, metadata);
  wrapped.zkp_proof = proof;
  const cidStr = mockCid(JSON.stringify(wrapped));
  console.log(`[MOCK IPFS] Pinned: ${cidStr}`);
  return cidStr;
}

// Fetch: Mock cat, decrypt
async function fetchFromIPFS(cidStr, decryptAfter = false) {
  // Stub data (in real: node.cat)
  const mockWrapped = { data: 'mock_encrypted_data', cid: cidStr };
  let content = mockWrapped.data;
  if (decryptAfter) content = decrypt(content);
  console.log(`[MOCK IPFS] Fetched: ${cidStr}`);
  return { ...mockWrapped, data: content };
}

// Unpin mock
async function unpinFromIPFS(cidStr) {
  console.log(`[MOCK IPFS] Unpinned: ${cidStr}`);
}

// Pubsub mock
async function publishUpdate(topic, data) {
  console.log(`[MOCK IPFS] Published to ${topic}: ${JSON.stringify(data)}`);
}

// List mock
async function listPins() {
  return [{ cid: 'QmMockPin1' }];
}

module.exports = {
  pinToIPFS,
  fetchFromIPFS,
  unpinFromIPFS,
  publishUpdate,
  listPins
};
