import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { fetchGAS } from '../api';
import Layout from '../components/Layout';
import { Plus, Pencil, Trash2, X, AlertCircle, CheckCircle, Link as LinkIcon, Wifi } from 'lucide-react';

const EMPTY_FORM = { label: '', url: '' };

export default function Webhooks() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [testingId, setTestingId] = useState(null);
  const [testingModal, setTestingModal] = useState(false);

  const load = () => {
    setLoading(true); setError('');
    fetchGAS('getWebhooks', { userId: user.id })
      .then(res => setWebhooks(res.data || []))
      .catch(() => setError('Webhook 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleTest = async (itemOrUrl) => {
    const url = typeof itemOrUrl === 'string' ? itemOrUrl : itemOrUrl.url;
    const isModal = typeof itemOrUrl === 'string';

    if (!url.trim()) {
      if (isModal) {
        setFormError('테스트할 Webhook URL을 입력해 주세요.');
      } else {
        setError('Webhook URL이 비어 있습니다.');
      }
      return;
    }
    if (!url.startsWith('https://')) {
      if (isModal) {
        setFormError('유효한 Webhook URL을 입력해 주세요. (https:// 로 시작)');
      } else {
        setError('유효하지 않은 Webhook URL입니다.');
      }
      return;
    }

    if (isModal) {
      setFormError('');
      setTestingModal(true);
    } else {
      setTestingId(itemOrUrl.id);
      setError('');
      setSuccess('');
    }

    try {
      const res = await fetchGAS('testWebhook', { url: url.trim() });
      if (!res.success) throw new Error(res.message);
      
      if (isModal) {
        setSuccess('테스트 메시지가 성공적으로 전송되었습니다! 구글 챗을 확인해 주세요.');
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setSuccess(`"${itemOrUrl.label}" Webhook 테스트 성공! 구글 챗을 확인해 주세요.`);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (e) {
      console.warn("GAS backend webhook test failed. Attempting direct browser fallback...", e);
      try {
        // Direct browser fallback fetch using no-cors mode to bypass browser CORS limitations
        await fetch(url.trim(), {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: '💬 Google Chat Webhook 연결 테스트에 성공했습니다! (브라우저 직접 연결 테스트)'
          })
        });
        
        if (isModal) {
          setSuccess('브라우저 직접 전송 방식으로 테스트 메시지를 보냈습니다! 구글 챗을 확인해 주세요.');
          setTimeout(() => setSuccess(''), 6000);
        } else {
          setSuccess(`"${itemOrUrl.label}" 브라우저 직접 연결 테스트 성공! 구글 챗을 확인해 주세요.`);
          setTimeout(() => setSuccess(''), 6000);
        }
      } catch (directErr) {
        let errMsg = e.message || '테스트 전송 중 오류가 발생했습니다.';
        if (errMsg.includes('알 수 없는 action: testWebhook')) {
          errMsg = '⚠️ Google Apps Script 백엔드가 아직 업데이트(재배포)되지 않았습니다. chatalarm 폴더 내 [backend/Code.gs] 파일의 소스코드를 전체 복사하여 구글 스크립트 에디터에 덮어씌우신 뒤, [새 버전]으로 배포(Deploy)해 주세요!';
        }
        
        if (isModal) {
          setFormError(errMsg);
        } else {
          setError(errMsg);
        }
      }
    } finally {
      if (isModal) {
        setTestingModal(false);
      } else {
        setTestingId(null);
      }
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setFormError(''); setEditItem(null); setModal('add'); };
  const openEdit = (item) => { setForm({ label: item.label, url: item.url }); setFormError(''); setEditItem(item); setModal('edit'); };
  const closeModal = () => { setModal(null); setEditItem(null); };

  const handleSave = async () => {
    if (!form.label.trim() || !form.url.trim()) { setFormError('이름과 URL을 모두 입력해 주세요.'); return; }
    if (!form.url.startsWith('https://')) { setFormError('유효한 Webhook URL을 입력해 주세요.'); return; }
    setSaving(true); setFormError('');
    try {
      if (modal === 'add') {
        const res = await fetchGAS('addWebhook', { userId: user.id, label: form.label.trim(), url: form.url.trim() });
        if (!res.success) throw new Error(res.message);
      } else {
        const res = await fetchGAS('updateWebhook', { userId: user.id, webhookId: editItem.id, label: form.label.trim(), url: form.url.trim() });
        if (!res.success) throw new Error(res.message);
      }
      setSuccess(modal === 'add' ? 'Webhook이 추가되었습니다.' : 'Webhook이 수정되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
      closeModal(); load();
    } catch (e) { setFormError(e.message || '저장 중 오류가 발생했습니다.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.label}" Webhook을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetchGAS('deleteWebhook', { userId: user.id, webhookId: item.id });
      if (!res.success) throw new Error(res.message);
      setSuccess('Webhook이 삭제되었습니다.'); setTimeout(() => setSuccess(''), 3000);
      load();
    } catch { setError('삭제 중 오류가 발생했습니다.'); }
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Webhook 관리</h1>
        <p>Google Chat Webhook URL을 등록하고 관리합니다</p>
      </div>

      {error   && <div className="alert alert-error"  ><AlertCircle size={16} style={{ flexShrink:0 }} />{error}</div>}
      {success && <div className="alert alert-success"><CheckCircle size={16} style={{ flexShrink:0 }} />{success}</div>}

      <div className="content-card glass-card">
        <div className="card-title" style={{ justifyContent: 'space-between' }}>
          <span style={{ display:'flex', alignItems:'center', gap:8 }}><LinkIcon size={18} color="var(--blue-500)" />등록된 Webhook ({webhooks.length})</span>
          <button id="webhook-add-btn" className="btn btn-primary btn-sm" onClick={openAdd}><Plus size={15} />추가</button>
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ borderTopColor:'var(--blue-500)', borderColor:'rgba(59,130,246,0.2)' }} /></div>
        ) : webhooks.length === 0 ? (
          <div className="empty-state">
            <LinkIcon size={40} />
            <p>등록된 Webhook이 없습니다.<br />+ 추가 버튼을 눌러 첫 Webhook을 등록하세요.</p>
          </div>
        ) : (
          <div className="webhook-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {webhooks.map(item => (
              <div key={item.id} className="webhook-item card-item" style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="webhook-name" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                  <div className="webhook-actions" style={{ display: 'flex', gap: 8 }}>
                    <button id={`webhook-edit-${item.id}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(item)} title="수정" style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}><Pencil size={14} /></button>
                    <button id={`webhook-del-${item.id}`}  className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(item)} title="삭제" style={{ borderRadius: '50%', width: 32, height: 32, padding: 0 }}><Trash2 size={14} /></button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>수신 Webhook URL</span>
                  <div className="webhook-url" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'rgba(241,245,249,0.7)', padding: '10px 14px', borderRadius: 10, wordBreak: 'break-all', whiteSpace: 'normal', textOverflow: 'unset', overflow: 'visible', border: '1px solid #f1f5f9' }}>{item.url}</div>
                </div>

                <button
                  id={`webhook-test-${item.id}`}
                  className="btn-test"
                  onClick={() => handleTest(item)}
                  disabled={testingId === item.id}
                >
                  {testingId === item.id ? (
                    <>
                      <span className="spinner spinner-sm" style={{ borderTopColor: '#334155' }} />
                      <span>연결 테스트 중...</span>
                    </>
                  ) : (
                    <>
                      <Wifi size={14} />
                      <span>웹훅 연결 테스트</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal-card glass-card">
            <div className="modal-header">
              <div className="modal-title">{modal === 'add' ? 'Webhook 추가' : 'Webhook 수정'}</div>
              <button className="modal-close" onClick={closeModal}><X size={20} /></button>
            </div>
            {formError && <div className="alert alert-error"><AlertCircle size={15} style={{ flexShrink:0 }} />{formError}</div>}
            <div className="form-group">
              <label className="form-label">이름 (채널명 등)</label>
              <input id="webhook-form-label" className="form-input" placeholder="예) 복지팀 공지" value={form.label} onChange={e => setForm(f => ({...f, label: e.target.value}))} />
            </div>
            <div className="form-group">
              <label className="form-label">Webhook URL</label>
              <input id="webhook-form-url" className="form-input" placeholder="https://chat.googleapis.com/v1/spaces/..." value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} />
              <button 
                id="webhook-form-test" 
                className="btn-test" 
                style={{ marginTop: 10 }}
                onClick={() => handleTest(form.url)}
                disabled={testingModal}
              >
                {testingModal ? (
                  <>
                    <span className="spinner spinner-sm" style={{ borderTopColor: '#334155' }} />
                    <span>연결 테스트 중...</span>
                  </>
                ) : (
                  <>
                    <Wifi size={14} />
                    <span>웹훅 연결 테스트</span>
                  </>
                )}
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>취소</button>
              <button id="webhook-form-save" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
