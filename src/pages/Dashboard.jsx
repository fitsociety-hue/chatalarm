import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { fetchGAS } from '../api';
import Layout from '../components/Layout';
import { Bell, Webhook, CalendarClock, CheckCircle, AlertCircle, RefreshCw, Activity, Clock, XCircle } from 'lucide-react';

const formatToKST = (timeStr) => {
  if (!timeStr || timeStr === '-') return '-';
  if (typeof timeStr === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return timeStr.substring(0, 5);
  }
  if (typeof timeStr === 'string' && timeStr.includes('T')) {
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit', minute: '2-digit',
        });
      }
    } catch {}
  }
  return String(timeStr);
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]   = useState({ webhooks: 0, schedules: 0, nextSend: '-' });
  const [status, setStatus] = useState(null);   // getStatus 결과
  const [logs, setLogs]     = useState([]);      // getLogs 결과
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!user) return;
    setLoading(true); setError('');
    Promise.all([
      fetchGAS('getWebhooks',  { userId: user.id }),
      fetchGAS('getSchedules', { userId: user.id }),
      fetchGAS('getStatus',    { userId: user.id }),
    ])
      .then(([wh, sc, st]) => {
        const webhooks   = (wh.data || []).length;
        const schedules  = (sc.data || []).length;
        const active     = (sc.data || []).filter(s => s.active);
        let nextSend = '-';
        if (active.length > 0) {
          const rawTimes = active.map(s => s.time).filter(Boolean).sort();
          if (rawTimes.length > 0) nextSend = formatToKST(rawTimes[0]) + ' 발송 예정';
        }
        setStats({ webhooks, schedules, nextSend });
        if (st.success) setStatus(st);
      })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [user]);

  const loadLogs = useCallback(() => {
    if (!user) return;
    setLogLoading(true);
    fetchGAS('getLogs', { userId: user.id })
      .then(res => { if (res.success) setLogs(res.data || []); })
      .catch(() => {})
      .finally(() => setLogLoading(false));
  }, [user]);

  useEffect(() => { load(); loadLogs(); }, [load, loadLogs]);

  const handleRefresh = () => { load(); loadLogs(); };

  const statusBadge = (st) => {
    if (st === 'OK')    return <span style={{ color: '#16a34a', fontWeight: 700, display:'flex', alignItems:'center', gap:3 }}><CheckCircle size={13}/>OK</span>;
    if (st === 'FAIL')  return <span style={{ color: '#dc2626', fontWeight: 700, display:'flex', alignItems:'center', gap:3 }}><XCircle size={13}/>FAIL</span>;
    if (st === 'ERROR') return <span style={{ color: '#d97706', fontWeight: 700, display:'flex', alignItems:'center', gap:3 }}><AlertCircle size={13}/>ERROR</span>;
    return <span style={{ color:'#64748b' }}>{st}</span>;
  };

  return (
    <Layout>
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1>대시보드</h1>
          <p>안녕하세요, <strong>{user?.name}</strong>님 ({user?.team})</p>
        </div>
        <button
          id="dashboard-refresh"
          className="btn btn-ghost btn-sm"
          onClick={handleRefresh}
          style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}
        >
          <RefreshCw size={14} />새로고침
        </button>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} style={{ flexShrink:0 }} />{error}</div>}

      {/* 트리거 상태 경고 */}
      {status && !status.triggerActive && (
        <div className="alert alert-error" style={{ marginBottom:16 }}>
          <AlertCircle size={16} style={{ flexShrink:0 }} />
          <strong>⚠️ 1분 트리거가 비활성 상태입니다!</strong>
          &nbsp;GAS 편집기에서 <code>installTrigger</code> 함수를 실행해 주세요.
        </div>
      )}
      {status && status.triggerActive && (
        <div className="alert alert-success" style={{ marginBottom:16 }}>
          <CheckCircle size={16} style={{ flexShrink:0 }} />
          트리거 정상 작동 중 · 오늘 발송 {status.todayOk}건 성공 / {status.todayFail}건 실패
        </div>
      )}

      {/* 통계 카드 */}
      <div className="stats-grid">
        <div className="stat-card glass-card">
          <Webhook size={22} color="var(--blue-500)" />
          <div className="stat-label">등록된 Webhook</div>
          <div className="stat-value">{loading ? '…' : stats.webhooks}</div>
          <div className="stat-sub">개의 URL 등록됨</div>
        </div>
        <div className="stat-card glass-card">
          <CalendarClock size={22} color="var(--blue-500)" />
          <div className="stat-label">예약 발송</div>
          <div className="stat-value">{loading ? '…' : stats.schedules}</div>
          <div className="stat-sub">개의 스케줄 설정됨</div>
        </div>
        <div className="stat-card glass-card">
          <Bell size={22} color="var(--blue-500)" />
          <div className="stat-label">다음 발송</div>
          <div className="stat-value" style={{ fontSize: '1.1rem', marginTop: 4 }}>{loading ? '…' : stats.nextSend}</div>
          <div className="stat-sub">가장 이른 스케줄</div>
        </div>
      </div>

      {/* 발송 이력 */}
      <div className="content-card glass-card" style={{ marginTop: 24 }}>
        <div className="card-title" style={{ justifyContent:'space-between' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Activity size={18} color="var(--blue-500)" />발송 이력 (최근 30건)
          </span>
          <button id="log-refresh-btn" className="btn btn-ghost btn-sm" onClick={loadLogs} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <RefreshCw size={13} />{logLoading ? '로딩…' : '갱신'}
          </button>
        </div>

        {logLoading ? (
          <div className="empty-state"><div className="spinner" style={{ borderTopColor:'var(--blue-500)', borderColor:'rgba(59,130,246,0.2)' }} /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Clock size={36} />
            <p>발송 이력이 없습니다.<br/>스케줄이 실행되면 여기에 기록됩니다.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.85rem' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', color:'var(--text-muted)', textAlign:'left' }}>
                  <th style={{ padding:'8px 12px', fontWeight:600 }}>발송 시각</th>
                  <th style={{ padding:'8px 12px', fontWeight:600 }}>스케줄명</th>
                  <th style={{ padding:'8px 12px', fontWeight:600 }}>결과</th>
                  <th style={{ padding:'8px 12px', fontWeight:600 }}>상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id || i} style={{ borderBottom:'1px solid rgba(0,0,0,0.04)', color:'var(--text-secondary)' }}>
                    <td style={{ padding:'8px 12px', whiteSpace:'nowrap', fontFamily:'monospace' }}>{log.sentAt}</td>
                    <td style={{ padding:'8px 12px' }}>{log.scheduleName}</td>
                    <td style={{ padding:'8px 12px' }}>{statusBadge(log.status)}</td>
                    <td style={{ padding:'8px 12px', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.78rem', color:'var(--text-muted)' }}>{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 시스템 안내 */}
      <div className="content-card glass-card" style={{ marginTop: 24 }}>
        <div className="card-title"><CheckCircle size={18} color="var(--blue-500)" />시스템 안내</div>
        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.9 }}>
          <li><strong>Webhook 관리</strong> 메뉴에서 Google Chat Webhook URL을 등록·수정·삭제할 수 있습니다.</li>
          <li><strong>발송 예약</strong> 메뉴에서 요일·시간·메시지를 설정하고, 발송 제외일을 지정할 수 있습니다.</li>
          <li>예약 발송은 <strong>월~금 중 지정 시간</strong>에 자동으로 실행됩니다.</li>
          <li>발송 이력은 위 표에서 실시간으로 확인할 수 있습니다.</li>
        </ul>
      </div>
    </Layout>
  );
}
