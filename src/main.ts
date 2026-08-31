import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { NeonPursuitGame } from './game/NeonPursuitGame';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const canvas = getElement<HTMLCanvasElement>('game-canvas');
const driveButton = getElement<HTMLButtonElement>('drive-button');
const startCard = getElement<HTMLElement>('start-card');
const installButton = getElement<HTMLButtonElement>('install-button');
const offlineBadge = getElement<HTMLElement>('offline-badge');
const coarsePointer = window.matchMedia('(pointer: coarse)');
const portrait = window.matchMedia('(orientation: portrait)');

const game = new NeonPursuitGame(canvas, {
  renderer: getElement('renderer-label'),
  speed: getElement('speed'),
  gear: getElement('gear'),
  nitroFill: getElement('nitro-fill'),
  heatPips: getElement('heat-pips')
});

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let gameStarted = false;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event as BeforeInstallPromptEvent;
  installButton.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButton.classList.add('hidden');
});

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  await deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.classList.add('hidden');
});

driveButton.addEventListener('click', async () => {
  gameStarted = true;
  startCard.classList.add('dismissed');
  await enterMobilePlayMode();
  syncPlaybackState();
});

const updateOnlineStatus = (): void => {
  offlineBadge.classList.toggle('hidden', navigator.onLine);
};
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

const syncPlaybackState = (): void => {
  if (!gameStarted) return;
  const blockedByPortrait = coarsePointer.matches && portrait.matches;
  if (document.hidden || blockedByPortrait) game.pause();
  else game.resume();
};

document.addEventListener('visibilitychange', syncPlaybackState);
portrait.addEventListener?.('change', syncPlaybackState);
window.addEventListener('orientationchange', syncPlaybackState);

registerSW({
  immediate: true,
  onOfflineReady: () => console.info('Neon Pursuit is cached for offline play.'),
  onRegisterError: (error) => console.error('Service worker registration failed.', error)
});

void game.initialize().then(syncPlaybackState).catch((error: unknown) => {
  console.error(error);
  const title = startCard.querySelector('h1');
  const copy = startCard.querySelector('p:not(.eyebrow)');
  if (title) title.textContent = 'ENGINE START FAILED';
  if (copy) copy.textContent = 'This browser could not initialize the 3D renderer. Try a current Chrome, Edge, Firefox, or Safari build.';
  driveButton.disabled = true;
});

window.addEventListener('pagehide', () => game.dispose(), { once: true });

async function enterMobilePlayMode(): Promise<void> {
  if (!coarsePointer.matches) {
    game.start();
    return;
  }

  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    // iOS Safari and some embedded browsers do not expose document fullscreen.
  }

  try {
    await screen.orientation.lock('landscape');
  } catch {
    // Orientation locking is best-effort; the CSS rotate prompt remains the fallback.
  }

  game.start();
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}
