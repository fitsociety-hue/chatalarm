import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { fetchGAS } from '../api';
import Layout from '../components/Layout';
import { Plus, Pencil, Trash2, X, AlertCircle, CheckCircle, Link as LinkIcon } from 'lucide-react';

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

  const load = () => {
    setLoading(true); setError('');
    fetchGAS('getWebhooks', { userId: user.id })
      .then(res => setWebhooks(res.data || []))
      .catch(() => setError('Webhook 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (user) load(); }, [user]);

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
          <div className="webhook-list">
            {webhooks.map(item => (
              <div key={item.id} className="webhook-item">
                <div className="webhook-item-info">
                  <div className="webhook-name">{item.label}</div>
                  <div className="webhook-url">{item.url}</div>
                </div>
                <div className="webhook-actions">
                  <button id={`webhook-edit-${item.id}`} className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(item)} title="수정"><Pencil size={14} /></button>
                  <button id={`webhook-del-${item.id}`}  className="btn btn-danger  btn-sm btn-icon" onClick={() => handleDelete(item)} title="삭제"><Trash2 size={14} /></button>
                </div>
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
