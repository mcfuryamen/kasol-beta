import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { Navbar } from './sections/Navbar';
import { Hero } from './sections/Hero';
import { StatsBar } from './sections/StatsBar';
import { About } from './sections/About';
import { Programs } from './sections/Programs';
import { Team } from './sections/Team';
import { Registration } from './sections/Registration';
import { Ecosystem } from './sections/Ecosystem';
import { Contact } from './sections/Contact';
import { Footer } from './sections/Footer';
import { LoginModal } from './sections/LoginModal';

export function Portal() {
  const [showLogin, setShowLogin] = useState(false);
  const [loginRole, setLoginRole] = useState<string>('admin');

  const openLogin = (role?: string) => {
    if (role) setLoginRole(role);
    setShowLogin(true);
  };

  return (
    <div class="min-h-screen">
      <Navbar onLogin={() => openLogin()} />
      <Hero onGetStarted={() => openLogin()} />
      <StatsBar />
      <About />
      <Programs />
      <Team />
      <Registration />
      <Ecosystem onSelectRole={(role) => openLogin(role)} />
      <Contact />
      <Footer />
      <LoginModal
        isOpen={showLogin}
        defaultRole={loginRole}
        onClose={() => setShowLogin(false)}
      />
    </div>
  );
}
