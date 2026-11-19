import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

const getMenuItems = (isAdmin) => [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { id: 'informes', label: isAdmin ? 'Informes' : 'Mis informes', icon: 'reports', to: '/informes' },
  ...(isAdmin
    ? [
        { id: 'usuarios', label: 'Usuarios', icon: 'users', to: '/usuarios' },
        { id: 'tiendas', label: 'Tiendas', icon: 'stores', to: '/tiendas' }
      ]
    : [])
];

export default function AppMenu({
  active,
  isAdmin = false,
  userName = '',
  onNavigate,
  onLogout,
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const originalOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);
  const navigateTo = (to) => {
    closeMenu();
    onNavigate?.(to);
  };
  const logout = () => {
    closeMenu();
    onLogout?.();
  };
  const menuItems = getMenuItems(isAdmin).filter((item) => item.id !== active);

  return (
    <>
      <button
        type="button"
        className="app-menu-trigger"
        aria-label="Abrir menú"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Icon name="menu" size={21} />
      </button>

      {open && createPortal(
        <div className="app-menu-backdrop" role="presentation" onMouseDown={closeMenu}>
          <aside
            className="app-menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menú principal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="app-menu-header">
              <div>
                <span className="app-menu-kicker">CUBICA PDF APP</span>
                {userName && <strong>{userName}</strong>}
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="app-menu-close"
                aria-label="Cerrar menú"
                onClick={closeMenu}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <nav className="app-menu-nav" aria-label="Navegación">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="app-menu-item"
                  disabled={disabled}
                  onClick={() => navigateTo(item.to)}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <button type="button" className="app-menu-logout" onClick={logout} disabled={disabled}>
              <Icon name="logout" size={18} />
              Cerrar sesión
            </button>
          </aside>
        </div>,
        document.body
      )}
    </>
  );
}
