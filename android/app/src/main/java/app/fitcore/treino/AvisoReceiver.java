package app.fitcore.treino;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * Aviso do fim do descanso quando o FitCore não está na frente (outro aplicativo aberto ou tela apagada).
 * O horário é agendado pelo AparelhoPlugin no alarme do Android; aqui só vibra e toca um bipe curto.
 * Não abre tela, não mostra notificação e não usa rede.
 */
public class AvisoReceiver extends BroadcastReceiver {

    static final String ACAO = "app.fitcore.treino.AVISO_DESCANSO";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACAO.equals(intent.getAction())) {
            return;
        }
        // Com o app na frente, a própria tela do treino já vibra e apita: não repete.
        if (AparelhoPlugin.naFrente) {
            return;
        }
        if (intent.getBooleanExtra("vibrar", true)) {
            vibrar(context);
        }
        if (intent.getBooleanExtra("som", true)) {
            bipe();
        }
    }

    private void vibrar(Context context) {
        try {
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vm != null ? vm.getDefaultVibrator() : null;
            } else {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator == null || !vibrator.hasVibrator()) {
                return;
            }
            long[] ritmo = {0, 250, 150, 250, 150, 400};
            // Uso "alarme": é o tipo de vibração que o Android permite a um aplicativo em segundo plano.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                vibrator.vibrate(VibrationEffect.createWaveform(ritmo, -1),
                        VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM));
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(ritmo, -1),
                        new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
            } else {
                vibrator.vibrate(ritmo, -1);
            }
        } catch (Exception ignored) {
            // sem vibração disponível
        }
    }

    private void bipe() {
        try {
            final ToneGenerator tom = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80);
            tom.startTone(ToneGenerator.TONE_PROP_BEEP2, 500);
            final PendingResult pendente = goAsync();
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    tom.release();
                } catch (Exception ignored) {
                    // já liberado
                }
                pendente.finish();
            }, 900);
        } catch (Exception ignored) {
            // sem áudio disponível
        }
    }
}
