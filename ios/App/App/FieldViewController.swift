import Capacitor

class FieldViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FieldDevicePlugin())
    }
}
