import type { PursuitState, RoadClass, VehicleTelemetry } from './contracts';

export class AudioDirector {
  private context: AudioContext | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private tireGain: GainNode | null = null;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private tunnelDelayGain: GainNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private lastNitrous = 1;

  async start(): Promise<void> {
    if (!this.context) this.buildGraph();
    if (this.context?.state === 'suspended') await this.context.resume();
  }

  update(telemetry: VehicleTelemetry, pursuitState: PursuitState, roadClass: RoadClass): void {
    if (!this.context || !this.engineOscillator || !this.engineGain || !this.windGain || !this.tireGain || !this.sirenOscillator || !this.sirenGain || !this.tunnelDelayGain) return;
    const now = this.context.currentTime;
    const normalizedSpeed = Math.min(1, telemetry.speedKph / 300);
    const nitrousActive = telemetry.nitrous < this.lastNitrous - 0.0005;
    const pseudoRpm = 900 + telemetry.speedKph * 23 + telemetry.gear * 360;
    const engineHz = 32 + pseudoRpm / 38;
    this.engineOscillator.frequency.setTargetAtTime(engineHz * (nitrousActive ? 1.04 : 1), now, 0.035);
    this.engineGain.gain.setTargetAtTime(0.025 + normalizedSpeed * 0.055 + (nitrousActive ? 0.014 : 0), now, 0.06);
    this.windGain.gain.setTargetAtTime(Math.pow(normalizedSpeed, 1.8) * 0.045 + (nitrousActive ? 0.035 : 0), now, 0.08);
    this.tireGain.gain.setTargetAtTime(Math.pow(telemetry.slip, 1.3) * Math.min(0.065, normalizedSpeed * 0.075), now, 0.045);

    const pursuitActive = pursuitState === 'engage' || pursuitState === 'chase' || pursuitState === 'intercept';
    const sirenAmount = pursuitActive ? 0.018 + telemetry.heat * 0.004 : 0;
    const sirenFrequency = 620 + Math.sin(now * 6.4) * 170;
    this.sirenOscillator.frequency.setTargetAtTime(sirenFrequency, now, 0.03);
    this.sirenGain.gain.setTargetAtTime(sirenAmount, now, 0.12);

    const tunnelWet = roadClass === 'tunnel' ? 0.2 : roadClass === 'parking' ? 0.08 : 0;
    this.tunnelDelayGain.gain.setTargetAtTime(tunnelWet, now, 0.18);
    this.lastNitrous = telemetry.nitrous;
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

    const worldBus = context.createGain();
    worldBus.gain.value = 1;
    worldBus.connect(master);

    const delay = context.createDelay(0.4);
    delay.delayTime.value = 0.095;
    const tunnelDelayGain = context.createGain();
    tunnelDelayGain.gain.value = 0;
    const feedback = context.createGain();
    feedback.gain.value = 0.18;
    worldBus.connect(delay);
    delay.connect(tunnelDelayGain);
    tunnelDelayGain.connect(master);
    delay.connect(feedback);
    feedback.connect(delay);

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
    engineGain.connect(worldBus);
    engine.start();

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const windFilter = context.createBiquadFilter();
    windFilter.type = 'highpass';
    windFilter.frequency.value = 900;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(worldBus);

    const tireFilter = context.createBiquadFilter();
    tireFilter.type = 'bandpass';
    tireFilter.frequency.value = 1800;
    tireFilter.Q.value = 0.7;
    const tireGain = context.createGain();
    tireGain.gain.value = 0;
    noiseSource.connect(tireFilter);
    tireFilter.connect(tireGain);
    tireGain.connect(worldBus);
    noiseSource.start();

    const siren = context.createOscillator();
    siren.type = 'square';
    siren.frequency.value = 700;
    const sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    siren.connect(sirenGain);
    sirenGain.connect(worldBus);
    siren.start();

    this.engineOscillator = engine;
    this.engineGain = engineGain;
    this.windGain = windGain;
    this.tireGain = tireGain;
    this.sirenOscillator = siren;
    this.sirenGain = sirenGain;
    this.tunnelDelayGain = tunnelDelayGain;
    this.noiseSource = noiseSource;
  }
}
