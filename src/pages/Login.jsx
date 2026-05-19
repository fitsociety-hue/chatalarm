import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { fetchGAS } from '../api';
import { Bell, AlertCircle } from 'lucide-react';
import PinInput from '../components/PinInput';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !team.trim() || pin.length < 4) {
      setError('모든 항목을 입력해 주세요.'); return;
    }
    setError(''); setLoading(true);
    try {
      const res = await fetchGAS('login', { name: name.trim(), team: team.trim(), pin: pin });
      if (res.success) {
        login({ name: res.name || name.trim(), team: res.team || team.trim(), id: res.id });
        navigate('/dashboard');
      } else {
        setError(res.message || '이름, 팀명 또는 비밀번호가 일치하지 않습니다.');
      }
    } catch (err) {
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

        <h2 className="auth-title">로그인</h2>
        <p className="auth-subtitle">등록된 계정으로 로그인하세요</p>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">이름</label>
            <input id="login-name" className="form-input" placeholder="홍길동" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="form-group">
            <label className="form-label">소속 팀명</label>
            <input id="login-team" className="form-input" placeholder="복지팀" value={team} onChange={e => setTeam(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">비밀번호 (숫자 4자리)</label>
            <PinInput value={pin} onChange={setPin} idPrefix="login-pin" />
          </div>

          <button id="login-submit" type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <span className="spinner" /> : '로그인'}
          </button>
        </form>

        <div className="auth-link-row">
          계정이 없으신가요?<Link to="/register">회원가입</Link>
        </div>
      </div>
    </div>
  );
}
