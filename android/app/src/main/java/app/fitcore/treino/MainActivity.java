package app.fitcore.treino;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AparelhoPlugin.class);
        super.onCreate(savedInstanceState);
        // Ignora toques quando outra janela está por cima do app (proteção contra sobreposição maliciosa).
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setFilterTouchesWhenObscured(true);
        }
        // Botão/gesto Voltar: volta uma tela dentro do app; na primeira tela, manda o app para segundo plano
        // (sem fechar, para não interromper um treino em andamento).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web != null && web.canGoBack()) {
                    web.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }
}
