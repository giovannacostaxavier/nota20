// Junta dados/amostra.json + dados/parciais/*.json num só banco,
// valida tudo e gera dados/banco.json e js/banco.js (usado pelo site).
// Uso: node scripts/juntar.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validar, TEMAS } from './validar.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pasta = join(raiz, 'dados', 'parciais');

const pedidos = process.argv.slice(2);
const fontes = pedidos.length ? [join(raiz, 'dados', 'amostra.json'), ...pedidos] : [join(raiz, 'dados', 'amostra.json')]
    .concat(existsSync(pasta) ? readdirSync(pasta).filter(f => f.endsWith('.json')).sort().map(f => join(pasta, f)) : []);

let banco = [];
for (const f of fontes) {
    banco = banco.concat(JSON.parse(readFileSync(f, 'utf8')));
}

const { erros, avisos, letras } = validar(banco);
if (erros.length) {
    erros.forEach(e => console.log(`ERRO  ${e}`));
    console.log(`\n${erros.length} erros: o banco não foi gerado.`);
    process.exit(1);
}
avisos.forEach(a => console.log(`AVISO ${a}`));

// Ordem estável: por tema (ordem oficial) e depois por id
const ordemTema = Object.keys(TEMAS);
banco.sort((a, b) => ordemTema.indexOf(a.tema) - ordemTema.indexOf(b.tema) || a.id.localeCompare(b.id));

const campos = ['id', 'bloco', 'tema', 'dificuldade', 'pergunta', 'codigo', 'linguagem', 'alternativas', 'correta', 'explicacao', 'manual'];
const limpo = banco.map(p => Object.fromEntries(campos.map(c => [c, p[c]])));

writeFileSync(join(raiz, 'dados', 'banco.json'), JSON.stringify(limpo, null, 2) + '\n');
writeFileSync(join(raiz, 'js', 'banco.js'),
    '// Gerado por scripts/juntar.mjs a partir de dados/. Não editar à mão.\n' +
    `window.BANCO = ${JSON.stringify(limpo)};\n`);

const porTema = {};
limpo.forEach(p => { porTema[p.tema] = (porTema[p.tema] || 0) + 1; });
console.log(`\n✓ Banco gerado: ${limpo.length} perguntas · letras a/b/c/d ${letras.join('/')}`);
Object.entries(porTema).forEach(([t, n]) => console.log(`  ${t.padEnd(26)} ${n}`));
