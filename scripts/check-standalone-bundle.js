/**
 * Garde-fou post-build pour le bundle IIS produit par ncc.
 *
 * Quand un paquet n'est pas resolvable dans node_modules au moment du build,
 * ncc n'echoue pas : il degrade silencieusement le `require` en
 * `eval("require")("<paquet>")`, resolu a l'execution. Sur le serveur IIS il n'y
 * a pas de node_modules, donc le bundle plante au demarrage avec
 * "Cannot find module ...". Ce script fait echouer le build a la place.
 *
 * Les entrees de ALLOWED sont des dependances optionnelles chargees par leurs
 * consommateurs dans un try/catch : leur absence a l'execution est benigne.
 */
const fs = require('fs');
const path = require('path');

const BUNDLE = path.join(__dirname, '..', 'dist', 'standalone', 'index.js');

const ALLOWED = new Set([
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  'class-transformer/storage',
  'bufferutil',
  'utf-8-validate',
]);

if (!fs.existsSync(BUNDLE)) {
  console.error(`[check-bundle] Bundle introuvable : ${BUNDLE}`);
  process.exit(1);
}

const source = fs.readFileSync(BUNDLE, 'utf8');
const unresolved = new Set();

for (const match of source.matchAll(/eval\("require"\)\("([^"]+)"\)/g)) {
  if (!ALLOWED.has(match[1])) unresolved.add(match[1]);
}

if (unresolved.size > 0) {
  console.error(
    '\n[check-bundle] ECHEC : ces modules ne sont pas inclus dans le bundle et',
  );
  console.error('seront cherches dans node_modules a l\'execution :\n');
  for (const name of [...unresolved].sort()) console.error(`  - ${name}`);
  console.error(
    '\nCause habituelle : node_modules incomplet au moment du build.',
  );
  console.error('Corriger avec `npm ci` puis relancer `npm run build:iis`.\n');
  process.exit(1);
}

console.log('[check-bundle] OK — aucun require non resolu dans le bundle.');
