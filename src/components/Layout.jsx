import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Bell, Webhook, CalendarClock, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Mobile Sticky Header */}
      <header className="mobile-header">
        <button className="menu-toggle" onClick={toggleMobileMenu} aria-label="메뉴 열기">
          <Menu size={24} />
        </button>
        <div className="mobile-header-logo">
          <div className="mobile-logo-icon"><Bell size={16} /></div>
          <span className="mobile-logo-text">ChatAlarm</span>
        </div>
        <div style={{ width: 32 }} /> {/* balance the header space */}
      </header>

      {/* Backdrop overlay for mobile menu */}
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={closeMobileMenu} />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><Bell size={20} /></div>
          <div>
            <h2>ChatAlarm</h2>
            <p>강동어울림복지관</p>
          </div>
          {/* Close button for mobile menu */}
          <button className="sidebar-close-btn" onClick={closeMobileMenu} aria-label="메뉴 닫기">
            <X size={20} />
          </button>
        </div>

        <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeMobileMenu}>
          <LayoutDashboard className="nav-icon" size={18} />
          <span className="nav-label">대시보드</span>
        </NavLink>
        <NavLink to="/webhooks" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeMobileMenu}>
          <Webhook className="nav-icon" size={18} />
          <span className="nav-label">Webhook 관리</span>
        </NavLink>
        <NavLink to="/schedule" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onClick={closeMobileMenu}>
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
        <button className="nav-item" onClick={() => { closeMobileMenu(); handleLogout(); }} style={{ marginTop: 6 }}>
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
