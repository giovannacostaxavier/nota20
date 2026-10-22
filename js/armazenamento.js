// ============================================================
//  Progresso guardado no browser (localStorage), sem login.
//  Por cada pergunta: quantas vezes saiu, quantas acertaste,
//  se acertaste da última vez e quando foi.
// ============================================================
(function () {
    'use strict';

    const CHAVE = 'nota20_progresso_v1';
    const CHAVE_CURSO = 'nota20_em_curso_v1';
    const MAX_TENTATIVAS = 100;

    function vazio() {
        return { versao: 1, perguntas: {}, tentativas: [] };
    }

    function ler(chave) {
        try {
            const texto = localStorage.getItem(chave);
            return texto ? JSON.parse(texto) : null;
        } catch (e) {
            return null;
        }
    }

    function escrever(chave, valor) {
        try {
            if (valor === null) localStorage.removeItem(chave);
            else localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch (e) {
            return false;
        }
    }

    let progresso = ler(CHAVE);
    if (!progresso || typeof progresso !== 'object' || !progresso.perguntas) progresso = vazio();

    function guardar() {
        return escrever(CHAVE, progresso);
    }

    // Regista as respostas de uma tentativa terminada
    function registarTentativa(tentativa) {
        const agora = Date.now();
        tentativa.respostas.forEach(r => {
            const p = progresso.perguntas[r.id] || { v: 0, c: 0, u: null, t: 0 };
            p.v += 1;
            if (r.certa) p.c += 1;
            p.u = r.certa;
            p.t = agora;
            progresso.perguntas[r.id] = p;
        });
        progresso.tentativas.unshift({
            id: tentativa.id,
            data: agora,
            tipo: tentativa.tipo,
            modo: tentativa.modo,
            acertos: tentativa.acertos,
            total: tentativa.total,
            duracao: tentativa.duracao,
            porTema: tentativa.porTema,
            erradas: tentativa.respostas.filter(r => !r.certa).map(r => r.id)
        });
        progresso.tentativas = progresso.tentativas.slice(0, MAX_TENTATIVAS);
        guardar();
    }

    function estadoPergunta(id) {
        return progresso.perguntas[id] || null;
    }

    function exportar() {
        return JSON.stringify({ app: 'nota20', exportado: new Date().toISOString(), progresso });
    }

    function importar(texto) {
        const dados = JSON.parse(texto);
        const novo = dados && dados.app === 'nota20' ? dados.progresso : null;
        if (!novo || typeof novo.perguntas !== 'object' || !Array.isArray(novo.tentativas)) {
            throw new Error('Este ficheiro não é um progresso do Nota20.');
        }
        // Junta: em cada pergunta fica o registo mais recente
        Object.entries(novo.perguntas).forEach(([id, p]) => {
            const atual = progresso.perguntas[id];
            if (!atual || (p.t || 0) > (atual.t || 0)) progresso.perguntas[id] = p;
        });
        const ids = new Set(progresso.tentativas.map(t => t.id));
        novo.tentativas.forEach(t => { if (!ids.has(t.id)) progresso.tentativas.push(t); });
        progresso.tentativas.sort((a, b) => b.data - a.data);
        progresso.tentativas = progresso.tentativas.slice(0, MAX_TENTATIVAS);
        guardar();
    }

    function apagarTudo() {
        progresso = vazio();
        guardar();
        escrever(CHAVE_CURSO, null);
    }

    window.Armazenamento = {
        get progresso() { return progresso; },
        estadoPergunta,
        registarTentativa,
        exportar,
        importar,
        apagarTudo,
        lerEmCurso: () => ler(CHAVE_CURSO),
        guardarEmCurso: t => escrever(CHAVE_CURSO, t),
        limparEmCurso: () => escrever(CHAVE_CURSO, null),
        disponivel: (function () {
            try {
                localStorage.setItem('nota20_teste', '1');
                localStorage.removeItem('nota20_teste');
                return true;
            } catch (e) {
                return false;
            }
        })()
    };
})();
