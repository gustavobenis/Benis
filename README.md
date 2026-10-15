# Marieta: A Grande Aventura na Mata

Aventura 3D de navegador protagonizada por **Marieta**, uma joaninha que atravessa a mata na escala de um inseto.
Stack: **Babylon.js + TypeScript + Vite** (sem servidor; progresso salvo localmente em IndexedDB).

> **Estado atual: protótipo jogável da Fase 1 — O Jardim das Gotas.** As Fases 2–8 ainda não existem.
> Veja [o que está e o que não está pronto](#estado-do-projeto).

## Rodar

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
| Perigo (sombra do pássaro), respawn | ✅ testado |
| Áudio procedural (vento, pássaros, passos, música generativa, 3D espacial) | ⚠️ implementado; **não auditado auditivamente** (ambiente de teste sem áudio) |
| Qualidade gráfica auto/eco/equilibrada/alta | ⚠️ implementada; **FPS real não medido** (só havia GPU por software) |
| Fase 2–8, Bento, Nina, Pipo, Dário, romance | ❌ não iniciado |
| Modelos Blender/GLB, animações autorais, gravações de áudio | ❌ arte atual é procedural (placeholder de qualidade de protótipo) |
| Testes em iPhone/Safari e Android reais | ❌ pendente |

**Peso do download:** o bundle do Babylon.js tem ~1,55 MB gzip (importação pelo pacote inteiro). Otimizar com imports profundos/tree-shaking é uma pendência antes de publicar para celulares em rede móvel.

Metas de desempenho (30 FPS em celulares modestos, 60 FPS em equipamentos potentes) são **metas**, ainda não verificadas.

Arquitetura: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
