import React, {useState} from 'react';
import {
  BarChart3,
  BookOpen,
  Calculator,
  ChefHat,
  Database,
  FileDown,
  Home,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  User,
  WifiOff,
  X,
} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {BloodDropEmblem, BrandLogo} from '../components/BrandMark';
import {PWAInstallButton} from '../components/PWAInstallPrompt';
import {cn} from '../components/ui/primitives';
import {useOnlineStatus} from '../hooks/useOnlineStatus';
import type {AppPage, AppSettings, UserProfile} from '../types';

interface AppShellProps {
  activePage: AppPage;
  onNavigate: (page: AppPage, options?: {openPdf?: boolean; mealType?: import('../types').MealType}) => void;
  settings: AppSettings;
  activeUser: UserProfile;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const SIDEBAR_ITEMS: Array<{
  id: AppPage;
  label: string;
  icon: React.ComponentType<{className?: string}>;
  openPdf?: boolean;
}> = [
  {id: 'dashboard', label: 'Início', icon: Home},
  {id: 'calculator', label: 'Contador de Carboidratos', icon: Calculator},
  {id: 'diary', label: 'Diário Alimentar', icon: BookOpen},
  {id: 'database', label: 'Banco de Alimentos', icon: Database},
  {id: 'reports', label: 'Histórico e Gráficos', icon: BarChart3},
  {id: 'recipes', label: 'Receitas e Favoritos', icon: ChefHat},
  {id: 'settings', label: 'Perfil e Configurações', icon: Settings},
];

const MOBILE_BOTTOM_TABS: Array<{
  id: AppPage;
  label: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'dashboard', label: 'Início', icon: Home},
  {id: 'calculator', label: 'Calculadora', icon: Calculator},
  {id: 'diary', label: 'Diário', icon: BookOpen},
  {id: 'reports', label: 'Relatórios', icon: BarChart3},
  {id: 'settings', label: 'Perfil', icon: User},
];

export const AppShell: React.FC<AppShellProps> = ({
  activePage,
  onNavigate,
  settings,
  activeUser,
  onToggleDarkMode,
  onLogout,
  children,
}) => {
  const isOnline = useOnlineStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--cc-bg-primary)] text-[var(--cc-text-primary)]">
      {/* Desktop Sidebar (matches Reference Image 2) */}
      <aside className="hidden lg:flex lg:w-[272px] lg:shrink-0 lg:flex-col lg:justify-between border-r border-[#650000]/45 bg-white dark:bg-[#0F0A0C] p-4 sticky top-0 h-screen">
        <div className="space-y-6">
          <div className="px-2 pt-1">
            <BrandLogo size="md" showTagline />
          </div>

          <nav aria-label="Navegação principal" className="space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors text-left cursor-pointer',
                    isActive
                      ? 'text-zinc-950 dark:text-white'
                      : 'text-zinc-600 dark:text-[#B5B5B5] hover:bg-[#B00020]/10 hover:text-zinc-950 dark:hover:text-white'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      transition={{type: 'spring', stiffness: 420, damping: 34}}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#B00020]/25 to-[#650000]/15 dark:from-[#B00020]/40 dark:to-[#650000]/20 border border-[#FF243D]/45 shadow-[0_0_16px_-6px_rgba(255,36,61,0.5)]"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={cn(
                      'relative z-10 w-4 h-4 shrink-0 transition-transform duration-150',
                      isActive
                        ? 'text-[#FF243D] scale-110'
                        : 'text-zinc-500 dark:text-[#9A9A9A]'
                    )}
                  />
                  <span className="relative z-10 truncate">{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onNavigate('reports', {openPdf: true})}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-zinc-600 dark:text-[#B5B5B5] hover:bg-[#B00020]/10 hover:text-zinc-950 dark:hover:text-white border border-transparent transition-all text-left cursor-pointer group"
            >
              <FileDown className="w-4 h-4 shrink-0 text-[#FF243D] group-hover:translate-y-0.5 transition-transform" />
              <span className="truncate">Exportar PDF</span>
            </button>
          </nav>
        </div>

        <div className="space-y-3">
          <PWAInstallButton compact />

          <div className="rounded-xl border border-[#650000]/50 bg-rose-50 dark:bg-[#1A1013] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-white">
              {isOnline ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{isOnline ? 'Modo Offline Pronto' : 'Operando Offline'}</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-[#B5B5B5] mt-1 leading-snug">
              Perfil ativo: <strong className="text-[#FF243D]">{activeUser.displayName}</strong> ·
              Base local ativa.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Top App Bar (matches Reference Image 1) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 border-b border-[#650000]/45 bg-white/95 dark:bg-[#0D0D0D]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir menu de módulos"
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-[#B00020]/20 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <BloodDropEmblem size={24} />
          <span className="text-lg font-bold tracking-tight">
            <span className="text-zinc-900 dark:text-white">Carb</span>
            <span className="text-[#FF243D]">Control</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          aria-label="Abrir Perfil e Configurações"
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-[#B00020]/20 cursor-pointer"
        >
          {activeUser.avatarDataUrl ? (
            <img
              src={activeUser.avatarDataUrl}
              alt={activeUser.displayName}
              className="w-7 h-7 rounded-full object-cover border border-[#FF243D]"
            />
          ) : (
            <Settings className="w-5 h-5" />
          )}
        </button>
      </header>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.18}}
              className="fixed inset-0 bg-black/75 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{x: '-100%'}}
              animate={{x: 0}}
              exit={{x: '-100%'}}
              transition={{duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
              className="relative z-10 w-72 max-w-[85vw] bg-[#120D0F] border-r border-[#650000]/60 p-4 flex flex-col justify-between text-white"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <BrandLogo size="sm" />
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Fechar menu"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-[#B00020]/20"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {SIDEBAR_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigate(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-left transition-colors',
                          active
                            ? 'bg-[#B00020]/30 text-white border border-[#FF243D]/40'
                            : 'text-[#B5B5B5] hover:bg-[#B00020]/15 hover:text-white'
                        )}
                      >
                        <Icon className="w-4 h-4 text-[#FF243D]" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-3 border-t border-[#650000]/40 pt-4">
                <PWAInstallButton compact />
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#650000]/60 py-2 text-xs font-semibold text-[#FF243D] hover:bg-[#B00020]/15"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Trocar Perfil / Sair</span>
                </button>
                <p className="text-[11px] text-[#B5B5B5]">
                  {isOnline ? 'Armazenamento 100% local' : 'Operando em modo offline'}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-8">
        {/* Desktop subtle top utility strip (matches Reference Image 2 top right) */}
        <div className="hidden lg:flex items-center justify-between px-8 pt-5 pb-2">
          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-[#B5B5B5]">
            {!isOnline && (
              <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                Offline — base local ativa
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={
                settings.darkMode
                  ? 'Alternar para tema claro'
                  : 'Alternar para tema escuro'
              }
              className="min-h-[36px] px-3 rounded-xl border border-[#650000]/50 bg-white dark:bg-[#151515] flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-[#D4D4D8] hover:border-[#FF243D]/60 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              {settings.darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tema Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#FF243D]" />
                  <span>Tema Sukuna</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="min-h-[36px] px-3.5 rounded-xl border border-[#650000]/50 bg-rose-50 dark:bg-[#1A1013] flex items-center gap-2 text-xs font-medium text-zinc-900 dark:text-white hover:border-[#FF243D]/60 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              {activeUser.avatarDataUrl ? (
                <img
                  src={activeUser.avatarDataUrl}
                  alt={activeUser.displayName}
                  className="w-5 h-5 rounded-full object-cover border border-[#FF243D]"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-[#FF243D]" />
              )}
              <span>
                {activeUser.displayName}
                {activeUser.diabetesType ? ` · ${activeUser.diabetesType}` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              title="Trocar perfil ou sair"
              aria-label="Trocar perfil ou sair"
              className="min-h-[36px] px-2.5 rounded-xl border border-[#650000]/50 bg-white dark:bg-[#151515] flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-[#D4D4D8] hover:border-[#FF243D]/60 hover:text-[#FF243D] transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 lg:px-8 lg:py-4 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{opacity: 0, y: 8}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -4}}
              transition={{duration: 0.17, ease: [0.16, 1, 0.3, 1]}}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar (matches Reference Image 1) */}
      <nav
        aria-label="Navegação inferior"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-[#650000]/50 bg-white/95 dark:bg-[#0D0D0D]/95 backdrop-blur-md grid grid-cols-5 items-center px-1"
      >
        {MOBILE_BOTTOM_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 min-h-[48px] rounded-xl transition-colors cursor-pointer',
                isActive
                  ? 'text-[#FF243D]'
                  : 'text-zinc-500 dark:text-[#9A9A9A] hover:text-zinc-900 dark:hover:text-white'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  transition={{type: 'spring', stiffness: 450, damping: 32}}
                  className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-[#FF243D] shadow-[0_0_8px_rgba(255,36,61,0.85)]"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={cn(
                  'w-5 h-5 transition-transform duration-150',
                  isActive && 'scale-110 drop-shadow-[0_0_8px_rgba(255,36,61,0.65)]'
                )}
              />
              <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
