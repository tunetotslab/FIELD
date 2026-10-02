import Foundation
import SQLite3

// Executes the app's real Swift storage, using only an isolated temp directory.
@main struct NativeLibraryRegression {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("field-native-test-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let render = Data([0,1,2,3,4]), original = Data([8,7,6])
        let metadata = "{\"record\":{\"id\":\"one\",\"title\":\"Rain\",\"editState\":{\"effect\":\"echo\"},\"unknown\":{\"keep\":true}}}"
        do { let store = FieldLibrary(root: root); try store.save(id: "one", metadata: metadata, render: render, original: original) }
        let reopened = FieldLibrary(root: root), row = try reopened.load("one")
        precondition(row.render == render && row.original == original && row.metadata == metadata)
        let initialIDs = try reopened.ids(); precondition(initialIDs == ["one"])
        // Fail precisely at the SQLite commit after audio was written.
        var handle: OpaquePointer?; precondition(sqlite3_open(root.appendingPathComponent("library.sqlite").path, &handle) == SQLITE_OK)
        precondition(sqlite3_exec(handle,"CREATE TRIGGER reject_update BEFORE UPDATE ON sounds BEGIN SELECT RAISE(ABORT,'simulated commit failure'); END;",nil,nil,nil) == SQLITE_OK)
        do { try reopened.save(id:"one",metadata:metadata,render:Data([99]),original:original); preconditionFailure("Failed update must reject") } catch { }
        let preserved = try reopened.load("one"); precondition(preserved.render == render && preserved.original == original && preserved.metadata == metadata)
        precondition(sqlite3_exec(handle,"DROP TRIGGER reject_update;",nil,nil,nil) == SQLITE_OK); sqlite3_close(handle)
        try reopened.save(id:"two",metadata:"{\"record\":{\"id\":\"two\"}}",render:render,original:original)
        try reopened.remove("one"); let remaining = try reopened.load("two"); precondition(remaining.render == render)
        do { try reopened.save(id:"../escape",metadata:metadata,render:render,original:nil); preconditionFailure("Unsafe paths must reject") } catch { }
        try reopened.remove("two"); let finalIDs = try reopened.ids(); precondition(finalIDs.isEmpty)
        print("PASS real Swift SQLite/file save, reopen, original/render/metadata integrity, aborted commit keeps old row, shared-file deletion isolation and path safety")
    }
}
