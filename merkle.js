"use strict";

const crypto = require("crypto");

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Build a Merkle tree from an array of hex hash strings.
 * Returns { root, layers } where layers[0] is the leaf layer.
 */
function buildTree(hashes) {
  if (!hashes.length) return { root: "0".repeat(64), layers: [] };

  const layers = [hashes.slice()];
  let current = hashes.slice();

  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1] || left; // duplicate last node for odd count
      next.push(sha256(left + right));
    }
    layers.push(next);
    current = next;
  }

  return { root: current[0], layers };
}

/**
 * Generate a Merkle proof for the leaf at `index` in `hashes`.
 * Returns an array of { hash, side: 'left'|'right' } objects.
 */
function getProof(hashes, index) {
  if (!hashes.length) return [];
  const { layers } = buildTree(hashes);
  const proof = [];
  let idx = index;

  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = layer[siblingIdx] || layer[idx]; // handle odd
    proof.push({ hash: sibling, side: isRight ? "left" : "right" });
    idx = Math.floor(idx / 2);
  }

  return proof;
}

/**
 * Verify a Merkle proof.
 * `leafHash`  — the entry's own hash
 * `proof`     — array from getProof()
 * `root`      — expected Merkle root
 */
function verifyProof(leafHash, proof, root) {
  let current = leafHash;
  for (const { hash, side } of proof) {
    current = side === "left" ? sha256(hash + current) : sha256(current + hash);
  }
  return current === root;
}

module.exports = { buildTree, getProof, verifyProof };
