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
const controlModeButton = getElement<HTMLButtonElement>('control-mode-button');
const vehicleButton = getElement<HTMLButtonElement>('vehicle-button');
const vehicleLabel = getElement<HTMLElement>('vehicle-label');
const styleButton = getElement<HTMLButtonElement>('style-button');
const styleLabel = getElement<HTMLElement>('style-label');
const tuneButton = getElement<HTMLButtonElement>('tune-button');
const settingsPanel = getElement<HTMLElement>('control-settings');
const closeSettings = getElement<HTMLButtonElement>('close-settings');
const steeringSensitivity = getElement<HTMLInputElement>('steer-sensitivity');
const steeringSensitivityValue = getElement<HTMLOutputElement>('steer-sensitivity-value');
const gyroSensitivity = getElement<HTMLInputElement>('gyro-sensitivity');
const gyroSensitivityValue = getElement<HTMLOutputElement>('gyro-sensitivity-value');
const controlOpacity = getElement<HTMLInputElement>('control-opacity');
const controlOpacityValue = getElement<HTMLOutputElement>('control-opacity-value');
const steeringAssist = getElement<HTMLInputElement>('steering-assist');
const leftHanded = getElement<HTMLInputElement>('left-handed');
const vibration = getElement<HTMLInputElement>('vibration');
const offlineBadge = getElement<HTMLElement>('offline-badge');
const coarsePointer = window.matchMedia('(pointer: coarse)');
const portrait = window.matchMedia('(orientation: portrait)');

const game = new NeonPursuitGame(canvas, {
  renderer: getElement('renderer-label'),
  speed: getElement('speed'),
  gear: getElement('gear'),
  nitroFill: getElement('nitro-fill'),
  heatPips: getElement('heat-pips'),
  pursuitState: getElement('pursuit-state'),
  fps: getElement('fps'),
  driftScore: getElement('drift-score')
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

controlModeButton.addEventListener('click', async () => {
  try {
    await game.cycleControlMode();
  } catch (error) {
    console.warn('Could not change mobile steering mode.', error);
  }
});

vehicleButton.addEventListener('click', () => {
  const name = game.cycleVehicle();
  if (name) vehicleLabel.textContent = name.toUpperCase();
  styleLabel.textContent = '1';
});

styleButton.addEventListener('click', () => {
  const label = game.cycleCustomization();
  if (label) styleLabel.textContent = label.replace('STYLE ', '');
});

tuneButton.addEventListener('click', () => settingsPanel.classList.toggle('hidden'));
closeSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

const syncSettingsUi = (): void => {
  const settings = game.getControlSettings();
  if (!settings) return;
  steeringSensitivity.value = String(settings.steeringSensitivity);
  steeringSensitivityValue.value = settings.steeringSensitivity.toFixed(2);
  gyroSensitivity.value = String(settings.gyroSensitivity);
  gyroSensitivityValue.value = settings.gyroSensitivity.toFixed(2);
  controlOpacity.value = String(settings.controlOpacity);
  controlOpacityValue.value = `${Math.round(settings.controlOpacity * 100)}%`;
  steeringAssist.checked = settings.steeringAssist;
  leftHanded.checked = settings.leftHanded;
  vibration.checked = settings.vibration;
};

const applyControlSettings = (): void => {
  const updated = game.updateControlSettings({
    steeringSensitivity: Number(steeringSensitivity.value),
    gyroSensitivity: Number(gyroSensitivity.value),
    controlOpacity: Number(controlOpacity.value),
    steeringAssist: steeringAssist.checked,
    leftHanded: leftHanded.checked,
    vibration: vibration.checked
  });
  if (!updated) return;
  steeringSensitivityValue.value = updated.steeringSensitivity.toFixed(2);
  gyroSensitivityValue.value = updated.gyroSensitivity.toFixed(2);
  controlOpacityValue.value = `${Math.round(updated.controlOpacity * 100)}%`;
};

for (const control of [steeringSensitivity, gyroSensitivity, controlOpacity, steeringAssist, leftHanded, vibration]) {
  control.addEventListener('input', applyControlSettings);
  control.addEventListener('change', applyControlSettings);
}

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

void game.initialize().then(() => {
  const name = game.getVehicleName();
  if (name) vehicleLabel.textContent = name.toUpperCase();
  syncSettingsUi();
  syncPlaybackState();
}).catch((error: unknown) => {
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
    await game.start();
    return;
  }

  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    // Fullscreen is best-effort on mobile browsers.
  }

  try {
    await screen.orientation.lock('landscape');
  } catch {
    // Orientation locking is best-effort; the rotate prompt remains the fallback.
  }

  await game.start();
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}
