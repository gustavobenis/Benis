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

## Como adicionar uma fase

1. Criar `levelNData.ts` (colisores, coletáveis, NPCs) e `LevelN.ts` seguindo `Level1`.
2. Declarar missões em `data/quests.ts` e diálogos em `data/dialogues.ts`.
3. Generalizar `Game` para escolher o nível pelo `SaveData.level` (hoje fixo na Fase 1).
