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

  constructor() {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.reset);
    this.bindTouchControls();
  }

  read(): InputSnapshot {
    const pad = navigator.getGamepads?.().find(Boolean) ?? null;
    const padSteer = pad?.axes[0] ?? 0;
    const padThrottle = pad ? Math.max(pad.buttons[7]?.value ?? 0, pad.buttons[0]?.pressed ? 1 : 0) : 0;
    const padBrake = pad ? Math.max(pad.buttons[6]?.value ?? 0, pad.buttons[1]?.pressed ? 1 : 0) : 0;
    const keyboardThrottle = this.has('KeyW', 'ArrowUp') || this.touch.has('throttle') ? 1 : 0;
    const keyboardBrake = this.has('KeyS', 'ArrowDown') || this.touch.has('brake') ? 1 : 0;
    const keyboardSteer = (this.has('KeyD', 'ArrowRight') || this.touch.has('right') ? 1 : 0) - (this.has('KeyA', 'ArrowLeft') || this.touch.has('left') ? 1 : 0);

    return {
      throttle: Math.max(keyboardThrottle, padThrottle),
      brake: Math.max(keyboardBrake, padBrake),
      steer: Math.abs(padSteer) > Math.abs(keyboardSteer) ? padSteer : keyboardSteer,
      handbrake: this.keys.has('Space') || this.touch.has('handbrake') || Boolean(pad?.buttons[2]?.pressed),
      nitro: this.has('ShiftLeft', 'ShiftRight') || this.touch.has('nitro') || Boolean(pad?.buttons[5]?.pressed)
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.reset);
  }

  private has(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly reset = (): void => {
    this.keys.clear();
    this.touch.clear();
  };

  private bindTouchControls(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-control]').forEach((button) => {
      const control = button.dataset.control as Control;
      const activate = (event: PointerEvent): void => {
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        this.touch.add(control);
      };
      const deactivate = (event: PointerEvent): void => {
        event.preventDefault();
        this.touch.delete(control);
      };
      button.addEventListener('pointerdown', activate);
      button.addEventListener('pointerup', deactivate);
      button.addEventListener('pointercancel', deactivate);
      button.addEventListener('pointerleave', deactivate);
    });
  }
}
