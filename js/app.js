// ============================================================
//  Nota20 — aplicação (ecrãs, simulado, resultado, progresso)
// ============================================================
(function () {
    'use strict';

    const BANCO = window.BANCO || [];
    const POR_ID = new Map(BANCO.map(p => [p.id, p]));
    const { TIPOS, TEMAS, BLOCOS } = window.Sorteio;
    const A = window.Armazenamento;
    const LETRAS = ['A', 'B', 'C', 'D'];
    const NOTA_MINIMA_GERAL = 23;

    const app = document.getElementById('app');
    let tentativa = null;     // simulado em curso (ou acabado de terminar)
    let relogio = null;       // setInterval do cronómetro
    let modoEscolhido = lerPreferencia('nota20_modo', 'estudo');

    // ---------- utilitários ----------
    function esc(texto) {
        return String(texto ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // Texto com `código` entre crases
    function rico(texto) {
        return esc(texto).replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    function lerPreferencia(chave, omissao) {
        try { return localStorage.getItem(chave) || omissao; } catch (e) { return omissao; }
    }
    function guardarPreferencia(chave, valor) {
        try { localStorage.setItem(chave, valor); } catch (e) { /* sem armazenamento */ }
    }

    function tempo(segundos) {
        segundos = Math.max(0, Math.round(segundos));
        const m = Math.floor(segundos / 60);
        const s = segundos % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function dataCurta(ms) {
        return new Date(ms).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function nota20(acertos, total) {
        return total ? Math.round((acertos / total) * 200) / 10 : 0;
    }

    function blocoDoTema(tema) {
        const t = TEMAS.find(x => x.nome === tema);
        return t ? t.bloco : '';
    }

    function toast(msg) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.classList.add('visivel');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => el.classList.remove('visivel'), 2600);
    }

    function realcar(raiz) {
        if (!window.hljs) return;
        raiz.querySelectorAll('pre code[data-lang]').forEach(el => {
            const lang = el.dataset.lang === 'html' ? 'xml' : el.dataset.lang;
            try {
                el.innerHTML = window.hljs.highlight(el.textContent, { language: lang, ignoreIllegals: true }).value;
            } catch (e) { /* fica sem cores */ }
        });
    }

    function blocoCodigo(p) {
        if (!p.codigo) return '';
        const nomes = { html: 'HTML', css: 'CSS', javascript: 'JavaScript', sql: 'SQL', php: 'PHP' };
        return `<div class="bloco-codigo">
            <div class="bloco-codigo-cabeca"><i></i><i></i><i></i>${nomes[p.linguagem] || 'Código'}</div>
            <pre><code data-lang="${esc(p.linguagem)}">${esc(p.codigo)}</code></pre>
        </div>`;
    }

    function mostrar(html, foco = true) {
        pararRelogio();
        app.innerHTML = html;
        realcar(app);
        if (foco) {
            app.focus({ preventScroll: true });
            window.scrollTo({ top: 0 });
        }
    }

    function marcarMenu(rota) {
        document.querySelectorAll('.menu a').forEach(a => {
            if (a.dataset.rota === rota) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    }

    const ICONE_SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    // ---------- estatísticas ----------
    function estatisticas() {
        const prog = A.progresso;
        const porTema = {};
        TEMAS.forEach(t => { porTema[t.nome] = { total: 0, vistas: 0, certas: 0, respondidas: 0 }; });
        BANCO.forEach(p => {
            const t = porTema[p.tema];
            if (!t) return;
            t.total++;
            const e = prog.perguntas[p.id];
            if (e) {
                t.vistas++;
                t.respondidas += e.v;
                t.certas += e.c;
            }
        });
        const vistas = Object.values(porTema).reduce((s, t) => s + t.vistas, 0);
        const respondidas = Object.values(porTema).reduce((s, t) => s + t.respondidas, 0);
        const certas = Object.values(porTema).reduce((s, t) => s + t.certas, 0);
        const gerais = prog.tentativas.filter(t => t.tipo === 'geral');
        const melhor = gerais.length ? Math.max(...gerais.map(t => nota20(t.acertos, t.total))) : null;
        // Os 3 temas com mais erros (só os que já têm pelo menos 3 respostas)
        const fracos = Object.entries(porTema)
            .filter(([, s]) => s.respondidas >= 3 && s.certas < s.respondidas)
            .map(([tema, s]) => ({ tema, erro: Math.round(((s.respondidas - s.certas) / s.respondidas) * 100) }))
            .sort((a, b) => b.erro - a.erro)
            .slice(0, 3);
        return {
            porTema, vistas, respondidas, certas, fracos,
            respondidasTotal: respondidas,
            acerto: respondidas ? Math.round((certas / respondidas) * 100) : null,
            testes: prog.tentativas.length,
            gerais, melhor,
            erradas: window.Sorteio.contarErradas(BANCO, A.estadoPergunta)
        };
    }

    // ---------- ecrã: início ----------
    function ecraInicio() {
        marcarMenu('inicio');
        const est = estatisticas();
        const cobertura = BANCO.length ? Math.round((est.vistas / BANCO.length) * 100) : 0;
        const emCurso = A.lerEmCurso();
        const continuar = emCurso && !emCurso.terminado && TIPOS[emCurso.tipo] ? `
            <div class="continuar">
                <p><b>Tens um simulado a meio:</b> ${esc(TIPOS[emCurso.tipo].titulo)} · ${emCurso.modo === 'exame' ? 'modo exame' : 'modo estudo'},
                ${Object.keys(emCurso.respostas).length} de ${emCurso.itens.length} respondidas.</p>
                <button class="botao pequeno" data-acao="continuar">Continuar ${ICONE_SETA}</button>
                <button class="botao pequeno fantasma" data-acao="descartar">Descartar</button>
            </div>` : '';

        const cartao = (tipo, extra = '') => {
            const d = TIPOS[tipo];
            const icone = { geral: '45', web: '1', dados: '2', php: '3', fracos: '◎', erradas: '↺' }[tipo];
            let bloqueado = '';
            if (tipo === 'erradas' && est.erradas === 0) bloqueado = 'Ainda não tens perguntas erradas para rever. Faz um teste primeiro!';
            if (tipo === 'fracos' && est.respondidasTotal < window.Sorteio.MIN_RESPOSTAS_FRACOS) {
                bloqueado = `Responde a pelo menos ${window.Sorteio.MIN_RESPOSTAS_FRACOS} perguntas para o Nota20 descobrir os teus pontos fracos (já tens ${est.respondidasTotal}).`;
            }
            return `<button class="teste ${tipo === 'geral' ? 'principal' : tipo}" data-tipo="${tipo}" ${bloqueado ? 'disabled' : ''}>
                <span class="teste-icone" aria-hidden="true">${icone}</span>
                <span class="teste-corpo">
                    <span class="teste-titulo">${esc(d.titulo)}</span>
                    <span class="sub">${esc(d.subtitulo)}</span>
                    <span class="desc">${esc(bloqueado || d.descricao)}</span>
                    <span class="teste-meta">
                        <span class="pilula">${d.total} perguntas</span>
                        <span class="pilula">${d.minutos} min no modo exame</span>
                        ${extra}
                    </span>
                </span>
                ${tipo === 'geral' ? `<span class="teste-ir" aria-hidden="true">${ICONE_SETA}</span>` : ''}
            </button>`;
        };

        const temasMini = TEMAS.map(t => {
            const s = est.porTema[t.nome];
            const pct = s.total ? Math.round((s.vistas / s.total) * 100) : 0;
            return `<div class="tema-mini">
                <div class="tema-mini-topo"><span>${esc(t.nome)}</span><span>${s.vistas}/${s.total}</span></div>
                <div class="barra ${t.bloco}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Perguntas vistas em ${esc(t.nome)}"><span style="width:${pct}%"></span></div>
            </div>`;
        }).join('');

        mostrar(`
            <section class="hero">
                <div>
                    <span class="etiqueta">UC00615 · Stack A · PHP</span>
                    <h1>Treina hoje, tira <span>20</span> no teste.</h1>
                    <p class="lead">Simulados com as mesmas regras do teste do formador: 45 perguntas, 4 opções e só uma certa. As perguntas que já te saíram ficam para o fim, por isso cada teste é diferente.</p>
                    <div class="hero-chips">
                        <span class="pilula">${BANCO.length} perguntas no banco</span>
                        <span class="pilula web">Front-end</span>
                        <span class="pilula dados">Dados e web</span>
                        <span class="pilula php">Stack A</span>
                    </div>
                </div>
                <aside class="painel-resumo" aria-label="O teu resumo">
                    <span class="etiqueta">O teu progresso</span>
                    <div class="resumo-grelha">
                        <div><div class="resumo-valor">${est.vistas}</div><div class="resumo-legenda">perguntas já vistas</div></div>
                        <div><div class="resumo-valor">${est.acerto === null ? '—' : est.acerto + '%'}</div><div class="resumo-legenda">de respostas certas</div></div>
                        <div><div class="resumo-valor">${est.testes}</div><div class="resumo-legenda">testes feitos</div></div>
                        <div><div class="resumo-valor">${est.melhor === null ? '—' : est.melhor.toFixed(1)}</div><div class="resumo-legenda">melhor nota (teste geral)</div></div>
                    </div>
                    <div class="barra-cobertura" title="${cobertura}% do banco já visto"><span style="width:${cobertura}%"></span></div>
                </aside>
            </section>

            ${A.disponivel ? '' : '<div class="continuar"><p><b>Atenção:</b> este browser não deixa guardar dados (janela anónima?). Podes treinar, mas o progresso não fica guardado.</p></div>'}
            ${continuar}

            <div class="titulo-seccao">
                <h2>Escolhe o simulado</h2>
                <div class="seletor-modo" role="group" aria-label="Modo do simulado">
                    <button type="button" data-modo="estudo" aria-pressed="${modoEscolhido === 'estudo'}">📖 Estudo</button>
                    <button type="button" data-modo="exame" aria-pressed="${modoEscolhido === 'exame'}">⏱️ Exame</button>
                </div>
            </div>
            <p class="explica-modo" id="explica-modo"></p>

            <div class="grelha-testes">
                ${cartao('geral', '<span class="pilula">aprovação com 23 certas</span>')}
                ${cartao('web')}
                ${cartao('dados')}
                ${cartao('php')}
                ${cartao('fracos', est.fracos.map(f => `<span class="pilula errado">${esc(f.tema)} · ${f.erro}% erro</span>`).join(''))}
                ${cartao('erradas', est.erradas ? `<span class="pilula errado">${est.erradas} por rever</span>` : '')}
            </div>

            <section class="temas-mini">
                <div class="titulo-seccao">
                    <h2>O banco por tema</h2>
                    <p>Perguntas que já te saíram / perguntas que existem</p>
                </div>
                <div class="temas-mini-grelha">${temasMini}</div>
            </section>
        `);

        atualizarExplicaModo();

        app.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => {
            modoEscolhido = b.dataset.modo;
            guardarPreferencia('nota20_modo', modoEscolhido);
            app.querySelectorAll('[data-modo]').forEach(x => x.setAttribute('aria-pressed', x === b));
            atualizarExplicaModo();
        }));
        app.querySelectorAll('[data-tipo]').forEach(b => b.addEventListener('click', () => {
            if (emCurso && !emCurso.terminado) {
                pedirConfirmacao('Começar um simulado novo?', 'O simulado que tens a meio vai ser descartado.', 'Começar novo', () => iniciar(b.dataset.tipo));
            } else {
                iniciar(b.dataset.tipo);
            }
        }));
        const bc = app.querySelector('[data-acao="continuar"]');
        if (bc) bc.addEventListener('click', () => { tentativa = emCurso; location.hash = '#/simulado'; });
        const bd = app.querySelector('[data-acao="descartar"]');
        if (bd) bd.addEventListener('click', () => { A.limparEmCurso(); ecraInicio(); });
    }

    function atualizarExplicaModo() {
        const el = document.getElementById('explica-modo');
        if (!el) return;
        el.textContent = modoEscolhido === 'estudo'
            ? 'Modo estudo: vês logo se acertaste, com a explicação e a secção do manual. Sem limite de tempo.'
            : 'Modo exame: como no dia do teste. Cronómetro, podes mudar respostas e saltar perguntas, e só vês a correção no fim.';
    }

    // ---------- simulado ----------
    function iniciar(tipo) {
        const itens = window.Sorteio.sortear(tipo, BANCO, A.estadoPergunta);
        if (!itens.length) {
            toast('Não há perguntas suficientes para este simulado.');
            return;
        }
        const def = TIPOS[tipo];
        tentativa = {
            id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
            tipo,
            modo: modoEscolhido,
            itens,
            respostas: {},      // índice da pergunta → índice ORIGINAL da opção escolhida
            confirmadas: {},    // modo estudo: perguntas já corrigidas
            marcadas: {},
            atual: 0,
            gasto: 0,           // segundos já passados
            limite: modoEscolhido === 'exame' ? def.minutos * 60 : null,
            terminado: false
        };
        A.guardarEmCurso(tentativa);
        location.hash = '#/simulado';
    }

    function guardarTentativa() {
        if (tentativa && !tentativa.terminado) A.guardarEmCurso(tentativa);
    }

    function pararRelogio() {
        if (relogio) clearInterval(relogio);
        relogio = null;
    }

    function arrancarRelogio() {
        pararRelogio();
        let ultimo = Date.now();
        relogio = setInterval(() => {
            const agora = Date.now();
            tentativa.gasto += (agora - ultimo) / 1000;
            ultimo = agora;
            desenharRelogio();
            if (Math.round(tentativa.gasto) % 5 === 0) guardarTentativa();
            if (tentativa.limite && tentativa.gasto >= tentativa.limite) {
                pararRelogio();
                toast('O tempo acabou! O simulado foi entregue.');
                terminar();
            }
        }, 1000);
    }

    function desenharRelogio() {
        const el = document.getElementById('relogio');
        if (!el) return;
        const restante = tentativa.limite ? tentativa.limite - tentativa.gasto : null;
        el.querySelector('.relogio-valor').textContent = tempo(restante ?? tentativa.gasto);
        el.classList.toggle('alerta', restante !== null && restante <= 300);
        const mini = document.getElementById('relogio-mini');
        if (mini) {
            mini.textContent = (restante !== null ? '⏱ ' : '') + tempo(restante ?? tentativa.gasto);
            mini.classList.toggle('alerta', restante !== null && restante <= 300);
        }
    }

    function ecraSimulado() {
        marcarMenu('');
        if (!tentativa) tentativa = A.lerEmCurso();
        if (!tentativa || tentativa.terminado) { location.hash = '#/'; return; }
        tentativa.itens = tentativa.itens.filter(it => POR_ID.has(it.id));
        if (!tentativa.itens.length) { A.limparEmCurso(); location.hash = '#/'; return; }
        tentativa.atual = Math.min(tentativa.atual, tentativa.itens.length - 1);

        const def = TIPOS[tentativa.tipo];
        const exame = tentativa.modo === 'exame';
        mostrar(`
            <div class="simulado">
                <div class="simulado-topo">
                    <h1>${esc(def.titulo)}</h1>
                    <span class="pilula">${esc(def.subtitulo)}</span>
                    <span class="pilula">${exame ? '⏱️ Modo exame' : '📖 Modo estudo'}</span>
                    <span class="pilula relogio-mini" id="relogio-mini" aria-hidden="true">00:00</span>
                    <button class="botao pequeno fantasma" data-acao="sair" style="margin-left:auto">Sair</button>
                </div>
                <div class="progresso-linha" aria-hidden="true"><span id="barra-progresso"></span></div>
                <section class="cartao pergunta-cartao" id="pergunta" aria-live="polite"></section>
                <aside class="lateral">
                    <div class="cartao">
                        <div class="relogio" id="relogio" title="${exame ? 'Tempo que falta' : 'Tempo que passou'}">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>
                            <div>
                                <div class="relogio-valor">00:00</div>
                                <span class="etiqueta">${exame ? 'tempo restante' : 'tempo de estudo'}</span>
                            </div>
                        </div>
                        <div class="placar" id="placar" style="margin-top:14px"></div>
                    </div>
                    <div class="cartao">
                        <span class="etiqueta">Perguntas</span>
                        <div class="navegador" id="navegador" style="margin-top:10px"></div>
                        <div class="legenda">
                            ${exame ? '<span><i style="background:var(--primaria-suave);border:1px solid var(--primaria)"></i>respondida</span>'
                                    : '<span><i style="background:var(--certo-fundo);border:1px solid var(--certo-linha)"></i>certa</span><span><i style="background:var(--errado-fundo);border:1px solid var(--errado-linha)"></i>errada</span>'}
                            <span><i style="background:var(--aviso);border-radius:50%"></i>a rever</span>
                        </div>
                        ${exame ? '<button class="botao secundario pequeno" data-acao="entregar" style="width:100%;margin-top:14px">Entregar o teste</button>' : ''}
                    </div>
                </aside>
            </div>
        `);

        app.querySelector('[data-acao="sair"]').addEventListener('click', () => {
            guardarTentativa();
            toast('Simulado guardado. Podes continuar mais tarde.');
            location.hash = '#/';
        });
        const be = app.querySelector('[data-acao="entregar"]');
        if (be) be.addEventListener('click', confirmarEntrega);

        desenharPergunta();
        desenharRelogio();
        arrancarRelogio();
    }

    function desenharPergunta() {
        const t = tentativa;
        const item = t.itens[t.atual];
        const p = POR_ID.get(item.id);
        const exame = t.modo === 'exame';
        const escolha = t.respostas[t.atual];
        const corrigida = !exame && t.confirmadas[t.atual];
        const bloco = blocoDoTema(p.tema);
        const nivel = { facil: 1, media: 2, dificil: 3 }[p.dificuldade] || 1;

        const opcoes = item.ordem.map((orig, pos) => {
            let classe = '';
            if (corrigida) {
                if (orig === p.correta) classe = 'certa';
                else if (orig === escolha) classe = 'errada';
                else classe = 'apagada';
            } else if (orig === escolha) {
                classe = 'escolhida';
            }
            return `<button type="button" class="opcao ${classe}" data-orig="${orig}" ${corrigida ? 'disabled' : ''}
                        aria-pressed="${orig === escolha}" aria-label="Opção ${LETRAS[pos]}: ${esc(p.alternativas[orig])}">
                <span class="opcao-letra" aria-hidden="true">${LETRAS[pos]}</span>
                <span class="opcao-texto">${rico(p.alternativas[orig])}</span>
            </button>`;
        }).join('');

        let explicacao = '';
        if (corrigida) {
            const certo = escolha === p.correta;
            const letraCerta = LETRAS[item.ordem.indexOf(p.correta)];
            explicacao = `<div class="explicacao ${certo ? 'ok' : 'ko'}">
                <h3>${certo ? '✓ Certo!' : `✗ Errado: a certa é a ${letraCerta}`}</h3>
                <p>${rico(p.explicacao)}</p>
                <p class="ref">📘 Manual do formador, secção ${esc(p.manual)}</p>
            </div>`;
        }

        const ultima = t.atual === t.itens.length - 1;
        let botoes;
        if (exame) {
            botoes = `
                <button class="botao secundario" data-acao="anterior" ${t.atual === 0 ? 'disabled' : ''}>← Anterior</button>
                <button class="botao secundario botao-marcar" data-acao="marcar" aria-pressed="${!!t.marcadas[t.atual]}">⚑ ${t.marcadas[t.atual] ? 'Marcada' : 'Marcar'}</button>
                <span class="direita">${ultima
                    ? '<button class="botao" data-acao="entregar">Entregar o teste</button>'
                    : '<button class="botao" data-acao="seguinte">Seguinte →</button>'}</span>`;
        } else if (corrigida) {
            botoes = `<span class="direita">${ultima
                ? '<button class="botao" data-acao="terminar">Ver resultado</button>'
                : '<button class="botao" data-acao="seguinte">Seguinte →</button>'}</span>`;
        } else {
            botoes = `
                <button class="botao fantasma" data-acao="saltar" ${ultima ? 'disabled' : ''}>Saltar</button>
                <span class="direita"><button class="botao" data-acao="confirmar" ${escolha === undefined ? 'disabled' : ''}>Confirmar</button></span>`;
        }

        const caixa = document.getElementById('pergunta');
        caixa.innerHTML = `
            <div class="pergunta-cabeca">
                <span class="pergunta-num">Pergunta ${t.atual + 1}/${t.itens.length}</span>
                <span class="pilula ${bloco}">${esc(p.tema)}</span>
                <span class="dificuldade" title="Dificuldade: ${['', 'fácil', 'média', 'difícil'][nivel]}" aria-label="Dificuldade ${['', 'fácil', 'média', 'difícil'][nivel]}">
                    <i class="on"></i><i class="${nivel > 1 ? 'on' : ''}"></i><i class="${nivel > 2 ? 'on' : ''}"></i>
                </span>
            </div>
            <div class="pergunta-texto">${rico(p.pergunta)}</div>
            ${blocoCodigo(p)}
            <div class="opcoes" role="group" aria-label="Opções de resposta">${opcoes}</div>
            ${explicacao}
            <div class="acoes">
                ${botoes}
            </div>
            <div class="acoes atalhos" aria-hidden="true">
                <span><kbd>A</kbd>–<kbd>D</kbd> escolher</span>
                <span><kbd>Enter</kbd> ${exame ? 'seguinte' : 'confirmar / seguinte'}</span>
                ${exame ? '<span><kbd>←</kbd><kbd>→</kbd> navegar</span><span><kbd>M</kbd> marcar</span>' : ''}
            </div>`;
        realcar(caixa);

        caixa.querySelectorAll('.opcao').forEach(b => b.addEventListener('click', () => escolher(Number(b.dataset.orig))));
        caixa.querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', () => acao(b.dataset.acao)));

        desenharLateral();
    }

    function desenharLateral() {
        const t = tentativa;
        const exame = t.modo === 'exame';
        const respondidas = Object.keys(t.respostas).length;
        document.getElementById('barra-progresso').style.width = `${(respondidas / t.itens.length) * 100}%`;

        let certas = 0, erradas = 0;
        Object.keys(t.confirmadas).forEach(i => {
            const p = POR_ID.get(t.itens[i].id);
            if (t.respostas[i] === p.correta) certas++; else erradas++;
        });
        document.getElementById('placar').innerHTML = exame
            ? `<div><b>${respondidas}</b><span>respondidas</span></div>
               <div><b>${t.itens.length - respondidas}</b><span>por responder</span></div>
               <div><b>${Object.keys(t.marcadas).filter(k => t.marcadas[k]).length}</b><span>marcadas</span></div>`
            : `<div class="ok"><b>${certas}</b><span>certas</span></div>
               <div class="ko"><b>${erradas}</b><span>erradas</span></div>
               <div><b>${t.itens.length - certas - erradas}</b><span>faltam</span></div>`;

        const nav = document.getElementById('navegador');
        nav.innerHTML = t.itens.map((it, i) => {
            const classes = [];
            if (i === t.atual) classes.push('atual');
            if (t.marcadas[i]) classes.push('marcada');
            if (exame) {
                if (t.respostas[i] !== undefined) classes.push('respondida');
            } else if (t.confirmadas[i]) {
                classes.push(t.respostas[i] === POR_ID.get(it.id).correta ? 'ok' : 'ko');
            }
            return `<button type="button" class="${classes.join(' ')}" data-ir="${i}" aria-label="Ir para a pergunta ${i + 1}">${i + 1}</button>`;
        }).join('');
        nav.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => irPara(Number(b.dataset.ir))));
    }

    function escolher(orig) {
        const t = tentativa;
        if (t.modo !== 'exame' && t.confirmadas[t.atual]) return;
        t.respostas[t.atual] = orig;
        guardarTentativa();
        desenharPergunta();
    }

    function irPara(i) {
        if (i < 0 || i >= tentativa.itens.length) return;
        tentativa.atual = i;
        guardarTentativa();
        desenharPergunta();
        document.getElementById('pergunta').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    // Próxima pergunta ainda por corrigir (modo estudo)
    function proximaPorFazer() {
        const t = tentativa;
        for (let k = 1; k <= t.itens.length; k++) {
            const i = (t.atual + k) % t.itens.length;
            if (!t.confirmadas[i]) return i;
        }
        return -1;
    }

    function acao(nome) {
        const t = tentativa;
        switch (nome) {
            case 'confirmar':
                if (t.respostas[t.atual] === undefined) return;
                t.confirmadas[t.atual] = true;
                guardarTentativa();
                desenharPergunta();
                break;
            case 'seguinte':
                if (t.modo === 'exame') irPara(t.atual + 1);
                else {
                    const prox = proximaPorFazer();
                    if (prox === -1) terminar(); else irPara(prox);
                }
                break;
            case 'saltar':
                irPara(t.atual + 1);
                break;
            case 'anterior':
                irPara(t.atual - 1);
                break;
            case 'marcar':
                t.marcadas[t.atual] = !t.marcadas[t.atual];
                guardarTentativa();
                desenharPergunta();
                break;
            case 'entregar':
                confirmarEntrega();
                break;
            case 'terminar':
                if (proximaPorFazer() !== -1) {
                    pedirConfirmacao('Terminar já?', 'Há perguntas que saltaste. Contam como erradas se terminares agora.', 'Ver resultado', terminar);
                } else {
                    terminar();
                }
                break;
        }
    }

    function confirmarEntrega() {
        const t = tentativa;
        const faltam = t.itens.length - Object.keys(t.respostas).length;
        const marcadas = Object.keys(t.marcadas).filter(k => t.marcadas[k]).length;
        let texto = 'Depois de entregares, vês a nota e a correção de todas as perguntas.';
        if (faltam) texto = `Tens ${faltam} pergunta${faltam > 1 ? 's' : ''} por responder (contam como erradas, não descontam). ` + texto;
        if (marcadas) texto += ` Tens ${marcadas} marcada${marcadas > 1 ? 's' : ''} para rever.`;
        pedirConfirmacao('Entregar o teste?', texto, 'Entregar', terminar);
    }

    function terminar() {
        pararRelogio();
        const t = tentativa;
        const respostas = t.itens.map((it, i) => {
            const p = POR_ID.get(it.id);
            const escolha = t.respostas[i];
            return { id: it.id, tema: p.tema, escolha, certa: escolha === p.correta };
        });
        const porTema = {};
        respostas.forEach(r => {
            porTema[r.tema] = porTema[r.tema] || [0, 0];
            porTema[r.tema][1]++;
            if (r.certa) porTema[r.tema][0]++;
        });
        t.terminado = true;
        t.acertos = respostas.filter(r => r.certa).length;
        t.total = respostas.length;
        t.duracao = Math.round(t.gasto);
        t.porTema = porTema;
        A.registarTentativa({ ...t, respostas });
        A.guardarEmCurso(t);   // fica guardado para mostrar o resultado (e sobreviver a um F5)
        location.hash = '#/resultado';
    }

    // ---------- ecrã: resultado ----------
    function ecraResultado() {
        marcarMenu('');
        if (!tentativa) tentativa = A.lerEmCurso();
        const t = tentativa;
        if (!t || !t.terminado) { location.hash = '#/'; return; }
        const def = TIPOS[t.tipo];
        const minimo = t.tipo === 'geral' ? NOTA_MINIMA_GERAL : Math.ceil(t.total / 2);
        const aprovado = t.acertos >= minimo;
        const nota = nota20(t.acertos, t.total);
        const pct = Math.round((t.acertos / t.total) * 100);
        const respondidas = Object.keys(t.respostas).length;

        const temas = Object.entries(t.porTema)
            .map(([tema, [c, n]]) => ({ tema, c, n, pct: c / n }))
            .sort((a, b) => TEMAS.findIndex(x => x.nome === a.tema) - TEMAS.findIndex(x => x.nome === b.tema));
        const fracos = temas.filter(x => x.c < x.n).sort((a, b) => a.pct - b.pct || b.n - a.n).slice(0, 3);

        // Secções do manual a rever, por tema, a partir das erradas
        const seccoes = {};
        t.itens.forEach((it, i) => {
            const p = POR_ID.get(it.id);
            if (t.respostas[i] !== p.correta) {
                seccoes[p.tema] = seccoes[p.tema] || new Set();
                p.manual.split(',').forEach(s => seccoes[p.tema].add(s.trim()));
            }
        });

        const listaTemas = temas.map(x => `<li>
            <span class="nome">${esc(x.tema)}</span><span class="valor">${x.c}/${x.n}</span>
            <div class="barra ${blocoDoTema(x.tema)}"><span style="width:${Math.round(x.pct * 100)}%"></span></div>
        </li>`).join('');

        const listaFracos = fracos.length ? fracos.map((x, i) => `<li>
            <span class="n">${i + 1}</span>
            <div><b>${esc(x.tema)}</b> · ${x.c}/${x.n}
                <p>Revê no manual: secção ${esc([...(seccoes[x.tema] || [])].sort().join(', '))}</p></div>
        </li>`).join('') : '<li><span class="n" style="background:var(--certo-fundo);color:var(--certo)">★</span><div><b>Sem pontos fracos neste teste!</b><p>Acertaste todas as perguntas.</p></div></li>';

        mostrar(`
            <section class="cartao resultado-topo">
                <div class="anel" style="--p:${t.acertos / t.total};--cor:${aprovado ? 'var(--certo)' : 'var(--errado)'}">
                    <svg viewBox="0 0 180 180" aria-hidden="true"><circle class="fundo-anel" cx="90" cy="90" r="80"/><circle class="valor-anel" cx="90" cy="90" r="80"/></svg>
                    <div class="anel-centro">
                        <div class="anel-nota">${nota.toFixed(1)}<small>/20</small></div>
                        <div class="anel-legenda">${t.acertos} de ${t.total} certas</div>
                    </div>
                </div>
                <div>
                    <span class="veredito ${aprovado ? 'aprovado' : 'reprovado'}">${aprovado ? '✓ APROVADO' : '✗ NÃO APROVADO'}</span>
                    <h1 style="font-size:1.8rem">${esc(def.titulo)} · ${t.modo === 'exame' ? 'modo exame' : 'modo estudo'}</h1>
                    <p style="color:var(--texto-2);margin:0">${aprovado
                        ? (nota >= 18 ? 'Excelente! Estás pronto para o teste.' : nota >= 14 ? 'Muito bem! Continua a treinar os temas mais fracos.' : 'Passaste! Agora é subir a nota.')
                        : `Precisas de ${minimo} certas para passar: faltaram ${minimo - t.acertos}. Revê os temas abaixo e tenta outra vez.`}</p>
                    <div class="numeros">
                        <div><b>${pct}%</b><span>de acerto</span></div>
                        <div><b>${t.total - t.acertos}</b><span>erradas${respondidas < t.total ? ` (${t.total - respondidas} em branco)` : ''}</span></div>
                        <div><b>${tempo(t.duracao)}</b><span>de duração</span></div>
                        <div><b>${minimo}</b><span>certas para passar</span></div>
                    </div>
                    <div class="acoes">
                        <button class="botao" data-acao="repetir">Fazer outro ${esc(def.titulo.toLowerCase())}</button>
                        ${t.acertos < t.total ? '<button class="botao secundario" data-acao="ver-erradas">Ver as erradas</button>' : ''}
                        ${t.tipo !== 'fracos' && t.acertos < t.total ? '<button class="botao secundario" data-acao="fracos">Treinar pontos fracos</button>' : ''}
                        <a class="botao fantasma" href="#/">Início</a>
                    </div>
                </div>
            </section>

            <div class="grelha-2">
                <section class="cartao">
                    <h2>Resultado por tema</h2>
                    <ul class="lista-temas">${listaTemas}</ul>
                </section>
                <section class="cartao">
                    <h2>O que estudar a seguir</h2>
                    <ul class="lista-fracos">${listaFracos}</ul>
                </section>
            </div>

            <section class="revisao" id="revisao">
                <div class="titulo-seccao">
                    <h2>Correção</h2>
                    <div class="filtros" role="group" aria-label="Filtrar a correção">
                        <button type="button" data-filtro="erradas" aria-pressed="true">Erradas (${t.total - t.acertos})</button>
                        <button type="button" data-filtro="certas" aria-pressed="false">Certas (${t.acertos})</button>
                        <button type="button" data-filtro="todas" aria-pressed="false">Todas (${t.total})</button>
                    </div>
                </div>
                <div id="lista-revisao"></div>
            </section>
        `);

        desenharRevisao('erradas');
        app.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => {
            app.querySelectorAll('[data-filtro]').forEach(x => x.setAttribute('aria-pressed', x === b));
            desenharRevisao(b.dataset.filtro);
        }));
        app.querySelector('[data-acao="repetir"]').addEventListener('click', () => {
            modoEscolhido = t.modo;
            iniciar(t.tipo === 'erradas' && !window.Sorteio.contarErradas(BANCO, A.estadoPergunta) ? 'geral' : t.tipo);
        });
        const bf = app.querySelector('[data-acao="fracos"]');
        if (bf) bf.addEventListener('click', () => { modoEscolhido = t.modo; iniciar('fracos'); });
        const ve = app.querySelector('[data-acao="ver-erradas"]');
        if (ve) ve.addEventListener('click', () => document.getElementById('revisao').scrollIntoView({ behavior: 'smooth' }));

        if (aprovado) confetes(nota >= 16 ? 140 : 70);
    }

    function desenharRevisao(filtro) {
        const t = tentativa;
        const itens = t.itens.map((it, i) => ({ it, i, p: POR_ID.get(it.id), escolha: t.respostas[i] }))
            .filter(x => filtro === 'todas' || (filtro === 'certas') === (x.escolha === x.p.correta));
        const lista = document.getElementById('lista-revisao');
        if (!itens.length) {
            lista.innerHTML = `<div class="cartao vazio">${filtro === 'erradas' ? 'Não erraste nenhuma. 🎉' : 'Nenhuma pergunta aqui.'}</div>`;
            return;
        }
        lista.innerHTML = itens.map(({ it, i, p, escolha }) => {
            const certa = escolha === p.correta;
            const estado = escolha === undefined ? 'nr' : certa ? 'ok' : 'ko';
            const opcoes = it.ordem.map((orig, pos) => {
                const classe = orig === p.correta ? 'certa' : orig === escolha ? 'errada' : 'apagada';
                return `<div class="opcao ${classe}"><span class="opcao-letra">${LETRAS[pos]}</span><span class="opcao-texto">${rico(p.alternativas[orig])}</span></div>`;
            }).join('');
            return `<details class="item-revisao" ${filtro === 'erradas' && itens.length <= 6 ? 'open' : ''}>
                <summary>
                    <span class="estado ${estado}" aria-label="${estado === 'ok' ? 'Certa' : estado === 'ko' ? 'Errada' : 'Em branco'}">${estado === 'ok' ? '✓' : estado === 'ko' ? '✗' : '–'}</span>
                    <span class="resumo-p"><b>${i + 1} · ${esc(p.tema)}${escolha === undefined ? ' · em branco' : ''}</b><span>${esc(p.pergunta.replace(/`/g, ''))}</span></span>
                </summary>
                <div class="corpo">
                    <div class="pergunta-texto" style="font-size:1.02rem">${rico(p.pergunta)}</div>
                    ${blocoCodigo(p)}
                    <div class="opcoes">${opcoes}</div>
                    <div class="explicacao ${certa ? 'ok' : 'ko'}">
                        <p>${rico(p.explicacao)}</p>
                        <p class="ref">📘 Manual do formador, secção ${esc(p.manual)}</p>
                    </div>
                </div>
            </details>`;
        }).join('');
        realcar(lista);
    }

    function confetes(n) {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const cores = ['#4f46e5', '#bef264', '#ea580c', '#0f8a7e', '#7c3aed', '#facc15'];
        const caixa = document.createElement('div');
        caixa.className = 'confetes';
        for (let i = 0; i < n; i++) {
            const c = document.createElement('i');
            c.style.left = Math.random() * 100 + 'vw';
            c.style.background = cores[i % cores.length];
            c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's';
            c.style.animationDelay = Math.random() * .6 + 's';
            caixa.appendChild(c);
        }
        document.body.appendChild(caixa);
        setTimeout(() => caixa.remove(), 4500);
    }

    // ---------- ecrã: progresso ----------
    function grafico(tentativas) {
        const pts = tentativas.slice(0, 15).reverse().map(t => nota20(t.acertos, t.total));
        if (pts.length < 2) return '<p class="vazio">Faz pelo menos dois testes gerais para veres a evolução da nota.</p>';
        const L = 600, H = 160, m = 26;
        const x = i => m + (i * (L - 2 * m)) / (pts.length - 1);
        const y = v => H - m - (v / 20) * (H - 2 * m);
        const linha = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const area = `${linha} L${x(pts.length - 1)},${H - m} L${x(0)},${H - m} Z`;
        const limite = y((NOTA_MINIMA_GERAL / 45) * 20);
        return `<svg class="grafico" viewBox="0 0 ${L} ${H}" role="img" aria-label="Evolução da nota nos últimos ${pts.length} testes gerais: ${pts.join(', ')}">
            <line class="limite" x1="${m}" x2="${L - m}" y1="${limite}" y2="${limite}"/>
            <text x="${L - m}" y="${limite - 6}" text-anchor="end">aprovação (23/45)</text>
            <text x="4" y="${y(20) + 4}">20</text><text x="4" y="${y(0) + 4}">0</text>
            <path class="area" d="${area}"/><path class="linha-grafico" d="${linha}"/>
            ${pts.map((v, i) => `<circle class="ponto" cx="${x(i)}" cy="${y(v)}" r="4.5"><title>${v.toFixed(1)}</title></circle>`).join('')}
        </svg>`;
    }

    function ecraProgresso() {
        marcarMenu('progresso');
        const est = estatisticas();
        const prog = A.progresso;

        const linhas = TEMAS.map(t => {
            const s = est.porTema[t.nome];
            const ac = s.respondidas ? Math.round((s.certas / s.respondidas) * 100) : null;
            const cob = s.total ? Math.round((s.vistas / s.total) * 100) : 0;
            return `<tr>
                <td><span class="pilula ${t.bloco}">${t.parte === 'I' ? 'Comum' : 'Stack A'}</span> ${esc(t.nome)}</td>
                <td class="num">${s.vistas}/${s.total}</td>
                <td class="col-barra"><div class="barra ${t.bloco}"><span style="width:${cob}%"></span></div></td>
                <td class="num" style="color:${ac === null ? 'var(--texto-3)' : ac >= 50 ? 'var(--certo)' : 'var(--errado)'}">${ac === null ? '—' : ac + '%'}</td>
            </tr>`;
        }).join('');

        const historico = prog.tentativas.length ? prog.tentativas.slice(0, 20).map(t => {
            const def = TIPOS[t.tipo] || { titulo: t.tipo };
            const minimo = t.tipo === 'geral' ? NOTA_MINIMA_GERAL : Math.ceil(t.total / 2);
            const ok = t.acertos >= minimo;
            return `<li>
                <span class="h-nota" style="color:${ok ? 'var(--certo)' : 'var(--errado)'}">${nota20(t.acertos, t.total).toFixed(1)}</span>
                <span class="h-info"><b>${esc(def.titulo)} · ${t.acertos}/${t.total}</b><span>${dataCurta(t.data)} · ${t.modo === 'exame' ? 'exame' : 'estudo'} · ${tempo(t.duracao)}</span></span>
                <span class="pilula ${ok ? 'certo' : 'errado'}">${ok ? 'aprovado' : 'não aprovado'}</span>
            </li>`;
        }).join('') : '<li class="vazio">Ainda não fizeste nenhum teste.</li>';

        mostrar(`
            <div class="titulo-seccao"><h1 style="font-size:2rem">O teu progresso</h1><p>Guardado só neste browser</p></div>
            <div class="cartoes-numero">
                <div class="cartao cartao-numero"><b>${est.vistas}<small style="font-size:1rem;color:var(--texto-3)">/${BANCO.length}</small></b><span>perguntas vistas</span></div>
                <div class="cartao cartao-numero"><b>${est.acerto === null ? '—' : est.acerto + '%'}</b><span>de respostas certas</span></div>
                <div class="cartao cartao-numero"><b>${est.testes}</b><span>testes feitos</span></div>
                <div class="cartao cartao-numero"><b>${est.erradas}</b><span>erradas por rever</span></div>
            </div>
            <section class="cartao" style="margin-bottom:18px">
                <h2>Nota nos testes gerais</h2>
                ${grafico(est.gerais)}
            </section>
            <div class="grelha-2" style="margin-top:0">
                <section class="cartao">
                    <h2>Por tema</h2>
                    <table class="tabela-temas">
                        <thead><tr><th>Tema</th><th style="text-align:right">Vistas</th><th class="col-barra"></th><th style="text-align:right">Acerto</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </section>
                <section class="cartao">
                    <h2>Últimos testes</h2>
                    <ul class="historico">${historico}</ul>
                </section>
            </div>
            <section class="cartao" style="margin-top:18px">
                <h2>Levar o progresso para outro dispositivo</h2>
                <p style="color:var(--texto-2)">Sem conta nem login: exporta um ficheiro aqui e importa-o no outro browser ou telemóvel. As respostas mais recentes de cada pergunta são mantidas.</p>
                <div class="zona-dados">
                    <button class="botao" data-acao="exportar">⬇ Exportar progresso</button>
                    <button class="botao secundario" data-acao="importar">⬆ Importar progresso</button>
                    <button class="botao fantasma" data-acao="apagar" style="color:var(--errado)">Apagar todo o progresso</button>
                    <input type="file" id="ficheiro-importar" accept="application/json,.json" class="oculto">
                </div>
            </section>
        `);

        app.querySelector('[data-acao="exportar"]').addEventListener('click', () => {
            const blob = new Blob([A.exportar()], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `nota20-progresso-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            toast('Progresso exportado.');
        });
        const ficheiro = app.querySelector('#ficheiro-importar');
        app.querySelector('[data-acao="importar"]').addEventListener('click', () => ficheiro.click());
        ficheiro.addEventListener('change', () => {
            const f = ficheiro.files[0];
            if (!f) return;
            f.text().then(texto => {
                try {
                    A.importar(texto);
                    toast('Progresso importado!');
                    ecraProgresso();
                } catch (e) {
                    toast(e.message.startsWith('Este') ? e.message : 'Ficheiro inválido.');
                }
            });
        });
        app.querySelector('[data-acao="apagar"]').addEventListener('click', () => {
            pedirConfirmacao('Apagar todo o progresso?', 'Perdes o histórico, as perguntas vistas e as erradas. Não dá para desfazer (a não ser que tenhas exportado antes).', 'Apagar', () => {
                A.apagarTudo();
                tentativa = null;
                toast('Progresso apagado.');
                ecraProgresso();
            }, true);
        });
    }

    // ---------- ecrã: como funciona ----------
    function ecraSobre() {
        marcarMenu('sobre');
        const contagem = {};
        BANCO.forEach(p => { contagem[p.tema] = (contagem[p.tema] || 0) + 1; });
        const dist = TEMAS.map(t => `<tr><td>${t.parte === 'I' ? 'I · Comum' : 'II · Stack A'}</td><td>${esc(t.nome)}</td><td>${contagem[t.nome] || 0}</td><td>${TIPOS.geral.quotas[t.nome]}</td></tr>`).join('');
        mostrar(`
            <div class="texto-longo">
                <span class="etiqueta">Como funciona</span>
                <h1 style="font-size:2.2rem">Simulados iguais ao teste, sem login.</h1>
                <p style="color:var(--texto-2);font-size:1.08rem">O teste da UC00615 tem 45 perguntas de escolha múltipla com 4 opções e só uma certa, em 60 minutos, sem consulta. Cada resposta certa vale 1 ponto e as erradas não descontam. Passas com 23 certas (50%).</p>
            </div>
            <div class="passos">
                <div class="cartao passo"><div class="n">1</div><h3>Escolhe o simulado</h3><p>O teste geral tem sempre 45 perguntas (30 da parte comum e 15 da Stack A). Os blocos têm 15, com a mesma proporção do teste.</p></div>
                <div class="cartao passo"><div class="n">2</div><h3>Estudo ou exame</h3><p>No estudo vês logo a correção e a explicação. No exame tens cronómetro, podes saltar e marcar perguntas, e só vês a nota no fim.</p></div>
                <div class="cartao passo"><div class="n">3</div><h3>Nada se repete cedo</h3><p>Primeiro saem as perguntas que nunca viste. Depois as que erraste e, por fim, as que viste há mais tempo.</p></div>
            </div>
            <div class="grelha-2">
                <section class="cartao">
                    <h2>Distribuição por tema</h2>
                    <table class="tabela-dist">
                        <thead><tr><th>Parte</th><th>Tema</th><th>No banco</th><th>No teste</th></tr></thead>
                        <tbody>${dist}</tbody>
                    </table>
                </section>
                <section class="cartao texto-longo">
                    <h2>Sobre as perguntas</h2>
                    <ul>
                        <li>Toda a matéria vem do <b>manual do formador</b> (a aplicação Biblioteca) e da secção 3.1 do dossier, a matéria oficial do teste.</li>
                        <li>Cada explicação indica a <b>secção do manual</b> onde podes estudar o assunto.</li>
                        <li>As opções aparecem numa ordem diferente em cada tentativa.</li>
                        <li><b>Pontos fracos:</b> o Nota20 calcula a tua taxa de erro em cada tema e monta um treino de 15 perguntas com mais perguntas dos temas onde falhas mais (até 5 por tema).</li>
                        <li>Como no teste, as perguntas vão do mais fácil ao mais difícil, e as últimas são de análise de código.</li>
                    </ul>
                    <h2 style="margin-top:18px">O teu progresso</h2>
                    <ul>
                        <li>Fica guardado <b>só neste browser</b> (localStorage). Não há contas e nada é enviado para nenhum servidor.</li>
                        <li>Noutro browser ou numa janela anónima começas do zero. Usa <a href="#/progresso">Exportar / Importar</a> para o levar contigo.</li>
                        <li>Se fechares a página a meio de um simulado, ele fica guardado para continuares.</li>
                    </ul>
                    <h2 style="margin-top:18px">Atalhos de teclado</h2>
                    <p><kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> (ou <kbd>1</kbd>–<kbd>4</kbd>) escolher · <kbd>Enter</kbd> confirmar ou seguinte · <kbd>←</kbd> <kbd>→</kbd> navegar · <kbd>M</kbd> marcar para rever</p>
                </section>
            </div>
        `);
    }

    // ---------- diálogo de confirmação ----------
    function pedirConfirmacao(titulo, texto, botao, depois, perigo = false) {
        const d = document.createElement('dialog');
        d.innerHTML = `<h2>${esc(titulo)}</h2><p>${esc(texto)}</p>
            <div class="acoes"><button class="botao fantasma" value="nao">Cancelar</button>
            <button class="botao ${perigo ? 'perigo' : ''}" value="sim">${esc(botao)}</button></div>`;
        document.body.appendChild(d);
        d.querySelectorAll('button').forEach(b => b.addEventListener('click', () => d.close(b.value)));
        d.addEventListener('close', () => {
            const ok = d.returnValue === 'sim';
            d.remove();
            if (ok) depois();
        });
        d.showModal();
        d.querySelector('[value="sim"]').focus();
    }

    // ---------- teclado ----------
    document.addEventListener('keydown', e => {
        if (location.hash !== '#/simulado' || !tentativa || tentativa.terminado) return;
        if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        const t = tentativa;
        const tecla = e.key.toLowerCase();
        const pos = ['a', 'b', 'c', 'd'].indexOf(tecla) !== -1 ? ['a', 'b', 'c', 'd'].indexOf(tecla) : ['1', '2', '3', '4'].indexOf(tecla);
        if (pos !== -1) {
            e.preventDefault();
            escolher(t.itens[t.atual].ordem[pos]);
        } else if (tecla === 'enter') {
            if (document.activeElement.matches('button') && !document.activeElement.classList.contains('opcao')) return;
            e.preventDefault();
            const b = document.querySelector('#pergunta [data-acao="confirmar"]:not(:disabled), #pergunta [data-acao="seguinte"], #pergunta [data-acao="terminar"], #pergunta [data-acao="entregar"]');
            if (b) b.click();
        } else if (t.modo === 'exame' && tecla === 'arrowright') {
            irPara(t.atual + 1);
        } else if (t.modo === 'exame' && tecla === 'arrowleft') {
            irPara(t.atual - 1);
        } else if (t.modo === 'exame' && tecla === 'm') {
            acao('marcar');
        }
    });

    // Guarda o tempo antes de sair da página
    window.addEventListener('pagehide', guardarTentativa);
    document.addEventListener('visibilitychange', () => { if (document.hidden) guardarTentativa(); });

    // ---------- tema claro/escuro ----------
    document.getElementById('alternar-tema').addEventListener('click', () => {
        const raiz = document.documentElement;
        const escuroAgora = raiz.dataset.theme
            ? raiz.dataset.theme === 'dark'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
        raiz.dataset.theme = escuroAgora ? 'light' : 'dark';
        guardarPreferencia('nota20_tema', raiz.dataset.theme);
    });

    // ---------- rotas ----------
    function rota() {
        const h = location.hash || '#/';
        if (h === '#/simulado') ecraSimulado();
        else if (h === '#/resultado') ecraResultado();
        else if (h === '#/progresso') ecraProgresso();
        else if (h === '#/sobre') ecraSobre();
        else ecraInicio();
    }

    window.addEventListener('hashchange', () => {
        if (location.hash !== '#/simulado') guardarTentativa();
        rota();
    });

    if (!BANCO.length) {
        app.innerHTML = '<div class="cartao erro-js">Não foi possível carregar o banco de perguntas (js/banco.js).</div>';
        return;
    }
    rota();
})();
