'use client';

import {useEffect, useState} from 'react';
import {CheckCircle2, Download, Smartphone, X} from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform?: string}>;
}

declare global {
  interface Window {
    __vezoraInstallPrompt?: InstallPromptEvent | null;
  }
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & {standalone?: boolean}).standalone);
}

type Platform = 'ios' | 'android' | 'desktop';

export default function InstallApp({welcome = false, userId = 'guest'}: {welcome?: boolean; userId?: string}) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [platform, setPlatform] = useState<Platform>('desktop');

  useEffect(() => {
    const standalone = isStandalone();
    const installationKey = 'vezora:pwa:installed';
    const reminderKey = `vezora:pwa:last-reminder:${userId}`;
    if (standalone) localStorage.setItem(installationKey, '1');
    // Se o navegador voltou a oferecer a instalação, um marcador antigo pode estar obsoleto.
    if (!standalone && window.__vezoraInstallPrompt) localStorage.removeItem(installationKey);
    const knownInstalled = localStorage.getItem(installationKey) === '1';
    setInstalled(standalone || knownInstalled);
    if (!standalone && !knownInstalled) {
      const lastReminder = Number(localStorage.getItem(reminderKey)||'0');
      // Reoferecer após 24 h, evitando interromper cada navegação.
      if (welcome || !lastReminder || Date.now()-lastReminder >= 24*60*60*1000) {
        setVisible(true);
        localStorage.setItem(reminderKey, String(Date.now()));
      }
    }

    const agent = navigator.userAgent;
    if (/iPad|iPhone|iPod/i.test(agent)) setPlatform('ios');
    else if (/Android/i.test(agent)) setPlatform('android');
    else setPlatform('desktop');

    // O evento pode ocorrer antes de o React montar a página de boas-vindas.
    // app/layout.tsx registra um listener antecipado e guarda o evento para este botão.
    if (window.__vezoraInstallPrompt) setPromptEvent(window.__vezoraInstallPrompt);

    const onReady = (event: Event) => {
      event.preventDefault();
      const previouslyInstalled = localStorage.getItem('vezora:pwa:installed') === '1';
      localStorage.removeItem('vezora:pwa:installed');
      setInstalled(false);
      if (previouslyInstalled) setVisible(true);
      setPromptEvent(event as InstallPromptEvent);
      setFeedback('');
    };
    const onEarlyReady = () => {
      if (window.__vezoraInstallPrompt) {
        localStorage.removeItem('vezora:pwa:installed');
        setInstalled(false);
        setPromptEvent(window.__vezoraInstallPrompt);
      }
    };
    const onInstalled = () => {
      window.__vezoraInstallPrompt = null;
      setPromptEvent(null);
      localStorage.setItem('vezora:pwa:installed','1');
      setInstalled(true);
      setVisible(false);
      setShowManual(false);
    };
    window.addEventListener('beforeinstallprompt', onReady);
    window.addEventListener('vezora:install-ready', onEarlyReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onReady);
      window.removeEventListener('vezora:install-ready', onEarlyReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [welcome, userId]);

  useEffect(() => {
    if (!visible) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [visible]);

  async function install() {
    if (installing || isStandalone()) return;
    const event = promptEvent ?? window.__vezoraInstallPrompt;
    if (!event) {
      // Chrome, Safari e iOS nem sempre disponibilizam a instalação por JavaScript.
      // Neste caso, o botão abre um guia real em vez de prometer uma instalação falsa.
      setShowManual(true);
      setVisible(true);
      setFeedback('A instalação automática não está disponível neste navegador agora. Use o passo a passo abaixo.');
      return;
    }
    setInstalling(true);
    setFeedback('');
    setPromptEvent(null);
    window.__vezoraInstallPrompt = null; // beforeinstallprompt pode ser utilizado uma única vez.
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
      } else {
        setFeedback('Instalação cancelada. Você pode instalar pelo menu do navegador quando desejar.');
        setShowManual(true);
      }
    } catch {
      setFeedback('O navegador não abriu a instalação. Use as instruções abaixo.');
      setShowManual(true);
    } finally {
      setInstalling(false);
    }
  }

  if (installed) return null;

  return <>
    <button type="button" className="btn btn-outline btn-small" onClick={() => {
      setVisible(true);
      setShowManual(false);
      setFeedback('');
    }}><Download size={17}/> Instalar Vezora</button>

    {visible && <div className="vezora-dialog-overlay" role="presentation">
      <section className="vezora-dialog vezora-install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title" aria-describedby="install-description">
        <button type="button" className="vezora-close" onClick={() => setVisible(false)} aria-label="Fechar"><X size={20}/></button>
        <div className="vezora-dialog-icon"><Smartphone size={24}/></div>
        <h2 id="install-title">Instale o Vezora no seu dispositivo</h2>
        <p id="install-description">Acesse agendamentos e avisos direto da tela inicial, como um aplicativo.</p>

        <button type="button" className="btn btn-primary wide vezora-install-primary" onClick={() => void install()} disabled={installing}>
          <Download size={18}/> {installing ? 'Abrindo instalação…' : 'Instalar Vezora'}
        </button>
        {!promptEvent && <p className="vezora-install-note">Se o navegador não disponibilizar a instalação em um clique, este botão mostra como instalar pelo menu.</p>}
        {feedback && <p className="vezora-install-feedback" role="status">{feedback}</p>}

        {showManual && <div className="vezora-install-guide" aria-label="Como instalar manualmente">
          <strong>{platform === 'ios' ? 'No iPhone ou iPad' : platform === 'android' ? 'No Android' : 'No computador'}</strong>
          {platform === 'ios' ? <ol>
            <li>Abra este endereço no <b>Safari</b>.</li>
            <li>Toque no botão <b>Compartilhar</b>.</li>
            <li>Escolha <b>Adicionar à Tela de Início</b> e confirme.</li>
          </ol> : platform === 'android' ? <ol>
            <li>Abra o Vezora no <b>Chrome</b>.</li>
            <li>Toque nos <b>três pontos (⋮)</b> do navegador.</li>
            <li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li>
          </ol> : <ol>
            <li>Abra o Vezora no <b>Chrome ou Microsoft Edge</b>.</li>
            <li>Clique no <b>ícone de instalação</b> da barra de endereço ou abra o menu <b>⋮</b>.</li>
            <li>Escolha <b>Instalar Vezora</b> ou <b>Instalar página como aplicativo</b>.</li>
          </ol>}
          <p><CheckCircle2 size={15}/> Depois de instalar, abra o Vezora pelo ícone na tela inicial.</p>
        </div>}

        <button type="button" className="btn btn-outline wide" onClick={() => setVisible(false)}>Agora não, continuar no painel</button>
      </section>
    </div>}
  </>;
}
