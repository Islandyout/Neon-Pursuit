export type Control = 'throttle' | 'brake' | 'left' | 'right' | 'handbrake' | 'nitro';

export interface InputSnapshot {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  nitro: boolean;
}

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly touch = new Set<Control>();
  private readonly touchStarted = new Map<Control, number>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.bindTouchControls();
  }

  read(): InputSnapshot {
    const pad = navigator.getGamepads?.().find(Boolean) ?? null;
    const padSteer = pad?.axes[0] ?? 0;
    const padThrottle = pad ? Math.max(pad.buttons[7]?.value ?? 0, pad.buttons[0]?.pressed ? 1 : 0) : 0;
    const padBrake = pad ? Math.max(pad.buttons[6]?.value ?? 0, pad.buttons[1]?.pressed ? 1 : 0) : 0;

    const touchThrottle = this.touchValue('throttle', 120);
    const touchBrake = this.touchValue('brake', 90);
    const touchRight = this.touchValue('right', 150);
    const touchLeft = this.touchValue('left', 150);
    const keyboardThrottle = this.has('KeyW', 'ArrowUp') ? 1 : 0;
    const keyboardBrake = this.has('KeyS', 'ArrowDown') ? 1 : 0;
    const keyboardSteer = (this.has('KeyD', 'ArrowRight') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') ? 1 : 0);
    const touchSteer = touchRight - touchLeft;
    const digitalSteer = Math.abs(touchSteer) > Math.abs(keyboardSteer) ? touchSteer : keyboardSteer;

    return {
      throttle: Math.max(keyboardThrottle, touchThrottle, padThrottle),
      brake: Math.max(keyboardBrake, touchBrake, padBrake),
      steer: Math.abs(padSteer) > Math.abs(digitalSteer) ? padSteer : digitalSteer,
      handbrake: this.keys.has('Space') || this.touch.has('handbrake') || Boolean(pad?.buttons[2]?.pressed),
      nitro: this.has('ShiftLeft', 'ShiftRight') || this.touch.has('nitro') || Boolean(pad?.buttons[5]?.pressed)
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
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

  private readonly reset = (): void => {
    this.keys.clear();
    this.touch.clear();
    this.touchStarted.clear();
    document.querySelectorAll<HTMLButtonElement>('[data-control].pressed').forEach((button) => button.classList.remove('pressed'));
  };

  private bindTouchControls(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach((button) => {
      const control = button.dataset.control as Control;
      const activate = (event: PointerEvent): void => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        this.touch.add(control);
        this.touchStarted.set(control, performance.now());
        button.classList.add('pressed');
        if ((control === 'nitro' || control === 'handbrake') && 'vibrate' in navigator) navigator.vibrate(12);
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
}
