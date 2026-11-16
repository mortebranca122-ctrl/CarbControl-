import React, {useEffect, useState} from 'react';
import {MotionConfig} from 'motion/react';
import {useLiveQuery} from 'dexie-react-hooks';
import {AppShell} from './app/AppShell';
import {AuthScreen} from './app/AuthScreen';
import {PinLockScreen} from './app/PinLockScreen';
import {SplashScreen} from './app/SplashScreen';
import {Button, Input, Modal, Select} from './components/ui/primitives';
import {
  DEFAULT_SETTINGS,
  initializeDatabase,
  makeDefaultSettingsForUser,
} from './database/migrations';
import {db, DEFAULT_USER_ID} from './database/schema';
import {SEED_USER_PROFILES} from './database/seed';
import {CalculatorPage} from './pages/Calculator/CalculatorPage';
import {DashboardPage} from './pages/Dashboard/DashboardPage';
import {FoodDatabasePage} from './pages/FoodDatabase/FoodDatabasePage';
import {FoodDiaryPage} from './pages/FoodDiary/FoodDiaryPage';
import {HistoryReportsPage} from './pages/History/HistoryReportsPage';
import {RecipesPage} from './pages/Recipes/RecipesPage';
import {SettingsPage} from './pages/Settings/SettingsPage';
import {glucoseInputSchema} from './services/validation';
import type {
  AppPage,
  AppSettings,
  GlucoseContext,
  MealType,
  UserProfile,
} from './types';
import {getCurrentTimeHHmm, getTodayIsoDate} from './utils/date';
import {
  generateId,
  GLUCOSE_CONTEXT_LABELS,
  MEAL_TYPE_LABELS,
  MEAL_TYPE_ORDER,
} from './utils/format';
import {
  getStoredActiveUserId,
  setStoredActiveUserId,
} from './utils/profile';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const [isAutostart] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('autostart') === '1';
    }
    return false;
  });
  const [showSplash, setShowSplash] = useState(() => !isAutostart);
  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    const stored = getStoredActiveUserId();
    if (stored) return stored;
    return isAutostart ? DEFAULT_USER_ID : null;
  });
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayIsoDate());
  const [activeMealType, setActiveMealType] = useState<MealType>('almoco');
  const [calculatorFoodId, setCalculatorFoodId] = useState<string | undefined>(
    undefined
  );

  // Quick Glucose Modal from Dashboard
  const [quickGlucoseOpen, setQuickGlucoseOpen] = useState(false);
  const [qgVal, setQgVal] = useState('');
  const [qgTime, setQgTime] = useState(getCurrentTimeHHmm());
  const [qgContext, setQgContext] = useState<GlucoseContext>('antes_refeicao');
  const [qgMeal, setQgMeal] = useState<MealType>('almoco');
  const [qgError, setQgError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setDbError(null);
    void initializeDatabase()
      .then(() => {
        if (mounted) setDbReady(true);
      })
      .catch((err) => {
        if (mounted) {
          setDbError(
            err instanceof Error
              ? err.message
              : 'Não foi possível inicializar o armazenamento local do aplicativo.'
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [initAttempt]);

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => setShowSplash(false), 900);
    return () => clearTimeout(timer);
  }, [showSplash]);

  const allUsers = useLiveQuery(
    () => (dbReady ? db.users.orderBy('createdAt').toArray() : []),
    [dbReady],
    [] as UserProfile[]
  );

  const activeUserQuery = useLiveQuery(
    async () => {
      if (!dbReady) return undefined;
      if (!activeUserId) return {userId: null as string | null, user: null as UserProfile | null};
      const user = await db.users.get(activeUserId);
      return {userId: activeUserId, user: user ?? null};
    },
    [dbReady, activeUserId],
    undefined
  );

  const activeUserLoadedForCurrentId =
    activeUserQuery !== undefined && activeUserQuery.userId === activeUserId;
  const activeUserRecord = activeUserLoadedForCurrentId
    ? activeUserQuery.user
    : undefined;

  useEffect(() => {
    if (
      dbReady &&
      activeUserId &&
      activeUserLoadedForCurrentId &&
      activeUserRecord === null &&
      !isAutostart
    ) {
      setStoredActiveUserId(null);
      setActiveUserId(null);
      setSessionUser(null);
    }
  }, [
    dbReady,
    activeUserId,
    activeUserLoadedForCurrentId,
    activeUserRecord,
    isAutostart,
  ]);

  const settingsRecord = useLiveQuery(
    () =>
      dbReady && activeUserId
        ? db.settings.get(`settings_${activeUserId}`)
        : undefined,
    [dbReady, activeUserId],
    undefined
  );

  const activeUser: UserProfile | null =
    activeUserRecord ??
    (activeUserId && sessionUser?.id === activeUserId
      ? sessionUser
      : activeUserId && isAutostart
      ? SEED_USER_PROFILES[0]
      : null);

  const settings: AppSettings =
    settingsRecord ??
    (activeUser ? makeDefaultSettingsForUser(activeUser) : DEFAULT_SETTINGS);

  // Sync Tailwind dark & high-contrast classes with user settings
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
    document.documentElement.classList.toggle(
      'high-contrast',
      Boolean(activeUser?.highContrastMode)
    );
  }, [settings.darkMode, activeUser?.highContrastMode]);

  const handleSelectUser = (user: UserProfile) => {
    setStoredActiveUserId(user.id);
    setSessionUser(user);
    setActiveUserId(user.id);
    setUnlocked(false);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    setStoredActiveUserId(null);
    setSessionUser(null);
    setActiveUserId(null);
    setUnlocked(false);
  };

  const updateSettings = async (patch: Partial<AppSettings>) => {
    if (!activeUser) return;
    const settingsId = `settings_${activeUser.id}`;
    const current =
      (await db.settings.get(settingsId)) ?? makeDefaultSettingsForUser(activeUser);
    const nowIso = new Date().toISOString();
    await db.transaction('rw', db.settings, db.users, async () => {
      await db.settings.put({
        ...current,
        ...patch,
        id: settingsId,
        userId: activeUser.id,
        updatedAt: nowIso,
      });
      await db.users.update(activeUser.id, {
        ...(patch.userName !== undefined ? {displayName: patch.userName} : {}),
        ...(patch.diabetesLabel !== undefined
          ? {diabetesType: patch.diabetesLabel}
          : {}),
        ...(patch.darkMode !== undefined ? {darkMode: patch.darkMode} : {}),
        ...(patch.preferredUnit !== undefined
          ? {preferredUnit: patch.preferredUnit}
          : {}),
        ...(patch.pinEnabled !== undefined ? {pinEnabled: patch.pinEnabled} : {}),
        ...(patch.pinHash !== undefined ? {pinHash: patch.pinHash} : {}),
        ...(patch.pinSalt !== undefined ? {pinSalt: patch.pinSalt} : {}),
        updatedAt: nowIso,
      });
    });
  };

  const updateActiveUser = async (patch: Partial<UserProfile>) => {
    if (!activeUser) return;
    const nowIso = new Date().toISOString();
    const updatedUser: UserProfile = {
      ...activeUser,
      ...patch,
      updatedAt: nowIso,
    };
    await db.transaction('rw', db.users, db.settings, async () => {
      await db.users.put(updatedUser);
      const settingsId = `settings_${activeUser.id}`;
      const existingSettings =
        (await db.settings.get(settingsId)) ?? makeDefaultSettingsForUser(updatedUser);
      await db.settings.put({
        ...existingSettings,
        userName: updatedUser.displayName,
        diabetesLabel: updatedUser.diabetesType || 'Acompanhamento Pessoal',
        darkMode: updatedUser.darkMode,
        preferredUnit: updatedUser.preferredUnit,
        pinEnabled: updatedUser.pinEnabled,
        pinHash: updatedUser.pinHash,
        pinSalt: updatedUser.pinSalt,
        updatedAt: nowIso,
      });
    });
  };

  const handleNavigate = (
    page: AppPage,
    options?: {openPdf?: boolean; mealType?: MealType}
  ) => {
    if (options?.mealType) {
      setActiveMealType(options.mealType);
      setSelectedDate(getTodayIsoDate());
    }
    setActivePage(page);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleSaveQuickGlucose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    setQgError(null);
    const parsed = glucoseInputSchema.safeParse({
      date: getTodayIsoDate(),
      time: qgTime,
      valueMgDl: Number(qgVal),
      context: qgContext,
      mealType: qgMeal,
    });
    if (!parsed.success) {
      setQgError(parsed.error.issues[0]?.message || 'Informe um valor válido.');
      return;
    }
    await db.glucose_records.put({
      id: generateId('glc'),
      userId: activeUser.id,
      ...parsed.data,
      createdAt: new Date().toISOString(),
    });
    setQgVal('');
    setQuickGlucoseOpen(false);
  };

  if (dbError) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full sukuna-panel rounded-2xl p-6 space-y-4 text-center">
          <h1 className="text-xl font-extrabold text-[#FF243D]">
            Falha ao abrir banco local
          </h1>
          <p className="text-xs text-[#D4D4D8] leading-relaxed">{dbError}</p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              className="flex-1"
              onClick={() => setInitAttempt((n) => n + 1)}
            >
              Tentar Novamente
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                void db.delete().then(() => setInitAttempt((n) => n + 1));
              }}
            >
              Reiniciar Banco Local
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (
    showSplash ||
    !dbReady ||
    (activeUserId && !activeUser && !activeUserLoadedForCurrentId && !isAutostart)
  ) {
    return <SplashScreen dbReady={dbReady} onSkip={() => setShowSplash(false)} />;
  }

  if (!activeUser) {
    return <AuthScreen users={allUsers} onAuthenticated={handleSelectUser} />;
  }

  if (settings.pinEnabled && settings.pinHash && settings.pinSalt && !unlocked) {
    return (
      <PinLockScreen
        pinHash={settings.pinHash}
        pinSalt={settings.pinSalt}
        userName={activeUser.displayName}
        onUnlock={() => setUnlocked(true)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <AppShell
        activePage={activePage}
        onNavigate={handleNavigate}
        settings={settings}
        activeUser={activeUser}
        onToggleDarkMode={() => void updateSettings({darkMode: !settings.darkMode})}
        onLogout={handleLogout}
      >
      {activePage === 'dashboard' && (
        <DashboardPage
          activeUser={activeUser}
          onNavigate={handleNavigate}
          onOpenQuickGlucose={() => {
            setQgTime(getCurrentTimeHHmm());
            setQgError(null);
            setQuickGlucoseOpen(true);
          }}
        />
      )}

      {activePage === 'calculator' && (
        <CalculatorPage
          userId={activeUser.id}
          initialFoodId={calculatorFoodId}
          initialMealType={activeMealType}
          initialDate={selectedDate}
          onBack={() => handleNavigate('dashboard')}
          onSavedToDiary={(date, mealType) => {
            setSelectedDate(date);
            setActiveMealType(mealType);
            handleNavigate('diary');
          }}
        />
      )}

      {activePage === 'diary' && (
        <FoodDiaryPage
          activeUser={activeUser}
          selectedDate={selectedDate}
          onChangeDate={setSelectedDate}
          activeMealType={activeMealType}
          onChangeMealType={setActiveMealType}
          onOpenCalculatorForMeal={(mealType, date) => {
            setActiveMealType(mealType);
            setSelectedDate(date);
            handleNavigate('calculator');
          }}
        />
      )}

      {activePage === 'database' && (
        <FoodDatabasePage
          onUseFoodInCalculator={(foodId) => {
            setCalculatorFoodId(foodId);
            handleNavigate('calculator');
          }}
        />
      )}

      {activePage === 'reports' && (
        <HistoryReportsPage
          activeUser={activeUser}
          onBack={() => handleNavigate('dashboard')}
        />
      )}

      {activePage === 'recipes' && (
        <RecipesPage
          userId={activeUser.id}
          onBack={() => handleNavigate('dashboard')}
          onUsedInDiary={(date, mealType) => {
            setSelectedDate(date);
            setActiveMealType(mealType);
            handleNavigate('diary');
          }}
        />
      )}

      {activePage === 'settings' && (
        <SettingsPage
          activeUser={activeUser}
          allUsers={allUsers}
          settings={settings}
          onBack={() => handleNavigate('dashboard')}
          onUpdateSettings={updateSettings}
          onUpdateUser={updateActiveUser}
          onSwitchUser={handleSelectUser}
          onLogout={handleLogout}
        />
      )}

      {/* Quick Glucose Modal */}
      <Modal
        open={quickGlucoseOpen}
        onClose={() => setQuickGlucoseOpen(false)}
        title="Registrar Glicemia de Hoje"
        subtitle="Registro manual de acompanhamento"
      >
        <form onSubmit={handleSaveQuickGlucose} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Valor (mg/dL) *</label>
              <Input
                type="number"
                value={qgVal}
                onChange={(e) => setQgVal(e.target.value)}
                placeholder="Ex: 112"
              />
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Horário *</label>
              <Input
                type="time"
                value={qgTime}
                onChange={(e) => setQgTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Contexto</label>
              <Select
                value={qgContext}
                onChange={(e) => setQgContext(e.target.value as GlucoseContext)}
              >
                {Object.entries(GLUCOSE_CONTEXT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#B5B5B5] block mb-1">Refeição</label>
              <Select
                value={qgMeal}
                onChange={(e) => setQgMeal(e.target.value as MealType)}
              >
                {MEAL_TYPE_ORDER.map((mt) => (
                  <option key={mt} value={mt}>
                    {MEAL_TYPE_LABELS[mt]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {qgError && <p className="text-xs text-red-400">{qgError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setQuickGlucoseOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Glicemia</Button>
          </div>
        </form>
      </Modal>
      </AppShell>
    </MotionConfig>
  );
}
