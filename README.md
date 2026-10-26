# Nota20 · Simulados UC00615 (Stack A · PHP)

Site de simulados para o teste da UC00615. As regras são as do teste do formador: 45 perguntas de escolha múltipla com 4 opções e só uma certa, 30 da parte comum e 15 da Stack A (PHP com PDO).

## O que tem

- **Teste geral**: sempre 45 perguntas, com a distribuição por tema do teste real. Passas com 23 certas.
- **Testes por bloco** (15 perguntas cada, com a mesma proporção):
  1. HTML e formulários · CSS · JavaScript
  2. HTTP · SQL e base de dados · Segurança · RGPD
  3. PHP (Stack A): PHP essencial, include/require, PDO, redirecionar e PRG, passwords, sessões, controlo de acesso e XSS
- **Pontos fracos**: 15 perguntas distribuídas pelos temas onde erras mais.
  - O site calcula a taxa de erro de cada tema a partir das tuas respostas.
  - Os temas com mais erros recebem mais perguntas, até 5 por tema.
  - Fica disponível depois de responderes a 10 perguntas.
- **Rever erradas**: 15 perguntas que falhaste da última vez.
- **Dois modos**:
  - **Estudo**: correção imediata, com explicação e a secção do manual.
  - **Exame**: cronómetro (60 min no geral, 20 min por bloco), navegação livre, marcar para rever e correção só no fim.
- **Resultado**:
  - nota de 0 a 20 e APROVADO / NÃO APROVADO;
  - acerto por tema e os 3 temas mais fracos, com as secções do manual a rever;
  - correção completa de cada pergunta.
- **Progresso sem login**: fica guardado no browser (localStorage).
  - Cada simulado só traz perguntas que ainda não te saíram, até as de cada tema se esgotarem.
  - Uma pergunta conta como "já saiu" assim que aparece no ecrã, mesmo que descartes o simulado a meio.
  - Quando um tema se esgota, começa uma volta nova: primeiro as que erraste mais vezes, depois as que erraste da última vez e, por fim, as que saíram há mais tempo. Dentro de cada volta nenhuma se repete.
  - O "Rever erradas" repete de propósito e não conta para as voltas.
  - Dá para exportar e importar o progresso para outro dispositivo.
- Tema claro e escuro, adaptado a telemóvel, com atalhos de teclado (A–D, Enter, ←/→, M).

## O banco de perguntas

- As perguntas estão em `dados/` e são geradas a partir do **manual do formador** (a aplicação "Biblioteca") e da secção 3.1 do dossier, a matéria oficial do teste.
- Cada pergunta indica a secção do manual que a sustenta.
- Não há perguntas sobre projetos de alunos.
- O estilo segue o teste do formador: enunciados e opções curtos e claros, sem pegadinhas, e código pequeno (no máximo 8 linhas). Cerca de 35% das perguntas são fáceis, 45% médias e 20% difíceis.
- Cada simulado tem no máximo 1/3 das perguntas com código (15 no teste geral e 5 nos de 15 perguntas).

```
dados/parciais/*.json     perguntas por tema
dados/banco.json          banco completo (gerado)
js/banco.js               o mesmo banco, carregado pelo site (gerado)
```

Para validar e voltar a gerar o banco depois de editar perguntas:

```bash
node scripts/validar.mjs          # valida dados/parciais/*.json
node scripts/juntar.mjs           # junta tudo e gera dados/banco.json e js/banco.js
```

O validador verifica:
- o formato e os temas;
- as 4 opções diferentes;
- os termos proibidos;
- o equilíbrio da letra certa;
- se a opção certa é muitas vezes a mais comprida;
- as perguntas quase duplicadas.

## Correr localmente

É um site estático, sem dependências. Abre o `index.html` no browser, ou serve a pasta:

```bash
python -m http.server 8000
# http://localhost:8000
```

## Publicar

Funciona em GitHub Pages, Vercel ou Netlify sem configuração: basta publicar a raiz do repositório.

Depois de mudar CSS, JS ou o banco, atualiza o `?v=` dos links no `index.html` para os browsers não usarem a versão antiga em cache.
