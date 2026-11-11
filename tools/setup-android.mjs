// Aplica ao projeto Android (pasta android/) os ajustes de segurança, aparência e assinatura.
// Rode uma vez depois de "npx cap add android":  node tools/setup-android.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = path.join(ROOT, 'android');
const res = path.join(A, 'app/src/main/res');
const w = (rel, text) => { const p = path.join(A, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); console.log('escrito', rel); };

// 1. Rede: nenhuma conexão sem criptografia
w('app/src/main/res/xml/network_security_config.xml', `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`);

// 2. Backup: nada é copiado para a nuvem nem transferido entre aparelhos automaticamente
w('app/src/main/res/xml/data_extraction_rules.xml', `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" />
        <exclude domain="file" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" />
        <exclude domain="file" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </device-transfer>
</data-extraction-rules>
`);

// 3. Compartilhamento de arquivos: só a pasta de cache (onde fica o backup pedido pelo usuário)
w('app/src/main/res/xml/file_paths.xml', `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <cache-path name="backup" path="backup/" />
</paths>
`);

// 4. Aparência: tela de abertura escura com o ícone do app (remove as imagens padrão do Capacitor)
w('app/src/main/res/values/styles.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:windowBackground">@color/fundo</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">@color/fundo</item>
        <item name="android:statusBarColor">@color/fundo</item>
        <item name="android:navigationBarColor">@color/fundo</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar" tools:targetApi="27">false</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/fundo</item>
        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`);
w('app/src/main/res/values/colors.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0E1116</color>
    <color name="colorPrimaryDark">#0E1116</color>
    <color name="colorAccent">#FF6B2C</color>
    <color name="fundo">#0E1116</color>
</resources>
`);
w('app/src/main/res/values/ic_launcher_background.xml', `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0E1116</color>
</resources>
`);
for (const d of fs.readdirSync(res)) {
  if (!d.startsWith('drawable')) continue;
  const f = path.join(res, d, 'splash.png');
  if (fs.existsSync(f)) fs.rmSync(f);
  const dir = path.join(res, d);
  if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
}
for (const f of ['drawable-v24/ic_launcher_foreground.xml', 'drawable/ic_launcher_background.xml']) {
  const p = path.join(res, f);
  if (fs.existsSync(p)) fs.rmSync(p);
}
for (const d of fs.readdirSync(res)) { const dir = path.join(res, d); if (d.startsWith('drawable') && !fs.readdirSync(dir).length) fs.rmdirSync(dir); }

// 5. Versão e assinatura do APK de lançamento
const gradle = path.join(A, 'app/build.gradle');
let g = fs.readFileSync(gradle, 'utf8');
if (!g.includes('keystore.properties')) {
  g = g.replace("apply plugin: 'com.android.application'\n", `apply plugin: 'com.android.application'

// A chave de assinatura fica fora do controle de versão (android/keystore.properties).
def keystoreProps = new Properties()
def keystoreFile = rootProject.file('keystore.properties')
if (keystoreFile.exists()) { keystoreFile.withInputStream { keystoreProps.load(it) } }
`);
  g = g.replace('versionName "1.0"', 'versionName "1.0.0"');
  g = g.replace('    buildTypes {\n        release {\n            minifyEnabled false', `    signingConfigs {
        release {
            if (keystoreFile.exists()) {
                storeFile rootProject.file(keystoreProps['storeFile'])
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            if (keystoreFile.exists()) { signingConfig signingConfigs.release }
            debuggable false
            minifyEnabled false`);
  fs.writeFileSync(gradle, g);
  console.log('atualizado app/build.gradle');
}

// 5b. Remove o que não é usado (serviços do Google) do build
const top = path.join(A, 'build.gradle');
let tg = fs.readFileSync(top, 'utf8');
tg = tg.split('\n').filter((linha) => !linha.includes('com.google.gms:google-services')).join('\n');
fs.writeFileSync(top, tg);
let ag = fs.readFileSync(gradle, 'utf8');
const gi0 = ag.indexOf('try {\n    def servicesJSON');
if (gi0 > 0) { ag = ag.slice(0, gi0).trimEnd() + '\n'; fs.writeFileSync(gradle, ag); }

// 6. Arquivos que nunca devem ir para o controle de versão
const gi = path.join(A, '.gitignore');
let t = fs.readFileSync(gi, 'utf8');
if (!t.includes('keystore.properties')) { t += '\n# Chave de assinatura (NUNCA publicar)\nkeystore.properties\n*.jks\n*.keystore\n'; fs.writeFileSync(gi, t); }
console.log('Projeto Android configurado.');
