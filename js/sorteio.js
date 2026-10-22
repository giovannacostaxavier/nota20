// ============================================================
//  Tipos de teste (quantidades fixas, como no teste do formador)
//  e sorteio das perguntas a evitar repetições.
// ============================================================
(function () {
    'use strict';

    const BLOCOS = {
        web: { nome: 'HTML · CSS · JavaScript', curto: 'Front-end', cor: 'web' },
        dados: { nome: 'HTTP · SQL · Segurança · RGPD', curto: 'Dados e web', cor: 'dados' },
        php: { nome: 'PHP · Stack A', curto: 'Stack A', cor: 'php' }
    };

    // Ordem dos temas = ordem em que aparecem no teste
    const TEMAS = [
        { nome: 'HTML e formulários', bloco: 'web', parte: 'I' },
        { nome: 'HTTP', bloco: 'dados', parte: 'I' },
        { nome: 'CSS', bloco: 'web', parte: 'I' },
        { nome: 'JavaScript', bloco: 'web', parte: 'I' },
        { nome: 'SQL e Base de dados', bloco: 'dados', parte: 'I' },
        { nome: 'Segurança', bloco: 'dados', parte: 'I' },
        { nome: 'RGPD', bloco: 'dados', parte: 'I' },
        { nome: 'PHP essencial', bloco: 'php', parte: 'II' },
        { nome: 'include e require', bloco: 'php', parte: 'II' },
        { nome: 'PDO', bloco: 'php', parte: 'II' },
        { nome: 'Redirecionar e PRG', bloco: 'php', parte: 'II' },
        { nome: 'Passwords', bloco: 'php', parte: 'II' },
        { nome: 'Sessões', bloco: 'php', parte: 'II' },
        { nome: 'Controlo de acesso e XSS', bloco: 'php', parte: 'II' }
    ];

    const DISTRIBUICAO = {
        'HTML e formulários': 5, 'HTTP': 4, 'CSS': 5, 'JavaScript': 5,
        'SQL e Base de dados': 5, 'Segurança': 3, 'RGPD': 3,
        'PHP essencial': 4, 'include e require': 1, 'PDO': 3, 'Redirecionar e PRG': 2,
        'Passwords': 2, 'Sessões': 2, 'Controlo de acesso e XSS': 1
    };

    function quotas(bloco) {
        const q = {};
        TEMAS.forEach(t => { if (!bloco || t.bloco === bloco) q[t.nome] = DISTRIBUICAO[t.nome]; });
        return q;
    }

    const TIPOS = {
        geral: {
            titulo: 'Teste geral', subtitulo: 'Igual ao teste real', total: 45, minutos: 60,
            minimo: 23, quotas: quotas(null),
            descricao: '30 perguntas da parte comum + 15 da Stack A, com a distribuição por tema do teste do formador.'
        },
        web: {
            titulo: 'Bloco 1', subtitulo: BLOCOS.web.nome, total: 15, minutos: 20, minimo: 8, quotas: quotas('web'),
            descricao: 'HTML e formulários, CSS e JavaScript: 5 perguntas de cada.'
        },
        dados: {
            titulo: 'Bloco 2', subtitulo: BLOCOS.dados.nome, total: 15, minutos: 20, minimo: 8, quotas: quotas('dados'),
            descricao: 'HTTP 4, SQL e base de dados 5, segurança 3 e RGPD 3.'
        },
        php: {
            titulo: 'Bloco 3', subtitulo: BLOCOS.php.nome, total: 15, minutos: 20, minimo: 8, quotas: quotas('php'),
            descricao: 'PHP, include, PDO, redirecionar, passwords, sessões e controlo de acesso.'
        },
        erradas: {
            titulo: 'Rever erradas', subtitulo: 'As que falhaste da última vez', total: 15, minutos: 20, minimo: 8, quotas: null,
            descricao: '15 perguntas que erraste da última vez que te saíram, de todos os temas.'
        }
    };

    const ORDEM_DIFICULDADE = { facil: 0, media: 1, dificil: 2 };

    function baralhar(lista) {
        const copia = lista.slice();
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    }

    // Prioridade: 1) nunca saiu; 2) erraste da última vez; 3) saiu há mais tempo
    function escolher(pool, quantidade, estado) {
        const nunca = [], erradas = [], vistas = [];
        pool.forEach(p => {
            const e = estado(p.id);
            if (!e) nunca.push(p);
            else if (e.u === false) erradas.push({ p, t: e.t });
            else vistas.push({ p, t: e.t });
        });
        const porAntiguidade = (a, b) => a.t - b.t;
        const ordenada = baralhar(nunca)
            .concat(erradas.sort(porAntiguidade).map(x => x.p))
            .concat(vistas.sort(porAntiguidade).map(x => x.p));
        return ordenada.slice(0, quantidade);
    }

    function sortear(tipo, banco, estado) {
        const def = TIPOS[tipo];
        let escolhidas = [];

        if (tipo === 'erradas') {
            const erradas = banco.filter(p => { const e = estado(p.id); return e && e.u === false; })
                .sort((a, b) => estado(a.id).t - estado(b.id).t);
            escolhidas = baralhar(erradas.slice(0, def.total));
        } else {
            Object.entries(def.quotas).forEach(([tema, n]) => {
                escolhidas = escolhidas.concat(escolher(banco.filter(p => p.tema === tema), n, estado));
            });
        }

        // Como no teste: parte comum primeiro e, dentro de cada parte, do mais fácil ao mais difícil
        const parteDe = {};
        TEMAS.forEach(t => { parteDe[t.nome] = t.parte; });
        escolhidas = baralhar(escolhidas).sort((a, b) =>
            (parteDe[a.tema] === parteDe[b.tema] ? 0 : parteDe[a.tema] === 'I' ? -1 : 1) ||
            ORDEM_DIFICULDADE[a.dificuldade] - ORDEM_DIFICULDADE[b.dificuldade]
        );

        // Baralha as opções de cada pergunta (guarda a ordem para mostrar sempre igual)
        return escolhidas.map(p => ({ id: p.id, ordem: baralhar([0, 1, 2, 3]) }));
    }

    function contarErradas(banco, estado) {
        return banco.filter(p => { const e = estado(p.id); return e && e.u === false; }).length;
    }

    window.Sorteio = { BLOCOS, TEMAS, TIPOS, sortear, contarErradas, baralhar };
})();
