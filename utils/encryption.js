// utils/encryption.js - Crypto Utilities for Self-Hosted Identity Vault
// AES-256-GCM for symmetric encryption (at-rest for DB blobs, in-transit for API responses if needed).
// Key management: Derive from env var (ENCRYPTION_KEY) or generate on first run (stub for user-controlled).
// Features: Encrypt/decrypt JSON strings, IV/nonce handling, auth tags for integrity, key gen/rotation.
// Advanced: PBKDF2 key derivation (from passphrase), salt per profile, export/import keys for backups.
// Integrates: Called in db.js (store encrypted), server.js (before send), zkps.js (for proofs).
// Safety: GCM for auth, no ECB; errors if key invalid. Expand to asymmetric (RSA) for teams.
// Usage: const encrypted = encrypt(JSON.stringify(profile), key); const profile = JSON.parse(decrypt(encrypted, key));
// Version: 1.0 | 2025 | Deps: crypto (Node built-in, no install).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Default key length: 32 bytes (AES-256)
const ALGO = 'aes-256-gcm';
const SALT_ROUNDS = 10000; // PBKDF2 iterations for derivation
const KEY_LENGTH = 32;

// Generate or load key: From env, or derive from passphrase, or gen new (save to .env.local stub)
function getKey(passphrase = null, saltFile = path.join(__dirname, '../.salt')) {
  let key;
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length === 64) { // Hex 32 bytes
    key = Buffer.from(envKey, 'hex');
  } else if (passphrase) {
    // Derive: PBKDF2 for security (slow, anti-brute)
    let salt;
    if (fs.existsSync(saltFile)) {
      salt = fs.readFileSync(saltFile);
    } else {
      salt = crypto.randomBytes(16);
      fs.writeFileSync(saltFile, salt); // Per-install salt
    }
    key = crypto.pbkdf2Sync(passphrase, salt, SALT_ROUNDS, KEY_LENGTH, 'sha512');
  } else {
    // Gen new: For first run (warn user to save)
    key = crypto.randomBytes(KEY_LENGTH);
    console.warn('Generated new key—save it securely to .env as ENCRYPTION_KEY (hex)!');
    console.log('Key (hex):', key.toString('hex'));
    // Stub: Save to .env.local (gitignore'd)
    fs.appendFileSync(path.join(__dirname, '../.env.local'), `ENCRYPTION_KEY=${key.toString('hex')}\n`);
  }
  if (!key || key.length !== KEY_LENGTH) {
    throw new Error('Invalid key length—must be 32 bytes');
  }
  return key;
}

// Encrypt: JSON string -> cipher text (IV + encrypted + authTag)
function encrypt(data, key = getKey()) {
  const iv = crypto.randomBytes(12); // GCM nonce
  const cipher = crypto.createCipher(ALGO, key);
  cipher.setAAD(Buffer.from('identity-vault')); // Auth data for integrity
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${authTag}`; // Concat for storage
}

// Decrypt: Cipher text -> JSON string (verify authTag)
function decrypt(encryptedStr, key = getKey()) {
  try {
    const [ivHex, encryptedHex, authTagHex] = encryptedStr.split(':');
    if (!ivHex || !encryptedHex || !authTagHex) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipher(ALGO, key);
    decipher.setAAD(Buffer.from('identity-vault'));
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    throw new Error(`Decryption failed: ${err.message} (key mismatch or tampered?)`);
  }
}

// Advanced: Key rotation (re-encrypt all profiles with new key)
async function rotateKeys(oldKey, newKey, db) {
  // Query all profiles
  db.all('SELECT id, type, data FROM profiles', [], (err, rows) => {
    if (err) throw err;
    rows.forEach(row => {
      try {
        const decrypted = decrypt(row.data, oldKey);
        const reEncrypted = encrypt(decrypted, newKey);
        db.run('UPDATE profiles SET data = ? WHERE id = ? AND type = ?', [reEncrypted, row.id, row.type]);
      } catch (e) {
        console.error(`Rotation failed for ${row.id}: ${e.message}`);
      }
    });
    console.log(`Rotated ${rows.length} profiles.`);
  });
}

// Export key (for backups/multi-device)
function exportKey(key, file = path.join(__dirname, '../key-backup.enc')) {
  const wrapped = encrypt(key.toString('hex'), key); // Self-encrypt
  fs.writeFileSync(file, wrapped);
  console.log(`Key exported to ${file}—decrypt with same key.`);
}

// Import key
function importKey(file = path.join(__dirname, '../key-backup.enc'), key = getKey()) {
  const wrapped = fs.readFileSync(file, 'utf8');
  return Buffer.from(decrypt(wrapped, key), 'hex');
}

// Stub for asymmetric (future: RSA for team shares)
function generateRSAKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

// Exports
module.exports = {
  encrypt,
  decrypt,
  getKey,
  rotateKeys,
  exportKey,
  importKey,
  generateRSAKeyPair
};
