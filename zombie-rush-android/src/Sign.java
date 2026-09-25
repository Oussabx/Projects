import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** Signs an APK (v2 scheme; minSdk 24+ only needs v2) with a key from a PKCS12 keystore. */
public class Sign {
    public static void main(String[] a) throws Exception {
        String in = a[0], out = a[1], ksPath = a[2], alias = a[3];
        char[] pass = a[4].toCharArray();
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream f = new FileInputStream(ksPath)) { ks.load(f, pass); }
        PrivateKey key = (PrivateKey) ks.getKey(alias, pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(alias);
        ApkSigner.SignerConfig sc = new ApkSigner.SignerConfig.Builder("CERT", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(sc))
            .setInputApk(new File(in)).setOutputApk(new File(out))
            .setV1SigningEnabled(false).setV2SigningEnabled(true)
            .build().sign();
    }
}
