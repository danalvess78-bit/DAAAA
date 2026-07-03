import React, { useEffect, useState } from "react";
import { Newspaper, Send, Trash2, Image, FileText, Globe, AlertCircle, Sparkles } from "lucide-react";
import { api } from "../lib/api.js";
import { NewsPost, User } from "../types.js";

interface JournalPanelProps {
  user: User;
}

export default function JournalPanel({ user }: JournalPanelProps) {
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPublicNews();
      setNews(data || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar notícias oficiais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("O título e o conteúdo da notícia são campos obrigatórios.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.createNews(title, content, imageUrl || undefined);
      setSuccess("Notícia oficial publicada com sucesso no portal do QG!");
      setTitle("");
      setImageUrl("");
      setContent("");
      fetchNews();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || "Falha ao publicar notícia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, postTitle: string) => {
    if (!confirm(`Deseja realmente excluir permanentemente a notícia: "${postTitle}"?`)) {
      return;
    }

    try {
      await api.deleteNews(id);
      setSuccess("Notícia excluída com sucesso.");
      fetchNews();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || "Erro ao excluir notícia.");
    }
  };

  return (
    <div className="space-y-6 font-mono text-left animate-fade-in" id="journal-panel-root">
      {/* HEADER SECTION */}
      <div className="border-b border-fmb-gold/30 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-wide uppercase flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-fmb-gold animate-pulse" />
            Redação Militar & Jornalismo
          </h2>
          <p className="text-[10px] text-gray-400 mt-1 uppercase">
            Canal de imprensa oficial da Força Militar Brasileira — Exclusivo para Jornalistas e Alto Comando
          </p>
        </div>
        <div className="bg-fmb-army/30 border border-fmb-gold/20 px-3 py-1 rounded text-[10px] font-bold text-fmb-gold uppercase flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> Imprensa Ativa
        </div>
      </div>

      {/* ERROR / SUCCESS FEEDBACK */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/50 p-3 rounded text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 p-3 rounded text-emerald-400 text-xs">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORM COLUMN: POST NEW ARTICLE */}
        <div className="lg:col-span-5 bg-fmb-slate/40 border border-fmb-army/20 rounded-lg p-5 space-y-4">
          <h3 className="text-xs font-bold text-fmb-gold uppercase tracking-wider border-b border-fmb-army/20 pb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Redigir Nova Notícia
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-400 uppercase block mb-1">Título da Notícia</label>
              <input
                type="text"
                placeholder="Ex: GRANDE DESFILE MILITAR DECRETADO PARA O PRÓXIMO SÁBADO"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-fmb-black/80 border border-fmb-army/40 rounded px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-fmb-gold"
                id="news-title-input"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 uppercase block mb-1">
                Link da Imagem (URL Externa)
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="Ex: https://i.imgur.com/exemplo.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-fmb-black/80 border border-fmb-army/40 rounded pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-fmb-gold"
                  id="news-image-input"
                />
                <Image className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
              </div>
              <p className="text-[9px] text-gray-500 mt-1 italic leading-tight">
                * Para evitar sobrecarregar o Supabase, utilize links diretos de hospedagens como Imgur, Discord, postimages ou uploads oficiais.
              </p>
            </div>

            {imageUrl && (
              <div className="border border-fmb-army/20 rounded overflow-hidden bg-fmb-black/50 p-2">
                <span className="text-[9px] text-gray-400 block mb-1 uppercase">Pré-visualização do Link:</span>
                <img
                  src={imageUrl}
                  alt="Pré-visualização"
                  className="max-h-28 w-full object-cover rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://placehold.co/600x300/15231c/ffd700?text=Link+de+Imagem+Invalido";
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] text-gray-400 uppercase block mb-1">Conteúdo da Notícia</label>
              <textarea
                rows={6}
                placeholder="Escreva os detalhes operacionais, depoimentos e boletim informativo oficial..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-fmb-black/80 border border-fmb-army/40 rounded px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-fmb-gold resize-none leading-relaxed"
                id="news-content-textarea"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-fmb-gold hover:bg-amber-400 disabled:bg-gray-700 text-fmb-black font-bold uppercase text-[10px] py-2.5 px-4 rounded shadow-md tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              id="submit-news-btn"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "Publicando..." : "Publicar Boletim Oficial"}
            </button>
          </form>
        </div>

        {/* LIST COLUMN: CURRENTLY PUBLISHED ARTICLES */}
        <div className="lg:col-span-7 bg-fmb-slate/20 border border-fmb-army/20 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-fmb-army/20 pb-2">
            <h3 className="text-xs font-bold text-fmb-gold uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4" /> Boletins Publicados
            </h3>
            <span className="text-[9px] bg-fmb-black px-2 py-0.5 rounded text-gray-400">
              {news.length} {news.length === 1 ? "notícia" : "notícias"}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-400 text-xs uppercase animate-pulse">
              Carregando acervo de notícias...
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-fmb-army/20 rounded bg-fmb-black/30 text-gray-500 text-xs uppercase">
              Nenhuma notícia militar publicada no portal.
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {news.map((item) => {
                const canDelete =
                  user.role === "Administrador Supremo" ||
                  item.authorNick.toLowerCase() === user.habboNick.toLowerCase();

                return (
                  <div
                    key={item.id}
                    className="bg-fmb-black/70 border border-fmb-army/30 rounded p-4 space-y-3 relative group hover:border-fmb-gold/40 transition-all"
                  >
                    {/* Exclude Button */}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item.id, item.title)}
                        className="absolute right-3 top-3 text-red-500 hover:text-red-400 hover:bg-red-950/40 p-1.5 rounded transition-all cursor-pointer"
                        title="Excluir notícia"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="space-y-1 text-left">
                      <h4 className="text-white font-bold text-xs uppercase tracking-wide pr-8">
                        {item.title}
                      </h4>
                      <p className="text-[9px] text-gray-500">
                        Publicado por <span className="text-fmb-gold uppercase font-bold">{item.authorNick}</span> em {new Date(item.createdAt).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>

                    {item.imageUrl && (
                      <div className="border border-fmb-army/20 rounded overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="max-h-40 w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}

                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words border-t border-fmb-army/10 pt-2 font-sans">
                      {item.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
