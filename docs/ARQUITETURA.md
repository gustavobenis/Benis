# Arquitetura

```
src/
  main.ts                 ponto de entrada (+ hook /?debug)
  game/Game.ts            orquestrador: estados, laço (passos fixos), sistemas, HUD
  game/BirdShadow.ts      perigo ambiental (sombra do pássaro)
  engine/Input.ts         teclado/mouse/toque/gamepad → InputFrame
  engine/CameraRig.ts     3 modos de câmera, colisão de câmera, bob/FOV (respeita "reduzir movimento")
  engine/Audio.ts         Web Audio procedural, 4 barramentos (música/ambiente/efeitos/diálogos), 3D espacial
  engine/Quality.ts       perfis eco/equilibrado/alto + ajuste automático por FPS
  physics/CollisionWorld.ts   colisão própria (cilindros + caixas orientadas), sem Babylon → testável
  levels/Level1.ts        construção da Fase 1 a partir de level1Data.ts
  levels/Environment.ts   céu, sol, sombras, névoa, partículas, probe de reflexo, pós-processamento
  levels/Grass.ts         relva instanciada com shader de vento
  levels/Materials.ts     texturas/materiais PBR procedurais
  player/Marieta.ts       modelos procedurais (Marieta, Tito) e animação das pernas/asas
  systems/                Quests, Inventory, Dialogue, Save (IndexedDB→localStorage), Settings (puros e testados)
  data/                   missões e diálogos (dados, sem lógica de renderização)
  ui/                     UI DOM (menus, HUD, diálogo, configurações) e minimapa
tests/                    vitest (física, missões, inventário, diálogo, save, configurações)
e2e/                      Playwright: desktop (fluxo completo) e celular (toque)
```

## Decisões

- **Física própria em vez de Havok/Ammo**: o jogo precisa de chão, degraus, plataformas, cilindros e escalada.
  Colisores simples e determinísticos (separados da malha visual) são mais leves no celular e testáveis em Node.
  Se surgirem corpos dinâmicos (correnteza, objetos empurráveis), reavaliar.
- **Arte procedural**: não há modelos GLB nem áudio licenciado no repositório. Tudo é gerado por código, o que
  evita questões de licença e permite validar mecânicas; deve ser substituído por arte autoral (Blender → glTF).
- **Passos fixos de ≤ 1/30 s** no laço: física estável em quadros lentos. `Game.maxFrame` limita o tempo simulado por quadro.
- **Sem servidor**: progresso e configurações em IndexedDB (fallback localStorage). Dados corrompidos são descartados na leitura.
- **Qualidade**: `AutoQuality` mede o FPS médio a cada 3 s e desce/sobe de perfil; resolução reduzida via `hardwareScalingLevel`.
- **Sem câmera de "segunda pessoa"** (não é um modo convencional): 1ª, 3ª pessoa e orbital.

## Fases

`LevelBase` concentra os construtores de cenário (pedras, folhas, cogumelos, coletáveis, NPCs, mapa) e o descarte limpo.
`Level1`/`Level2` só declaram dados (`level1Data`, `level2Data`), regras próprias (portão, ponte) e `LevelInfo`
(missões, diálogos, névoa, pássaro, resgate). O `Game` troca de fase com `loadLevel(n)`.
Atenção: o rastreio de recursos da fase termina em `finishBuild()`; recursos criados depois (ex.: pós-processamento) não são da fase.

## Como adicionar uma fase

1. Criar `levelNData.ts` e `LevelN.ts` estendendo `LevelBase` (chame `finishBuild()` no fim do construtor).
2. Declarar missões em `data/quests.ts` e diálogos em `data/dialogues.ts`.
3. Registrar em `LEVELS` (`game/Game.ts`) e aumentar `READY_PHASES` (`ui/UI.ts`).
