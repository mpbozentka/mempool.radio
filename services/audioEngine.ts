
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private isShakerStarted = false;

  // Mixolydian Scale (G Major with a flat 7th)
  private DRUM_FREQUENCIES = [
    196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00,
    440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00,
  ];

  constructor() {}

  async init() {
    if (this.ctx && this.ctx.state === 'running') return;
    
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive'
    });
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    // Dub Delay
    this.delay = this.ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.45;
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.4;
    
    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1000;

    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(delayFilter);
    delayFilter.connect(this.delay);
    this.delay.connect(this.masterGain);

    // Warm Plate Reverb
    this.reverb = this.ctx.createConvolver();
    this.setupReverb();

    this.masterGain.connect(this.ctx.destination);
    
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Immediate feedback sound
    this.playStartupChime();
    this.startShaker();
  }

  private async setupReverb() {
    if (!this.ctx) return;
    const length = this.ctx.sampleRate * 2.5;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    for (let i = 0; i < 2; i++) {
      const channel = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3.0);
      }
    }
    this.reverb!.buffer = impulse;
    this.reverb!.connect(this.masterGain!);
  }

  setVolume(value: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
    }
  }

  private playStartupChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [196, 246.94, 293.66, 392].forEach((f, i) => {
      const osc = this.ctx!.createOscillator();
      const env = this.ctx!.createGain();
      osc.frequency.setValueAtTime(f, now + i * 0.1);
      env.gain.setValueAtTime(0, now + i * 0.1);
      env.gain.linearRampToValueAtTime(0.2, now + i * 0.1 + 0.05);
      env.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 1.5);
      osc.connect(env);
      env.connect(this.masterGain!);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 1.6);
    });
  }

  private startShaker() {
    if (this.isShakerStarted || !this.ctx) return;
    this.isShakerStarted = true;
    
    // Constant low-volume pulse to ensure the user knows audio is on
    const trigger = () => {
      if (!this.ctx || !this.masterGain) return;
      const now = this.ctx.currentTime;
      const noise = this.ctx.createBufferSource();
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 8000;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.015, now);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      noise.connect(filter);
      filter.connect(env);
      env.connect(this.masterGain);
      noise.start(now);
      
      setTimeout(trigger, 400); // Steady island shaker pulse
    };
    trigger();
  }

  private getFrequencyFromValue(btcValue: number, low: number, high: number): number {
    const clampedVal = Math.max(low, Math.min(high, btcValue));
    const logMin = Math.log10(low);
    const logMax = Math.log10(high);
    const logVal = Math.log10(clampedVal);
    const ratio = (logVal - logMin) / (logMax - logMin);
    const index = Math.floor((1 - ratio) * (this.DRUM_FREQUENCIES.length - 1));
    return this.DRUM_FREQUENCIES[index];
  }

  playTransaction(valueSats: number, beatPos: number) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const btcValue = valueSats / 100_000_000;
    
    const isSkankBeat = [4, 12].includes(beatPos % 16);
    if (isSkankBeat && (btcValue > 0 || Math.random() < 0.3)) {
      this.createOrganSkank(392.00); 
    }

    if (btcValue <= 0) return;

    if (btcValue >= 1.0) {
      this.createWhaleStrike(btcValue);
    } else if (btcValue >= 0.1) {
      const freq = this.getFrequencyFromValue(btcValue, 0.1, 1.0);
      this.createSteelDrumStrike(freq, btcValue);
    } else if (btcValue >= 0.01) {
      const freq = this.getFrequencyFromValue(btcValue, 0.01, 0.1);
      this.createMarimbaStrike(freq, btcValue);
    } else {
      const freq = this.getFrequencyFromValue(btcValue, 0.00001, 0.01);
      this.createUkulelePluck(freq, btcValue);
    }
  }

  private createOrganSkank(freq: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const duration = 0.15;
    const vol = 0.08;

    [1, 2, 1.5].forEach((ratio, i) => {
      const osc = this.ctx!.createOscillator();
      const env = this.ctx!.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * ratio, now);
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(vol / (i + 1), now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(env);
      env.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  }

  private createWhaleStrike(btcValue: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const baseFreq = 49.00;
    const duration = 5.0;
    const volume = 0.4;
    const env = this.ctx.createGain();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.1);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  private createUkulelePluck(freq: number, btcValue: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const volume = 0.1 + (btcValue * 10);
    const duration = 0.4;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq * 2, now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  private createMarimbaStrike(freq: number, btcValue: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const volume = 0.15 + (btcValue * 3);
    const duration = 0.8;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  private createSteelDrumStrike(freq: number, btcValue: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const duration = 1.5;
    const volume = 0.2 + Math.sqrt(btcValue) * 0.1;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(volume, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(env);
    env.connect(this.masterGain);
    if (this.reverb) env.connect(this.reverb);
    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  playBlockConfirm() {
    if (!this.ctx || !this.masterGain) return;
    this.playStartupChime(); // Use chime as celebratory block confirmation
  }
}

export const audioEngine = new AudioEngine();
