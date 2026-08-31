import type { PursuitState, VehicleTelemetry } from './contracts';

export class AudioDirector {
  private context: AudioContext | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;

  async start(): Promise<void> {
    if (!this.context) this.buildGraph();
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  update(telemetry: VehicleTelemetry, pursuitState: PursuitState): void {
    if (!this.context || !this.engineOscillator || !this.engineGain || !this.windGain || !this.sirenOscillator || !this.sirenGain) return;
    const now = this.context.currentTime;
    const normalizedSpeed = Math.min(1, telemetry.speedKph / 300);
    const pseudoRpm = 900 + telemetry.speedKph * 23 + telemetry.gear * 360;
    const engineHz = 32 + pseudoRpm / 38;
    this.engineOscillator.frequency.setTargetAtTime(engineHz, now, 0.035);
    this.engineGain.gain.setTargetAtTime(0.025 + normalizedSpeed * 0.055, now, 0.06);
    this.windGain.gain.setTargetAtTime(Math.pow(normalizedSpeed, 1.8) * 0.045 + telemetry.slip * 0.025, now, 0.1);

    const pursuitActive = pursuitState === 'engage' || pursuitState === 'chase' || pursuitState === 'intercept';
    const sirenAmount = pursuitActive ? 0.018 + telemetry.heat * 0.004 : 0;
    const sirenFrequency = 620 + Math.sin(now * 6.4) * 170;
    this.sirenOscillator.frequency.setTargetAtTime(sirenFrequency, now, 0.03);
    this.sirenGain.gain.setTargetAtTime(sirenAmount, now, 0.12);
  }

  dispose(): void {
    this.engineOscillator?.stop();
    this.sirenOscillator?.stop();
    this.noiseSource?.stop();
    void this.context?.close();
    this.context = null;
  }

  private buildGraph(): void {
    const AudioContextCtor = window.AudioContext;
    const context = new AudioContextCtor();
    this.context = context;

    const master = context.createGain();
    master.gain.value = 0.72;
    master.connect(context.destination);

    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 1250;
    engineFilter.Q.value = 0.8;
    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    const engine = context.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 55;
    engine.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engine.start();

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseFilter = context.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 900;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(windGain);
    windGain.connect(master);
    noiseSource.start();

    const siren = context.createOscillator();
    siren.type = 'square';
    siren.frequency.value = 700;
    const sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    siren.connect(sirenGain);
    sirenGain.connect(master);
    siren.start();

    this.engineOscillator = engine;
    this.engineGain = engineGain;
    this.windGain = windGain;
    this.sirenOscillator = siren;
    this.sirenGain = sirenGain;
    this.noiseSource = noiseSource;
  }
}
