import Capacitor
import WebKit

class FieldViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FieldDevicePlugin())
        #if DEBUG
        // Opt-in CI smoke test on a fresh Simulator installation only. This
        // exercises the real WKWebView -> Capacitor -> Swift/SQLite file bridge.
        if ProcessInfo.processInfo.arguments.contains("--field-ci-smoke") {
            smokeAttempt(0)
        }
        #endif
    }
    #if DEBUG
    private func smokeAttempt(_ attempt: Int) {
        let script = """
        (async () => {
          if (!document.querySelector('#root')?.children.length || !window.Capacitor?.isNativePlatform()) return false;
          const p = window.Capacitor.Plugins.FieldDevice;
          if (!p) throw Error('Missing native FieldDevice plugin');
          const id = 'field-ci-smoke';
          const metadata = JSON.stringify({record: {id, title:'CI smoke', unknown:{keep:true}},renderType:'audio/wav',originalType:'audio/mp4'});
          await p.saveSound({id,metadata,renderBase64:'AP8EBw==',originalBase64:'CQgA'});
          const row = await p.loadSound({id});
          if(row.metadata !== metadata || row.renderBase64 !== 'AP8EBw==' || row.originalBase64 !== 'CQgA') throw Error('Native bytes differ');
          await p.removeSound({id});
          const list = await p.listSounds();
          if(list.ids.includes(id)) throw Error('Native row not removed');
          await p.sessionWrite({value:'CI Keychain smoke'});
          if((await p.sessionRead()).value !== 'CI Keychain smoke') throw Error('Keychain mismatch');
          await p.sessionRemove();
          return {ok:true, native:true, ui:true, storage:true, keychain:true};
        })().then(result => { window.__fieldSmoke = result; }).catch(error => { window.__fieldSmoke = {ok:false, error:String(error)}; });
        true;
        """
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
            guard let self else { return }
            self.webView?.evaluateJavaScript("window.__fieldSmoke || null") { result, error in
                if let report = result as? [String: Any] {
                    self.smokeReport(report); return
                }
                if attempt >= 45 {
                    self.smokeReport(["ok":false,"error":"Native UI/bridge smoke timed out"]); return
                }
                self.webView?.evaluateJavaScript(script) { _, _ in self.smokeAttempt(attempt + 1) }
            }
        }
    }
    private func smokeReport(_ report: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]) else { return }
        let directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? data.write(to: directory.appendingPathComponent("FIELD-ci-smoke.json"), options: .atomic)
    }
    #endif
}
