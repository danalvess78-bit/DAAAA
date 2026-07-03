import React, { useEffect, useState } from "react";
import { Shield, Medal, Users, GraduationCap, Clock, Award, Star, ArrowRight, Zap, Target, BookOpen, Newspaper, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { User, MilitaryRank, LIST_OF_MEDALS, NewsPost, getRankOrder } from "../types.js";
import { api } from "../lib/api.js";
import logoImg from "../assets/images/regenerated_image_1781102632223.png";

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenEnlist: () => void;
  destaques: {
    militaryOfTheMonth: User | null;
    instructorOfTheMonth: User | null;
    destaqueOperacional: User | null;
  } | null;
}

export default function LandingPage({ onOpenLogin, onOpenEnlist, destaques }: LandingPageProps) {
  const [currentHour, setCurrentHour] = useState(new Date().toLocaleTimeString("pt-BR"));
  const [activeLandingTab, setActiveLandingTab] = useState<"noticias" | "hall" | "organograma">("noticias");
  const [news, setNews] = useState<NewsPost[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<NewsPost | null>(null);
  const [hierarchy, setHierarchy] = useState<any[]>([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const data = await api.getPublicNews();
        setNews(data || []);
      } catch (err) {
        console.error("Erro ao carregar notícias públicas:", err);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, []);

  useEffect(() => {
    const fetchHierarchy = async () => {
      try {
        const data = await api.getPublicHierarchy();
        if (data && data.length > 0) {
          const sorted = [...data].sort((a, b) => {
            const orderA = getRankOrder(a.rank);
            const orderB = getRankOrder(b.rank);
            return orderB - orderA;
          });
          setHierarchy(sorted);
        } else {
          setHierarchy(Object.values(MilitaryRank).reverse().map(r => ({ rank: r, label: r })));
        }
      } catch (err) {
        console.error("Erro ao carregar hierarquia pública:", err);
        setHierarchy(Object.values(MilitaryRank).reverse().map(r => ({ rank: r, label: r })));
      } finally {
        setHierarchyLoading(false);
      }
    };
    fetchHierarchy();
  }, []);

  // Real-time server clock to simulate command center feel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().toLocaleTimeString("pt-BR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Highlight elements
  const militaryStar = destaques?.militaryOfTheMonth;
  const instructorStar = destaques?.instructorOfTheMonth;
  const operationalStar = destaques?.destaqueOperacional;

  return (
    <div className="min-h-screen bg-fmb-black text-gray-100 font-sans military-grid relativ overflow-x-hidden">
      {/* Decorative overhead subtle tactical ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[350px] bg-gradient-to-b from-fmb-army/10 via-fmb-olive/5 to-transparent blur-3xl pointer-events-none" />

      {/* TACTICAL FLOATING MONITOR STATUS HEADER */}
      <nav className="border-b border-fmb-army/30 bg-fmb-black/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <img 
                src={logoImg} 
                alt="FMB Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = "https://images.habbo.com/c_images/album1500/ADM.png";
                }}
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm tracking-widest text-white leading-none uppercase">
                FORÇA MILITAR BRASILEIRA
              </h1>
              <span className="text-[9px] font-mono text-fmb-gold uppercase tracking-wider block mt-0.5">
                FMB • CENTRO OPERACIONAL DE COMANDO 🇧🇷
              </span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-6">
            <div className="text-right border-r border-fmb-army/25 pr-6">
              <span className="text-[9px] font-mono text-gray-500 block">HORÁRIO DE SÃO PAULO</span>
              <span className="text-xs font-mono font-bold text-fmb-gold tracking-widest">{currentHour}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-mono text-gray-500 block">COORDENAÇÃO INTEGRADA</span>
              <span className="text-xs font-mono font-bold text-green-500 flex items-center space-x-1 justify-end">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping mr-1" /> SERVIDORES OPERACIONAIS
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenLogin}
              className="bg-fmb-dark/70 border border-fmb-army/40 hover:bg-fmb-army/30 hover:border-fmb-gold/40 px-4 py-1.5 rounded transition-all text-xs font-mono uppercase tracking-widest text-gray-200"
              id="landing-login-btn"
            >
              Entrar
            </button>
            <button
              onClick={onOpenEnlist}
              className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold/40 hover:border-fmb-gold text-white px-4 py-1.5 rounded transition-all text-xs font-mono uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(53,94,59,0.3)] animate-pulse"
              id="landing-enlist-btn"
            >
              Alistar-se
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative px-4 pt-10 pb-20 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center" id="fmb-tactical-hero">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          {/* Logotipo da FMB no Início */}
          <div className="flex justify-center">
            <div className="w-28 h-28 md:w-36 md:h-36 flex items-center justify-center relative group">
              <img 
                src={logoImg} 
                alt="Logotipo FMB" 
                className="w-full h-full object-contain relative z-10 transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  e.currentTarget.src = "https://images.habbo.com/c_images/album1500/ADM.png";
                }}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Brazilian Ribbon Detail */}
          <div className="inline-flex items-center justify-center space-x-2 px-3 py-1 bg-fmb-slate border border-fmb-army/40 rounded-full text-xs font-mono tracking-wider text-green-400">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full inline-block" />
            <span className="w-2.5 h-2.5 bg-fmb-gold rounded-full inline-block" />
            <span>EXÉRCITO MILITAR ATIVO DO HABBO BRASIL</span>
          </div>

          <h1 className="font-display font-extrabold text-5xl md:text-7xl text-white tracking-tighter leading-none uppercase">
            FORÇA MILITAR BRASILEIRA
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl font-display font-medium text-gray-300 italic">
            "Disciplina, Honra e Compromisso."
          </p>

          <p className="max-w-2xl mx-auto text-sm text-gray-400 leading-relaxed">
            Seja bem-vindo ao portal de inteligência e regência tática da <strong className="text-fmb-gold">FMB</strong>. 
            Nossa doutrina preza pela excelência operacional, treinamentos de resiliência e meritocracia rigorosa. Prepare-se para defender a soberania nacional no Habbo!
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button
              onClick={onOpenLogin}
              className="bg-fmb-slate hover:bg-fmb-dark border border-fmb-army/60 hover:border-fmb-gold/50 px-8 py-3.5 rounded text-sm uppercase tracking-widest font-mono font-bold text-fmb-gold transition-all shadow-md flex items-center space-x-2 group"
              id="hero-dashboard-login-btn"
            >
              <span>Acessar Painel</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
            </button>
            <button
              onClick={onOpenEnlist}
              className="bg-fmb-army hover:bg-fmb-olive border border-fmb-gold px-8 py-3.5 rounded text-sm uppercase tracking-widest font-mono font-bold text-white transition-all shadow-[0_0_20px_rgba(53,94,59,0.4)] flex items-center space-x-2 animate-bounce"
              id="hero-recruit-enlist-btn"
            >
              <Zap className="w-4 h-4 text-fmb-gold" />
              <span>Alistar Novo Militar</span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* CORE STATS BOARD */}
      <section className="bg-fmb-slate/40 border-y border-fmb-army/20 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <Users className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">FORÇA DE COMBATE</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">124 MILITARES</span>
            <span className="text-[10px] font-mono text-green-400 block mt-1">● 100% REGULAMENTADOS</span>
          </div>

          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <Clock className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">HORAS DE SENTINELA</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">2.418 HS</span>
            <span className="text-[10px] font-mono text-gray-500 block mt-1">EM PATRULHA ATIVA</span>
          </div>

          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <GraduationCap className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">INSTRUTORES FORMADOS</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">52 OFICIAIS</span>
            <span className="text-[10px] font-mono text-green-400 block mt-1">ACADEMIA MILITAR DE TIPOS</span>
          </div>

          <div className="border border-fmb-army/30 bg-fmb-black/80 px-4 py-5 rounded text-center relative group overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-fmb-army" />
            <Award className="w-8 h-8 text-fmb-gold mx-auto mb-2 shrink-0 opacity-80" />
            <span className="text-xs font-mono text-gray-400 uppercase tracking-widest block">BATALHA DE MISSÕES</span>
            <span className="font-mono text-2xl font-bold text-white block mt-1 tracking-wider">15 ATIVAS</span>
            <span className="text-[10px] font-mono text-fmb-gold block mt-1">RECOMPENSAS EXCEPCIONAIS</span>
          </div>
        </div>
      </section>

      {/* LANDING PAGES MULTI-TAB PORTAL */}
      <section className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex justify-center border-b border-fmb-army/30 pb-4 mb-10">
          <div className="flex flex-wrap justify-center bg-fmb-slate/30 p-1.5 rounded-lg border border-fmb-army/20 gap-2">
            <button
              onClick={() => setActiveLandingTab("noticias")}
              className={`px-5 py-2.5 rounded font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 font-bold cursor-pointer ${
                activeLandingTab === "noticias"
                  ? "bg-fmb-gold text-fmb-black shadow-md"
                  : "text-gray-400 hover:text-white hover:bg-fmb-slate/50"
              }`}
              id="landing-tab-news"
            >
              <Newspaper className="w-4 h-4" />
              Notícias do QG
            </button>
            <button
              onClick={() => setActiveLandingTab("hall")}
              className={`px-5 py-2.5 rounded font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 font-bold cursor-pointer ${
                activeLandingTab === "hall"
                  ? "bg-fmb-gold text-fmb-black shadow-md"
                  : "text-gray-400 hover:text-white hover:bg-fmb-slate/50"
              }`}
              id="landing-tab-hall"
            >
              <Medal className="w-4 h-4" />
              Hall da Fama
            </button>
            <button
              onClick={() => setActiveLandingTab("organograma")}
              className={`px-5 py-2.5 rounded font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2 font-bold cursor-pointer ${
                activeLandingTab === "organograma"
                  ? "bg-fmb-gold text-fmb-black shadow-md"
                  : "text-gray-400 hover:text-white hover:bg-fmb-slate/50"
              }`}
              id="landing-tab-organograma"
            >
              <Target className="w-4 h-4" />
              Organograma
            </button>
          </div>
        </div>

        {/* TAB CONTENTS */}
        <AnimatePresence mode="wait">
          {activeLandingTab === "noticias" && (
            <motion.div
              key="noticias"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
              id="landing-news-container"
            >
              <div className="text-center mb-8">
                <Newspaper className="w-10 h-10 text-fmb-gold mx-auto mb-3 animate-pulse" />
                <h2 className="font-display text-3xl font-extrabold text-white tracking-tight uppercase">
                  📰 NOTÍCIAS & IMPRENSA MILITAR 📰
                </h2>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
                  Fique atualizado com os últimos decretos, eventos e boletins do Comando da FMB
                </p>
              </div>

              {newsLoading ? (
                <div className="text-center py-20 text-gray-400 text-xs font-mono uppercase animate-pulse">
                  Sincronizando boletins com o QG Central...
                </div>
              ) : news.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-fmb-army/20 rounded-lg bg-fmb-slate/10 max-w-2xl mx-auto">
                  <p className="text-gray-400 text-sm font-mono uppercase">Nenhum boletim oficial postado no momento.</p>
                  <p className="text-xs text-gray-500 font-mono uppercase mt-1">Nossos jornalistas estão em patrulha.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {news.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedNews(item)}
                      className="bg-fmb-slate/20 border border-fmb-army/30 rounded-lg p-5 flex flex-col justify-between hover:border-fmb-gold/50 hover:-translate-y-0.5 active:scale-[0.99] transition-all group cursor-pointer"
                    >
                      <div className="space-y-4">
                        {item.imageUrl && (
                          <div className="border border-fmb-army/30 rounded overflow-hidden aspect-video relative">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div className="space-y-1 text-left">
                          <span className="text-[9px] font-mono text-fmb-gold font-bold bg-fmb-gold/10 px-2 py-0.5 rounded uppercase">
                            Imprensa FMB
                          </span>
                          <h3 className="font-display font-extrabold text-sm text-white uppercase tracking-tight group-hover:text-fmb-gold transition-colors mt-2">
                            {item.title}
                          </h3>
                          <p className="text-[9px] font-mono text-gray-500">
                            Publicado por <strong className="text-gray-300 uppercase">{item.authorNick}</strong> em {new Date(item.createdAt).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <p className="text-xs text-gray-300 font-sans leading-relaxed text-left whitespace-pre-wrap break-words border-t border-fmb-army/10 pt-3 line-clamp-6">
                          {item.content}
                        </p>
                        <div className="pt-2 flex justify-end">
                          <span className="text-[10px] font-mono text-fmb-gold uppercase tracking-wider group-hover:underline flex items-center gap-1">
                            Ler notícia completa <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeLandingTab === "hall" && (
            <motion.div
              key="hall"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <Medal className="w-10 h-10 text-fmb-gold mx-auto mb-3 animate-pulse" />
                <h2 className="font-display text-3xl font-extrabold text-white tracking-tight uppercase">
                  🏆 HALL DA FAMA MILITAR 🏆
                </h2>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
                  Chancela e consagração do alto escalão pelas operações deste ciclo
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Militar do Mês */}
                <div className="border border-fmb-army/50 bg-fmb-slate/30 p-6 rounded-lg text-center relative group hover:border-fmb-gold/40 transition-colors">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-fmb-gold text-fmb-black font-display font-extrabold text-[10px] tracking-widest uppercase rounded shadow-lg">
                    MILITAR DO MÊS
                  </div>
                  <div className="w-24 h-24 bg-fmb-black/60 border border-fmb-army/30 rounded-full mx-auto my-4 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform shrink-0">
                    {militaryStar ? (
                      <img 
                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${militaryStar.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                        alt={militaryStar.habboNick}
                        className="scale-125 translate-y-2"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Users className="w-10 h-10 text-gray-600" />
                    )}
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-white">
                    {militaryStar ? militaryStar.habboNick : "A Nomear"}
                  </h3>
                  <p className="text-xs font-mono text-fmb-gold font-bold mt-1 uppercase">
                    {militaryStar ? militaryStar.role : "Soberano Patrulheiro"}
                  </p>
                  <p className="text-xs text-gray-400 mt-3 italic leading-relaxed">
                    "{militaryStar ? militaryStar.habboMotto : "Serviço leal e destemido focado na segurança nacional FMB."}"
                  </p>
                  <div className="mt-4 pt-4 border-t border-fmb-army/20 flex justify-center space-x-2">
                    <span className="px-2 py-0.5 bg-fmb-army/40 border border-fmb-gold/20 text-[9px] font-mono rounded text-fmb-gold">
                      🥇 Conquista Suprema
                    </span>
                  </div>
                </div>

                {/* Instrutor do Mês */}
                <div className="border border-fmb-army/50 bg-fmb-slate/30 p-6 rounded-lg text-center relative group hover:border-fmb-gold/40 transition-colors">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-fmb-gold text-fmb-black font-display font-extrabold text-[10px] tracking-widest uppercase rounded shadow-lg">
                    INSTRUTOR DO MÊS
                  </div>
                  <div className="w-24 h-24 bg-fmb-black/60 border border-fmb-army/30 rounded-full mx-auto my-4 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform shrink-0">
                    {instructorStar ? (
                      <img 
                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${instructorStar.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                        alt={instructorStar.habboNick}
                        className="scale-125 translate-y-2"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <BookOpen className="w-10 h-10 text-gray-600" />
                    )}
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-white">
                    {instructorStar ? instructorStar.habboNick : "A Nomear"}
                  </h3>
                  <p className="text-xs font-mono text-fmb-gold font-bold mt-1 uppercase">
                    {instructorStar ? instructorStar.role : "Mestre Operacional"}
                  </p>
                  <p className="text-xs text-gray-400 mt-3 italic leading-relaxed">
                    "{instructorStar ? instructorStar.habboMotto : "Doutrinar recrutas, construir a farda de ferro."}"
                  </p>
                  <div className="mt-4 pt-4 border-t border-fmb-army/20 flex justify-center space-x-2">
                    <span className="px-2 py-0.5 bg-fmb-army/40 border border-fmb-gold/20 text-[9px] font-mono rounded text-fmb-gold">
                      🥇 Elite de Treino
                    </span>
                  </div>
                </div>

                {/* Destaque Operacional */}
                <div className="border border-fmb-army/50 bg-fmb-slate/30 p-6 rounded-lg text-center relative group hover:border-fmb-gold/40 transition-colors">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-fmb-gold text-fmb-black font-display font-extrabold text-[10px] tracking-widest uppercase rounded shadow-lg">
                    DESTAQUE OPERACIONAL
                  </div>
                  <div className="w-24 h-24 bg-fmb-black/60 border border-fmb-army/30 rounded-full mx-auto my-4 flex items-center justify-center overflow-hidden hover:scale-105 transition-transform shrink-0">
                    {operationalStar ? (
                      <img 
                        src={`https://www.habbo.com/habbo-imaging/avatarimage?figure=${operationalStar.habboAvatar}&size=m&direction=3&head_direction=3&gesture=sml&action=std`} 
                        alt={operationalStar.habboNick}
                        className="scale-125 translate-y-2"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Zap className="w-10 h-10 text-gray-600" />
                    )}
                  </div>
                  <h3 className="font-display font-extrabold text-lg text-white">
                    {operationalStar ? operationalStar.habboNick : "A Nomear"}
                  </h3>
                  <p className="text-xs font-mono text-fmb-gold font-bold mt-1 uppercase">
                    {operationalStar ? operationalStar.role : "Sargento Tático"}
                  </p>
                  <p className="text-xs text-gray-400 mt-3 italic leading-relaxed">
                    "{operationalStar ? operationalStar.habboMotto : "Em combate ostensivo com dedicação impecável."}"
                  </p>
                  <div className="mt-4 pt-4 border-t border-fmb-army/20 flex justify-center space-x-2">
                    <span className="px-2 py-0.5 bg-fmb-army/40 border border-fmb-gold/20 text-[9px] font-mono rounded text-fmb-gold">
                      🥇 Crachá de Bravura
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeLandingTab === "organograma" && (
            <motion.div
              key="organograma"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <Target className="w-10 h-10 text-fmb-gold mx-auto mb-3" />
                <h2 className="font-display text-3xl font-extrabold text-white tracking-tight uppercase">
                  ORGANOGRAMA & HIERARQUIA MILITAR
                </h2>
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
                  O ordenamento e precedência absoluta de nossa força de comando
                </p>
              </div>

              {hierarchyLoading ? (
                <div className="text-center py-12 text-gray-400 text-xs font-mono uppercase animate-pulse">
                  Carregando organograma oficial...
                </div>
              ) : (
                <div className="space-y-3 bg-fmb-black/80 border border-fmb-army/30 p-6 rounded-lg text-xs font-mono max-w-4xl mx-auto">
                  {hierarchy.map((item, index) => {
                    const label = item.label || item.rank;
                    const rankId = item.rank;
                    let rankStyle = "border-gray-800 text-gray-300 bg-fmb-slate/20";
                    if (index < 2) {
                      rankStyle = "border-fmb-gold/40 text-fmb-gold bg-fmb-gold/5 font-extrabold";
                    } else if (index < 7) {
                      rankStyle = "border-fmb-army/50 text-green-300 bg-fmb-army/10";
                    }

                    return (
                      <div 
                        key={rankId}
                        className={`flex items-center justify-between p-3 border rounded transition-colors hover:bg-fmb-slate/40 ${rankStyle}`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-6 text-gray-600 text-right">#{hierarchy.length - index}</span>
                          <span className="font-bold text-sm tracking-wide">{label}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          {index < 2 ? (
                            <span className="px-2 py-0.5 bg-fmb-gold text-fmb-black rounded text-[9px] uppercase tracking-wider font-bold">
                              Alto Escalão
                            </span>
                          ) : index < 7 ? (
                            <span className="px-2 py-0.5 bg-fmb-army text-white rounded text-[9px] uppercase tracking-wider">
                              Oficiais
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-[9px] uppercase tracking-widest">
                              Praças/Graduados
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* NEWS DETAIL MODAL */}
      <AnimatePresence>
        {selectedNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
            onClick={() => setSelectedNews(null)}
            id="news-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-fmb-black border-2 border-fmb-gold/40 rounded-lg max-w-3xl w-full overflow-hidden shadow-[0_0_50px_rgba(255,215,0,0.15)] flex flex-col my-8"
              onClick={(e) => e.stopPropagation()}
              id="news-modal-content"
            >
              {/* HEADER WITH CLOSE BUTTON */}
              <div className="border-b border-fmb-army/30 bg-fmb-slate/20 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-fmb-gold">
                  <Newspaper className="w-5 h-5 text-fmb-gold animate-pulse" />
                  <span className="font-mono text-xs uppercase tracking-widest font-bold">Boletim Informativo Oficial</span>
                </div>
                <button
                  onClick={() => setSelectedNews(null)}
                  className="text-gray-400 hover:text-white hover:bg-fmb-army/30 p-1.5 rounded transition-all cursor-pointer"
                  id="news-modal-close-icon-btn"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* BODY SECTION (SCROLLABLE) */}
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6 text-left">
                {/* News Image */}
                {selectedNews.imageUrl && (
                  <div className="border border-fmb-army/40 rounded-lg overflow-hidden bg-fmb-black relative max-h-96">
                    <img
                      src={selectedNews.imageUrl}
                      alt={selectedNews.title}
                      className="w-full object-cover max-h-96"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* News Title & Metadata */}
                <div className="space-y-3">
                  <span className="text-[10px] font-mono text-fmb-gold font-bold bg-fmb-gold/10 px-2.5 py-1 rounded uppercase">
                    IMPRENSA EXCLUSIVA FMB
                  </span>
                  <h2 className="font-display font-extrabold text-2xl text-white uppercase tracking-tight leading-tight">
                    {selectedNews.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-400 font-mono border-y border-fmb-army/10 py-2.5">
                    <div>
                      AUTOR: <strong className="text-gray-200 uppercase">{selectedNews.authorNick}</strong>
                    </div>
                    <div className="hidden sm:inline text-gray-600">•</div>
                    <div>
                      DATA DE PUBLICAÇÃO: <strong className="text-gray-200">{new Date(selectedNews.createdAt).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}</strong>
                    </div>
                  </div>
                </div>

                {/* News Content */}
                <p className="text-sm text-gray-200 font-sans leading-relaxed whitespace-pre-wrap break-words">
                  {selectedNews.content}
                </p>
              </div>

              {/* FOOTER */}
              <div className="border-t border-fmb-army/30 bg-fmb-slate/10 px-6 py-4 flex justify-end">
                <button
                  onClick={() => setSelectedNews(null)}
                  className="bg-fmb-gold hover:bg-amber-400 text-fmb-black px-6 py-2 rounded font-mono text-xs font-bold uppercase tracking-widest transition-all shadow-md cursor-pointer"
                  id="news-modal-close-footer-btn"
                >
                  Fechar Leitura
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <footer className="border-t border-fmb-army/30 bg-fmb-black text-gray-500 py-12 px-4 sm:px-6 lg:px-8 text-center text-xs font-mono">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex justify-center items-center space-x-3">
            <img 
              src={logoImg} 
              alt="FMB Logo Rodapé" 
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.src = "https://images.habbo.com/c_images/album1500/ADM.png";
              }}
              referrerPolicy="no-referrer"
            />
            <span className="text-white font-display font-extrabold uppercase tracking-widest">FMB 🇧🇷</span>
          </div>
          <p className="max-w-md mx-auto text-[11px] text-gray-400 leading-relaxed">
            A Força Militar Brasileira é uma instituição virtual inspirada nas forças de defesa nacionais brasileiras sem quaisquer filiações governamentais políticas reais.
          </p>
          <div className="pt-4 border-t border-fmb-army/10 text-[9px]">
            © {new Date().getFullYear()} FORÇA MILITAR BRASILEIRA • TODOS OS DIREITOS RESERVADOS • SEGURANÇA MÁXIMA
          </div>
        </div>
      </footer>
    </div>
  );
}
