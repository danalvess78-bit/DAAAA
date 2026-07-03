import React, { useState } from "react";
import { Shield, KeyRound, AlertTriangle, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../lib/api.js";
import { User } from "../types.js";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [nick, setNick] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecoverAlert, setShowRecoverAlert] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nick || !password) {
      setError("Insira suas credenciais militares nos campos indicados.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await api.login(nick, password);
      localStorage.setItem("fmb_token", data.token);
      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message || "Senha inválida ou militar desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -15 }}
          className="relative w-full max-w-md border border-fmb-army/40 bg-fmb-black text-white rounded-lg shadow-2xl overflow-hidden tactical-scanline"
          id="login-modal-window"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-fmb-army/30 bg-fmb-slate">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-fmb-gold animate-pulse" />
              <span className="font-display font-medium text-xs tracking-wider uppercase text-fmb-gold">
                Autenticação de Combate (FMB)
              </span>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              id="close-login-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <h3 className="font-display text-xl font-bold tracking-tight text-white uppercase">
                Acesse o Centro de Comando
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Conecte-se à rede integrada da Força Militar Brasileira.
              </p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 border border-red-500/30 bg-red-950/30 text-red-200 text-xs rounded-md flex items-center space-x-2"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-fmb-gold mb-1">
                  Nick Habbo / Registro
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 font-mono text-xs select-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    placeholder="NickMilitar"
                    className="w-full bg-fmb-slate/60 border border-fmb-army/30 focus:border-fmb-gold rounded-md py-2.5 pl-8 pr-3 text-sm text-white placeholder-gray-500 outline-none transition-colors font-mono"
                    id="login-username-input"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-fmb-gold mb-1">
                  Senha Geral de Acesso
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-fmb-slate/60 border border-fmb-army/30 focus:border-fmb-gold rounded-md py-2.5 pl-10 pr-3 text-sm text-white placeholder-gray-500 outline-none transition-colors font-mono"
                    id="login-password-input"
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowRecoverAlert(true)}
                  className="text-[10px] uppercase tracking-wider font-mono text-gray-400 hover:text-fmb-gold transition-colors underline"
                  id="forgot-password-btn"
                >
                  Esqueceu a senha tática?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden bg-fmb-army border border-fmb-gold/40 hover:bg-fmb-olive active:scale-[99%] text-white py-2.5 rounded font-display font-medium text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center space-x-2"
                id="submit-login-btn"
              >
                {loading ? (
                  <span className="inline-block animate-spin border-2 border-white border-t-transparent w-4 h-4 rounded-full" />
                ) : (
                  <>
                    <Shield className="w-4 h-4 text-fmb-gold group-hover:rotate-12 transition-transform" />
                    <span>Estabeler Conexão</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer banner */}
          <div className="p-3 bg-fmb-slate/50 border-t border-fmb-army/20 text-center text-[10px] font-mono text-gray-400">
            FMB © 2026 • Canal Codificado Seguro
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Recover Password Modal Alert */}
      <AnimatePresence>
        {showRecoverAlert && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-sm border border-fmb-gold/30 bg-fmb-black text-white p-6 rounded-lg shadow-2xl relative"
            >
              <div className="flex flex-col items-center text-center">
                <AlertTriangle className="w-12 h-12 text-fmb-gold mb-4 animate-bounce" />
                <h4 className="font-display font-bold text-lg text-white uppercase tracking-tight">
                  Acesso Restrito do Alto Comando
                </h4>
                
                <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                  "Entre em contato com um <span className="text-fmb-gold font-bold">Administrador Supremo</span> para redefinição de acesso."
                </p>

                <p className="text-[10px] text-gray-500 font-mono mt-4 border-t border-fmb-army/20 pt-4 w-full">
                  Por medidas padrão de sigilo cibernético militar, a recuperação automatizada é proibida.
                </p>

                <button
                  onClick={() => setShowRecoverAlert(false)}
                  className="mt-6 bg-fmb-slate border border-fmb-gold/30 hover:bg-fmb-army/40 px-6 py-2 rounded font-mono text-xs text-white transition-all uppercase tracking-wider"
                  id="close-recover-alert-btn"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
