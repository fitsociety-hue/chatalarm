import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { fetchGAS } from '../api';
import Layout from '../components/Layout';
import { Bell, Webhook, CalendarClock, CheckCircle, AlertCircle } from 'lucide-react';

const formatToKST = (timeStr) => {
  if (!timeStr || timeStr === '-') return '-';
  
  // Clean HH:MM format check
  if (typeof timeStr === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return timeStr.substring(0, 5);
  }
  
  // ISO Timestamp or similar
  if (typeof timeStr === 'string' && timeStr.includes('T')) {
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('ko-KR', {
          timeZone: 'Asia/Seoul',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch (err) {
      console.warn('KST time parse error:', err);
    }
  }

  // Raw split fallback
  if (typeof timeStr === 'string' && timeStr.includes('T')) {
    try {
      const timePart = timeStr.split('T')[1].substring(0, 5);
      return timePart;
    } catch (err) {
      console.warn('KST time split error:', err);
    }
  }
  
  return String(timeStr);
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ webhooks: 0, schedules: 0, nextSend: '-' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchGAS('getWebhooks', { userId: user.id }),
      fetchGAS('getSchedules', { userId: user.id }),
    ])
      .then(([wh, sc]) => {
        const webhooks = (wh.data || []).length;
        const schedules = (sc.data || []).length;
        const active = (sc.data || []).filter(s => s.active);
        let nextSend = '-';
        if (active.length > 0) {
          const rawTimes = active.map(s => s.time).filter(Boolean);
          if (rawTimes.length > 0) {
            // Sort raw times but format the earliest one
            rawTimes.sort();
            nextSend = rawTimes[0] ? formatToKST(rawTimes[0]) + ' 발송 예정' : '-';
          }
        }
        setStats({ webhooks, schedules, nextSend });
      })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <Layout>
      <div className="page-header">
        <h1>대시보드</h1>
        <p>안녕하세요, <strong>{user?.name}</strong>님 ({user?.team})</p>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} style={{ flexShrink:0 }} />{error}</div>}

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

      <div className="content-card glass-card">
        <div className="card-title"><CheckCircle size={18} color="var(--blue-500)" />시스템 안내</div>
        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.9 }}>
          <li><strong>Webhook 관리</strong> 메뉴에서 Google Chat Webhook URL을 등록·수정·삭제할 수 있습니다.</li>
          <li><strong>발송 예약</strong> 메뉴에서 요일·시간·메시지를 설정하고, 발송 제외일을 지정할 수 있습니다.</li>
          <li>예약 발송은 <strong>월~금 중 지정 시간</strong>에 자동으로 실행됩니다.</li>
          <li>공휴일 등 특정 날짜는 <strong>발송 제외일</strong>로 설정하여 발송을 건너뛸 수 있습니다.</li>
          <li>발송 이력 및 오류는 Google Sheets에서 확인할 수 있습니다.</li>
        </ul>
      </div>
    </Layout>
  );
}
