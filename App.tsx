
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header.tsx';
import { Visualizer } from './components/Visualizer.tsx';
import { InstrumentGrid } from './components/InstrumentGrid.tsx';
import { MidiKeyboard } from './components/MidiKeyboard.tsx';
import { AudioEngine } from './services/audioEngine.ts';
import { INSTRUMENTS, SCALES } from './constants.ts';
import { downloadBlob, exportMidi } from './services/midiExport.ts';
import { ProLanding } from './components/ProLanding.tsx';
import { licenseService } from './services/licenseService.ts';
import { GoogleGenAI } from "@google/genai";
import { 
  Mic, Square, ChevronUp, ChevronDown, Loader2, Volume2, PlayCircle, Download, Settings, AlertCircle, Crown, Video, RefreshCw, Zap, Music
} from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<'idle' | 'recording' | 'live'>('idle');
  const [selectedInstrument, setSelectedInstrument] = useState(INSTRUMENTS[0].id);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [octaveShift, setOctaveShift] = useState(0);
  const [sensitivity, setSensitivity] = useState(0.015);
  const [autotune, setAutotune] = useState(true);
  const [selectedScaleIdx, setSelectedScaleIdx] = useState(0);
  const [loadingInstrumentId, setLoadingInstrumentId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);
  const [showProLanding, setShowProLanding] = useState(false);
  const [isEngineInitialized, setIsEngineInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationStatus, setVideoGenerationStatus] = useState<string | null>(null);
  
  const audioEngineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    const checkLicense = async () => {
      setIsCheckingLicense(true);
      const proStatus = await licenseService.isUserPro();
      setIsPro(proStatus);
      setIsCheckingLicense(false);
    };
    checkLicense();

    const engine = new AudioEngine((midi) => setActiveMidi(midi));
    audioEngineRef.current = engine;
    return () => audioEngineRef.current?.stopMic();
  }, []);

  const initializeApp = async () => {
    if (!audioEngineRef.current) return;
    setError(null);
    setLoadingInstrumentId(selectedInstrument);
    try {
      await audioEngineRef.current.initAudio();
      const success = await audioEngineRef.current.loadInstrument(selectedInstrument);
      if (success) {
        setIsEngineInitialized(true);
        // Applica parametri iniziali
        audioEngineRef.current.setAutotune(autotune);
        audioEngineRef.current.setScale(SCALES[selectedScaleIdx].intervals);
      } else {
        setError("Errore caricamento suoni. Riprova.");
      }
    } catch (e) {
      setError("Errore accesso audio.");
    } finally {
      setLoadingInstrumentId(null);
    }
  };

  const handleInstrumentChange = async (id: string) => {
    const inst = INSTRUMENTS.find(i => i.id === id);
    if (inst?.isPro && !isPro) {
      setShowProLanding(true);
      return;
    }
    if (loadingInstrumentId) return;
    setError(null);
    setSelectedInstrument(id);
    setLoadingInstrumentId(id);
    if (audioEngineRef.current) {
      const success = await audioEngineRef.current.loadInstrument(id);
      if (!success) setError(`Impossibile caricare ${inst?.name}.`);
    }
    setLoadingInstrumentId(null);
  };

  const toggleAutotune = () => {
    const newVal = !autotune;
    setAutotune(newVal);
    audioEngineRef.current?.setAutotune(newVal);
  };

  const handleScaleChange = (idx: number) => {
    setSelectedScaleIdx(idx);
    audioEngineRef.current?.setScale(SCALES[idx].intervals);
  };

  const handleRec = async () => {
    if (!audioEngineRef.current) return;
    if (appState === 'recording') {
      audioEngineRef.current.stopMic();
      setAppState('idle');
    } else {
      try {
        await audioEngineRef.current.startMic('recording');
        setAppState('recording');
      } catch (e) { alert("Permesso microfono negato."); }
    }
  };

  const handleLiveMode = async () => {
    if (!audioEngineRef.current) return;
    if (appState === 'live') {
      audioEngineRef.current.stopMic();
      setAppState('idle');
    } else {
      try {
        await audioEngineRef.current.startMic('live');
        setAppState('live');
      } catch (e) { alert("Permesso microfono negato."); }
    }
  };

  const handleDownloadMidi = () => {
    if (!isPro) {
      setShowProLanding(true);
      return;
    }
    if (!audioEngineRef.current) return;
    const sequence = audioEngineRef.current.getSequence();
    if (sequence.length === 0) return alert("Nulla da esportare!");
    const inst = INSTRUMENTS.find(i => i.id === selectedInstrument);
    const blob = exportMidi(sequence, inst?.midiProgram || 0);
    downloadBlob(blob, `vocal_synth_${selectedInstrument}.mid`);
  };

  const handlePreview = () => {
    audioEngineRef.current?.previewSequence();
  };

  const adjustOctave = (delta: number) => {
    const newVal = Math.max(-3, Math.min(3, octaveShift + delta));
    setOctaveShift(newVal);
    audioEngineRef.current?.setOctaveShift(newVal);
  };

  const adjustSensitivity = (val: number) => {
    setSensitivity(val);
    audioEngineRef.current?.setSensitivity(val);
  };

  const handleGeneratePromo = async () => {
    try {
      if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
      }
      setIsGeneratingVideo(true);
      setVideoGenerationStatus("Preparing studio scene...");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inst = INSTRUMENTS.find(i => i.id === selectedInstrument);
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `High-end cinematic close-up of a futuristic music studio. A singer's voice becomes glowing musical notes. ${inst?.name} instrument as a holographic interface. Cyberpunk, 8k.`,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VocalSynthPro_Cinema_Promo.mp4`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found.")) {
        await (window as any).aistudio.openSelectKey();
      } else alert("Cinema generation issue.");
    } finally {
      setIsGeneratingVideo(false);
      setVideoGenerationStatus(null);
    }
  };

  if (isCheckingLicense) {
    return (
      <div className="fixed inset-0 bg-[#050507] flex flex-col items-center justify-center z-[400]">
        <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Sincronizzazione Licenza...</p>
      </div>
    );
  }

  if (!isEngineInitialized) {
    return (
      <div className="fixed inset-0 bg-[#050507] flex flex-col items-center justify-center z-[300] p-6 text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl animate-pulse">
           <Volume2 className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">VocalSynth<span className="text-purple-400">Pro</span></h1>
        <p className="text-white/40 max-w-sm mb-10 text-sm">Trasforma la tua voce in MIDI professionale con correzione dell'intonazione integrata.</p>
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        <button onClick={initializeApp} disabled={!!loadingInstrumentId} className="px-12 py-6 bg-white text-black rounded-3xl font-black uppercase tracking-[0.2em] text-sm hover:scale-105 transition-all shadow-2xl flex items-center gap-3">
          {loadingInstrumentId ? <Loader2 className="animate-spin w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
          Carica Studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] pb-24 selection:bg-purple-500/30">
      <Header onUpgradeClick={() => setShowProLanding(true)} isPro={isPro} onGeneratePromo={handleGeneratePromo} />
      
      {isGeneratingVideo && (
        <div className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center p-8 text-center backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="relative mb-12">
             <div className="w-40 h-40 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
             <Video className="w-16 h-16 text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Cinema Engine Active</h2>
          <p className="text-purple-400 font-mono text-xs uppercase tracking-widest animate-pulse h-4">{videoGenerationStatus}</p>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-8 py-10 space-y-10">
        <Visualizer analyser={audioEngineRef.current?.getAnalyser() || null} isActive={appState !== 'idle'} activeColor="purple" />
        
        <section className="glass p-8 rounded-[3rem] border-white/5 shadow-2xl relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-center">
            
            {/* Controllo Rec/Live */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-white/20" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Recording Engine</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleRec}
                  className={`py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all ${
                    appState === 'recording' ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  {appState === 'recording' ? <Square className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {appState === 'recording' ? 'Stop' : 'Rec'}
                </button>
                <button 
                  onClick={handleLiveMode}
                  className={`py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all ${
                    appState === 'live' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  <Volume2 className="w-3 h-3" />
                  Live
                </button>
              </div>
            </div>

            {/* Pitch Correction Panel */}
            <div className="space-y-4 px-4 md:border-x border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Zap className={`w-3 h-3 ${autotune ? 'text-amber-500' : 'text-white/20'}`} />
                   <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Pitch Core</h3>
                </div>
                <button 
                  onClick={toggleAutotune}
                  className={`text-[8px] font-black uppercase px-2 py-1 rounded ${autotune ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/30'}`}
                >
                  {autotune ? 'Auto-Tune ON' : 'Off'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-white/40 uppercase">Octave</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => adjustOctave(-1)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 text-xs font-black">-</button>
                    <span className="text-xs font-black w-4 text-center">{octaveShift > 0 ? `+${octaveShift}` : octaveShift}</span>
                    <button onClick={() => adjustOctave(1)} className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 text-xs font-black">+</button>
                  </div>
                </div>

                <div className="space-y-2">
                   <div className="flex justify-between text-[9px] font-bold text-white/40 uppercase">
                     <span>Scale Correction</span>
                   </div>
                   <select 
                     value={selectedScaleIdx} 
                     onChange={(e) => handleScaleChange(parseInt(e.target.value))}
                     className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 focus:outline-none focus:border-purple-500 transition-all appearance-none cursor-pointer"
                   >
                     {SCALES.map((scale, i) => (
                       <option key={i} value={i}>{scale.name}</option>
                     ))}
                   </select>
                </div>
              </div>
            </div>

            {/* Azioni MIDI */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-3 h-3 text-white/20" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Post-Process</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handlePreview} disabled={appState !== 'idle'} className="py-4 bg-white/5 border border-white/5 rounded-2xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all disabled:opacity-20 flex items-center justify-center gap-2 group">
                  <PlayCircle className="w-3 h-3 group-hover:scale-110 transition-transform" /> Preview
                </button>
                <button onClick={handleDownloadMidi} className={`py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${isPro ? 'bg-indigo-600 text-white' : 'bg-amber-500 text-black'}`}>
                  {!isPro && <Crown className="w-3 h-3" />}
                  <Download className="w-3 h-3" /> Export
                </button>
              </div>
              <div className="flex items-center gap-2 px-2 mt-1">
                 <input 
                    type="range" min="0.001" max="0.1" step="0.001" 
                    value={sensitivity} 
                    onChange={(e) => adjustSensitivity(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    title="Noise Gate Sensitivity"
                  />
                  <span className="text-[8px] font-mono text-white/20">GATE</span>
              </div>
            </div>

          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-12 space-y-10">
            <InstrumentGrid 
              selectedId={selectedInstrument} 
              onSelect={handleInstrumentChange} 
              isLoading={loadingInstrumentId}
              isProUser={isPro}
            />
            <MidiKeyboard activeMidi={activeMidi} activeColor="purple" />
          </div>
        </div>
      </main>

      {showProLanding && (
        <ProLanding 
          onClose={() => setShowProLanding(false)} 
          onUpgrade={() => licenseService.redirectToPayment()} 
        />
      )}
    </div>
  );
};
export default App;
