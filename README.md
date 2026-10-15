# Marieta: A Grande Aventura na Mata

Aventura 3D de navegador protagonizada por **Marieta**, uma joaninha que atravessa a mata na escala de um inseto.
Stack: **Babylon.js + TypeScript + Vite** (sem servidor; progresso salvo localmente em IndexedDB).

> **Estado atual: protótipo jogável das Fases 1 (O Jardim), 2 (O Rio), 3 (A Floresta), 4 (A Colônia) e 5 (A Tempestade).** As Fases 6–8 ainda não existem.
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

## Publicar com link público

O build (`npm run build` → pasta `dist/`) é um site estático, sem servidor. Três caminhos:

1. **GitHub Pages (automático):** o workflow `.github/workflows/pages.yml` já está no repositório (o job de build já roda verde
   no GitHub). Falta só habilitar a publicação, em *Settings → Pages → Build and deployment → Source: **GitHub Actions***,
   e permitir o branch em *Settings → Environments → github-pages → Deployment branches* (ou fazer merge na `main`). A cada push ele roda typecheck e testes, gera o
   build e publica em `https://<usuário>.github.io/<repositório>/`. (Em repositório privado o Pages exige plano pago.)
2. **Netlify Drop (1 minuto, sem conta técnica):** rode `npm run build` e arraste a pasta `dist/` em https://app.netlify.com/drop.
3. **Vercel / Cloudflare Pages:** conecte o repositório; comando de build `npm run build`, pasta de saída `dist`.

O jogo exige HTTPS para áudio e recursos do navegador em celulares; todos os caminhos acima já servem em HTTPS.

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
**Fase 3 — A Floresta:** converse com Tico (gafanhoto) → colete 3 cristais de luz nas alturas (quique nos cogumelos cor-de-rosa e
use as asas) → acenda o altar para romper a muralha de teia → chegue à clareira e fale com Dona Olívia (aranha protetora).
A aranha-caçadora (olhos vermelhos) patrulha o centro e enxerga bem de frente: esconda-se sob os troncos. Teias deixam você lenta.
**Fase 4 — A Colônia:** converse com Lino → recolha 4 sementes (uma está no topo do formigueiro, que se escala com saltos) →
abasteça o celeiro para abrir a barricada de gravetos → chegue à câmara e fale com a Rainha Formiga. Um louva-a-deus de grande
alcance patrulha o centro: use os túneis de terra como cobertura. Formigas operárias carregam folhas pelas trilhas.
**Fase 5 — A Tempestade:** chuva e vento forte. Converse com Beto (que passa a acompanhar Marieta) → junte 3 folhas firmes →
construa a jangada na beira da enchente → atravesse até a colina → fale com Zuzu. Um círculo brilhante no chão avisa onde um raio
vai cair (saia dele!); rajadas empurram quem está sem cobertura (abrigue-se sob folhas).
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
| Qualidade gráfica auto/eco/equilibrada/alta (alta inclui SSAO e luz/gradação por fase) | ⚠️ implementada; **FPS real e SSAO não medidos/vistos em GPU real** (só havia renderização por software) |
| Fase 3 (floresta, trampolins, teias, aranha-caçadora, altar, Tico, Dona Olívia) | ✅ jogável de ponta a ponta (e2e) |
| Fase 4 (formigueiro, louva-a-deus, celeiro, Rainha Formiga, Lino) | ✅ jogável de ponta a ponta (e2e) |
| Fase 5 (chuva, vento, raios avisados, enchente com jangada, Beto companheiro, Zuzu) | ✅ jogável de ponta a ponta (e2e) |
| Fases 6–8 (Vale das Flores, Ninho Verde, Juntos Sempre), demais amigos (Freddy, Rita, Sr. Caramujo), Dário, cenas românticas finais | ❌ não iniciado |
| Modelos Blender/GLB, animações autorais, gravações de áudio | ❌ arte atual é procedural (placeholder de qualidade de protótipo) |
| Testes em iPhone/Safari e Android reais | ❌ pendente |

**Peso do download:** o bundle do Babylon.js tem ~1,55 MB gzip (importação pelo pacote inteiro). Otimizar com imports profundos/tree-shaking é uma pendência antes de publicar para celulares em rede móvel.

Metas de desempenho (30 FPS em celulares modestos, 60 FPS em equipamentos potentes) são **metas**, ainda não verificadas.

Arquitetura: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
