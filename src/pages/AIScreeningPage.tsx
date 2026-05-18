import * as React from 'react';
import { AlertTriangle, Bot, Camera, CheckCircle2, Clock, Download, Eye, HeartPulse, RotateCcw, ShieldAlert, Sparkles, Stethoscope, UploadCloud } from 'lucide-react';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Select, Textarea } from '@/components/ui/basic';

const MEDICAL_DISCLAIMER = 'AI Mata hanya digunakan untuk edukasi dan screening awal, bukan pengganti diagnosis dokter. Untuk hasil akurat, silakan konsultasi langsung dengan dokter mata.';
const PRIVACY_NOTE = 'Data dan foto yang Anda masukkan hanya digunakan untuk membantu screening awal. Jangan gunakan fitur ini untuk kondisi gawat darurat.';

const symptoms = [
  'Mata merah',
  'Mata gatal',
  'Mata berair',
  'Mata kering',
  'Nyeri mata',
  'Pandangan buram',
  'Silau',
  'Sakit kepala',
  'Keluar kotoran mata',
  'Penglihatan mendadak menurun',
  'Melihat kilatan cahaya',
  'Riwayat trauma mata',
];

const durations = ['Hari ini', '1–3 hari', '4–7 hari', 'Lebih dari 1 minggu'];

type RiskLevel = 'Rendah' | 'Sedang' | 'Tinggi' | 'Darurat';
type AnalysisInput = { complaintText: string; selectedSymptoms: string[]; duration: string; painScore: number; hasPhoto: boolean };
type AnalysisResult = {
  riskLevel: RiskLevel;
  categories: string[];
  summary: string;
  recommendation: string;
  bookingRecommendation: string;
  ctas: string[];
  safetyNote: string;
  detectedSignals: string[];
};

const containsAny = (text: string, words: string[]) => words.some(word => text.includes(word));
const addUnique = (items: string[], item: string) => { if (!items.includes(item)) items.push(item); };

export function analyzeEyeScreening({ complaintText, selectedSymptoms, duration, painScore, hasPhoto }: AnalysisInput): AnalysisResult {
  const text = complaintText.toLowerCase();
  const signals = [...selectedSymptoms];
  const categories: string[] = [];

  if (containsAny(text, ['merah', 'red eye'])) signals.push('Mata merah');
  if (containsAny(text, ['gatal'])) signals.push('Mata gatal');
  if (containsAny(text, ['buram', 'kabur', 'blur'])) signals.push('Pandangan buram');
  if (containsAny(text, ['nyeri', 'sakit'])) signals.push('Nyeri mata');
  if (containsAny(text, ['kering', 'perih'])) signals.push('Mata kering');
  if (containsAny(text, ['berair'])) signals.push('Mata berair');
  if (containsAny(text, ['belekan', 'kotoran', 'nanah'])) signals.push('Keluar kotoran mata');
  if (containsAny(text, ['trauma', 'terbentur', 'kemasukan benda'])) signals.push('Riwayat trauma mata');
  if (containsAny(text, ['mendadak tidak jelas', 'hilang penglihatan'])) signals.push('Penglihatan mendadak menurun');
  if (containsAny(text, ['kilatan', 'floaters', 'bayangan hitam', 'bayangan seperti tirai', 'tirai'])) signals.push('Melihat kilatan cahaya');
  if (containsAny(text, ['layar', 'komputer', 'laptop', 'hp', 'ponsel', 'gadget'])) addUnique(categories, 'Mata lelah / digital eye strain');

  const detectedSignals = [...new Set(signals)];
  const hasSignal = (signal: string) => detectedSignals.includes(signal);
  const redPainBlur = hasSignal('Mata merah') && hasSignal('Pandangan buram') && painScore >= 8;
  const prolongedRedEye = hasSignal('Mata merah') && (duration === '4–7 hari' || duration === 'Lebih dari 1 minggu');
  const seriousText = containsAny(text, ['silau berat', 'buram menetap', 'pandangan buram menetap']);

  if (hasSignal('Mata kering')) addUnique(categories, 'Mata kering');
  if (hasSignal('Mata gatal')) addUnique(categories, 'Alergi mata');
  if (hasSignal('Mata berair') || hasSignal('Mata merah')) addUnique(categories, 'Iritasi ringan');
  if (hasSignal('Mata merah') && (hasSignal('Keluar kotoran mata') || hasSignal('Mata berair'))) addUnique(categories, 'Konjungtivitis');
  if (hasSignal('Pandangan buram')) addUnique(categories, 'Gangguan refraksi');
  if (hasSignal('Keluar kotoran mata')) addUnique(categories, 'Infeksi mata');
  if (hasSignal('Riwayat trauma mata')) addUnique(categories, 'Trauma mata');
  if (hasSignal('Penglihatan mendadak menurun') || hasSignal('Melihat kilatan cahaya') || redPainBlur) addUnique(categories, 'Kemungkinan kondisi serius yang perlu pemeriksaan dokter');
  if (categories.length === 0) addUnique(categories, painScore === 0 && duration === 'Hari ini' ? 'Mata lelah / digital eye strain' : 'Iritasi ringan');

  const emergency = hasSignal('Penglihatan mendadak menurun') || painScore >= 8 || hasSignal('Riwayat trauma mata') || hasSignal('Melihat kilatan cahaya') || redPainBlur;
  const high = painScore >= 6 || prolongedRedEye || hasSignal('Keluar kotoran mata') || hasSignal('Pandangan buram') || hasSignal('Silau') || seriousText;
  const low = !emergency && !high && painScore === 0 && duration === 'Hari ini' && (hasSignal('Mata kering') || categories.includes('Mata lelah / digital eye strain') || detectedSignals.length === 0);

  const riskLevel: RiskLevel = emergency ? 'Darurat' : high ? 'Tinggi' : low ? 'Rendah' : 'Sedang';
  const symptomText = detectedSignals.length ? detectedSignals.map(s => s.toLowerCase()).join(', ') : complaintText.trim() || 'keluhan mata ringan';
  const photoNote = hasPhoto ? ' Foto mata telah diunggah sebagai konteks visual awal, namun tidak digunakan sebagai diagnosis.' : '';

  const resultByRisk: Record<RiskLevel, Pick<AnalysisResult, 'recommendation' | 'bookingRecommendation' | 'ctas'>> = {
    Darurat: {
      recommendation: 'Segera periksa ke dokter mata atau IGD. Gejala Anda memerlukan evaluasi medis secepatnya.',
      bookingRecommendation: 'Perlu pemeriksaan segera. Bila gejala berat atau memburuk, prioritaskan IGD/fasilitas kesehatan terdekat.',
      ctas: ['Booking Pemeriksaan Segera'],
    },
    Tinggi: {
      recommendation: 'Disarankan melakukan pemeriksaan dokter mata dalam waktu dekat.',
      bookingRecommendation: 'Booking dokter mata direkomendasikan agar keluhan dapat dievaluasi langsung.',
      ctas: ['Booking Dokter Mata'],
    },
    Sedang: {
      recommendation: 'Kondisi perlu dipantau. Lakukan perawatan awal dan pertimbangkan konsultasi bila tidak membaik.',
      bookingRecommendation: 'Pertimbangkan booking pemeriksaan bila keluhan menetap, memburuk, atau mengganggu aktivitas.',
      ctas: ['Lihat Tips Perawatan', 'Booking Pemeriksaan'],
    },
    Rendah: {
      recommendation: 'Kemungkinan keluhan ringan. Coba istirahat mata, hidrasi, dan aturan 20-20-20.',
      bookingRecommendation: 'Booking dokter belum menjadi prioritas bila keluhan cepat membaik, namun tetap dianjurkan bila berulang.',
      ctas: ['Mulai 20-20-20'],
    },
  };

  return {
    riskLevel,
    categories,
    detectedSignals,
    summary: `Berdasarkan keluhan ${symptomText} selama ${duration.toLowerCase()}, screening awal AI Mata menempatkan risiko pada kategori ${riskLevel}.${photoNote}`,
    safetyNote: `${MEDICAL_DISCLAIMER} ${hasPhoto ? 'Analisa foto bersifat terbatas dan perlu dikonfirmasi oleh dokter mata.' : ''}`.trim(),
    ...resultByRisk[riskLevel],
  };
}

export function MedicalDisclaimer() {
  return <Alert className="border-[#B19731]/35 bg-[#FFE7AB]/45 text-[#231F20]"><ShieldAlert className="mr-2 inline" size={16} /><b>Disclaimer medis:</b> {MEDICAL_DISCLAIMER}<p className="mt-2 text-xs text-[#231F20]/75">{PRIVACY_NOTE}</p></Alert>;
}

export function EmergencyWarningCard() {
  return <Card className="border-red-200 bg-red-50 shadow-none"><CardContent className="flex gap-3 p-4 text-red-900"><AlertTriangle className="mt-0.5 shrink-0" size={22} /><div><b>Jika mengalami gejala darurat</b><p className="mt-1 text-sm">Penglihatan mendadak menurun, nyeri berat, trauma mata, kilatan cahaya, atau bayangan seperti tirai perlu pemeriksaan dokter mata/IGD secepatnya.</p></div></CardContent></Card>;
}

export function AIAnalysisEngine() {
  return <Card className="border-[#B19731]/25 bg-white/85 shadow-sm"><CardContent className="flex items-start gap-3 p-4"><Bot className="mt-1 text-[#B19731]" size={22} /><div><p className="font-semibold text-[#231F20]">Rule-based AI Screening Engine</p><p className="text-sm text-slate-600">Engine frontend membaca teks, gejala, durasi, skor nyeri, dan status foto. Struktur ini siap dihubungkan ke API AI/computer vision backend pada tahap berikutnya.</p></div></CardContent></Card>;
}

export function SymptomSelector({ selectedSymptoms, onToggle }: { selectedSymptoms: string[]; onToggle: (symptom: string) => void }) {
  return <div><p className="mb-3 text-sm font-semibold text-[#231F20]">Pilihan gejala cepat</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{symptoms.map(symptom => { const active = selectedSymptoms.includes(symptom); return <button key={symptom} type="button" onClick={() => onToggle(symptom)} className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition ${active ? 'border-[#B19731] bg-[#FFE7AB]/75 text-[#231F20] shadow-sm' : 'border-stone-200 bg-white text-slate-700 hover:border-[#B19731]/60 hover:bg-[#FFE7AB]/25'}`}><CheckCircle2 className={`mr-2 inline ${active ? 'text-[#B19731]' : 'text-slate-300'}`} size={15} />{symptom}</button>; })}</div></div>;
}

export function PainScale({ painScore, onChange }: { painScore: number; onChange: (score: number) => void }) {
  return <div className="rounded-2xl border border-stone-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-[#231F20]">Tingkat nyeri</p><p className="text-sm text-slate-500">Geser skala 0–10</p></div><Badge className="bg-[#231F20] text-white">{painScore}/10</Badge></div><input type="range" min={0} max={10} value={painScore} onChange={e => onChange(Number(e.target.value))} className="mt-4 h-2 w-full accent-[#B19731]" /><div className="mt-2 flex justify-between text-xs text-slate-500"><span>Tidak nyeri</span><span>Nyeri berat</span></div></div>;
}

export function EyePhotoUploader({ uploadedImage, onUpload }: { uploadedImage: string; onUpload: (image: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onUpload(String(reader.result || ''));
    reader.readAsDataURL(file);
  };
  return <Card className="border-dashed border-[#B19731]/40 bg-[#FFF9EA]"><CardContent className="p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#231F20]"><Camera className="mr-2 inline text-[#B19731]" size={17} />Upload foto mata opsional</p><p className="mt-1 text-sm text-slate-600">Foto membantu konteks visual awal, tanpa klaim diagnosis dari gambar.</p></div><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} /><Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="border-[#B19731] text-[#231F20] hover:bg-[#FFE7AB]/60"><UploadCloud size={16} />Upload Foto Mata</Button></div>{uploadedImage && <div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]"><img src={uploadedImage} alt="Preview foto mata" className="h-36 w-full rounded-2xl border border-[#B19731]/25 object-cover shadow-sm" /><div className="rounded-2xl bg-white p-3 text-sm text-slate-700"><p className="font-semibold text-emerald-700">Foto berhasil diunggah. AI akan membantu membaca gejala visual secara awal.</p><p className="mt-2">Analisa foto bersifat terbatas dan perlu dikonfirmasi oleh dokter mata.</p></div></div>}</CardContent></Card>;
}

const riskStyle: Record<RiskLevel, string> = {
  Rendah: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Sedang: 'bg-amber-50 text-amber-800 border-amber-200',
  Tinggi: 'bg-orange-50 text-orange-800 border-orange-200',
  Darurat: 'bg-red-50 text-red-800 border-red-200',
};

export function AIResultCard({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const saveResult = () => {
    const payload = [`Hasil Screening AI Mata`, `Risiko: ${result.riskLevel}`, `Ringkasan: ${result.summary}`, `Kategori: ${result.categories.join(', ')}`, `Rekomendasi: ${result.recommendation}`, `Catatan: ${result.safetyNote}`].join('\n');
    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hasil-screening-ai-mata.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return <Card className="overflow-hidden border-[#B19731]/35 bg-white shadow-xl"><div className="bg-gradient-to-r from-[#231F20] via-[#3A3121] to-[#B19731] p-5 text-white"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-[#FFE7AB]">AI Mata PRIME</p><h2 className="text-2xl font-bold">Hasil Screening AI Mata</h2></div><span className={`rounded-full border px-4 py-2 text-sm font-bold ${riskStyle[result.riskLevel]}`}>Risiko: {result.riskLevel}</span></div></div><CardContent className="space-y-5 p-5"><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl bg-[#FFF9EA] p-4"><p className="text-sm font-semibold text-[#B19731]">Ringkasan keluhan pasien</p><p className="mt-2 text-slate-700">{result.summary}</p></div><div className="rounded-2xl border border-stone-200 p-4"><p className="text-sm font-semibold text-[#231F20]">Kemungkinan kategori keluhan</p><div className="mt-2 flex flex-wrap gap-2">{result.categories.map(category => <Badge key={category} variant="outline" className="border-[#B19731]/30 bg-[#FFE7AB]/30 text-[#231F20]">{category}</Badge>)}</div></div></div><div className={`rounded-2xl border p-4 ${riskStyle[result.riskLevel]}`}><p className="font-bold">Rekomendasi tindakan</p><p className="mt-1">{result.recommendation}</p><p className="mt-2 text-sm">{result.bookingRecommendation}</p></div><div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-slate-700"><b>Catatan keamanan medis:</b> {result.safetyNote}</div><div className="flex flex-wrap gap-2">{result.ctas.map(cta => <Button key={cta} type="button" className="bg-[#B19731] text-white hover:bg-[#927C28]"><Stethoscope size={16} />{cta}</Button>)}<Button type="button" variant="outline" onClick={saveResult} className="border-[#B19731]/50"><Download size={16} />Simpan Hasil</Button><Button type="button" variant="ghost" onClick={onReset}><RotateCcw size={16} />Ulangi Screening</Button></div></CardContent></Card>;
}

export function AIScreeningPage() {
  const [complaintText, setComplaintText] = React.useState('');
  const [selectedSymptoms, setSelectedSymptoms] = React.useState<string[]>([]);
  const [duration, setDuration] = React.useState(durations[0]);
  const [painScore, setPainScore] = React.useState(0);
  const [uploadedImage, setUploadedImage] = React.useState('');
  const [analysisResult, setAnalysisResult] = React.useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [error, setError] = React.useState('');

  const toggleSymptom = (symptom: string) => setSelectedSymptoms(current => current.includes(symptom) ? current.filter(item => item !== symptom) : [...current, symptom]);
  const reset = () => { setComplaintText(''); setSelectedSymptoms([]); setDuration(durations[0]); setPainScore(0); setUploadedImage(''); setAnalysisResult(null); setError(''); };
  const analyzeNow = () => {
    if (!complaintText.trim() && selectedSymptoms.length === 0) { setError('Mohon isi keluhan atau pilih minimal satu gejala untuk memulai screening.'); return; }
    setError(''); setIsAnalyzing(true); setAnalysisResult(null);
    window.setTimeout(() => { setAnalysisResult(analyzeEyeScreening({ complaintText, selectedSymptoms, duration, painScore, hasPhoto: Boolean(uploadedImage) })); setIsAnalyzing(false); }, 1200);
  };

  return <div className="mx-auto max-w-7xl space-y-6" style={{ fontFamily: 'Montserrat, Inter, ui-sans-serif, system-ui, sans-serif' }}><section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#231F20] via-[#3B311C] to-[#B19731] text-white shadow-2xl"><div className="grid gap-6 p-6 md:grid-cols-[1.15fr_.85fr] md:p-8"><div><Badge className="bg-[#FFE7AB] text-[#231F20]"><Sparkles size={14} />Frontend AI Screening</Badge><h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">AI Mata</h1><p className="mt-3 max-w-2xl text-base leading-7 text-[#FFF3CF] md:text-lg">Engine screening awal kesehatan mata berbasis rule-based untuk membaca keluhan teks, gejala cepat, durasi, tingkat nyeri, dan foto mata opsional.</p><div className="mt-5 flex flex-wrap gap-3 text-sm text-[#FFE7AB]"><span className="rounded-full border border-white/20 px-3 py-1"><Eye className="mr-1 inline" size={15} />Edukasi, bukan diagnosis final</span><span className="rounded-full border border-white/20 px-3 py-1"><Clock className="mr-1 inline" size={15} />Analisa ±1 detik</span><span className="rounded-full border border-white/20 px-3 py-1"><HeartPulse className="mr-1 inline" size={15} />Prioritas keamanan medis</span></div></div><div className="rounded-[1.5rem] border border-white/20 bg-white/10 p-5 backdrop-blur"><MedicalDisclaimer /></div></div></section><EmergencyWarningCard /><AIAnalysisEngine /><div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><Card className="border-[#B19731]/25 bg-white/95 shadow-lg"><CardHeader><CardTitle className="text-2xl text-[#231F20]">Form AI Screening Mata</CardTitle><p className="text-sm text-slate-500">Isi keluhan dengan jelas agar screening awal lebih relevan.</p></CardHeader><CardContent className="space-y-5"><div><label className="mb-2 block text-sm font-semibold text-[#231F20]">Keluhan bebas</label><Textarea value={complaintText} onChange={e => setComplaintText(e.target.value)} placeholder="Contoh: mata merah, buram, nyeri, gatal, keluar cairan, silau, atau penglihatan menurun." className="min-h-32 border-stone-200 focus:border-[#B19731] focus:ring-[#B19731]/30" /></div><SymptomSelector selectedSymptoms={selectedSymptoms} onToggle={toggleSymptom} /><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-2 block text-sm font-semibold text-[#231F20]">Durasi keluhan</label><Select value={duration} onChange={e => setDuration(e.target.value)} className="border-stone-200 focus:border-[#B19731] focus:ring-[#B19731]/30">{durations.map(item => <option key={item} value={item}>{item}</option>)}</Select></div><PainScale painScore={painScore} onChange={setPainScore} /></div><EyePhotoUploader uploadedImage={uploadedImage} onUpload={setUploadedImage} />{error && <Alert className="border-red-200 bg-red-50 text-red-800">{error}</Alert>}<div className="flex flex-wrap gap-3"><Button type="button" onClick={analyzeNow} disabled={isAnalyzing} className="bg-[#B19731] px-5 text-white hover:bg-[#927C28]"><Bot size={16} />{isAnalyzing ? 'AI sedang menganalisa keluhan Anda...' : 'Analisa Sekarang'}</Button><Button type="button" variant="outline" onClick={reset} className="border-[#B19731]/50"><RotateCcw size={16} />Ulangi Screening</Button></div></CardContent></Card><div className="space-y-5">{isAnalyzing && <Card className="border-[#B19731]/30 bg-[#FFF9EA]"><CardContent className="flex items-center gap-3 p-5 text-[#231F20]"><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#B19731] border-t-transparent" />AI sedang menganalisa keluhan Anda...</CardContent></Card>}{analysisResult ? <AIResultCard result={analysisResult} onReset={reset} /> : <Card className="border-[#B19731]/25 bg-white/90"><CardContent className="p-6 text-center"><Eye className="mx-auto text-[#B19731]" size={42} /><h2 className="mt-3 text-xl font-bold text-[#231F20]">Hasil akan muncul di sini</h2><p className="mt-2 text-sm text-slate-600">Klik “Analisa Sekarang” setelah mengisi keluhan. Untuk kondisi darurat, jangan menunggu hasil screening dan segera cari bantuan medis.</p></CardContent></Card>}</div></div></div>;
}
