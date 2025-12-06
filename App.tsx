import React, { useState, useRef } from 'react';
import { LinearEyesCanvas } from './components/LinearEyesCanvas';
import { Volume2, VolumeX, Eye, Settings, ChevronUp, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  const [audioStarted, setAudioStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [windSpeed, setWindSpeed] = useState(3.5);
  const [turbulence, setTurbulence] = useState(0.005);
  const [eyeSize, setEyeSize] = useState(130);

  // Initialize Audio Context (Cicada Synth)
  const initAudio = () => {
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;

    // Master Gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.15; // Initial volume
    masterGain.connect(ctx.destination);
    gainNodeRef.current = masterGain;

    // Create Cicada Sound (Filtered Noise + AM Modulation)
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Bandpass filter to isolate the "chirp" frequencies
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 4500;
    bandpass.Q.value = 15;

    // Highpass to clean up mud
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 3000;

    // Amplitude Modulation (LFO) for the pulsing "buzz"
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 40; // Buzz speed

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1500; // Depth of modulation

    const ampMod = ctx.createGain();
    
    // Connect graph
    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(ampMod);
    ampMod.connect(masterGain);

    // Modulate the amplitude
    lfo.connect(ampMod.gain);
    
    noise.start();
    lfo.start();

    // Second layer: Deep drone (The heat/wind)
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55; // Low A
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    drone.connect(droneGain);
    droneGain.connect(masterGain);
    drone.start();

    setAudioStarted(true);
  };

  const toggleMute = () => {
    if (!audioContextRef.current || !gainNodeRef.current) return;
    
    if (isMuted) {
      gainNodeRef.current.gain.setTargetAtTime(0.15, audioContextRef.current.currentTime, 0.1);
      setIsMuted(false);
    } else {
      gainNodeRef.current.gain.setTargetAtTime(0, audioContextRef.current.currentTime, 0.1);
      setIsMuted(true);
    }
  };

  const handleStart = () => {
    initAudio();
  };

  return (
    <div className="relative w-full h-screen bg-[#010a01] overflow-hidden">
      {/* Background Canvas */}
      <div className="absolute inset-0 z-0">
        <LinearEyesCanvas windSpeed={windSpeed} turbulence={turbulence} eyeSize={eyeSize} />
      </div>

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="pointer-events-auto">
            <h1 className="text-lime-400 text-2xl font-bold tracking-[0.2em] uppercase drop-shadow-[0_0_10px_rgba(163,230,53,0.8)] animate-pulse">
                Verdant Flow
            </h1>
            <p className="text-emerald-500 text-xs tracking-widest mt-1 opacity-80">
                SYSTEM.WIND_VELOCITY_{windSpeed > 5 ? 'HIGH' : 'NORMAL'}
            </p>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-4">
          {/* Audio Toggle */}
          {audioStarted && (
            <button
              onClick={toggleMute}
              className="group flex items-center justify-center p-3 rounded-full border border-lime-500/30 bg-black/40 backdrop-blur-sm hover:bg-lime-500/20 transition-all duration-300"
            >
              {isMuted ? (
                <VolumeX className="w-6 h-6 text-lime-500 opacity-50 group-hover:opacity-100" />
              ) : (
                <Volume2 className="w-6 h-6 text-lime-400 drop-shadow-[0_0_5px_rgba(163,230,53,0.8)]" />
              )}
            </button>
          )}

          {/* Settings Panel */}
          <div className="bg-black/60 backdrop-blur-md border border-lime-500/30 rounded-lg overflow-hidden transition-all duration-300 w-64">
             <button 
               onClick={() => setShowSettings(!showSettings)}
               className="w-full flex items-center justify-between p-3 hover:bg-lime-500/10 text-lime-400 uppercase text-xs tracking-widest font-bold"
             >
                <div className="flex items-center gap-2">
                   <Settings className="w-4 h-4" />
                   <span>Parameters</span>
                </div>
                {showSettings ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
             </button>
             
             {showSettings && (
               <div className="p-4 space-y-5 border-t border-lime-500/20">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-lime-300 uppercase tracking-wider">
                      <span>Wind Speed</span>
                      <span>{windSpeed.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      step="0.1" 
                      value={windSpeed}
                      onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
                      className="w-full h-1 bg-lime-900 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-lime-400 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-lime-300 uppercase tracking-wider">
                      <span>Turbulence</span>
                      <span>{(turbulence * 1000).toFixed(0)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.001" 
                      max="0.02" 
                      step="0.001" 
                      value={turbulence}
                      onChange={(e) => setTurbulence(parseFloat(e.target.value))}
                      className="w-full h-1 bg-lime-900 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-lime-400 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-lime-300 uppercase tracking-wider">
                      <span>Eye Influence</span>
                      <span>{eyeSize.toFixed(0)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="250" 
                      step="10" 
                      value={eyeSize}
                      onChange={(e) => setEyeSize(parseFloat(e.target.value))}
                      className="w-full h-1 bg-lime-900 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-lime-400 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Start Prompt Overlay */}
      {!audioStarted && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#010a01]/60 backdrop-blur-[2px] pointer-events-auto cursor-pointer" onClick={handleStart}>
          <button
            onClick={handleStart}
            className="group relative px-12 py-4 bg-transparent border border-lime-500 text-lime-500 font-mono text-lg tracking-widest uppercase hover:bg-lime-500/10 transition-all duration-500 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-4">
              <Eye className="w-5 h-5" />
              Initiate
            </span>
            <div className="absolute inset-0 bg-lime-500/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-pulse" />
          </button>
        </div>
      )}

      {/* Footer info */}
      <div className="absolute bottom-4 right-6 z-10 text-right pointer-events-none opacity-50 mix-blend-screen">
        <p className="text-[10px] text-lime-300 tracking-[0.3em] uppercase">
          Nature Simulation: Active
        </p>
      </div>
    </div>
  );
};

export default App;