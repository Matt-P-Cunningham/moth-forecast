package com.mothforecast.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    private int lastNavPx = -1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Re-inject whenever the layout changes (covers first load, orientation, multi-window)
        getWindow().getDecorView().getViewTreeObserver().addOnGlobalLayoutListener(() -> {
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
            if (insets == null) return;
            int navPx = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            if (navPx == lastNavPx) return; // skip if unchanged
            lastNavPx = navPx;
            postNavBarHeight(navPx);
        });

        // Also inject after each page commit so the CSS var is set before user sees content
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                if (lastNavPx >= 0) postNavBarHeight(lastNavPx);
            }
        });
    }

    private void postNavBarHeight(int navPx) {
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv == null) return;
        String js = "window.androidNavBarHeight=" + navPx + ";" +
                    "document.documentElement.style.setProperty('--nav-bar-height','" + navPx + "px');";
        wv.post(() -> wv.evaluateJavascript(js, null));
    }

    @Override
    public void onBackPressed() {
        if (!getBridge().getWebView().canGoBack()) {
            getBridge().triggerWindowJSEvent("backButton", "{}");
        } else {
            super.onBackPressed();
        }
    }
}
