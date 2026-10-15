# Marieta: A Grande Aventura na Mata

Aventura 3D de navegador protagonizada por **Marieta**, uma joaninha que atravessa a mata na escala de um inseto.
Stack: **Babylon.js + TypeScript + Vite** (sem servidor; progresso salvo localmente em IndexedDB).

> **Estado atual: protótipo jogável das Fases 1 (O Jardim) e 2 (O Rio — Novos Amigos).** As Fases 3–8 ainda não existem.
> Veja [o que está e o que não está pronto](#estado-do-projeto).

## Rodar no computador (Windows, macOS, Linux)

1. Instale o [Node.js](https://nodejs.org) 18 ou superior (versão LTS).
2. No terminal:
   ```bash
   git clone https://github.com/gustavobenis/Benis.git
   cd Benis
   git checkout claude/marieta-game-design-97fhfm
   npm install
   npm run dev          # abre em http://localhost:5173
   ```
3. Abra **http://localhost:5173** no Chrome, Edge ou Firefox atualizados (com aceleração de hardware ligada) e clique em **Novo jogo**.
   Clique na tela durante o jogo para capturar o mouse e girar a câmera; **Esc** pausa e solta o mouse.

Para jogar a versão otimizada (build de produção): `npm run play` (leva alguns minutos no primeiro build).
Para testar no celular na mesma rede Wi-Fi, abra no celular o endereço `Network` que o `npm run dev` mostra
(o toque funciona; o áudio e alguns recursos exigem HTTPS ao publicar).

## Comandos

```bash
npm install
npm run dev        # http://localhost:5173  (também acessível na rede local)
npm run build      # typecheck + build de produção em dist/
npm test           # testes unitários (física, missões, diálogo, save, configurações)
```

Testes de ponta a ponta (Playwright + Chromium; WebGL por software é lento, mas funciona):

```bash
npm run dev &
CHROMIUM_PATH=/caminho/do/chrome BASE_URL=http://localhost:5173 npm run e2e   # desktop: fluxo completo
CHROMIUM_PATH=... BASE_URL=... node e2e/mobile.mjs                              # celular: toque real (CDP)
```

Abra com `/?debug` para expor `window.__marieta` (usado pelos testes).

## Como jogar

| Entrada | Ação |
|---|---|
| WASD / setas · Shift | Mover · correr |
| Espaço | Pular; segure no ar para **planar** (depois de falar com Tito) |
| W junto a um caule verde | Escalar |
| E | Interagir / conversar |
| F | Câmera: 3ª pessoa → 1ª pessoa → orbital |
| Q | Modo de observação (realça itens e objetivos) |
| Esc | Pausar |
| Mouse (clique para capturar) / roda | Girar câmera / distância |
| Toque | Joystick à esquerda, arrastar à direita = câmera, botões Pular / Agir / Observar |
| Controle (Gamepad API) | Analógicos, A pula, X age, Y câmera, LB observa, Start pausa |

**Fase 2 — O Rio:** converse com Lino (formiga) → colete 3 folhas especiais → construa a ponte → atravesse e fale com Luna
(borboleta) → encontre Beto (besouro). A água arrasta: depois de ~2 s Marieta é levada pela correnteza (a primeira vez, Beto a
resgata; depois custa um coração). Dá para cruzar sem ponte por pedras (precisão) ou folhas flutuantes (móveis).
**Vida:** 3 corações; o pássaro e a correnteza tiram um, gotas de orvalho devolvem um. Sem game over.

**Fase 1:** converse com Tito → colete 5 gotas de orvalho → molhe a folha-portão → chegue ao abrigo.
Opcional: 3 sementes escondidas. Cuidado com a **sombra do pássaro**: esconda-se sob folhas/cogumelos.

## Estado do projeto

| Item | Estado |
|---|---|
| Menu, novo jogo, continuar, configurações, pausa, diário, inventário, mapa | ✅ implementado e testado (e2e) |
| Marieta (modelo procedural), movimento, colisão, pulo, planar, escalada | ✅ implementado; física com testes unitários |
| Câmeras 1ª / 3ª pessoa / orbital, troca sem teleporte | ✅ testado |
| Controles teclado+mouse, toque, gamepad | ✅ teclado/mouse/toque testados; **gamepad implementado mas não testado com hardware** |
| Missões, diálogos, coleta, checkpoints, salvamento | ✅ testado |
| Perigo (sombra do pássaro), correnteza, plataformas móveis, corações, respawn | ✅ testado |
| Fase 2 (rio, Lino, Luna, Beto, ponte, 6 tipos de colecionáveis) | ✅ jogável de ponta a ponta (e2e) |
| Interface conforme a arte de referência (HUD, minimapa circular, seleção de fases, coleção, vitória) | ✅ implementada a partir do design no Claude Design; **não é pixel-idêntica** à imagem |
| Áudio procedural (vento, pássaros, passos, música generativa, 3D espacial) | ⚠️ implementado; **não auditado auditivamente** (ambiente de teste sem áudio) |
| Qualidade gráfica auto/eco/equilibrada/alta | ⚠️ implementada; **FPS real não medido** (só havia GPU por software) |
| Fases 3–8, demais amigos (Tico, Dona Olívia, Zuzu, Freddy, Rita, Sr. Caramujo), Dário, romance | ❌ não iniciado |
| Modelos Blender/GLB, animações autorais, gravações de áudio | ❌ arte atual é procedural (placeholder de qualidade de protótipo) |
| Testes em iPhone/Safari e Android reais | ❌ pendente |

**Peso do download:** o bundle do Babylon.js tem ~1,55 MB gzip (importação pelo pacote inteiro). Otimizar com imports profundos/tree-shaking é uma pendência antes de publicar para celulares em rede móvel.

Metas de desempenho (30 FPS em celulares modestos, 60 FPS em equipamentos potentes) são **metas**, ainda não verificadas.

Arquitetura: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
