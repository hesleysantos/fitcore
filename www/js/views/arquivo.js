// Entrega de um arquivo gerado no aparelho (backup, planilhas): no celular abre a folha de compartilhar do sistema
// (salvar em Arquivos, no Drive etc.); no computador, ou se compartilhar falhar, baixa pelo link de download.
// Nada sai do aparelho sem a pessoa escolher para onde vai.
import { h } from '../ui.js';
import { isIos } from '../install.js';

// `tipos`: tipos MIME a tentar no compartilhamento, do melhor para o mais aceito (ex.: ['text/csv', 'text/plain']).
// Devolve 'compartilhado' | 'cancelado' (a pessoa fechou a folha) | 'baixado'. Lança erro se nem o download funcionar.
export async function entregarArquivo(texto, nome, tipos, titulo) {
  const blob = new Blob([texto], { type: tipos[0] });
  const noCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIos();
  if (noCelular && navigator.canShare && typeof File !== 'undefined') {
    const file = tipos.map((t) => new File([texto], nome, { type: t })).find((f) => { try { return navigator.canShare({ files: [f] }); } catch { return false; } });
    if (file) {
      try {
        await navigator.share({ files: [file], title: titulo });
        return 'compartilhado';
      } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelado'; // fechou a folha de compartilhar: não é erro
        // outro erro: segue para o download
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: nome });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'baixado';
}
