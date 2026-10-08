import Foundation
import CryptoKit
import SQLite3

/// Audio files are content addressed; the SQLite commit is the only point that
/// changes a Library entry. Orphan files after failed writes are never used as rows.
final class FieldLibrary {
    enum Failure: Error { case invalid, storage, integrity }
    let root: URL
    private var database: OpaquePointer?
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    init(root: URL) { self.root = root }
    deinit { if let database { sqlite3_close(database) } }
    private func directory() throws {
        #if os(iOS)
        let attributes: [FileAttributeKey: Any] = [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        #else
        let attributes: [FileAttributeKey: Any] = [:]
        #endif
        try FileManager.default.createDirectory(at: root.appendingPathComponent("audio"), withIntermediateDirectories: true, attributes: attributes)
    }
    private func db() throws -> OpaquePointer {
        if let database { return database }
        try directory()
        let url = root.appendingPathComponent("library.sqlite")
        var handle: OpaquePointer?
        guard sqlite3_open_v2(url.path, &handle, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK, let handle else { throw Failure.storage }
        guard sqlite3_exec(handle, "PRAGMA synchronous=FULL; PRAGMA journal_mode=DELETE; CREATE TABLE IF NOT EXISTS sounds(id TEXT PRIMARY KEY,metadata TEXT NOT NULL,render_hash TEXT NOT NULL,original_hash TEXT);", nil, nil, nil) == SQLITE_OK else { sqlite3_close(handle); throw Failure.storage }
        #if os(iOS)
        do { try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path) }
        catch { sqlite3_close(handle); throw error }
        #endif
        database = handle; return handle
    }
    private func stmt(_ sql: String) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(try db(), sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw Failure.storage }
        return statement
    }
    private func bind(_ statement: OpaquePointer, _ index: Int32, _ value: String?) {
        if let value { sqlite3_bind_text(statement, index, value, -1, transient) }
        else { sqlite3_bind_null(statement, index) }
    }
    private func text(_ statement: OpaquePointer, _ index: Int32) throws -> String {
        guard let value = sqlite3_column_text(statement, index) else { throw Failure.storage }
        return String(cString: value)
    }
    private func put(_ bytes: Data) throws -> String {
        guard !bytes.isEmpty, bytes.count <= 64_000_000 else { throw Failure.invalid }
        try directory()
        let hash = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined(), url = root.appendingPathComponent("audio/\(hash)")
        if FileManager.default.fileExists(atPath: url.path) { guard try Data(contentsOf: url) == bytes else { throw Failure.integrity } }
        else {
            #if os(iOS)
            try bytes.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            #else
            try bytes.write(to: url, options: .atomic)
            #endif
        }
        return hash
    }
    private func read(_ hash: String) throws -> Data {
        guard hash.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw Failure.integrity }
        let bytes = try Data(contentsOf: root.appendingPathComponent("audio/\(hash)"))
        guard SHA256.hash(data: bytes).map({ String(format: "%02x", $0) }).joined() == hash else { throw Failure.integrity }
        return bytes
    }
    private func validate(_ id: String) throws { guard id.range(of: "^[A-Za-z0-9_-]{1,100}$", options: .regularExpression) != nil else { throw Failure.invalid } }
    func ids() throws -> [String] {
        let statement = try stmt("SELECT id FROM sounds ORDER BY id"); defer { sqlite3_finalize(statement) }
        var ids: [String] = []; var status = sqlite3_step(statement)
        while status == SQLITE_ROW { ids.append(try text(statement, 0)); status = sqlite3_step(statement) }
        guard status == SQLITE_DONE else { throw Failure.storage }; return ids
    }
    func load(_ id: String) throws -> (metadata: String, render: Data, original: Data?) {
        try validate(id)
        let statement = try stmt("SELECT metadata,render_hash,original_hash FROM sounds WHERE id=?"); defer { sqlite3_finalize(statement) }; bind(statement, 1, id)
        guard sqlite3_step(statement) == SQLITE_ROW else { throw Failure.storage }
        let original = sqlite3_column_type(statement, 2) == SQLITE_NULL ? nil : try read(text(statement, 2))
        return (try text(statement, 0), try read(text(statement, 1)), original)
    }
    func save(id: String, metadata: String, render: Data, original: Data?) throws {
        try validate(id)
        guard metadata.utf8.count <= 1_000_000,
              let json = try JSONSerialization.jsonObject(with: Data(metadata.utf8)) as? [String: Any],
              let record = json["record"] as? [String: Any], record["id"] as? String == id else { throw Failure.invalid }
        let renderHash = try put(render), originalHash = try original.map { try put($0) }
        let statement = try stmt("INSERT INTO sounds(id,metadata,render_hash,original_hash) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata,render_hash=excluded.render_hash,original_hash=excluded.original_hash"); defer { sqlite3_finalize(statement) }
        bind(statement, 1, id); bind(statement, 2, metadata); bind(statement, 3, renderHash); bind(statement, 4, originalHash)
        guard sqlite3_step(statement) == SQLITE_DONE else { throw Failure.storage }
    }
    func remove(_ id: String) throws {
        try validate(id)
        let hashes = try stmt("SELECT render_hash,original_hash FROM sounds WHERE id=?"); bind(hashes, 1, id)
        var candidates: Set<String> = []
        if sqlite3_step(hashes) == SQLITE_ROW { candidates.insert(try text(hashes, 0)); if sqlite3_column_type(hashes, 1) != SQLITE_NULL { candidates.insert(try text(hashes, 1)) } }; sqlite3_finalize(hashes)
        let statement = try stmt("DELETE FROM sounds WHERE id=?"); defer { sqlite3_finalize(statement) }; bind(statement, 1, id)
        guard sqlite3_step(statement) == SQLITE_DONE else { throw Failure.storage }
        for hash in candidates {
            let references = try stmt("SELECT COUNT(*) FROM sounds WHERE render_hash=? OR original_hash=?"); bind(references, 1, hash); bind(references, 2, hash)
            let status = sqlite3_step(references), count = sqlite3_column_int(references, 0); sqlite3_finalize(references)
            if status == SQLITE_ROW && count == 0 { try FileManager.default.removeItem(at: root.appendingPathComponent("audio/\(hash)")) }
        }
    }
}
