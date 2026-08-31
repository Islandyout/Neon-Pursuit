import type { ControlMode, VehicleInput } from './contracts';

export type Control = 'throttle' | 'brake' | 'left' | 'right' | 'handbrake' | 'nitro';

export interface ControlSettings {
  steeringSensitivity: number;
  gyroSensitivity: number;
  steeringAssist: boolean;
  leftHanded: boolean;
  controlOpacity: number;
  vibration: boolean;
}

const DEFAULT_SETTINGS: ControlSettings = {
  steeringSensitivity: 1,
  gyroSensitivity: 1,
  steeringAssist: true,
  leftHanded: false,
  controlOpacity: 0.78,
  vibration: true
};

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly touch = new Set<Control>();
  private readonly touchStarted = new Map<Control, number>();
  private controlMode: ControlMode = this.readSavedControlMode();
  private settings: ControlSettings = this.readSavedSettings();
  private analogSteer = 0;
  private gyroSteer = 0;
  private steeringPointer: number | null = null;
  private steeringPad: HTMLElement | null = null;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('deviceorientation', this.onDeviceOrientation, { passive: true });
    this.bindTouchControls();
    this.bindAnalogSteering();
    this.syncControlModeClass();
    this.applySettingsToUi();
  }

  read(): VehicleInput {
    const pad = navigator.getGamepads?.().find(Boolean) ?? null;
    const padSteer = pad?.axes[0] ?? 0;
    const padThrottle = pad ? Math.max(pad.buttons[7]?.value ?? 0, pad.buttons[0]?.pressed ? 1 : 0) : 0;
    const padBrake = pad ? Math.max(pad.buttons[6]?.value ?? 0, pad.buttons[1]?.pressed ? 1 : 0) : 0;

    const touchThrottle = this.touchValue('throttle', 120);
    const touchBrake = this.touchValue('brake', 90);
    const tapRight = this.controlMode === 'tap' ? this.touchValue('right', 130) : 0;
    const tapLeft = this.controlMode === 'tap' ? this.touchValue('left', 130) : 0;
    const keyboardThrottle = this.has('KeyW', 'ArrowUp') ? 1 : 0;
    const keyboardBrake = this.has('KeyS', 'ArrowDown') ? 1 : 0;
    const keyboardSteer = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    const touchSteer = this.controlMode === 'analog' ? this.analogSteer : this.controlMode === 'gyro' ? this.gyroSteer : tapRight - tapLeft;
    const digitalSteer = Math.abs(touchSteer) > Math.abs(keyboardSteer) ? touchSteer : keyboardSteer;
    const rawSteer = Math.abs(padSteer) > Math.abs(digitalSteer) ? padSteer : digitalSteer;
    const sensitivity = Math.max(0.55, Math.min(1.55, this.settings.steeringSensitivity));
    const assisted = this.settings.steeringAssist ? Math.sign(rawSteer) * Math.pow(Math.abs(rawSteer), 1.18) : rawSteer;
    const steer = Math.max(-1, Math.min(1, assisted * sensitivity));

    return {
      throttle: Math.max(keyboardThrottle, touchThrottle, padThrottle),
      brake: Math.max(keyboardBrake, touchBrake, padBrake),
      steer,
      handbrake: this.keys.has('Space') || this.touch.has('handbrake') || Boolean(pad?.buttons[2]?.pressed),
      nitro: this.has('ShiftLeft', 'ShiftRight') || this.touch.has('nitro') || Boolean(pad?.buttons[5]?.pressed)
    };
  }

  getControlMode(): ControlMode {
    return this.controlMode;
  }

  getSettings(): ControlSettings {
    return { ...this.settings };
  }

  updateSettings(next: Partial<ControlSettings>): ControlSettings {
    this.settings = {
      ...this.settings,
      ...next,
      steeringSensitivity: Math.max(0.55, Math.min(1.55, next.steeringSensitivity ?? this.settings.steeringSensitivity)),
      gyroSensitivity: Math.max(0.5, Math.min(1.8, next.gyroSensitivity ?? this.settings.gyroSensitivity)),
      controlOpacity: Math.max(0.35, Math.min(1, next.controlOpacity ?? this.settings.controlOpacity))
    };
    localStorage.setItem('np-control-settings', JSON.stringify(this.settings));
    this.applySettingsToUi();
    return this.getSettings();
  }

  async cycleControlMode(): Promise<ControlMode> {
    const modes: ControlMode[] = ['analog', 'tap', 'gyro'];
    const next = modes[(modes.indexOf(this.controlMode) + 1) % modes.length];
    if (next === 'gyro') {
      const DeviceOrientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (DeviceOrientation.requestPermission) {
        const permission = await DeviceOrientation.requestPermission();
        if (permission !== 'granted') return this.controlMode;
      }
    }
    this.controlMode = next;
    localStorage.setItem('np-control-mode', next);
    this.analogSteer = 0;
    this.syncControlModeClass();
    return next;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
  }

  private readSavedControlMode(): ControlMode {
    const value = localStorage.getItem('np-control-mode');
    return value === 'tap' || value === 'gyro' || value === 'analog' ? value : 'analog';
  }

  private readSavedSettings(): ControlSettings {
    try {
      const raw = localStorage.getItem('np-control-settings');
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ControlSettings>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private has(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  private touchValue(control: Control, rampMs: number): number {
    if (!this.touch.has(control)) return 0;
    const started = this.touchStarted.get(control) ?? performance.now();
    return Math.min(1, Math.max(0.25, (performance.now() - started) / rampMs));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) this.reset();
  };

  private readonly onDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (this.controlMode !== 'gyro' || event.gamma === null) return;
    const deadZone = 2.5;
    const gamma = Math.abs(event.gamma) < deadZone ? 0 : event.gamma;
    const sensitivity = Math.max(0.5, Math.min(1.8, this.settings.gyroSensitivity));
    this.gyroSteer = Math.max(-1, Math.min(1, (gamma / 26) * sensitivity));
  };

  private readonly reset = (): void => {
    this.keys.clear();
    this.touch.clear();
    this.touchStarted.clear();
    this.analogSteer = 0;
    this.steeringPointer = null;
    document.querySelectorAll<HTMLButtonElement>('[data-control].pressed').forEach((button) => button.classList.remove('pressed'));
    const knob = document.getElementById('steering-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  };

  private bindAnalogSteering(): void {
    const pad = document.getElementById('steering-pad');
    if (!pad) return;
    this.steeringPad = pad;
    const update = (event: PointerEvent): void => {
      if (this.steeringPointer !== event.pointerId || this.controlMode !== 'analog') return;
      event.preventDefault();
      const rect = pad.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const radius = rect.width * 0.42;
      this.analogSteer = Math.max(-1, Math.min(1, (event.clientX - centerX) / radius));
      const knob = document.getElementById('steering-knob');
      if (knob) knob.style.transform = `translate(calc(-50% + ${this.analogSteer * radius * 0.58}px), -50%)`;
    };
    pad.addEventListener('pointerdown', (event) => {
      if (this.controlMode !== 'analog') return;
      this.steeringPointer = event.pointerId;
      pad.setPointerCapture?.(event.pointerId);
      update(event);
    });
    pad.addEventListener('pointermove', update);
    const release = (event: PointerEvent): void => {
      if (this.steeringPointer !== event.pointerId) return;
      this.steeringPointer = null;
      this.analogSteer = 0;
      const knob = document.getElementById('steering-knob');
      if (knob) knob.style.transform = 'translate(-50%, -50%)';
    };
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    pad.addEventListener('lostpointercapture', release);
  }

  private bindTouchControls(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach((button) => {
      const control = button.dataset.control as Control;
      const activate = (event: PointerEvent): void => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        this.touch.add(control);
        this.touchStarted.set(control, performance.now());
        button.classList.add('pressed');
        if (this.settings.vibration && (control === 'nitro' || control === 'handbrake') && 'vibrate' in navigator) navigator.vibrate(12);
      };
      const deactivate = (event: PointerEvent): void => {
        event.preventDefault();
        this.touch.delete(control);
        this.touchStarted.delete(control);
        button.classList.remove('pressed');
      };
      button.addEventListener('pointerdown', activate);
      button.addEventListener('pointerup', deactivate);
      button.addEventListener('pointercancel', deactivate);
      button.addEventListener('lostpointercapture', deactivate);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
    });
  }

  private syncControlModeClass(): void {
    document.documentElement.dataset.controlMode = this.controlMode;
    const label = document.getElementById('control-mode-label');
    if (label) label.textContent = this.controlMode.toUpperCase();
    if (this.steeringPad) this.steeringPad.setAttribute('aria-hidden', String(this.controlMode !== 'analog'));
  }

  private applySettingsToUi(): void {
    document.documentElement.dataset.leftHanded = String(this.settings.leftHanded);
    document.documentElement.style.setProperty('--control-opacity', this.settings.controlOpacity.toFixed(2));
  }
}
