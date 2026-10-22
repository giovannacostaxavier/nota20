// Valida um ou mais ficheiros de perguntas (ou dados/parciais inteiro).
// Uso: node scripts/validar.mjs [ficheiro.json ...]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

export const TEMAS = {
    'HTML e formulários': 'web',
    'CSS': 'web',
    'JavaScript': 'web',
    'HTTP': 'dados',
    'SQL e Base de dados': 'dados',
    'Segurança': 'dados',
    'RGPD': 'dados',
    'PHP essencial': 'php',
    'include e require': 'php',
    'PDO': 'php',
    'Redirecionar e PRG': 'php',
    'Passwords': 'php',
    'Sessões': 'php',
    'Controlo de acesso e XSS': 'php'
};

const PROIBIDAS = [/carjack/i, /\bcarros?\b/i, /\bmarcas?\b/i, /alugue/i, /\breservas?\b/i, /\bstand\b/i, /check-in/i];
const OPCOES_PROIBIDAS = [/todas as (anteriores|opções)/i, /nenhuma das (anteriores|opções)/i];
const DIFICULDADES = ['facil', 'media', 'dificil'];
const LINGUAGENS = ['', 'html', 'css', 'javascript', 'sql', 'php'];

function palavras(texto) {
    return new Set(
        texto.toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .split(/[^a-z0-9_$]+/)
            .filter(p => p.length > 2)
    );
}

function jaccard(a, b) {
    let comum = 0;
    for (const p of a) if (b.has(p)) comum++;
    return comum / (a.size + b.size - comum || 1);
}

export function validar(perguntas) {
    const erros = [];
    const avisos = [];
    const ids = new Set();

    perguntas.forEach((p, i) => {
        const onde = `#${i} (${p.id ?? 'sem id'})`;
        const falha = msg => erros.push(`${onde}: ${msg}`);

        if (typeof p.id !== 'string' || !/^[a-z]+-\d{3}$/.test(p.id)) falha('id tem de ser "prefixo-000"');
        if (ids.has(p.id)) falha('id repetido');
        ids.add(p.id);
        if (!(p.tema in TEMAS)) falha(`tema desconhecido: ${p.tema}`);
        else if (p.bloco !== TEMAS[p.tema]) falha(`bloco devia ser ${TEMAS[p.tema]}`);
        if (!DIFICULDADES.includes(p.dificuldade)) falha('dificuldade inválida');
        if (typeof p.pergunta !== 'string' || p.pergunta.trim().length < 10) falha('pergunta vazia');
        if (typeof p.codigo !== 'string') falha('codigo tem de ser string (vazia se não houver)');
        if (!LINGUAGENS.includes(p.linguagem)) falha('linguagem inválida');
        if ((p.codigo || '') === '' && p.linguagem !== '') falha('linguagem sem código');
        if ((p.codigo || '') !== '' && p.linguagem === '') falha('código sem linguagem');
        if (!Array.isArray(p.alternativas) || p.alternativas.length !== 4) falha('tem de ter 4 alternativas');
        else {
            const norm = p.alternativas.map(a => String(a).trim().toLowerCase());
            if (new Set(norm).size !== 4) falha('alternativas repetidas');
            if (norm.some(a => a === '')) falha('alternativa vazia');
            p.alternativas.forEach(a => OPCOES_PROIBIDAS.forEach(r => r.test(a) && falha(`opção proibida: ${a}`)));
        }
        if (![0, 1, 2, 3].includes(p.correta)) falha('correta tem de ser 0..3');
        if (typeof p.explicacao !== 'string' || p.explicacao.trim().length < 20) falha('explicação em falta');
        if (typeof p.manual !== 'string' || !/^(\d+(\.\d+)?|Anexo [ABC])(, ?(\d+(\.\d+)?|Anexo [ABC]))*$/.test(p.manual)) falha(`manual inválido: ${p.manual}`);

        const tudo = [p.pergunta, p.codigo, ...(p.alternativas || []), p.explicacao].join(' ');
        PROIBIDAS.forEach(r => r.test(tudo) && falha(`termo proibido (${r}) — exemplos têm de ser da Biblioteca ou genéricos`));
    });

    // Equilíbrio da letra certa
    const letras = [0, 0, 0, 0];
    perguntas.forEach(p => letras[p.correta] !== undefined && letras[p.correta]++);
    const media = perguntas.length / 4;
    if (perguntas.length >= 20 && letras.some(n => Math.abs(n - media) > Math.max(3, media * 0.15))) {
        avisos.push(`letra certa desequilibrada: a=${letras[0]} b=${letras[1]} c=${letras[2]} d=${letras[3]}`);
    }

    // A certa não pode ser quase sempre a mais comprida
    const maisComprida = perguntas.filter(p => Array.isArray(p.alternativas) && p.alternativas.length === 4 &&
        p.alternativas[p.correta]?.length === Math.max(...p.alternativas.map(a => a.length))).length;
    if (perguntas.length >= 20 && maisComprida / perguntas.length > 0.4) {
        avisos.push(`a certa é a opção mais comprida em ${Math.round(100 * maisComprida / perguntas.length)}% das perguntas (máx. 40%)`);
    }

    // Quase-duplicados (mesma pergunta e mesmo código)
    const assinaturas = perguntas.map(p => palavras(`${p.pergunta} ${p.codigo} ${p.alternativas?.[p.correta] ?? ''}`));
    for (let i = 0; i < perguntas.length; i++) {
        for (let j = i + 1; j < perguntas.length; j++) {
            const s = jaccard(assinaturas[i], assinaturas[j]);
            if (s >= 0.75) avisos.push(`possível duplicado (${s.toFixed(2)}): ${perguntas[i].id} ~ ${perguntas[j].id}`);
        }
    }

    return { erros, avisos, letras };
}

// Execução direta
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    let ficheiros = process.argv.slice(2);
    if (ficheiros.length === 0) {
        const pasta = join(raiz, 'dados', 'parciais');
        ficheiros = readdirSync(pasta).filter(f => f.endsWith('.json')).map(f => join(pasta, f));
    }
    let todas = [];
    let falhou = false;
    for (const f of ficheiros) {
        let lista;
        try {
            lista = JSON.parse(readFileSync(f, 'utf8'));
        } catch (e) {
            console.log(`✗ ${f}: JSON inválido — ${e.message}`);
            falhou = true;
            continue;
        }
        const { erros, avisos, letras } = validar(lista);
        const porTema = {};
        lista.forEach(p => porTema[p.tema] = (porTema[p.tema] || 0) + 1);
        const porDif = {};
        lista.forEach(p => porDif[p.dificuldade] = (porDif[p.dificuldade] || 0) + 1);
        const comCodigo = lista.filter(p => p.codigo).length;
        console.log(`\n${erros.length ? '✗' : '✓'} ${f}: ${lista.length} perguntas`);
        console.log(`  temas: ${JSON.stringify(porTema)}`);
        console.log(`  dificuldade: ${JSON.stringify(porDif)} · com código: ${comCodigo} · letras a/b/c/d: ${letras.join('/')}`);
        erros.forEach(e => console.log(`  ERRO  ${e}`));
        avisos.forEach(a => console.log(`  AVISO ${a}`));
        if (erros.length) falhou = true;
        todas = todas.concat(lista);
    }
    if (ficheiros.length > 1) {
        const { erros, avisos } = validar(todas);
        console.log(`\n== Conjunto: ${todas.length} perguntas, ${erros.length} erros, ${avisos.length} avisos ==`);
        erros.filter(e => e.includes('repetido')).forEach(e => console.log(`  ERRO  ${e}`));
        avisos.filter(a => a.includes('duplicado')).forEach(a => console.log(`  AVISO ${a}`));
    }
    process.exit(falhou ? 1 : 0);
}
