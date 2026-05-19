import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Bell, Webhook, CalendarClock, LayoutDashboard, LogOut } from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Bell size={20} /></div>
          <div>
            <h2>ChatAlarm</h2>
            <p>강동어울림복지관</p>
          </div>
        </div>

        <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <LayoutDashboard className="nav-icon" size={18} />
          <span className="nav-label">대시보드</span>
        </NavLink>
        <NavLink to="/webhooks" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Webhook className="nav-icon" size={18} />
          <span className="nav-label">Webhook 관리</span>
        </NavLink>
        <NavLink to="/schedule" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <CalendarClock className="nav-icon" size={18} />
          <span className="nav-label">발송 예약</span>
        </NavLink>

        <div className="sidebar-spacer" />

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-team">{user.team}</div>
          </div>
        )}
        <button className="nav-item" onClick={handleLogout} style={{ marginTop: 6 }}>
          <LogOut className="nav-icon" size={18} />
          <span className="nav-label">로그아웃</span>
        </button>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
