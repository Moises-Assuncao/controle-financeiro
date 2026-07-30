/*
  Gera src/config/firebase-config.js a partir de variáveis de ambiente.
  Roda automaticamente no build do Vercel (veja vercel.json) e também
  localmente com: npm run build  (ou: node scripts/generate-firebase-config.js)

  Não tem nenhuma dependência externa de propósito — só Node puro.
*/
const fs = require('fs');
const path = require('path');

// Lê um .env local (se existir) só para permitir testar fora do Vercel.
// Na Vercel, as variáveis já vêm prontas em process.env — este .env NUNCA é commitado.
function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnv(path.join(__dirname, '..', '.env'));

const REQUIRED = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
];

const outDir = path.join(__dirname, '..', 'src', 'config');
const outPath = path.join(outDir, 'firebase-config.js');
fs.mkdirSync(outDir, { recursive: true });

const missing = REQUIRED.filter((k) => !process.env[k]);

if (missing.length) {
  console.warn('[fluxo] Variáveis do Firebase ausentes: ' + missing.join(', '));
  console.warn('[fluxo] Gerando site SEM login com Google (modo local continua funcionando normalmente).');
  fs.writeFileSync(
    outPath,
    '// Gerado automaticamente pelo build. Variáveis de ambiente do Firebase não foram encontradas.\n' +
    'window.FIREBASE_CONFIG = null;\n'
  );
  process.exit(0);
}

const config = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

fs.writeFileSync(
  outPath,
  '// Arquivo gerado automaticamente pelo build (scripts/generate-firebase-config.js).\n' +
  '// Não edite à mão nem versione este arquivo com valores reais — ele é ignorado pelo Git.\n' +
  'window.FIREBASE_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n'
);
console.log('[fluxo] src/config/firebase-config.js gerado com sucesso a partir das variáveis de ambiente.');
