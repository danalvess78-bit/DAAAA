/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Shield, KeyRound, AlertCircle, Info, Landmark, HelpCircle, X, ChevronRight, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "./lib/api.js";
import { User, MilitaryRank, LIST_OF_MEDALS, UserStatus } from "./types.js";

import LandingPage from "./components/LandingPage.js";
import LoginModal from "./components/LoginModal.js";
import CommandCenter from "./components/CommandCenter.js";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [showLogin, setShowLogin] = useState(false);
  const [showEnlistModal, setShowEnlistModal] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(true);

  // Destaques do Hall da Fama (shared globally)
  const [destaques, setDestaques] = useState<{
    militaryOfTheMonth: User | null;
    instructorOfTheMonth: User | null;
    destaqueOperacional: User | null;
  } | null>(null);

  // State for public recruitment (guest registration sandbox)
  const [guestNick, setGuestNick] = useState("");
  const [guestPass, setGuestPass] = useState("");
  const [guestSuccess, setGuestSuccess] = useState<string | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  const loadDestaques = async () => {
    try {
      const data = await api.getDestaques();
      setDestaques(data);
    } catch (e) {
      console.warn("Erro ao obter destaques:", e);
    }
  };

  const verifySession = async () => {
    const savedToken = localStorage.getItem("fmb_token");
    if (!savedToken) {
      setCheckingSession(false);
      return;
    }

    try {
      const me = await api.getMe();
      setUser(me);
      setToken(savedToken);
    } catch (e) {
      console.warn("Sessão militar expirou.");
      localStorage.removeItem("fmb_token");
    } finally {
      setCheckingSession(false);
    }
  };

  useEffect(() => {
    verifySession();
    loadDestaques();
  }, []);

  const handleLoginSuccess = (loggedInUser: User, sessionToken: string) => {
    setUser(loggedInUser);
    setToken(sessionToken);
    loadDestaques(); // reload after potential changes
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    loadDestaques();
  };

  const handleUpdateMe = (updatedUser: User) => {
    setUser(updatedUser);
  };

  // Public candidate self-enlistment submission handler
  const handlePublicEnlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNick || !guestPass) {
      setGuestError("Preencha o seu Nick Habbo e a senha tática desejada.");
      return;
    }

    setGuestLoading(true);
    setGuestError(null);
    setGuestSuccess(null);

    try {
      const res = await api.submitEnlistmentRequest(guestNick, guestPass);
      setGuestSuccess(res.message || "Solicitação de alistamento enviada com sucesso! Peça a um Oficial ou Administrador para aprovar seu ingresso no painel.");
      setGuestNick("");
      setGuestPass("");
    } catch (e: any) {
      setGuestError(e.message || "Ocorreu uma falha tática ao enviar a solicitação.");
    } finally {
      setGuestLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-fmb-black flex flex-col items-center justify-center p-4 tactical-scanline">
        <div className="w-16 h-16 border-4 border-fmb-gold border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="font-display font-medium text-xs text-fmb-gold tracking-widest uppercase">
          Estabelecendo canal criptografado seguro...
        </h2>
        <span className="text-[10px] font-mono text-gray-500 mt-2">FORÇA MILITAR BRASILEIRA • FMB</span>
      </div>
    );
  }

  return (
    <div className="bg-fmb-black min-h-screen text-gray-100 flex flex-col relative selection:bg-fmb-gold selection:text-fmb-black">
      
      {/* CORE VIEW SHIFTER (LOGGED IN vs LANDING PAGE) */}
      {user ? (
        <CommandCenter 
          user={user} 
          onLogout={handleLogout} 
          onUpdateMe={handleUpdateMe}
        />
      ) : (
        <LandingPage 
          onOpenLogin={() => setShowLogin(true)} 
          onOpenEnlist={() => {
            setGuestError(null);
            setGuestSuccess(null);
            setShowEnlistModal(true);
          }}
          destaques={destaques}
        />
      )}

      {/* MODAL: LOGIN OPERATOR */}
      <LoginModal 
        isOpen={showLogin} 
        onClose={() => setShowLogin(false)} 
        onLoginSuccess={handleLoginSuccess}
      />

      {/* MODAL: PUBLIC RECRUITMENT REGULATION GUIDE */}
      <AnimatePresence>
        {showEnlistModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-fmb-black border border-fmb-gold/40 text-white rounded-lg shadow-2xl p-6 relative"
            >
              <button 
                onClick={() => setShowEnlistModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <Shield className="w-10 h-10 text-fmb-gold mx-auto mb-2 animate-bounce" />
                <h3 className="font-display font-extrabold text-lg text-white uppercase">Alistamento Militar Autônomo</h3>
                <p className="text-[10px] font-mono text-gray-400">FAÇA SEU PRÓPRIO REGISTRO DE RECRUTA NA FMB</p>
              </div>

              <div className="space-y-4 font-mono text-xs">
                {guestSuccess ? (
                  <div className="space-y-4 text-center">
                    <div className="p-4 bg-green-950/20 border border-green-500/30 rounded text-green-300 font-mono text-xs leading-relaxed">
                      <p className="font-bold text-sm mb-2">🎉 SOLICITAÇÃO RECEBIDA!</p>
                      <p>{guestSuccess}</p>
                    </div>
                    <button
                      onClick={() => setShowEnlistModal(false)}
                      className="w-full bg-fmb-army hover:bg-fmb-olive text-white font-bold py-2.5 rounded uppercase tracking-wider text-[10px]"
                    >
                      Fechar Janela
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-fmb-slate/40 border border-fmb-army/30 rounded text-gray-300 leading-relaxed text-center">
                      <p>
                        "Insira seu Nick Habbo real para sincronizarmos seu visual e sua farda automaticamente. Defina sua própria senha para logar no painel."
                      </p>
                    </div>

                    <form onSubmit={handlePublicEnlist} className="space-y-3">
                      <div>
                        <label className="text-[10px] text-fmb-gold block uppercase mb-1">Seu Nick Habbo real:</label>
                        <input 
                          type="text"
                          placeholder="Ex: Recruta_Militar"
                          value={guestNick}
                          onChange={(e) => setGuestNick(e.target.value)}
                          className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-2 px-3 text-white outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-fmb-gold block uppercase mb-1">Sua Senha de Acesso Privada:</label>
                        <input 
                          type="password"
                          placeholder="••••••••"
                          value={guestPass}
                          onChange={(e) => setGuestPass(e.target.value)}
                          className="w-full bg-fmb-slate border border-fmb-army/30 rounded py-2 px-3 text-white outline-none"
                          required
                        />
                      </div>

                      {guestError && (
                        <p className="text-[10px] text-red-400 leading-normal border-t border-red-500/10 pt-2">{guestError}</p>
                      )}

                      <button
                        type="submit"
                        disabled={guestLoading}
                        className="w-full bg-fmb-army hover:bg-fmb-olive text-white font-bold py-2.5 rounded uppercase tracking-wider text-[10px] shadow"
                      >
                        {guestLoading ? "Enviando Ficha..." : "SOLICITAR MEU ALISTAMENTO"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
