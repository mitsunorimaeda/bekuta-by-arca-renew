import { useEffect, useState } from 'react';
import { getBodyPartLabel } from '../lib/rehabConstants';
import {
  Stethoscope, ClipboardList, FileText, Clock,
  User, AlertTriangle, TrendingUp, Shield, Zap, Activity
} from 'lucide-react';

interface SharedRehabViewProps {
  token: string;
}

export function SharedRehabView({ token }: SharedRehabViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-shared-rehab?token=${token}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load');
        setData(json);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const getSideLabel = (s: string | null) => s === 'left' ? '左' : s === 'right' ? '右' : s === 'both' ? '両側' : '';
  const getDaysSince = (d: string | null) => d ? Math.ceil(Math.abs(Date.now() - new Date(d).getTime()) / 86400000) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm px-6">
          <Shield size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {error === 'This link has expired' ? 'リンクの有効期限が切れています' : 'リンクが無効です'}
          </h2>
          <p className="text-sm text-gray-500">
            このリンクは無効か、有効期限が切れています。トレーナーに新しいリンクを依頼してください。
          </p>
        </div>
      </div>
    );
  }

  const { athleteName, injuries, prescriptions, prescriptionItems, dailyLogs, notes } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User size={20} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{athleteName}</h1>
                <p className="text-xs text-gray-500">リハビリ・プログラム経過</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
              <Shield size={14} className="text-blue-600" />
              <span className="text-xs font-medium text-blue-600">閲覧専用</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Bekuta branding */}
        <div className="text-center text-xs text-gray-400">
          <span className="font-semibold">Bekuta</span> by ARCA — コンディション管理システム
        </div>

        {/* ========== 怪我情報 ========== */}
        {injuries && injuries.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Stethoscope size={16} className="text-red-500" /> 怪我情報
            </h2>
            <div className="space-y-3">
              {injuries.map((inj: any) => (
                <div key={inj.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-900">{getSideLabel(inj.side)}{inj.diagnosis}</h3>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                      inj.status === 'active' ? 'bg-red-100 text-red-700' : inj.status === 'conditioning' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {inj.status === 'active' ? '治療中' : inj.status === 'conditioning' ? 'コンディショニング' : '完了'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-gray-400">部位:</span> <span className="text-gray-700">{getBodyPartLabel(inj.body_part_key)}</span></div>
                    {inj.injury_date && <div><span className="text-gray-400">受傷日:</span> <span className="text-gray-700">{inj.injury_date}（{getDaysSince(inj.injury_date)}日前）</span></div>}
                    {inj.mechanism && <div className="col-span-2"><span className="text-gray-400">受傷機転:</span> <span className="text-gray-700">{inj.mechanism}</span></div>}
                    {inj.surgery_date && <div><span className="text-gray-400">手術日:</span> <span className="text-gray-700">{inj.surgery_date}</span></div>}
                    {inj.target_return_date && <div><span className="text-gray-400">復帰目標:</span> <span className="text-gray-700">{inj.target_return_date}</span></div>}
                    {inj.doctor_name && <div><span className="text-gray-400">主治医:</span> <span className="text-gray-700">{inj.doctor_name}</span></div>}
                    {inj.hospital && <div><span className="text-gray-400">病院:</span> <span className="text-gray-700">{inj.hospital}</span></div>}
                    {[inj.problem_1, inj.problem_2, inj.problem_3, inj.problem_4, inj.problem_5].filter(Boolean).length > 0 && (
                      <div className="col-span-2">
                        <span className="text-gray-400">主要な問題点:</span>
                        <ul className="mt-1 space-y-0.5">
                          {[inj.problem_1, inj.problem_2, inj.problem_3, inj.problem_4, inj.problem_5].filter(Boolean).map((p: string, i: number) => (
                            <li key={i} className="text-gray-700">• {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========== 処方プログラム ========== */}
        {prescriptions && prescriptions.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <ClipboardList size={16} className="text-blue-500" /> プログラム
            </h2>
            <div className="space-y-3">
              {prescriptions.map((p: any) => {
                const items = prescriptionItems.filter((i: any) => i.prescription_id === p.id);
                const maxPhase = Array.isArray(p.phase_details) ? p.phase_details.length : 1;
                const PurposeIcon = p.purpose === 'rehab' ? Stethoscope : p.purpose === 'performance' ? Zap : Activity;
                const purposeColor = p.purpose === 'rehab' ? 'red' : p.purpose === 'performance' ? 'blue' : 'green';

                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <PurposeIcon size={16} className={`text-${purposeColor}-500`} />
                      <h3 className="font-bold text-gray-900 flex-1">{p.title}</h3>
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold bg-${purposeColor}-100 text-${purposeColor}-700`}>
                        Phase {p.current_phase}/{maxPhase}
                      </span>
                    </div>

                    {p.goal && <p className="text-xs text-gray-500 mb-3">目標: {p.goal}</p>}

                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
                      <div className={`h-full rounded-full bg-${purposeColor}-500`} style={{ width: `${(p.current_phase / maxPhase) * 100}%` }} />
                    </div>

                    {/* Current phase exercises */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 mb-2">Phase {p.current_phase} エクササイズ</h4>
                      <div className="space-y-1.5">
                        {items.filter((i: any) => i.phase === p.current_phase).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5 text-xs">
                            <span className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center text-[10px] font-bold text-gray-500">{idx + 1}</span>
                            <span className="flex-1 text-gray-700">{item.name}</span>
                            {item.quantity && <span className="text-gray-400">{item.quantity}</span>}
                            {item.sets && <span className="text-gray-400">×{item.sets}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========== NRS推移 ========== */}
        {dailyLogs && dailyLogs.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" /> 疼痛推移（NRS）
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-end gap-1 h-24">
                {dailyLogs.slice().reverse().map((log: any, idx: number) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${
                        log.pain_level >= 7 ? 'bg-red-500' :
                        log.pain_level >= 4 ? 'bg-orange-400' :
                        log.pain_level >= 2 ? 'bg-amber-300' :
                        'bg-green-300'
                      }`}
                      style={{ height: `${Math.max(log.pain_level * 10, 4)}%` }}
                      title={`${log.log_date}: NRS ${log.pain_level}`}
                    />
                    <span className="text-[8px] text-gray-400">{log.log_date.slice(8)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-gray-400">
                <span>痛みなし ←</span>
                <span>→ 強い痛み</span>
              </div>
            </div>
          </section>
        )}

        {/* ========== ノート ========== */}
        {notes && notes.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FileText size={16} className="text-purple-500" /> トレーナーノート
            </h2>
            <div className="space-y-3">
              {notes.map((note: any) => (
                <div key={note.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      note.note_type === 'soap' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {note.note_type === 'soap' ? 'SOAP' : 'メモ'}
                    </span>
                    <span className="text-[10px] text-gray-400">{note.created_at.slice(0, 10)}</span>
                  </div>
                  {note.note_type === 'soap' ? (
                    <div className="space-y-2 text-xs">
                      {note.subjective && <div><span className="font-bold text-blue-600">S (主訴):</span> <span className="text-gray-700">{note.subjective}</span></div>}
                      {note.objective && <div><span className="font-bold text-green-600">O (所見):</span> <span className="text-gray-700">{note.objective}</span></div>}
                      {note.assessment && <div><span className="font-bold text-orange-600">A (評価):</span> <span className="text-gray-700">{note.assessment}</span></div>}
                      {note.plan && <div><span className="font-bold text-purple-600">P (計画):</span> <span className="text-gray-700">{note.plan}</span></div>}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{note.body}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center py-8 text-xs text-gray-400 border-t border-gray-200">
          <p className="font-semibold">Bekuta by ARCA</p>
          <p className="mt-1">この情報はトレーナーにより共有されました</p>
          {data.expiresAt && <p className="mt-1">有効期限: {new Date(data.expiresAt).toLocaleDateString('ja-JP')}</p>}
        </div>
      </div>
    </div>
  );
}

export default SharedRehabView;
