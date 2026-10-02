import Foundation
import Capacitor
import CryptoKit
import SQLite3
import Security
import UIKit

// FIELD private files never live in WebView cache or UserDefaults. SQLite stores
// metadata/content hashes, files store audio, Keychain stores only the session.
@objc(FieldDevicePlugin)
public class FieldDevicePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FieldDevicePlugin"
    public let jsName = "FieldDevice"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openTelegram", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listSounds", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadSound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveSound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeSound", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sessionRead", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sessionWrite", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sessionRemove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareWav", returnType: CAPPluginReturnPromise)
    ]
    private let queue = DispatchQueue(label: "lab.tunetots.field.storage")
    private lazy var library: FieldLibrary = {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return FieldLibrary(root: base.appendingPathComponent("FIELD", isDirectory: true))
    }()
    private var exportCall: CAPPluginCall?
    private var exportURL: URL?
    private enum Failure: Error { case invalid, storage, keychain, presentation }
    private var service: String { (Bundle.main.bundleIdentifier ?? "lab.tunetots.field") + ".session" }
    private func command(_ call: CAPPluginCall, _ work: @escaping () throws -> JSObject) {
        queue.async { do { call.resolve(try work()) } catch { call.reject("FIELD device operation failed", "NATIVE_STORAGE") } }
    }
    @objc public func openTelegram(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), value.range(of: "^https://t[.]me/field_sound_bot[?]start=field_ios_[a-f0-9]{32}$", options: .regularExpression) != nil, let url = URL(string: value) else { call.reject("Invalid login URL"); return }
        DispatchQueue.main.async { UIApplication.shared.open(url, options: [:]) { opened in
            if opened { call.resolve() } else { call.reject("Cannot open Telegram") }
        } }
    }
    @objc public func listSounds(_ call: CAPPluginCall) {
        command(call) { ["ids": try self.library.ids()] }
    }
    @objc public func loadSound(_ call: CAPPluginCall) {
        command(call) {
            guard let id = call.getString("id") else { throw Failure.invalid }
            let row = try self.library.load(id)
            var result: JSObject = ["metadata": row.metadata, "renderBase64": row.render.base64EncodedString()]
            if let original = row.original { result["originalBase64"] = original.base64EncodedString() }
            return result
        }
    }
    @objc public func saveSound(_ call: CAPPluginCall) {
        command(call) {
            guard let id = call.getString("id"), let metadata = call.getString("metadata"),
                  let encoded = call.getString("renderBase64"), let render = Data(base64Encoded: encoded) else { throw Failure.invalid }
            let original = try call.getString("originalBase64").map { value -> Data in
                guard let data = Data(base64Encoded: value) else { throw Failure.invalid }; return data
            }
            try self.library.save(id: id, metadata: metadata, render: render, original: original)
            return [:]
        }
    }
    @objc public func removeSound(_ call: CAPPluginCall) {
        command(call) { guard let id = call.getString("id") else { throw Failure.invalid }; try self.library.remove(id); return [:] }
    }
    private func keyQuery() -> [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "account"] }
    @objc public func sessionRead(_ call: CAPPluginCall) {
        command(call) {
            var query = self.keyQuery(); query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
            var result: CFTypeRef?; let status = SecItemCopyMatching(query as CFDictionary, &result)
            if status == errSecItemNotFound { return [:] }
            guard status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) else { throw Failure.keychain }
            return ["value": value]
        }
    }
    @objc public func sessionWrite(_ call: CAPPluginCall) {
        command(call) {
            guard let value = call.getString("value"), value.utf8.count <= 4096 else { throw Failure.invalid }
            let data = Data(value.utf8)
            let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
            let status = SecItemUpdate(self.keyQuery() as CFDictionary, attributes as CFDictionary)
            if status == errSecItemNotFound { var item = self.keyQuery(); attributes.forEach { item[$0.key] = $0.value }; guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw Failure.keychain } }
            else if status != errSecSuccess { throw Failure.keychain }
            return [:]
        }
    }
    @objc public func sessionRemove(_ call: CAPPluginCall) {
        command(call) { let status = SecItemDelete(self.keyQuery() as CFDictionary); guard status == errSecSuccess || status == errSecItemNotFound else { throw Failure.keychain }; return [:] }
    }
    @objc public func shareWav(_ call: CAPPluginCall) {
        guard let encoded = call.getString("base64"), let bytes = Data(base64Encoded: encoded), !bytes.isEmpty, bytes.count <= 64_000_000,
              let name = call.getString("name"), name.hasSuffix(".wav"), name.utf8.count <= 240, !name.contains("/"), !name.contains("\\"),
              let action = call.getString("action"), ["export", "share"].contains(action) else { call.reject("Invalid WAV", "NATIVE_FILE"); return }
        DispatchQueue.main.async {
            guard self.exportCall == nil, let viewController = self.bridge?.viewController, viewController.presentedViewController == nil else { call.reject("File action already open", "NATIVE_FILE"); return }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let url = directory.appendingPathComponent(name)
                try bytes.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                self.exportCall = call; self.exportURL = url
                if action == "export" {
                    let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
                    picker.delegate = self; viewController.present(picker, animated: true)
                } else {
                    let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                    share.popoverPresentationController?.sourceView = viewController.view
                    share.popoverPresentationController?.sourceRect = CGRect(x: viewController.view.bounds.midX, y: viewController.view.bounds.midY, width: 1, height: 1)
                    share.completionWithItemsHandler = { _, completed, _, _ in self.completeExport(cancelled: !completed) }
                    viewController.present(share, animated: true)
                }
            } catch { self.exportCall = nil; self.exportURL = nil; call.reject("Cannot prepare WAV", "NATIVE_FILE") }
        }
    }
    private func completeExport(cancelled: Bool) {
        exportCall?.resolve(["cancelled": cancelled]); exportCall = nil
        if let url = exportURL { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }; exportURL = nil
    }
    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { completeExport(cancelled: true) }
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { completeExport(cancelled: urls.isEmpty) }
}
