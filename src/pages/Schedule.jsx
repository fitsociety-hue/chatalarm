import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { fetchGAS } from '../api';
import Layout from '../components/Layout';
import { Plus, Pencil, Trash2, X, AlertCircle, CheckCircle, CalendarClock, Calendar, Zap, RotateCw } from 'lucide-react';

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

const getTodayDateString = () => {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 3600000;
  const kst = new Date(kstMs);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
};

const getDayNameFromDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return days[d.getDay()] || '';
    }
  } catch {}
  return '';
};

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const DAY_VALUES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const EMPTY_FORM = {
  name: '',
  repeatType: 'WEEKLY', // 'ONCE' | 'WEEKLY' | 'MONTHLY'
  targetDate: '',
  monthlyDay: '1',
  days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  time: '09:00',
  message: '',
  webhookId: '',
  excludedDates: [],
  active: true,
};

export default function Schedule() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [newExDate, setNewExDate] = useState('');

  const load = () => {
    setLoading(true); setError('');
    Promise.all([
      fetchGAS('getSchedules', { userId: user.id }),
      fetchGAS('getWebhooks', { userId: user.id }),
    ])
      .then(([sc, wh]) => {
        setSchedules(sc.data || []);
        setWebhooks(wh.data || []);
      })
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const openAdd = () => {
    setForm({
      ...EMPTY_FORM,
      targetDate: getTodayDateString(),
      webhookId: webhooks[0]?.id || '',
    });
    setFormError(''); setEditItem(null); setNewExDate(''); setModal('add');
  };

  const openEdit = (item) => {
    setForm({
      name: item.name || '',
      repeatType: item.repeatType || 'WEEKLY',
      targetDate: item.targetDate || getTodayDateString(),
      monthlyDay: String(item.monthlyDay || '1'),
      days: item.days && item.days.length > 0 ? item.days : ['MON','TUE','WED','THU','FRI'],
      time: formatToKST(item.time) || '09:00',
      message: item.message || '',
      webhookId: item.webhookId || '',
      excludedDates: item.excludedDates || [],
      active: item.active !== false,
    });
    setFormError(''); setEditItem(item); setNewExDate(''); setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditItem(null); };

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));
  };

  const setDaysPreset = (preset) => {
    if (preset === 'weekdays') setForm(f => ({ ...f, days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }));
    else if (preset === 'weekend') setForm(f => ({ ...f, days: ['SAT', 'SUN'] }));
    else if (preset === 'all') setForm(f => ({ ...f, days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] }));
  };

  const addExDate = () => {
    if (!newExDate) return;
    if (form.excludedDates.includes(newExDate)) { setNewExDate(''); return; }
    setForm(f => ({ ...f, excludedDates: [...f.excludedDates, newExDate].sort() }));
    setNewExDate('');
  };

  const removeExDate = (d) => setForm(f => ({ ...f, excludedDates: f.excludedDates.filter(x => x !== d) }));

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('스케줄 이름을 입력해 주세요.'); return; }
    if (!form.time) { setFormError('발송 시간을 입력해 주세요.'); return; }
    if (!form.webhookId) { setFormError('Webhook을 선택해 주세요.'); return; }
    if (!form.message.trim()) { setFormError('발송 메시지를 입력해 주세요.'); return; }

    if (form.repeatType === 'ONCE') {
      if (!form.targetDate) { setFormError('1회 발송할 날짜를 선택해 주세요.'); return; }
    } else if (form.repeatType === 'WEEKLY') {
      if (form.days.length === 0) { setFormError('발송 요일을 하나 이상 선택해 주세요.'); return; }
    } else if (form.repeatType === 'MONTHLY') {
      if (!form.monthlyDay) { setFormError('매월 발송할 일자를 선택해 주세요.'); return; }
    }

    setSaving(true); setFormError('');
    try {
      const payload = { userId: user.id, ...form };
      let res;
      if (modal === 'add') {
        res = await fetchGAS('addSchedule', payload);
      } else {
        res = await fetchGAS('updateSchedule', { ...payload, scheduleId: editItem.id });
      }
      if (!res.success) throw new Error(res.message);
      setSuccess(modal === 'add' ? '스케줄이 추가되었습니다.' : '스케줄이 수정되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
      closeModal(); load();
    } catch (e) { setFormError(e.message || '저장 중 오류가 발생했습니다.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.name}" 스케줄을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetchGAS('deleteSchedule', { userId: user.id, scheduleId: item.id });
      if (!res.success) throw new Error(res.message);
      setSuccess('스케줄이 삭제되었습니다.'); setTimeout(() => setSuccess(''), 3000); load();
    } catch { setError('삭제 중 오류가 발생했습니다.'); }
  };

  const daysLabel = (days) =>
    DAY_VALUES.map((d, i) => days?.includes(d) ? DAY_LABELS[i] : null).filter(Boolean).join('·');

  const webhookLabel = (id) => webhooks.find(w => w.id === id)?.label || id || '-';

  const renderScheduleMeta = (item) => {
    const repeatType = item.repeatType || 'WEEKLY';
    const timeStr = formatToKST(item.time);
    const whStr = webhookLabel(item.webhookId);

    if (repeatType === 'ONCE') {
      const dayName = getDayNameFromDate(item.targetDate);
      return (
        <span>
          <strong>{item.targetDate || '-'}</strong>{dayName ? ` (${dayName})` : ''} · <strong>{timeStr}</strong> · {whStr}
        </span>
      );
    }
    if (repeatType === 'MONTHLY') {
      const dayDisplay = item.monthlyDay === 'LAST' ? '말일' : `${item.monthlyDay || '1'}일`;
      return (
        <span>
          <strong>매월 {dayDisplay}</strong> · <strong>{timeStr}</strong> · {whStr}
        </span>
      );
    }
    return (
      <span>
        <strong>{daysLabel(item.days)}</strong> · <strong>{timeStr}</strong> · {whStr}
      </span>
    );
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>발송 예약</h1>
        <p>1회, 매주, 매월 주기와 시간·메시지를 설정하고 발송 제외일을 지정합니다</p>
      </div>

      {error   && <div className="alert alert-error"  ><AlertCircle size={16} style={{ flexShrink:0 }} />{error}</div>}
      {success && <div className="alert alert-success"><CheckCircle size={16} style={{ flexShrink:0 }} />{success}</div>}

      {webhooks.length === 0 && !loading && (
        <div className="alert alert-info">
          <AlertCircle size={16} style={{ flexShrink:0 }} />
          먼저 <strong>Webhook 관리</strong> 메뉴에서 Webhook URL을 등록해 주세요.
        </div>
      )}

      <div className="content-card glass-card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><CalendarClock size={18} color="var(--blue-500)" />발송 스케줄 ({schedules.length})</span>
          <button id="schedule-add-btn" className="btn btn-primary btn-sm" onClick={openAdd} disabled={webhooks.length === 0}><Plus size={15} />추가</button>
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ borderTopColor:'var(--blue-500)', borderColor:'rgba(59,130,246,0.2)' }} /></div>
        ) : schedules.length === 0 ? (
          <div className="empty-state">
            <CalendarClock size={40} />
            <p>등록된 스케줄이 없습니다.<br />+ 추가 버튼을 눌러 첫 스케줄을 생성하세요.</p>
          </div>
        ) : (
          <div className="schedule-grid">
            {schedules.map(item => {
              const repeatType = item.repeatType || 'WEEKLY';
              const isCompleted = repeatType === 'ONCE' && item.active === false;

              return (
                <div key={item.id} className="schedule-item">
                  <div className="schedule-info">
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <div className="schedule-name">{item.name}</div>
                      
                      {/* 주기 뱃지 */}
                      {repeatType === 'ONCE' && <span className="badge badge-purple">1회 발송</span>}
                      {repeatType === 'WEEKLY' && <span className="badge badge-blue">매주 반복</span>}
                      {repeatType === 'MONTHLY' && <span className="badge badge-teal">매월 반복</span>}

                      {/* 상태 뱃지 */}
                      {isCompleted ? (
                        <span className="badge badge-gray">발송 완료</span>
                      ) : (
                        <span className={`badge ${item.active !== false ? 'badge-green' : 'badge-gray'}`}>
                          {item.active !== false ? '활성' : '비활성'}
                        </span>
                      )}
                    </div>

                    <div className="schedule-meta" style={{ marginTop: 6 }}>
                      {renderScheduleMeta(item)}
                    </div>

                    {item.excludedDates?.length > 0 && (
                      <div className="schedule-meta" style={{ marginTop: 4 }}>
                        제외일: {item.excludedDates.join(', ')}
                      </div>
                    )}
                    <div className="schedule-msg">{item.message}</div>
                  </div>
                  <div className="schedule-actions">
                    <button id={`sched-edit-${item.id}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(item)} title="수정"><Pencil size={14} /></button>
                    <button id={`sched-del-${item.id}`}  className="btn btn-danger  btn-sm btn-icon" onClick={() => handleDelete(item)} title="삭제"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card glass-card">
            <div className="modal-header">
              <div className="modal-title">{modal === 'add' ? '스케줄 추가' : '스케줄 수정'}</div>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>

            {formError && <div className="alert alert-error"><AlertCircle size={15} style={{ flexShrink:0 }} />{formError}</div>}

            <div className="form-group">
              <label className="form-label">스케줄 이름</label>
              <input id="sched-form-name" className="form-input" placeholder="예) 주간 회의 공지" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>

            {/* 주기 선택 세그먼트 */}
            <div className="form-group">
              <label className="form-label">발송 주기</label>
              <div className="repeat-tabs">
                <button
                  type="button"
                  id="tab-repeat-once"
                  className={`repeat-tab${form.repeatType === 'ONCE' ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, repeatType: 'ONCE', targetDate: f.targetDate || getTodayDateString() }))}
                >
                  <Zap size={14} />1회
                </button>
                <button
                  type="button"
                  id="tab-repeat-weekly"
                  className={`repeat-tab${form.repeatType === 'WEEKLY' ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, repeatType: 'WEEKLY' }))}
                >
                  <RotateCw size={14} />매주
                </button>
                <button
                  type="button"
                  id="tab-repeat-monthly"
                  className={`repeat-tab${form.repeatType === 'MONTHLY' ? ' active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, repeatType: 'MONTHLY' }))}
                >
                  <Calendar size={14} />매월
                </button>
              </div>
            </div>

            {/* 주기별 상세 설정 */}
            {form.repeatType === 'ONCE' && (
              <div className="form-group">
                <label className="form-label">발송 날짜 (특정일 지정)</label>
                <input
                  id="sched-form-targetdate"
                  className="form-input"
                  type="date"
                  min={getTodayDateString()}
                  value={form.targetDate}
                  onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                />
                <p className="field-hint">💡 지정한 날짜에 1회 발송 후 자동으로 완료(비활성화)됩니다.</p>
              </div>
            )}

            {form.repeatType === 'WEEKLY' && (
              <div className="form-group">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>발송 요일</label>
                  <div className="quick-days" style={{ marginTop: 0 }}>
                    <button type="button" className="quick-day-btn" onClick={() => setDaysPreset('weekdays')}>평일</button>
                    <button type="button" className="quick-day-btn" onClick={() => setDaysPreset('weekend')}>주말</button>
                    <button type="button" className="quick-day-btn" onClick={() => setDaysPreset('all')}>매일</button>
                  </div>
                </div>
                <div className="days-chips">
                  {DAY_VALUES.map((d, i) => (
                    <span key={d} id={`day-chip-${d}`} className={`day-chip${form.days.includes(d) ? ' selected' : ''}`} onClick={() => toggleDay(d)}>
                      {DAY_LABELS[i]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {form.repeatType === 'MONTHLY' && (
              <div className="form-group">
                <label className="form-label">발송 일자 (매월 지정일)</label>
                <select
                  id="sched-form-monthlyday"
                  className="form-input"
                  value={form.monthlyDay}
                  onChange={e => setForm(f => ({ ...f, monthlyDay: e.target.value }))}
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={String(day)}>매월 {day}일</option>
                  ))}
                  <option value="LAST">매월 말일 (해당 월의 마지막 날)</option>
                </select>
                <p className="field-hint">💡 28일/30일 달의 31일 설정 시 해당 월의 말일에 발송됩니다.</p>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">발송 시간</label>
              <input id="sched-form-time" className="form-input" type="time" value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} />
            </div>

            <div className="form-group">
              <label className="form-label">Webhook 선택</label>
              <select id="sched-form-webhook" className="form-input" value={form.webhookId} onChange={e => setForm(f => ({...f, webhookId: e.target.value}))}>
                {webhooks.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">발송 메시지</label>
              <textarea id="sched-form-message" className="form-input" placeholder="발송할 공지 메시지를 입력하세요" value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))} rows={4} />
            </div>

            <div className="form-group">
              <label className="form-label">발송 제외일 (휴일/특정일)</label>
              <div style={{ display:'flex', gap:8 }}>
                <input id="sched-form-exdate" className="form-input" type="date" value={newExDate} onChange={e => setNewExDate(e.target.value)} style={{ flex:1 }} />
                <button id="sched-form-exdate-add" className="btn btn-secondary btn-sm" onClick={addExDate}><Calendar size={14} />추가</button>
              </div>
              {form.excludedDates.length > 0 && (
                <div className="excluded-list">
                  {form.excludedDates.map(d => (
                    <span key={d} className="excluded-tag">
                      {d}
                      <button onClick={() => removeExDate(d)}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({...f, active: e.target.checked}))} style={{ width:16, height:16 }} />
                스케줄 활성화
              </label>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>취소</button>
              <button id="sched-form-save" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
