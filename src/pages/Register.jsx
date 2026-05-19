import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchGAS } from '../api';
import { Bell, AlertCircle, CheckCircle } from 'lucide-react';
import PinInput from '../components/PinInput';

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !team.trim()) { setError('이름과 팀명을 입력해 주세요.'); return; }
    if (pin.length < 4) { setError('비밀번호 4자리를 모두 입력해 주세요.'); return; }
    if (pin !== pinConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetchGAS('register', { name: name.trim(), team: team.trim(), pin: pin });
      if (res.success) {
        setSuccess('회원가입이 완료되었습니다! 로그인 화면으로 이동합니다.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(res.message || '이미 등록된 사용자이거나 오류가 발생했습니다.');
      }
    } catch {
      setError('서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-layout page-wrapper">
      <div className="auth-card glass-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><Bell size={22} /></div>
          <div className="auth-logo-text">
            <h1>ChatAlarm</h1>
            <p>강동어울림복지관</p>
          </div>
        </div>

        <h2 className="auth-title">회원가입</h2>
        <p className="auth-subtitle">신규 계정을 생성하세요</p>

        {error && <div className="alert alert-error"><AlertCircle size={16} style={{ flexShrink:0, marginTop:1 }} />{error}</div>}
        {success && <div className="alert alert-success"><CheckCircle size={16} style={{ flexShrink:0, marginTop:1 }} />{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">이름</label>
            <input id="reg-name" className="form-input" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">소속 팀명</label>
            <input id="reg-team" className="form-input" placeholder="복지팀" value={team} onChange={e => setTeam(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">비밀번호 (숫자 4자리)</label>
            <PinInput value={pin} onChange={setPin} idPrefix="reg-pin" />
          </div>
          <div className="form-group">
            <label className="form-label">비밀번호 확인</label>
            <PinInput value={pinConfirm} onChange={setPinConfirm} idPrefix="reg-pinc" />
          </div>

          <button id="reg-submit" type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <span className="spinner" /> : '가입하기'}
          </button>
        </form>

        <div className="auth-link-row">
          이미 계정이 있으신가요?<Link to="/login">로그인</Link>
        </div>
      </div>
    </div>
  );
}
