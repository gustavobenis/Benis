import './style.css';
import { Game } from './game/Game';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const game = new Game(canvas);

game.init().catch((e) => {
  console.error('[marieta] falha ao iniciar', e);
  const err = document.getElementById('loaderr');
  if (err) { err.textContent = `Não foi possível iniciar o jogo. Seu navegador precisa de WebGL. Detalhe: ${e instanceof Error ? e.message : String(e)}`; err.classList.remove('hidden'); }
});

// Hook de depuração/testes: /?debug
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __marieta: Game }).__marieta = game;
