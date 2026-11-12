// Contournement Node >= 26 : jsonschema@1.5.0 (utilisé par ace pour valider les commandes) construit
// new URL(x, 'thismessage::/') qui lève "Invalid URL". Idempotent ; à retirer quand jsonschema est corrigé.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const f = new URL('../node_modules/jsonschema/lib/validator.js', import.meta.url)
if (existsSync(f)) {
  const s = readFileSync(f, 'utf-8')
  if (s.includes("'thismessage::/'")) writeFileSync(f, s.replaceAll("'thismessage::/'", "'thismessage:/'"))
}
