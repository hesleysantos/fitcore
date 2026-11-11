package app.fitcore.treino;

import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.WindowManager;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Recursos do aparelho usados pelo app:
 * - manter a tela ligada durante o treino;
 * - vibrar ao fim do descanso;
 * - compartilhar o arquivo de backup que o próprio usuário pediu para criar.
 * O plugin não lê nenhum arquivo e só escreve dentro da pasta "backup" do cache do app.
 */
@CapacitorPlugin(name = "Aparelho")
public class AparelhoPlugin extends Plugin {

    private static final int MAX_BACKUP = 24 * 1024 * 1024;

    @PluginMethod
    public void telaLigada(PluginCall call) {
        final boolean ligada = Boolean.TRUE.equals(call.getBoolean("ligada", false));
        getActivity().runOnUiThread(() -> {
            if (ligada) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void vibrar(PluginCall call) {
        Integer pedido = call.getInt("ms", 300);
        long ms = Math.max(20, Math.min(1000, pedido == null ? 300 : pedido));
        try {
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(ms);
                }
            }
        } catch (Exception ignored) {
            // sem vibração disponível: o aviso sonoro e visual continua funcionando
        }
        call.resolve();
    }

    private File pastaBackup() {
        return new File(getContext().getCacheDir(), "backup");
    }

    private void apagarBackups() {
        File dir = pastaBackup();
        File[] arquivos = dir.listFiles();
        if (arquivos != null) {
            for (File f : arquivos) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    /** Grava o backup na pasta de cache do app e abre a tela de compartilhamento do Android. */
    @PluginMethod
    public void compartilharBackup(PluginCall call) {
        String texto = call.getString("texto");
        String nome = call.getString("nome", "fitcore-backup.json");
        if (texto == null || texto.isEmpty() || texto.length() > MAX_BACKUP) {
            call.reject("Backup vazio ou grande demais");
            return;
        }
        // o nome do arquivo nunca pode apontar para fora da pasta de backup
        if (nome == null || !nome.matches("^fitcore-backup-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.json$")) {
            nome = "fitcore-backup.json";
        }
        try {
            File dir = pastaBackup();
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("Não foi possível criar a pasta do backup");
                return;
            }
            apagarBackups();
            File arquivo = new File(dir, nome);
            try (FileOutputStream out = new FileOutputStream(arquivo)) {
                out.write(texto.getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", arquivo);
            Intent envio = new Intent(Intent.ACTION_SEND);
            envio.setType("application/json");
            envio.putExtra(Intent.EXTRA_STREAM, uri);
            envio.putExtra(Intent.EXTRA_SUBJECT, "Backup do FitCore");
            // dá ao aplicativo escolhido permissão de leitura só para este arquivo
            envio.setClipData(ClipData.newRawUri("Backup do FitCore", uri));
            envio.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent seletor = Intent.createChooser(envio, "Salvar backup em…");
            seletor.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(seletor);
            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível compartilhar o backup");
        }
    }

    /** Apaga as cópias temporárias de backup guardadas no cache do app. */
    @PluginMethod
    public void limparBackups(PluginCall call) {
        try {
            apagarBackups();
        } catch (Exception ignored) {
            // nada a apagar
        }
        call.resolve();
    }
}
